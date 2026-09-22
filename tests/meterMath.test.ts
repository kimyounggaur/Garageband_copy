import { describe, expect, it } from "vitest";
import {
  barLengthBeats, barPositionAtBeat, metronomeClickPattern,
  notatedBeatLength, resolveSnapInterval
} from "../src/utils/meterMath";
import { formatBarBeatTick } from "../src/utils/timeline";

describe("quarter-note meter math", () => {
  it.each([
    [[4, 4], 4, 1],
    [[3, 4], 3, 1],
    [[6, 8], 3, 0.5],
    [[7, 8], 3.5, 0.5]
  ] as const)("keeps transport beats in quarter notes for %j", (signature, barBeats, notatedBeatBeats) => {
    expect(barLengthBeats([...signature])).toBe(barBeats);
    expect(notatedBeatLength([...signature])).toBe(notatedBeatBeats);
  });

  it.each([
    [[4, 4], [0, 4, 12]],
    [[3, 4], [0, 3, 9]],
    [[6, 8], [0, 3, 9]]
  ] as const)("identifies bars 1, 2, and 4 in %j", (signature, starts) => {
    starts.forEach((startBeat, index) => {
      expect(barPositionAtBeat(startBeat, [...signature])).toEqual({ bar: [1, 2, 4][index], beat: 1, tick: 0 });
    });
  });

  it("shows all six eighth notes and the half-eighth tick inside a 6/8 bar", () => {
    const signature: [number, number] = [6, 8];
    for (let index = 0; index < 6; index += 1) {
      expect(barPositionAtBeat(index * 0.5, signature)).toEqual({ bar: 1, beat: index + 1, tick: 0 });
    }
    expect(barPositionAtBeat(2.75, signature)).toEqual({ bar: 1, beat: 6, tick: 240 });
    expect(barPositionAtBeat(3, signature)).toEqual({ bar: 2, beat: 1, tick: 0 });
  });

  it("preserves the current 4/4 bar-beat-tick display for existing positions", () => {
    for (const quarterBeat of [0, 0.25, 3.5, 4, 5.5, 12]) {
      const position = barPositionAtBeat(quarterBeat, [4, 4]);
      const display = `${String(position.bar).padStart(3, "0")}|${position.beat}|${String(position.tick).padStart(3, "0")}`;
      expect(display).toBe(formatBarBeatTick(quarterBeat, [4, 4]));
    }
    expect(barPositionAtBeat(Number.NaN, [0, 4])).toEqual({ bar: 1, beat: 1, tick: 0 });
  });

  it("clicks six eighth notes in 6/8 and accents the first and fourth", () => {
    expect(metronomeClickPattern([6, 8])).toEqual([
      { offsetBeats: 0, accent: "primary" },
      { offsetBeats: 0.5, accent: "weak" },
      { offsetBeats: 1, accent: "weak" },
      { offsetBeats: 1.5, accent: "secondary" },
      { offsetBeats: 2, accent: "weak" },
      { offsetBeats: 2.5, accent: "weak" }
    ]);
    expect(metronomeClickPattern([3, 4]).map((click) => click.accent)).toEqual(["primary", "weak", "weak"]);
    expect(metronomeClickPattern([4, 4]).map((click) => click.offsetBeats)).toEqual([0, 1, 2, 3]);
  });

  it("preserves numeric quarter-note snap intervals and resolves a named bar snap", () => {
    expect(resolveSnapInterval(4, [4, 4])).toBe(4);
    expect(resolveSnapInterval(4, [3, 4])).toBe(4);
    expect(resolveSnapInterval(4, [6, 8])).toBe(4);
    expect(resolveSnapInterval("bar", [3, 4])).toBe(3);
    expect(resolveSnapInterval("bar", [6, 8])).toBe(3);
    expect(resolveSnapInterval(0.5, [6, 8])).toBe(0.5);
  });
});
