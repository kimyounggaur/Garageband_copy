export const BASE_PIXELS_PER_BEAT = 56;
export const PIXELS_PER_BEAT = BASE_PIXELS_PER_BEAT;
export const TRACK_HEIGHT = 72;
export const CLIP_HEIGHT = 44;
export const SNAP_BEAT = 0.25;
export const SNAP_OPTIONS = [0.25, 0.5, 1, 4] as const;
export const MIN_TIMELINE_ZOOM = 0.65;
export const MAX_TIMELINE_ZOOM = 1.8;
export const DEFAULT_PROJECT_BEATS = 32;
export const TICKS_PER_BEAT = 480;

export type RulerTick = {
  beat: number;
  kind: "bar" | "beat";
  label: string;
};

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

export function normalizeCycleRange(startBeat: number, endBeat: number, snap = SNAP_BEAT) {
  const start = snapBeat(Math.min(startBeat, endBeat), snap);
  const rawEnd = snapBeat(Math.max(startBeat, endBeat), snap);
  return {
    start,
    end: Math.max(start + snap, rawEnd)
  };
}

export function formatBarBeatTick(beat: number, timeSignature: [number, number] = [4, 4]) {
  const beatsPerBar = Math.max(1, Math.round(timeSignature[0] || 4));
  const safeBeat = Math.max(0, beat);
  const bar = Math.floor(safeBeat / beatsPerBar) + 1;
  const beatInBar = Math.floor(safeBeat % beatsPerBar) + 1;
  const tick = Math.round((safeBeat - Math.floor(safeBeat)) * TICKS_PER_BEAT);
  return `${String(bar).padStart(3, "0")}|${beatInBar}|${String(tick).padStart(3, "0")}`;
}

export function buildRulerTicks(totalBeats: number, timeSignature: [number, number] = [4, 4]): RulerTick[] {
  const beatsPerBar = Math.max(1, Math.round(timeSignature[0] || 4));
  const beatCount = Math.max(0, Math.ceil(totalBeats));
  return Array.from({ length: beatCount }, (_, beat) => {
    const isBar = beat % beatsPerBar === 0;
    return {
      beat,
      kind: isBar ? "bar" : "beat",
      label: isBar ? String(Math.floor(beat / beatsPerBar) + 1) : ""
    };
  });
}

export function clipTypeRegionColor(type: string) {
  if (type === "midi") return "#5ec26b";
  if (type === "audio") return "#46a7e0";
  if (type === "drummer") return "#e0b341";
  if (type === "loop") return "#7d8cff";
  return "#8b98a8";
}

export function formatBeat(beat: number) {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  return `${bar}.${beatInBar}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
