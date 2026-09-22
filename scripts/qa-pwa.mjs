import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pwaBuildPlan } from "./generate-pwa.mjs";

const dist = resolve(process.argv[2] ?? "dist");
const plan = pwaBuildPlan(dist);
const html = readFileSync(join(dist, "index.html"), "utf8");
const worker = readFileSync(join(dist, "sw.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));

assert.equal(worker, plan.workerContent, "서비스 워커와 HTML/청크 revision이 맞지 않습니다");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");
assert.match(manifest.name, /[가-힣]/);
assert.match(html, /<html lang="ko">/);
assert.match(html, /name="description"/);
assert.match(html, /name="theme-color"/);
assert.match(html, /property="og:image" content="https:\/\/kimyounggaur\.github\.io\/Garageband_copy\/og\/editor-preview\.png"/);
assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(html, /rel="icon" href="\.\/icons\/mark\.svg"/);
assert(!/src="\/assets\//.test(html) && !/href="\/assets\//.test(html), "하위 경로에서 깨지는 절대 번들 경로가 있습니다");

for (const link of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)) {
  const path = link[1].slice(2);
  assert(existsSync(join(dist, ...path.split("/"))), `HTML 참조 파일이 없습니다: ${path}`);
}
for (const file of plan.shellFiles) {
  assert(!file.startsWith("samples/") || file === "samples/manifest.json", "샘플 오디오를 앱 셸 사전 캐시에 넣으면 안 됩니다");
  const deployedUrl = new URL(file, "https://kimyounggaur.github.io/Garageband_copy/");
  assert(deployedUrl.pathname.startsWith("/Garageband_copy/"), `배포 하위 경로 밖 파일: ${file}`);
}
assert(plan.shellFiles.includes("samples/manifest.json"), "오프라인 재방문에 필요한 샘플 목록이 앱 셸에 없습니다");

function pngSize(path) {
  const buffer = readFileSync(join(dist, path));
  assert.equal(buffer.subarray(1, 4).toString(), "PNG", `${path}: PNG가 아닙니다`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
assert.deepEqual(pngSize("icons/icon-192.png"), [192, 192]);
assert.deepEqual(pngSize("icons/icon-512.png"), [512, 512]);
assert.deepEqual(pngSize("icons/icon-maskable-512.png"), [512, 512]);
assert.deepEqual(pngSize("og/editor-preview.png"), [1600, 840]);
assert(manifest.icons.some((icon) => icon.purpose === "maskable" && icon.src === "./icons/icon-maskable-512.png"));
assert(worker.includes('event.data?.type === "SKIP_WAITING"'), "수동 갱신 핸들러가 없습니다");
assert(!worker.includes("indexedDB"), "서비스 워커가 프로젝트 저장소를 건드리면 안 됩니다");

console.log(`PWA QA 통과: revision ${plan.revision}, 셸 ${plan.shellFiles.length}개, 승인 샘플 ${plan.approvedSampleFiles.length}개, 상대 base/scope 확인`);
