export const BASE_PIXELS_PER_BEAT = 56;
export const PIXELS_PER_BEAT = BASE_PIXELS_PER_BEAT;
export const TRACK_HEIGHT = 72;
export const AUTOMATION_LANE_HEIGHT = 64;
export const CLIP_HEIGHT = 44;
export const SNAP_BEAT = 0.25;
export const SNAP_OPTIONS = [0.25, 0.5, 1, 4, "bar"] as const;
export const MIN_TIMELINE_ZOOM = 0.65;
export const MAX_TIMELINE_ZOOM = 1.8;
export const DEFAULT_PROJECT_BEATS = 32;
export const TICKS_PER_BEAT = 480;

export type RulerTick = {
  beat: number;
  kind: "bar" | "beat";
  label: string;
};

export type SnapOption = (typeof SNAP_OPTIONS)[number];
export type SnapBeats = Exclude<SnapOption, "bar">;

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
  const position = barPositionAtBeat(beat, timeSignature);
  return `${String(position.bar).padStart(3, "0")}|${position.beat}|${String(position.tick).padStart(3, "0")}`;
}

export function buildRulerTicks(totalBeats: number, timeSignature: [number, number] = [4, 4]): RulerTick[] {
  const unit = notatedBeatLength(timeSignature);
  const tickCount = Number.isFinite(totalBeats) ? Math.max(0, Math.ceil(totalBeats / unit)) : 0;
  return Array.from({ length: tickCount }, (_, index) => {
    const beat = index * unit;
    const position = barPositionAtBeat(beat, timeSignature);
    const isBar = position.beat === 1;
    return {
      beat,
      kind: isBar ? "bar" : "beat",
      label: isBar ? String(position.bar) : ""
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

export function formatBeat(beat: number, timeSignature: [number, number] = [4, 4]) {
  const position = barPositionAtBeat(beat, timeSignature);
  return `${position.bar}.${position.beat}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
import { barPositionAtBeat, notatedBeatLength } from "./meterMath";
