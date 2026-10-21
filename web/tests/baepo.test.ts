import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateReservedRoutes } from "../scripts/baepo-routes";
import { BaepoError, MAX_HTML_BYTES, MAX_UPLOAD_BYTES, requireSameOrigin, validateHtml, validateSlug } from "../src/lib/baepo-policy";
import { readHtmlUpload } from "../src/lib/baepo-server";

test("slug validation rejects reserved, ambiguous, traversal and encoded routes", () => {
  for (const slug of ["baepo", "api", "notice", "legacy", "legacy-uploads", "admin_dashboard", "callback",
    "", "Example", "a/b", "a.b", "-a", "a-", "%61pi", "..", "한글", "a".repeat(49), null, {}]) {
    assert.throws(() => validateSlug(slug), BaepoError);
  }
  for (const slug of ["a", "example", "my-game-123", "a".repeat(48)]) assert.equal(validateSlug(slug), slug);
});

test("reserved paths include future routes, route groups, public assets, metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "baepo-routes-"));
  try {
    for (const dir of ["src/app/(group)/future", "src/app/@slot/help", "src/app/[slug]", "src/lib", "public/assets"])
      mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, "public/download.html"), "");
    writeFileSync(join(root, "src/app/opengraph-image.tsx"), "");
    const routes = generateReservedRoutes(root);
    for (const route of ["future", "help", "assets", "download", "opengraph-image"]) assert.ok(routes.includes(route));
    mkdirSync(join(root, "src/app/[other]"));
    assert.throws(() => generateReservedRoutes(root));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("HTML validation enforces extension, UTF-8, nonempty content and actual byte size", () => {
  const bytes = new TextEncoder().encode("<!doctype html><html>안녕<script>1+1</script></html>");
  assert.match(validateHtml("example.HTML", bytes), /안녕/);
  for (const [name, content] of [["bad.svg", bytes], ["bad.html.exe", bytes], ["../a.html", bytes],
    ["a.html", new Uint8Array()], ["a.html", new Uint8Array([255])],
    ["a.html", new TextEncoder().encode("plain text")], ["a.html", new Uint8Array(MAX_HTML_BYTES + 1)]] as const)
    assert.throws(() => validateHtml(name, content), BaepoError);
});

test("CSRF guard rejects missing, null, foreign and same-site origins", () => {
  for (const origin of ["", "null", "https://evil.test", "https://app.test.evil.test"]) {
    assert.throws(() => requireSameOrigin(new Request("https://app.test/api/baepo", { headers: { origin } })), BaepoError);
  }
  requireSameOrigin(new Request("https://app.test/api/baepo", { headers: { origin: "https://app.test" } }));
  assert.throws(() => requireSameOrigin(new Request("https://app.test/api/baepo", {
    headers: { origin: "https://app.test", "sec-fetch-site": "same-site" },
  })), BaepoError);
});

test("multipart parser handles missing/duplicate files and limits chunked bodies before parsing", async () => {
  const form = new FormData(); form.set("file", new File(["<html>ok</html>"], "a.html"));
  const request = () => new Request("https://app.test/api/baepo", { method: "POST", body: form });
  assert.equal((await readHtmlUpload(request())).filename, "a.html");
  form.append("file", new File(["<html>duplicate</html>"], "b.html"));
  await assert.rejects(readHtmlUpload(request()), { status: 400 });
  form.delete("file");
  await assert.rejects(readHtmlUpload(request()), { status: 400 });
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES + 1)); },
    cancel() { cancelled = true; },
  });
  const chunked = new Request("https://app.test/api/baepo", {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body, duplex: "half",
  } as RequestInit);
  await assert.rejects(readHtmlUpload(chunked), { status: 413 });
  assert.equal(cancelled, true);
});
