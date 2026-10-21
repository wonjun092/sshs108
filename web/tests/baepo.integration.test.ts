import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { User } from "../src/models/User";
import { HtmlDeployment } from "../src/models/HtmlDeployment";
import { Attachment } from "../src/models/Attachment";

test("baepo production server: real MongoDB races, authorization and browser sandbox", { timeout: 240_000 }, async t => {
  const mongo = await MongoMemoryServer.create();
  const secret = randomBytes(40).toString("hex");
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const origin = `http://localhost:${port}`;
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
    env: { ...process.env, MONGODB_URI: mongo.getUri(), AUTH_SECRET: secret },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let logs = "";
  app.stdout.on("data", chunk => { logs += chunk; });
  app.stderr.on("data", chunk => { logs += chunk; });
  t.after(async () => { app.kill(); await mongoose.disconnect(); await mongo.stop(); });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${origin}/login`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, logs);
  await mongoose.connect(mongo.getUri());
  const users = await User.create([
    { loginId: "owner", name: "Owner", passwordHash: "unused", role: "student", status: "active" },
    { loginId: "other", name: "Other", passwordHash: "unused", role: "student", status: "active" },
    { loginId: "admin", name: "Admin", passwordHash: "unused", role: "admin", status: "active" },
    { loginId: "pending", name: "Pending", passwordHash: "unused", role: "student", status: "pending" },
  ]);
  const tokens = await Promise.all(users.map(user => new SignJWT({ userId: String(user._id), loginId: user.loginId, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(secret))));
  const headers = (who = 0) => ({ origin, cookie: `sshs108_session=${tokens[who]}` });
  const html = "<!doctype html><html><body><h1>테스트 페이지</h1><script>document.body.dataset.ran='yes'</script></body></html>";
  const file = (slug: string, source = html, name = "example.html") => {
    const form = new FormData(); form.set("slug", slug); form.set("file", new File([source], name)); return form;
  };
  const post = (slug: string, who = 0, source = html, name = "example.html") => fetch(`${origin}/api/baepo`, {
    method: "POST", headers: headers(who), body: file(slug, source, name),
  });
  const list = async (who = 0) => (await (await fetch(`${origin}/api/baepo`, { headers: headers(who) })).json()).entries;

  await t.test("authentication, approval, CSRF, reserved paths and file validation", async () => {
    assert.equal((await fetch(`${origin}/api/baepo`)).status, 401);
    assert.equal((await fetch(`${origin}/api/baepo`, { method: "POST", headers: { origin }, body: file("no-login") })).status, 401);
    assert.equal((await post("pending", 3)).status, 403);
    for (const badOrigin of ["null", "https://evil.test", ""]) assert.equal((await fetch(`${origin}/api/baepo`, {
      method: "POST", headers: { ...headers(), origin: badOrigin }, body: file("csrf"),
    })).status, 403);
    for (const slug of ["notice", "baepo", "api", "legacy", "legacy-uploads"]) assert.equal((await post(slug)).status, 409);
    for (const slug of ["Example", "a/b", "%61pi", "a".repeat(49)]) assert.equal((await post(slug)).status, 400);
    assert.equal((await post("bad-extension", 0, html, "x.svg")).status, 400);
    assert.equal((await post("empty", 0, "")).status, 400);
    assert.equal((await post("huge", 0, "<html>" + "x".repeat(1024 * 1024))).status, 413);
  });

  await t.test("concurrent registration has exactly one winner and stores one full document", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => post("race")));
    assert.equal(results.filter(r => r.status === 201).length, 1);
    assert.equal(results.filter(r => r.status === 409).length, 11);
    assert.equal(await HtmlDeployment.countDocuments({ _id: "race" }), 1);
    assert.equal((await HtmlDeployment.findById("race").select("+html"))?.html, html);
  });

  await t.test("legacy attachment URLs cannot bypass HTML isolation; raster previews remain inline", async () => {
    for (const contentType of ["text/html", "image/svg+xml", "image/png"]) {
      const attachment = await Attachment.create({ filename: "attachment.html", contentType, size: html.length,
        data: Buffer.from(html), uploadedBy: users[0]._id });
      const response = await fetch(`${origin}/api/uploads/${attachment._id}`, { headers: headers() });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-disposition")!, contentType === "image/png" ? /^inline;/ : /^attachment;/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(response.headers.get("content-security-policy")!, /^sandbox;/);
      assert.equal(response.headers.get("content-type"), contentType === "image/png" ? "image/png" : "application/octet-stream");
    }
  });

  await t.test("owner/admin authorization, atomic edits, stale delete and account revocation", async () => {
    const entry = (await list())[0];
    assert.equal((await list(1)).length, 0);
    assert.equal((await list(2)).length, 1);
    for (const method of ["PUT", "DELETE"]) assert.equal((await fetch(`${origin}/api/baepo/race`, {
      method, headers: { ...headers(1), "if-match": entry.revision }, ...(method === "PUT" ? { body: file("race") } : {}),
    })).status, 404);
    const updates = await Promise.all([0, 1].map(() => fetch(`${origin}/api/baepo/race`, {
      method: "PUT", headers: { ...headers(), "if-match": entry.revision }, body: file("race", "<html>updated</html>"),
    })));
    assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
    assert.equal((await fetch(`${origin}/api/baepo/race`, { method: "DELETE", headers: { ...headers(), "if-match": entry.revision } })).status, 409);
    await User.updateOne({ _id: users[0]._id }, { $set: { status: "rejected" } });
    assert.equal((await post("revoked")).status, 403);
    await User.updateOne({ _id: users[0]._id }, { $set: { status: "active" } });
    await User.updateOne({ _id: users[2]._id }, { $set: { role: "student" } });
    assert.equal((await list(2)).length, 0);
    await User.updateOne({ _id: users[2]._id }, { $set: { role: "admin" } });
    const current = (await list())[0];
    assert.equal((await fetch(`${origin}/api/baepo/race`, { method: "DELETE", headers: { ...headers(2), "if-match": current.revision } })).status, 200);
    assert.equal((await fetch(`${origin}/race`)).status, 404);
    assert.equal((await fetch(`${origin}/api/baepo/race/content`)).status, 404);
    assert.equal((await post("race")).status, 201);
    assert.equal((await fetch(`${origin}/api/baepo/race`, { method: "DELETE", headers: { ...headers(), "if-match": current.revision } })).status, 409);
  });

  await t.test("public content executes inline JS but cannot escape sandbox or access session/storage/network", async () => {
    const hostile = `<!doctype html><html><body><h1>격리 테스트</h1><script>
      const result = { ran: true };
      for (const [name, fn] of Object.entries({ parent: () => parent.document.body, cookie: () => document.cookie, storage: () => localStorage.length })) {
        try { fn(); result[name] = 'allowed'; } catch { result[name] = 'blocked'; }
      }
      result.popup = window.open('about:blank') === null ? 'blocked' : 'allowed';
      if (top !== self) { try { top.location.href = '/login?escape'; result.navigation = 'allowed'; } catch { result.navigation = 'blocked'; } }
      fetch('/api/baepo').then(() => result.network = 'allowed').catch(() => result.network = 'blocked').finally(() => document.body.dataset.result = JSON.stringify(result));
      </script><script src="/api/baepo?external-script"></script><img src="/api/baepo?external-image"></body></html>`;
    assert.equal((await post("sandbox-test", 0, hostile)).status, 201);
    const content = await fetch(`${origin}/api/baepo/sandbox-test/content`);
    assert.match(content.headers.get("content-security-policy")!, /sandbox allow-scripts/);
    assert.equal(content.headers.get("cache-control"), "no-store");
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    try {
      const context = await browser.newContext();
      await context.addCookies([{ name: "sshs108_session", value: tokens[0], url: origin, httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      const responses: string[] = [];
      page.on("response", response => responses.push(response.url()));
      await page.goto(`${origin}/sandbox-test`);
      const frame = page.frameLocator("iframe");
      await expect(frame.locator("body")).toHaveAttribute("data-result", /network/);
      const result = JSON.parse((await frame.locator("body").getAttribute("data-result"))!);
      assert.deepEqual(result, { ran: true, parent: "blocked", cookie: "blocked", storage: "blocked", popup: "blocked", navigation: "blocked", network: "blocked" });
      assert.equal(page.url(), `${origin}/sandbox-test`);
      assert.ok(responses.includes(`${origin}/api/baepo/sandbox-test/content`));
      assert.equal(responses.filter(url => url.startsWith(`${origin}/api/baepo`) && !url.endsWith("/content")).length, 0);
      await page.goto(`${origin}/api/baepo/sandbox-test/content`);
      await expect(page.locator("body")).toHaveAttribute("data-result", /network/);
      const direct = JSON.parse((await page.locator("body").getAttribute("data-result"))!);
      assert.equal(direct.cookie, "blocked"); assert.equal(direct.storage, "blocked"); assert.equal(direct.network, "blocked");
      await page.goto(`${origin}/baepo`);
      await expect(page.getByRole("heading", { name: "HTML 파일로 페이지 만들기" })).toBeVisible();
      await page.getByLabel("페이지 경로", { exact: true }).fill("browser-upload");
      await page.getByLabel("HTML 파일", { exact: true }).setInputFiles({ name: "browser.html", mimeType: "text/html", buffer: Buffer.from(html) });
      await page.getByRole("button", { name: "업로드", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("페이지를 등록했습니다");
      await expect(page.getByRole("link", { name: "/browser-upload ↗" })).toBeVisible();
      await mkdir("test-results", { recursive: true });
      await page.screenshot({ path: "test-results/baepo-desktop.png", fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/baepo-mobile.png", fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const row = page.locator("li").filter({ has: page.getByRole("link", { name: "/browser-upload ↗" }) });
      await row.getByRole("button", { name: "파일 교체", exact: true }).click();
      await page.getByLabel("HTML 파일", { exact: true }).setInputFiles({ name: "replacement.html", mimeType: "text/html", buffer: Buffer.from("<html>replacement</html>") });
      await page.locator("form").getByRole("button", { name: "파일 교체", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("HTML 파일을 교체했습니다");
      await expect(row).toContainText("replacement.html");
      assert.equal(await (await fetch(`${origin}/api/baepo/browser-upload/content`)).text(), "<html>replacement</html>");
      await row.getByRole("button", { name: "삭제", exact: true }).click();
      await row.getByRole("button", { name: "삭제 확인", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("페이지를 삭제했습니다");
      await expect(row).toHaveCount(0);
    } finally { await browser.close(); }
  });
});
