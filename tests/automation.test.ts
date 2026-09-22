import { describe, expect, it } from "vitest";
import {
  automationBaseValue, automationParamRange, automationValueAtBeat,
  clampAutomationValue, normalizeAutomationPoint, normalizeTrackAutomation,
  trackAutomationEntry
} from "../src/audio/automation";

describe("track automation", () => {
  it("normalizes supported params and clamps points", () => {
    expect(automationParamRange("pan")).toEqual({ min: -1, max: 1, defaultValue: 0 });
    expect(automationParamRange("volume").defaultValue).toBe(0.82);
    expect(automationParamRange("send.delay").defaultValue).toBe(0);
    expect(clampAutomationValue("pan", 2)).toBe(1);
    expect(clampAutomationValue("volume", "bad")).toBe(0.82);
    expect(normalizeAutomationPoint("volume", { beat: -2, value: 5 }, 3))
      .toEqual({ id: "automation-volume-3-0", beat: 0, value: 1 });
  });

  it("drops unknown entries, merges duplicate lanes, and sorts points", () => {
    const lanes = normalizeTrackAutomation([
      null,
      { param: "unknown", points: [] },
      { param: "volume", points: [{ id: "b", beat: 4, value: 0.4 }] },
      { param: "volume", points: [{ id: "a", beat: 1, value: -1 }, null] },
      { param: "pan", points: "invalid" }
    ]);
    expect(lanes.map((lane) => lane.param)).toEqual(["volume", "pan"]);
    expect(lanes[0].points.map((point) => [point.beat, point.value]))
      .toEqual([[0, 0.82], [1, 0], [4, 0.4]]);
    expect(lanes[1].points).toEqual([]);
    expect(normalizeTrackAutomation(undefined)).toEqual([]);
    expect(trackAutomationEntry(undefined, "pan")).toEqual({ param: "pan", points: [] });
  });

  it("derives each lane base value from the track", () => {
    const base = { volume: 1.5, pan: -2, sends: { reverb: 0.4, delay: 2 } };
    expect(["volume", "pan", "send.reverb", "send.delay"].map((param) =>
      automationBaseValue(base, param as "volume" | "pan" | "send.reverb" | "send.delay")))
      .toEqual([1, -1, 0.4, 1]);
    expect(automationBaseValue(undefined, "volume")).toBe(0.82);
  });

  it("interpolates between points and holds the final value", () => {
    const track = {
      volume: 0.7,
      pan: 0,
      sends: {},
      automation: [{ param: "volume" as const, points: [
        { id: "late", beat: 4, value: 1 }, { id: "early", beat: 2, value: 0 }
      ] }]
    };
    expect(automationValueAtBeat(track, "volume", 0)).toBe(0.7);
    expect(automationValueAtBeat(track, "volume", 3)).toBe(0.5);
    expect(automationValueAtBeat(track, "volume", 6)).toBe(1);
    expect(automationValueAtBeat(track, "pan", 2)).toBe(0);
  });
});
