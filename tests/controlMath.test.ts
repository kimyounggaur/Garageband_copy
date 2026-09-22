import { describe, expect, it } from "vitest";
import {
  clamp01, denormalizeValue, faderValueToPercent, formatLcdBeat,
  knobValueToDegrees, meterLevelToPercent, normalizeValue
} from "../src/components/ui/controlMath";

describe("control values", () => {
  it("clamps non-finite and out-of-range input", () => {
    expect([clamp01(-1), clamp01(0.3), clamp01(2), clamp01(Number.NaN)])
      .toEqual([0, 0.3, 1, 0]);
    expect(normalizeValue(5, 0, 10)).toBe(0.5);
    expect(normalizeValue(2, 5, 5)).toBe(0);
    expect(normalizeValue(Number.POSITIVE_INFINITY)).toBe(0);
    expect(denormalizeValue(2, 10, 20)).toBe(20);
  });

  it("maps values to control display positions", () => {
    expect([-1, 0, 1].map((value) => knobValueToDegrees(value, -1, 1)))
      .toEqual([-135, 0, 135]);
    expect(faderValueToPercent(0.555)).toBe(56);
    expect(meterLevelToPercent(1.5)).toBe(100);
  });

  it("formats LCD time and falls back for invalid beats", () => {
    expect(formatLcdBeat(5.5, [4, 4])).toBe("002|2|240");
    expect(formatLcdBeat(Number.NaN, [0, 4])).toBe("001|1|000");
    expect(formatLcdBeat(3, [3, 4])).toBe("002|1|000");
    expect(formatLcdBeat(1.5, [6, 8])).toBe("001|4|000");
    expect(formatLcdBeat(2.75, [6, 8])).toBe("001|6|240");
    expect(formatLcdBeat(9, [6, 8])).toBe("004|1|000");
  });
});
