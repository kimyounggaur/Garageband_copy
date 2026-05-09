export const PIXELS_PER_BEAT = 56;
export const TRACK_HEIGHT = 72;
export const CLIP_HEIGHT = 44;
export const SNAP_BEAT = 0.25;
export const DEFAULT_PROJECT_BEATS = 32;

export function beatToX(beat: number, pixelsPerBeat = PIXELS_PER_BEAT) {
  return beat * pixelsPerBeat;
}

export function xToBeat(x: number, pixelsPerBeat = PIXELS_PER_BEAT) {
  return x / pixelsPerBeat;
}

export function snapBeat(beat: number, snap = SNAP_BEAT) {
  return Math.max(0, Math.round(beat / snap) * snap);
}

export function formatBeat(beat: number) {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  return `${bar}.${beatInBar}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
