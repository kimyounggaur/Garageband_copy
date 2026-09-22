import { describe, expect, it } from "vitest";
import {
  beatToX, buildRulerTicks, clamp, clipTypeRegionColor, formatBarBeatTick,
  formatBeat, normalizeCycleRange, pixelsPerBeatForZoom, snapBeat, xToBeat
} from "../src/utils/timeline";

describe("timeline geometry and labels", () => {
  it("round trips beat and pixel positions at default and custom zoom", () => {
    expect(beatToX(2.5)).toBe(140);
    expect(xToBeat(140)).toBe(2.5);
    expect(xToBeat(beatToX(3.25, 84), 84)).toBe(3.25);
    expect(pixelsPerBeatForZoom(0)).toBe(36.4);
    expect(pixelsPerBeatForZoom(5)).toBe(100.8);
  });

  it("snaps to nearest grid and clamps negative positions", () => {
    expect(snapBeat(1.13)).toBe(1.25);
    expect(snapBeat(1.49, 1)).toBe(1);
    expect(snapBeat(-2)).toBe(0);
    expect(clamp(7, 0, 5)).toBe(5);
  });

  it("normalizes reversed and zero-width cycle ranges", () => {
    expect(normalizeCycleRange(6.1, 2.1, 0.5)).toEqual({ start: 2, end: 6 });
    expect(normalizeCycleRange(4, 4)).toEqual({ start: 4, end: 4.25 });
  });

  it("builds bar ticks in the requested time signature", () => {
    expect(buildRulerTicks(7.1, [3, 4])).toHaveLength(8);
    expect(buildRulerTicks(7, [3, 4]).filter((tick) => tick.kind === "bar"))
      .toEqual([{ beat: 0, kind: "bar", label: "1" }, { beat: 3, kind: "bar", label: "2" }, { beat: 6, kind: "bar", label: "3" }]);
    expect(buildRulerTicks(-4)).toEqual([]);
    expect(buildRulerTicks(10, [6, 8]).filter((tick) => tick.kind === "bar"))
      .toEqual([
        { beat: 0, kind: "bar", label: "1" },
        { beat: 3, kind: "bar", label: "2" },
        { beat: 6, kind: "bar", label: "3" },
        { beat: 9, kind: "bar", label: "4" }
      ]);
    expect(buildRulerTicks(3, [6, 8]).map((tick) => tick.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });

  it("formats bar, beat, and tick labels", () => {
    expect(formatBarBeatTick(5.5)).toBe("002|2|240");
    expect(formatBarBeatTick(-2, [0, 4])).toBe("001|1|000");
    expect(formatBeat(4)).toBe("2.1");
    expect(formatBarBeatTick(3, [3, 4])).toBe("002|1|000");
    expect(formatBarBeatTick(1.5, [6, 8])).toBe("001|4|000");
    expect(formatBarBeatTick(3, [6, 8])).toBe("002|1|000");
    expect(formatBeat(9, [6, 8])).toBe("4.1");
  });

  it("maps every supported clip region color", () => {
    expect(["midi", "audio", "drummer", "loop", "unknown"].map(clipTypeRegionColor))
      .toEqual(["#5ec26b", "#46a7e0", "#e0b341", "#7d8cff", "#8b98a8"]);
  });
});
