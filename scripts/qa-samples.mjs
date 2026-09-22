import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const root = resolve("public/samples");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const exact = (value, fields, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...fields].sort().join("|")) throw new Error(`${label}: 필드 오류`);
};
const present = (value) => typeof value === "string" && value.trim().length > 0;
const safe = (value) => present(value) && !value.startsWith("/") && !value.includes("\\") && !value.includes("%") && !value.split("/").some((part) => part === ".." || part === ".") && !/^[a-z]+:/i.test(value) && !/[?#]/.test(value);
const https = (value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };
const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const listed = new Set(["manifest.json", "README.md"]);
exact(manifest, ["schemaVersion", "packs"], "manifest");
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.packs) || !manifest.packs.length) throw new Error("매니페스트 버전/팩 오류");
const packIds = new Set();
for (const pack of manifest.packs) {
  exact(pack, ["id", "name", "kind", "baseUrl", "files"], "pack");
  if (!present(pack.id) || packIds.has(pack.id) || !present(pack.name) || !["test-tone", "instrument"].includes(pack.kind) || !safe(pack.baseUrl) || !pack.baseUrl.startsWith("samples/") || !pack.baseUrl.endsWith("/") || !Array.isArray(pack.files) || !pack.files.length) throw new Error("샘플 팩 오류");
  packIds.add(pack.id);
  const ids = new Set();
  for (const file of pack.files) {
    exact(file, ["id", "note", "velocityLayer", "file", "mimeType", "alternates", "gain", "licenseSpdx", "licenseUrl", "author", "sourceUrl", "acquiredAt", "redistributionReview"], "file");
    if (!present(file.id) || ids.has(file.id) || !Number.isInteger(file.note) || file.note < 0 || file.note > 127 || !safe(file.file) || !present(file.mimeType) || !Array.isArray(file.alternates) || !(file.gain > 0 && file.gain <= 2) || !present(file.licenseSpdx) || !https(file.licenseUrl) || !present(file.author) || !https(file.sourceUrl) || !date(file.acquiredAt)) throw new Error(`${pack.id}: 파일 메타데이터 오류`);
    ids.add(file.id);
    exact(file.velocityLayer, ["min", "max"], "velocityLayer");
    if (!(file.velocityLayer.min >= 0 && file.velocityLayer.max <= 1 && file.velocityLayer.min < file.velocityLayer.max)) throw new Error(`${file.id}: velocity 범위 오류`);
    exact(file.redistributionReview, ["status", "reviewedAt", "evidence"], "redistributionReview");
    if (file.redistributionReview.status !== "approved" || !date(file.redistributionReview.reviewedAt) || !present(file.redistributionReview.evidence)) throw new Error(`${file.id}: 재배포 검토 오류`);
    for (const variant of [{ file: file.file, mimeType: file.mimeType }, ...file.alternates]) {
      exact(variant, ["file", "mimeType"], "variant");
      if (!safe(variant.file) || !present(variant.mimeType)) throw new Error(`${file.id}: 형식 오류`);
      const full = resolve(root, pack.baseUrl.slice("samples/".length), variant.file);
      const within = relative(root, full);
      if (within.startsWith("..") || within === "") throw new Error(`${file.id}: 경로 이탈`);
      const data = readFileSync(full);
      if (!data.length) throw new Error(`${file.id}: 빈 파일`);
      listed.add(within.replaceAll("\\", "/"));
      if (variant.mimeType === "audio/wav" && (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WAVE" || data.readUInt32LE(4) + 8 !== data.length || data.readUInt16LE(20) !== 1 || data.readUInt16LE(34) !== 16 || data.readUInt32LE(24) < 8000)) throw new Error(`${file.id}: WAV 헤더 오류`);
    }
  }
  const layers = pack.files.map((file) => file.velocityLayer).sort((left, right) => left.min - right.min);
  let covered = 0;
  for (const layer of layers) {
    if (layer.min > covered + 0.000001) throw new Error(`${pack.id}: velocity 빈 구간`);
    covered = Math.max(covered, layer.max);
  }
  if (covered < 1) throw new Error(`${pack.id}: 재생 범위 부족`);
  const boundaries = [...new Set([0, 1, ...layers.flatMap((layer) => [layer.min, layer.max])])].sort((left, right) => left - right);
  const velocities = [...boundaries, ...boundaries.slice(1).map((edge, index) => (boundaries[index] + edge) / 2)];
  if (velocities.some((velocity) => Array.from({ length: 128 }, (_, pitch) => pitch).some((pitch) =>
    pack.files.every((file) => velocity < file.velocityLayer.min || velocity > file.velocityLayer.max || Math.abs(file.note - pitch) >= 96)
  ))) throw new Error(`${pack.id}: 재생 범위 부족`);
}
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (!listed.has(relative(root, full).replaceAll("\\", "/"))) throw new Error(`매니페스트에 없는 파일: ${name}`);
  }
}
walk(root);
console.log(`Sample QA passed: ${packIds.size} pack(s), ${listed.size - 2} file(s).`);
