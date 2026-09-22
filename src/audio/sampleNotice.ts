import { logError } from "../utils/logger";

let notice = "";
const listeners = new Set<() => void>();
export function reportSampleFallback(reason: unknown) {
  logError("sampleFallback", reason);
  const raw = reason instanceof Error ? reason.message : String(reason);
  const detail = /[가-힣]/.test(raw) ? raw : "네트워크 연결이나 샘플 형식을 확인해 주세요.";
  notice = `샘플을 불러오지 못해 합성음으로 재생합니다. ${detail}`;
  listeners.forEach((listener) => listener());
}
export function clearSampleNotice() {
  notice = "";
  listeners.forEach((listener) => listener());
}
export function getSampleNotice() { return notice; }
export function subscribeSampleNotice(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
