import { normalizeTimeSignature } from "./transport";

export type TimeSignature = [number, number];
export type MeterSnapOption = 0.25 | 0.5 | 1 | 4 | "bar";
export type BarPosition = { bar: number; beat: number; tick: number };
export type MetronomeClick = {
  offsetBeats: number;
  accent: "primary" | "secondary" | "weak";
};

// All beat positions and durations in project data and the transport are quarter notes.
// A displayed beat follows the denominator of the time signature instead.
const DISPLAY_TICKS_PER_NOTATED_BEAT = 480;

export function notatedBeatLength(timeSignature: TimeSignature): number {
  const [, denominator] = normalizeTimeSignature(timeSignature);
  return 4 / denominator;
}

export function barLengthBeats(timeSignature: TimeSignature): number {
  const [numerator, denominator] = normalizeTimeSignature(timeSignature);
  return numerator * (4 / denominator);
}

export function barPositionAtBeat(quarterBeat: number, timeSignature: TimeSignature): BarPosition {
  const [numerator, denominator] = normalizeTimeSignature(timeSignature);
  const notatedBeatBeats = 4 / denominator;
  const safeBeat = Number.isFinite(quarterBeat) ? Math.max(0, quarterBeat) : 0;
  const totalDisplayTicks = Math.round((safeBeat / notatedBeatBeats) * DISPLAY_TICKS_PER_NOTATED_BEAT);
  const ticksPerBar = numerator * DISPLAY_TICKS_PER_NOTATED_BEAT;
  const barIndex = Math.floor(totalDisplayTicks / ticksPerBar);
  const ticksInBar = totalDisplayTicks - barIndex * ticksPerBar;

  return {
    bar: barIndex + 1,
    beat: Math.floor(ticksInBar / DISPLAY_TICKS_PER_NOTATED_BEAT) + 1,
    tick: ticksInBar % DISPLAY_TICKS_PER_NOTATED_BEAT
  };
}

export function metronomeClickPattern(timeSignature: TimeSignature): MetronomeClick[] {
  const [numerator, denominator] = normalizeTimeSignature(timeSignature);
  const notatedBeatBeats = 4 / denominator;
  return Array.from({ length: numerator }, (_, index) => ({
    offsetBeats: index * notatedBeatBeats,
    accent: index === 0 ? "primary" : numerator === 6 && denominator === 8 && index === 3 ? "secondary" : "weak"
  }));
}

export function resolveSnapInterval(option: MeterSnapOption, timeSignature: TimeSignature): number {
  // Existing numeric selections remain quarter-note durations, including 4.
  if (option === "bar") return barLengthBeats(timeSignature);
  return Number.isFinite(option) && option > 0 ? option : 0.25;
}
