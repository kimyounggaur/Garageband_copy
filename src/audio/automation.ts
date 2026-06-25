import type { AutomationParam, AutomationPoint, Track, TrackAutomation } from "../types/project";
import { normalizeTrackSends } from "./fx";

export const AUTOMATION_PARAMS: AutomationParam[] = ["volume", "pan", "send.reverb", "send.delay"];

export const AUTOMATION_PARAM_LABELS: Record<AutomationParam, string> = {
  volume: "Volume",
  pan: "Pan",
  "send.reverb": "Reverb",
  "send.delay": "Delay"
};

type AutomationRange = {
  min: number;
  max: number;
  defaultValue: number;
};

function isAutomationParam(value: unknown): value is AutomationParam {
  return typeof value === "string" && AUTOMATION_PARAMS.includes(value as AutomationParam);
}

function finiteNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function automationParamRange(param: AutomationParam): AutomationRange {
  if (param === "pan") return { min: -1, max: 1, defaultValue: 0 };
  if (param === "volume") return { min: 0, max: 1, defaultValue: 0.82 };
  return { min: 0, max: 1, defaultValue: 0 };
}

export function clampAutomationValue(param: AutomationParam, value: unknown) {
  const range = automationParamRange(param);
  return round(Math.min(range.max, Math.max(range.min, finiteNumber(value, range.defaultValue))));
}

export function normalizeAutomationPoint(
  param: AutomationParam,
  point: Partial<AutomationPoint>,
  fallbackIndex = 0
): AutomationPoint {
  const beat = round(Math.max(0, finiteNumber(point.beat, 0)));
  return {
    id: typeof point.id === "string" && point.id.length > 0 ? point.id : `automation-${param}-${fallbackIndex}-${beat}`,
    beat,
    value: clampAutomationValue(param, point.value)
  };
}

export function normalizeTrackAutomation(automation?: unknown): TrackAutomation[] {
  if (!Array.isArray(automation)) return [];

  const order: AutomationParam[] = [];
  const entries = new Map<AutomationParam, AutomationPoint[]>();

  automation.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const param = (entry as { param?: unknown }).param;
    if (!isAutomationParam(param)) return;
    if (!entries.has(param)) {
      order.push(param);
      entries.set(param, []);
    }

    const points = Array.isArray((entry as { points?: unknown }).points) ? (entry as { points: unknown[] }).points : [];
    const nextPoints = points.map((point, index) =>
      normalizeAutomationPoint(
        param,
        point && typeof point === "object" ? (point as Partial<AutomationPoint>) : {},
        index
      )
    );
    entries.set(param, [...(entries.get(param) ?? []), ...nextPoints]);
  });

  return order.map((param) => ({
    param,
    points: [...(entries.get(param) ?? [])].sort((left, right) => left.beat - right.beat || left.id.localeCompare(right.id))
  }));
}

export function trackAutomationEntry(track: Pick<Track, "automation"> | undefined, param: AutomationParam): TrackAutomation {
  return normalizeTrackAutomation(track?.automation).find((entry) => entry.param === param) ?? { param, points: [] };
}

export function automationBaseValue(
  track: Pick<Track, "volume" | "pan" | "sends"> | undefined,
  param: AutomationParam
) {
  if (!track) return automationParamRange(param).defaultValue;
  if (param === "volume") return clampAutomationValue(param, track.volume);
  if (param === "pan") return clampAutomationValue(param, track.pan);
  const sends = normalizeTrackSends(track.sends);
  return clampAutomationValue(param, param === "send.reverb" ? sends.reverb : sends.delay);
}

export function automationValueAtBeat(
  track: Pick<Track, "automation" | "volume" | "pan" | "sends"> | undefined,
  param: AutomationParam,
  beat: number,
  fallback = automationBaseValue(track, param)
) {
  const points = trackAutomationEntry(track, param).points;
  if (points.length === 0) return clampAutomationValue(param, fallback);

  const safeBeat = Math.max(0, finiteNumber(beat, 0));
  if (safeBeat < points[0].beat) return clampAutomationValue(param, fallback);
  if (safeBeat >= points[points.length - 1].beat) return points[points.length - 1].value;

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (safeBeat < left.beat || safeBeat > right.beat) continue;
    if (right.beat === left.beat) return right.value;
    const progress = (safeBeat - left.beat) / (right.beat - left.beat);
    return clampAutomationValue(param, left.value + (right.value - left.value) * progress);
  }

  return clampAutomationValue(param, fallback);
}
