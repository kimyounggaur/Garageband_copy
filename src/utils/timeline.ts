export const BASE_PIXELS_PER_BEAT = 56;
export const PIXELS_PER_BEAT = BASE_PIXELS_PER_BEAT;
export const TRACK_HEIGHT = 72;
export const CLIP_HEIGHT = 44;
export const SNAP_BEAT = 0.25;
export const SNAP_OPTIONS = [0.25, 0.5, 1, 4] as const;
export const MIN_TIMELINE_ZOOM = 0.65;
export const MAX_TIMELINE_ZOOM = 1.8;
export const DEFAULT_PROJECT_BEATS = 32;

export type SnapBeats = (typeof SNAP_OPTIONS)[number];

export function pixelsPerBeatForZoom(zoom: number) {
  return BASE_PIXELS_PER_BEAT * clamp(zoom, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
}

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
