import type { SampleFile, SampleManifest, SamplePack } from "../types/samples";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown) => string(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const safePath = (value: unknown) => string(value) && !value.startsWith("/") && !value.includes("\\") && !value.includes("%") && !value.split("/").some((part) => part === ".." || part === ".") && !/^[a-z]+:/i.test(value) && !value.includes("?") && !value.includes("#");
const httpsUrl = (value: unknown) => {
  if (!string(value)) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value);

function exactKeys(value: Record<string, unknown>, expected: string[], where: string) {
  const unexpected = Object.keys(value).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !(key in value));
  if (unexpected.length || missing.length) throw new Error(`${where}: 매니페스트 필드가 올바르지 않습니다 (${[...missing, ...unexpected].join(", ")}).`);
}

function validateFile(value: unknown, packId: string): SampleFile {
  if (!object(value)) throw new Error(`${packId}: 샘플 파일 정보가 올바르지 않습니다.`);
  exactKeys(value, ["id", "note", "velocityLayer", "file", "mimeType", "alternates", "gain", "licenseSpdx", "licenseUrl", "author", "sourceUrl", "acquiredAt", "redistributionReview"], packId);
  if (!string(value.id) || !Number.isInteger(value.note) || (value.note as number) < 0 || (value.note as number) > 127 || !safePath(value.file) || !string(value.mimeType) || !Array.isArray(value.alternates) || !number(value.gain) || (value.gain as number) <= 0 || (value.gain as number) > 2 || !string(value.licenseSpdx) || !httpsUrl(value.licenseUrl) || !string(value.author) || !httpsUrl(value.sourceUrl) || !date(value.acquiredAt)) throw new Error(`${packId}: 필수 샘플·저작권 메타데이터가 올바르지 않습니다.`);
  if (!object(value.velocityLayer)) throw new Error(`${packId}: velocity 범위가 없습니다.`);
  exactKeys(value.velocityLayer, ["min", "max"], packId);
  if (!number(value.velocityLayer.min) || !number(value.velocityLayer.max) || (value.velocityLayer.min as number) < 0 || (value.velocityLayer.max as number) > 1 || (value.velocityLayer.min as number) >= (value.velocityLayer.max as number)) throw new Error(`${packId}: velocity 범위가 올바르지 않습니다.`);
  if (!object(value.redistributionReview)) throw new Error(`${packId}: 재배포 검토 기록이 없습니다.`);
  exactKeys(value.redistributionReview, ["status", "reviewedAt", "evidence"], packId);
  if (value.redistributionReview.status !== "approved" || !date(value.redistributionReview.reviewedAt) || !string(value.redistributionReview.evidence)) throw new Error(`${packId}: 재배포 승인 기록이 올바르지 않습니다.`);
  for (const alternate of value.alternates) {
    if (!object(alternate)) throw new Error(`${packId}: 대체 파일 정보가 올바르지 않습니다.`);
    exactKeys(alternate, ["file", "mimeType"], packId);
    if (!safePath(alternate.file) || !string(alternate.mimeType)) throw new Error(`${packId}: 대체 파일 정보가 올바르지 않습니다.`);
  }
  return value as SampleFile;
}

function validatePack(value: unknown): SamplePack {
  if (!object(value)) throw new Error("샘플 팩 정보가 올바르지 않습니다.");
  exactKeys(value, ["id", "name", "kind", "baseUrl", "files"], "샘플 팩");
  if (!string(value.id) || !string(value.name) || !["test-tone", "instrument"].includes(String(value.kind)) || !safePath(value.baseUrl) || !(value.baseUrl as string).startsWith("samples/") || !(value.baseUrl as string).endsWith("/") || !Array.isArray(value.files) || value.files.length === 0) throw new Error("샘플 팩 필드가 올바르지 않습니다.");
  const files = value.files.map((file) => validateFile(file, value.id as string));
  if (new Set(files.map((file) => file.id)).size !== files.length) throw new Error(`${value.id}: 중복 샘플 ID입니다.`);
  if (new Set(files.map((file) => file.file)).size !== files.length) throw new Error(`${value.id}: 중복 샘플 파일입니다.`);
  const layers = files.map((file) => file.velocityLayer).sort((left, right) => left.min - right.min);
  let covered = 0;
  for (const layer of layers) {
    if (layer.min > covered + 0.000001) throw new Error(`${value.id}: velocity 범위에 빈 구간이 있습니다.`);
    covered = Math.max(covered, layer.max);
  }
  if (covered < 1) throw new Error(`${value.id}: velocity 범위에 빈 구간이 있습니다.`);
  const boundaries = [...new Set([0, 1, ...layers.flatMap((layer) => [layer.min, layer.max])])].sort((left, right) => left - right);
  const velocities = [...boundaries, ...boundaries.slice(1).map((edge, index) => (boundaries[index] + edge) / 2)];
  if (velocities.some((velocity) => Array.from({ length: 128 }, (_, pitch) => pitch).some((pitch) =>
    files.every((file) => velocity < file.velocityLayer.min || velocity > file.velocityLayer.max || Math.abs(file.note - pitch) >= 96)
  ))) throw new Error(`${value.id}: 일부 MIDI 음높이·velocity를 Tone.Sampler로 재생할 수 없습니다.`);
  return value as SamplePack;
}

export function parseSampleManifest(value: unknown): SampleManifest {
  if (!object(value)) throw new Error("샘플 매니페스트가 올바르지 않습니다.");
  exactKeys(value, ["schemaVersion", "packs"], "샘플 매니페스트");
  if (value.schemaVersion !== 1 || !Array.isArray(value.packs) || value.packs.length === 0) throw new Error("지원하지 않는 샘플 매니페스트입니다.");
  const packs = value.packs.map(validatePack);
  if (new Set(packs.map((pack) => pack.id)).size !== packs.length) throw new Error("중복 샘플 팩 ID입니다.");
  return value as SampleManifest;
}
