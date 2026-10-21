import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Run from next.config too, so direct `next build` cannot skip route discovery.
export function generateReservedRoutes(root = process.cwd()) {
  const reserved = new Set([
    "api", "baepo", "admin", "login", "logout", "signup", "auth", "static",
    "assets", "uploads", "callback", "approve", "reject", "delete",
    "delete_reservation", "favicon", "robots", "sitemap", "manifest",
  ]);
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && /^(?:robots|sitemap|manifest|icon|apple-icon|opengraph-image|twitter-image)\./.test(entry.name)) {
        reserved.add(entry.name.split(".")[0].toLowerCase());
      }
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      if (entry.name.startsWith("(") || entry.name.startsWith("@")) {
        scan(join(directory, entry.name));
      } else if (entry.name.startsWith("[")) {
        if (entry.name !== "[slug]") throw new Error("Review baepo route conflicts before adding a root dynamic route.");
      } else reserved.add(entry.name.toLowerCase());
    }
  }
  scan(join(root, "src/app"));
  for (const entry of readdirSync(join(root, "public"))) {
    reserved.add(entry.toLowerCase());
    reserved.add(entry.split(".")[0].toLowerCase());
  }
  const routes = [...reserved].sort();
  writeFileSync(join(root, "src/lib/baepo-reserved.json"), JSON.stringify(routes, null, 2) + "\n");
  return routes;
}
