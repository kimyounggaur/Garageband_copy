import { barPositionAtBeat } from "../../utils/meterMath";

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeValue(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value) || max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

export function denormalizeValue(normalized: number, min = 0, max = 1) {
  return min + clamp01(normalized) * (max - min);
}

export function knobValueToDegrees(value: number, min = 0, max = 1) {
  return Math.round(-135 + normalizeValue(value, min, max) * 270);
}

export function faderValueToPercent(value: number, min = 0, max = 1) {
  return Math.round(normalizeValue(value, min, max) * 100);
}

export function meterLevelToPercent(value: number) {
  return Math.round(clamp01(value) * 100);
}

export function formatLcdBeat(beat: number, timeSignature: [number, number]) {
  const position = barPositionAtBeat(beat, timeSignature);
  return `${String(position.bar).padStart(3, "0")}|${position.beat}|${String(position.tick).padStart(3, "0")}`;
}
