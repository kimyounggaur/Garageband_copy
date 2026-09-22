import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

const dist = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 4191);
const base = "/Garageband_copy/";
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".wav": "audio/wav"
};

createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host}`).pathname;
  if (!pathname.startsWith(base)) {
    response.writeHead(404).end();
    return;
  }
  const name = decodeURIComponent(pathname.slice(base.length)) || "index.html";
  const target = resolve(dist, name);
  const pathFromDist = relative(dist, target);
  if (!pathFromDist || pathFromDist.startsWith("..") || pathFromDist.includes(`..${sep}`)
    || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": mime[extname(target)] ?? "application/octet-stream",
    "Cache-Control": name === "sw.js" || name === "index.html" ? "no-cache" : "public, max-age=3600"
  });
  createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`PWA preview: http://127.0.0.1:${port}${base} → ${dist}`);
});
