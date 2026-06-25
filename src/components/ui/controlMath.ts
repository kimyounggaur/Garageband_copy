const LCD_TICKS_PER_BEAT = 480;

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
  const beatsPerBar = Math.max(1, timeSignature[0] || 4);
  const safeBeat = Math.max(0, Number.isFinite(beat) ? beat : 0);
  const barIndex = Math.floor(safeBeat / beatsPerBar);
  const beatInBar = safeBeat - barIndex * beatsPerBar;
  const beatIndex = Math.floor(beatInBar);
  const tick = Math.round((beatInBar - beatIndex) * LCD_TICKS_PER_BEAT);
  const measureText = String(barIndex + 1).padStart(3, "0");
  const tickText = String(tick).padStart(3, "0");

  return `${measureText}|${beatIndex + 1}|${tickText}`;
}
