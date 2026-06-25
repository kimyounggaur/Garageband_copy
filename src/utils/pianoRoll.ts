import type { MidiNote, ProjectScale } from "../types/project";

export type QuantizeOptions = {
  gridBeats: number;
  strength: number;
};

export type PasteOptions = {
  startBeat: number;
  pitchOffset?: number;
};

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

const SCALE_INTERVALS: Record<ProjectScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

function roundTo(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeKey(projectKey = "C") {
  const trimmed = projectKey.trim();
  const isMinorKey = trimmed.endsWith("m") && trimmed.length > 1;
  const tonic = isMinorKey ? trimmed.slice(0, -1) : trimmed;
  return {
    tonic: KEY_TO_SEMITONE[tonic] === undefined ? "C" : tonic,
    isMinorKey
  };
}

function quantizeValue(value: number, gridBeats: number, strength: number) {
  const grid = Math.max(1 / 48, gridBeats);
  const amount = clampNumber(strength, 0, 1);
  const target = Math.round(value / grid) * grid;
  return roundTo(value + (target - value) * amount);
}

export function normalizePianoRollScale(scale?: string, projectKey = "C"): ProjectScale {
  if (scale === "major" || scale === "minor" || scale === "chromatic") return scale;
  return normalizeKey(projectKey).isMinorKey ? "minor" : "major";
}

export function scalePitchClasses(projectKey = "C", scale: ProjectScale = "major") {
  const { tonic } = normalizeKey(projectKey);
  const root = KEY_TO_SEMITONE[tonic] ?? 0;
  return SCALE_INTERVALS[scale].map((interval) => (root + interval) % 12);
}

export function isPitchInScale(pitch: number, projectKey = "C", scale: ProjectScale = "major") {
  if (scale === "chromatic") return true;
  return scalePitchClasses(projectKey, scale).includes(((pitch % 12) + 12) % 12);
}

export function quantizeMidiNotes(notes: MidiNote[], selectedIds: string[], options: QuantizeOptions) {
  const selected = new Set(selectedIds);
  return notes.map((note) => {
    if (!selected.has(note.id)) return note;
    return {
      ...note,
      startBeat: Math.max(0, quantizeValue(note.startBeat, options.gridBeats, options.strength)),
      durationBeats: Math.max(0.0625, quantizeValue(note.durationBeats, options.gridBeats, options.strength))
    };
  });
}

export function cloneNotesForPaste(notes: MidiNote[], options: PasteOptions): Array<Omit<MidiNote, "id">> {
  if (notes.length === 0) return [];
  const firstBeat = Math.min(...notes.map((note) => note.startBeat));
  const startBeat = Math.max(0, options.startBeat);
  const pitchOffset = options.pitchOffset ?? 0;

  return notes.map((note) => ({
    pitch: Math.round(clampNumber(note.pitch + pitchOffset, 0, 127)),
    startBeat: roundTo(startBeat + note.startBeat - firstBeat),
    durationBeats: Math.max(0.0625, roundTo(note.durationBeats)),
    velocity: roundTo(clampNumber(note.velocity, 0, 1))
  }));
}
