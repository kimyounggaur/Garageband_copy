const BROKEN_TEXT_PATTERN = /[\u3400-\u9fff\uf900-\ufaff\ufffd]|[?]{2,}|쨌|쀍|占/;

export function hasBrokenKorean(value?: string | null) {
  return typeof value === "string" && BROKEN_TEXT_PATTERN.test(value);
}

export function repairBrokenText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || hasBrokenKorean(trimmed)) return fallback;
  return trimmed;
}
