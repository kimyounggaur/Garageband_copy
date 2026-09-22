import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const template = readFileSync(join(root, "scripts", "pwa-sw-template.js"), "utf8");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function approvedSamples() {
  const manifest = JSON.parse(readFileSync(join(root, "public", "samples", "manifest.json"), "utf8"));
  return (manifest.packs ?? []).flatMap((pack) => (pack.files ?? []).flatMap((file) => {
    if (file.redistributionReview?.status !== "approved") return [];
    const path = `${pack.baseUrl ?? ""}${file.file ?? ""}`.replaceAll("\\", "/");
    if (!/^samples\/[a-zA-Z0-9_/-]+\.(?:wav|mp3|ogg|webm)$/.test(path) || path.includes("..")) {
      throw new Error(`승인된 샘플 경로가 안전하지 않습니다: ${path}`);
    }
    return [path];
  }));
}

export function pwaBuildPlan(distDirectory) {
  const dist = resolve(distDirectory);
  const assets = join(dist, "assets");
  if (!existsSync(join(dist, "index.html")) || !existsSync(assets)) {
    throw new Error(`Vite 빌드 결과가 없습니다: ${dist}`);
  }

  const required = [
    "index.html", "manifest.webmanifest", "samples/manifest.json", "icons/mark.svg",
    "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"
  ];
  const chunks = walk(assets)
    .filter((path) => /\.(?:js|css)$/.test(path))
    .map((path) => relative(dist, path).split(sep).join("/"))
    .sort();
  if (!chunks.some((name) => name.endsWith(".js")) || !chunks.some((name) => name.endsWith(".css"))) {
    throw new Error("사전 캐시할 JS/CSS 청크가 없습니다.");
  }
  for (const name of chunks) {
    if (!/-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(name)) throw new Error(`해시 없는 번들 파일: ${name}`);
  }
  const shellFiles = [...required, ...chunks];
  const hash = createHash("sha256").update(template);
  for (const name of shellFiles) {
    const file = join(dist, ...name.split("/"));
    if (!existsSync(file)) throw new Error(`앱 셸 필수 파일이 없습니다: ${name}`);
    hash.update(name).update(readFileSync(file));
  }
  const samples = approvedSamples();
  for (const name of samples) {
    if (!existsSync(join(dist, ...name.split("/")))) throw new Error(`승인된 샘플 파일이 없습니다: ${name}`);
  }
  hash.update(JSON.stringify(samples));
  const revision = hash.digest("hex").slice(0, 16);
  const output = template
    .replace("__SHELL_REVISION__", JSON.stringify(revision))
    .replace("__SHELL_FILES__", JSON.stringify(shellFiles))
    .replace("__APPROVED_SAMPLE_FILES__", JSON.stringify(samples));
  return { revision, shellFiles, approvedSampleFiles: samples, workerContent: output };
}

export function generatePwaWorker(distDirectory) {
  const plan = pwaBuildPlan(distDirectory);
  writeFileSync(join(resolve(distDirectory), "sw.js"), plan.workerContent);
  const { revision, shellFiles, approvedSampleFiles } = plan;
  console.log(`> PWA worker ${revision}: 앱 셸 ${shellFiles.length}개, 승인 샘플 ${approvedSampleFiles.length}개`);
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generatePwaWorker(process.argv[2] ?? join(root, "dist"));
}
