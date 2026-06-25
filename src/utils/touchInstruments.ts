import type { MidiNote } from "../types/project";

export type TouchNote = Omit<MidiNote, "id">;

export type DrumLaneId = "kick" | "snare" | "hat" | "clap" | "tom";

export type SequencerStep = {
  lane: DrumLaneId;
  step: number;
  active?: boolean;
  velocity?: number;
};

export type StepSequencerOptions = {
  startBeat?: number;
  stepBeats?: number;
  swing?: number;
  lengthSteps?: number;
};

export type SmartDrumOptions = {
  complexity: number;
  loudness: number;
  lengthBeats?: number;
  seed?: number;
};

export type ChordStrip = {
  id: string;
  roman: string;
  name: string;
  rootPitch: number;
  notes: number[];
};

export const KEYBOARD_KEY_INTERVALS: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14
};

export const DRUM_LANES: Array<{ id: DrumLaneId; label: string; pitch: number; color: string }> = [
  { id: "kick", label: "Kick", pitch: 36, color: "#38bdf8" },
  { id: "snare", label: "Snare", pitch: 38, color: "#fb7185" },
  { id: "hat", label: "Hat", pitch: 42, color: "#facc15" },
  { id: "clap", label: "Clap", pitch: 39, color: "#a78bfa" },
  { id: "tom", label: "Tom", pitch: 45, color: "#4ade80" }
];

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const KEY_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundTo(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export function quantizeBeat(beat: number, snapBeats = 0.25) {
  const snap = snapBeats > 0 ? snapBeats : 0.25;
  return roundTo(Math.max(0, Math.round(beat / snap) * snap));
}

export function timelineBeatToClipBeat(timelineBeat: number, clipStartBeat: number, snapBeats = 0.25) {
  return quantizeBeat(Math.max(0, timelineBeat - clipStartBeat), snapBeats);
}

export function keyboardKeyToMidi(key: string, octave = 4, rootPitch?: number) {
  const interval = KEYBOARD_KEY_INTERVALS[key.toLowerCase()];
  if (interval === undefined) return undefined;
  const basePitch = rootPitch ?? 12 * (octave + 1);
  return clampNumber(basePitch + interval, 24, 96);
}

export function buildKeyboardNote({
  pitch,
  startBeat,
  snapBeats = 0.25,
  durationBeats = 0.5,
  velocity = 0.82
}: {
  pitch?: number;
  startBeat: number;
  snapBeats?: number;
  durationBeats?: number;
  velocity?: number;
}): TouchNote {
  return {
    pitch: Math.round(clampNumber(pitch ?? 60, 24, 96)),
    startBeat: quantizeBeat(startBeat, snapBeats),
    durationBeats: Math.max(0.25, quantizeBeat(durationBeats, snapBeats)),
    velocity: roundTo(clampNumber(velocity, 0, 1))
  };
}

export function drumLanePitch(lane: DrumLaneId) {
  return DRUM_LANES.find((item) => item.id === lane)?.pitch ?? 42;
}

export function buildStepSequencerNotes(steps: SequencerStep[], options: StepSequencerOptions = {}): TouchNote[] {
  const startBeat = Math.max(0, options.startBeat ?? 0);
  const stepBeats = Math.max(0.0625, options.stepBeats ?? 0.25);
  const swing = clampNumber(options.swing ?? 0, 0, 1);
  const lengthSteps = Math.max(1, Math.floor(options.lengthSteps ?? 16));

  return steps
    .filter((step) => step.active !== false && step.step >= 0 && step.step < lengthSteps)
    .map((step) => {
      const swingOffset = step.step % 2 === 1 ? swing * stepBeats * 0.5 : 0;
      return {
        pitch: drumLanePitch(step.lane),
        startBeat: roundTo(startBeat + step.step * stepBeats + swingOffset),
        durationBeats: roundTo(stepBeats),
        velocity: roundTo(clampNumber(step.velocity ?? 0.7, 0.05, 1))
      };
    });
}

function seededRandom(seed: number) {
  let value = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function scaledVelocity(loudness: number, accent = 0) {
  const base = 0.24 + clampNumber(loudness, 0, 1) * 0.58 + accent;
  return roundTo(clampNumber(base, 0.2, 0.9));
}

export function generateSmartDrumPattern(options: SmartDrumOptions): TouchNote[] {
  const complexity = clampNumber(options.complexity, 0, 1);
  const loudness = clampNumber(options.loudness, 0, 1);
  const lengthBeats = Math.max(1, Math.round(options.lengthBeats ?? 4));
  const random = seededRandom(options.seed ?? 1);
  const notes: TouchNote[] = [];

  for (let beat = 0; beat < lengthBeats; beat += 1) {
    if (beat % 2 === 0 || complexity > 0.55) {
      notes.push({ pitch: drumLanePitch("kick"), startBeat: beat, durationBeats: 0.25, velocity: scaledVelocity(loudness, 0.08) });
    }
    if (beat % 4 === 1 || beat % 4 === 3) {
      notes.push({ pitch: drumLanePitch("snare"), startBeat: beat, durationBeats: 0.25, velocity: scaledVelocity(loudness, 0.03) });
    }
    if (complexity > 0.45 && beat % 4 === 3 && random() > 0.35) {
      notes.push({ pitch: drumLanePitch("clap"), startBeat: beat + 0.01, durationBeats: 0.25, velocity: scaledVelocity(loudness, -0.08) });
    }
  }

  const hatStep = complexity > 0.7 ? 0.25 : complexity > 0.35 ? 0.5 : 1;
  for (let beat = 0; beat < lengthBeats; beat = roundTo(beat + hatStep)) {
    const skipChance = complexity > 0.7 ? 0.08 : 0.24;
    if (random() > skipChance) {
      notes.push({
        pitch: drumLanePitch("hat"),
        startBeat: beat,
        durationBeats: 0.25,
        velocity: scaledVelocity(loudness, beat % 1 === 0 ? -0.08 : -0.18)
      });
    }
  }

  if (complexity > 0.65) {
    notes.push({
      pitch: drumLanePitch("tom"),
      startBeat: Math.max(0, lengthBeats - 0.5),
      durationBeats: 0.25,
      velocity: scaledVelocity(loudness, -0.02)
    });
  }

  return notes.sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch);
}

function normalizeKey(key = "C") {
  const trimmed = key.trim();
  const isMinor = trimmed.endsWith("m") && trimmed.length > 1;
  const tonic = isMinor ? trimmed.slice(0, -1) : trimmed;
  return {
    tonic: KEY_TO_SEMITONE[tonic] === undefined ? "C" : tonic,
    isMinor
  };
}

function noteNameForPitchClass(pitchClass: number) {
  return NOTE_NAMES[((pitchClass % 12) + 12) % 12];
}

export function buildDiatonicChordStrips(projectKey = "C"): ChordStrip[] {
  const { tonic, isMinor } = normalizeKey(projectKey);
  const root = KEY_TO_SEMITONE[tonic] ?? 0;
  const scale = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const romans = isMinor ? ["i", "ii dim", "III", "iv", "v", "VI", "VII"] : ["I", "ii", "iii", "IV", "V", "vi", "vii dim"];

  return scale.map((interval, index) => {
    const degree = index + 1;
    const rootPitch = 60 + root + interval;
    const third = 60 + root + scale[(index + 2) % scale.length] + (index + 2 >= scale.length ? 12 : 0);
    const fifth = 60 + root + scale[(index + 4) % scale.length] + (index + 4 >= scale.length ? 12 : 0);
    const rootName = noteNameForPitchClass(root + interval);
    return {
      id: `degree-${degree}`,
      roman: romans[index],
      name: `${rootName} ${romans[index]}`,
      rootPitch,
      notes: [rootPitch, third, fifth]
    };
  });
}

export function buildChordNotes(
  chord: ChordStrip,
  {
    startBeat,
    durationBeats = 1,
    strumBeats = 0.04,
    velocity = 0.76
  }: {
    startBeat: number;
    durationBeats?: number;
    strumBeats?: number;
    velocity?: number;
  }
): TouchNote[] {
  return chord.notes.map((pitch, index) => {
    const offset = Math.max(0, strumBeats) * index;
    return {
      pitch,
      startBeat: roundTo(startBeat + offset),
      durationBeats: roundTo(Math.max(0.25, durationBeats - offset)),
      velocity: roundTo(clampNumber(velocity, 0.05, 1))
    };
  });
}
