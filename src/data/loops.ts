import type { LoopCategory, LoopDefinition } from "../types/project";

export type LoopBrowserFilters = {
  category?: LoopCategory | "All";
  genre?: string;
  mood?: string;
  query?: string;
};

const NOTE_TO_SEMITONE: Record<string, number> = {
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

const SEMITONE_TO_NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const LOOP_LIBRARY: LoopDefinition[] = [
  {
    id: "drums-grid",
    name: "그리드 룸 드럼",
    category: "Drums",
    type: "midi",
    trackType: "drum",
    key: "C",
    genre: "Pop",
    mood: ["Steady", "Bright"],
    bpm: 120,
    lengthBeats: 4,
    color: "#38bdf8",
    description: "A tight four-beat drum groove with kick, snare, and hats.",
    pattern: [
      { beat: 0, drum: "kick", velocity: 0.95 },
      { beat: 0.5, drum: "hat", velocity: 0.55 },
      { beat: 1, drum: "snare", velocity: 0.82 },
      { beat: 1.5, drum: "hat", velocity: 0.5 },
      { beat: 2, drum: "kick", velocity: 0.88 },
      { beat: 2.5, drum: "hat", velocity: 0.58 },
      { beat: 3, drum: "snare", velocity: 0.86 },
      { beat: 3.5, drum: "hat", velocity: 0.52 }
    ]
  },
  {
    id: "drums-electro",
    name: "Electro Pulse",
    category: "Drums",
    type: "midi",
    trackType: "drum",
    key: "C",
    genre: "Electronic",
    mood: ["Energetic", "Bright"],
    bpm: 124,
    lengthBeats: 4,
    color: "#22c55e",
    description: "A punchy electronic beat with a clear clap backbeat.",
    pattern: [
      { beat: 0, drum: "kick", velocity: 0.96 },
      { beat: 0.75, drum: "hat", velocity: 0.5 },
      { beat: 1, drum: "clap", velocity: 0.8 },
      { beat: 1.5, drum: "hat", velocity: 0.48 },
      { beat: 2, drum: "kick", velocity: 0.94 },
      { beat: 2.75, drum: "hat", velocity: 0.5 },
      { beat: 3, drum: "clap", velocity: 0.82 },
      { beat: 3.5, drum: "hat", velocity: 0.62 }
    ]
  },
  {
    id: "bass-midnight",
    name: "Midnight Bass",
    category: "Bass",
    type: "midi",
    trackType: "instrument",
    key: "C",
    genre: "Hip Hop",
    mood: ["Dark", "Steady"],
    bpm: 120,
    lengthBeats: 4,
    color: "#f59e0b",
    description: "A warm bass phrase that leaves room for drums and keys.",
    pattern: [
      { beat: 0, note: "C2", durationBeats: 0.5, velocity: 0.86 },
      { beat: 0.75, note: "C2", durationBeats: 0.25, velocity: 0.68 },
      { beat: 1.5, note: "G1", durationBeats: 0.5, velocity: 0.78 },
      { beat: 2.25, note: "A#1", durationBeats: 0.5, velocity: 0.8 },
      { beat: 3.25, note: "G1", durationBeats: 0.5, velocity: 0.72 }
    ]
  },
  {
    id: "bass-clean",
    name: "Clean Sub Bass",
    category: "Bass",
    type: "midi",
    trackType: "instrument",
    key: "F",
    genre: "R&B",
    mood: ["Smooth", "Warm"],
    bpm: 110,
    lengthBeats: 4,
    color: "#fb7185",
    description: "A simple sub bass movement for sparse arrangements.",
    pattern: [
      { beat: 0, note: "F1", durationBeats: 0.75, velocity: 0.82 },
      { beat: 1, note: "F2", durationBeats: 0.5, velocity: 0.65 },
      { beat: 2, note: "D#1", durationBeats: 0.75, velocity: 0.8 },
      { beat: 3, note: "C2", durationBeats: 0.5, velocity: 0.62 }
    ]
  },
  {
    id: "synth-glass",
    name: "Glass Arpeggio",
    category: "Synth",
    type: "midi",
    trackType: "instrument",
    key: "C",
    genre: "Electronic",
    mood: ["Bright", "Dreamy"],
    bpm: 120,
    lengthBeats: 4,
    color: "#a78bfa",
    description: "A bright eighth-note synth arpeggio.",
    pattern: [
      { beat: 0, note: "C4", durationBeats: 0.35, velocity: 0.55 },
      { beat: 0.5, note: "E4", durationBeats: 0.35, velocity: 0.54 },
      { beat: 1, note: "G4", durationBeats: 0.35, velocity: 0.58 },
      { beat: 1.5, note: "B4", durationBeats: 0.35, velocity: 0.5 },
      { beat: 2, note: "C5", durationBeats: 0.35, velocity: 0.52 },
      { beat: 2.5, note: "G4", durationBeats: 0.35, velocity: 0.52 },
      { beat: 3, note: "E4", durationBeats: 0.35, velocity: 0.55 },
      { beat: 3.5, note: "G4", durationBeats: 0.35, velocity: 0.56 }
    ]
  },
  {
    id: "fx-rise",
    name: "Soft Riser",
    category: "FX",
    type: "midi",
    trackType: "instrument",
    key: "C",
    genre: "Cinematic",
    mood: ["Rising", "Tense"],
    bpm: 120,
    lengthBeats: 4,
    color: "#eab308",
    description: "A short transition texture for section changes.",
    pattern: [
      { beat: 0, note: "C4", durationBeats: 1, velocity: 0.25 },
      { beat: 1, note: "D4", durationBeats: 1, velocity: 0.32 },
      { beat: 2, note: "F4", durationBeats: 1, velocity: 0.38 },
      { beat: 3, note: "A4", durationBeats: 1, velocity: 0.44 }
    ]
  }
];

export const LOOP_CATEGORIES: LoopCategory[] = ["Drums", "Bass", "Synth", "FX"];

export function getLoopById(loopId?: string) {
  return LOOP_LIBRARY.find((loop) => loop.id === loopId);
}

export function loopGenres() {
  return [...new Set(LOOP_LIBRARY.map((loop) => loop.genre).filter(Boolean) as string[])].sort();
}

export function loopMoods() {
  return [...new Set(LOOP_LIBRARY.flatMap((loop) => loop.mood ?? []))].sort();
}

export function filterLoops(filters: LoopBrowserFilters = {}) {
  const query = filters.query?.trim().toLowerCase();
  return LOOP_LIBRARY.filter((loop) => {
    if (filters.category && filters.category !== "All" && loop.category !== filters.category) return false;
    if (filters.genre && loop.genre !== filters.genre) return false;
    if (filters.mood && !loop.mood?.includes(filters.mood)) return false;
    if (!query) return true;
    const haystack = [loop.name, loop.description, loop.category, loop.genre, ...(loop.mood ?? [])].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function keyRoot(key?: string) {
  if (!key) return undefined;
  const normalized = key.trim().replace(/m$/, "");
  return NOTE_TO_SEMITONE[normalized];
}

export function loopPitchShift(fromKey?: string, toKey?: string) {
  const from = keyRoot(fromKey);
  const to = keyRoot(toKey);
  if (from === undefined || to === undefined) return 0;
  const raw = to - from;
  if (raw > 6) return raw - 12;
  if (raw < -6) return raw + 12;
  return raw;
}

export function transposeLoopNote(note: string, fromKey?: string, toKey?: string) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  const shift = loopPitchShift(fromKey, toKey);
  if (!match || shift === 0) return note;
  const semitone = NOTE_TO_SEMITONE[match[1]];
  if (semitone === undefined) return note;
  const octave = Number(match[2]);
  const midi = (octave + 1) * 12 + semitone + shift;
  const nextOctave = Math.floor(midi / 12) - 1;
  const nextNote = SEMITONE_TO_NOTE[((midi % 12) + 12) % 12];
  return `${nextNote}${nextOctave}`;
}

export function loopMatchSummary(loop: LoopDefinition | undefined, project: { bpm?: number; key?: string }) {
  const loopBpm = loop?.bpm ?? project.bpm ?? 120;
  const projectBpm = Number(project.bpm ?? loopBpm);
  const loopKey = loop?.key ?? project.key ?? "C";
  const projectKey = project.key ?? loopKey;
  const pitchShift = loopPitchShift(loopKey, projectKey);
  const needsTempoMatch = loopBpm !== projectBpm;
  const needsKeyMatch = pitchShift !== 0;
  return {
    needsTempoMatch,
    needsKeyMatch,
    tempoRatio: projectBpm / Math.max(1, loopBpm),
    pitchShift,
    tempoLabel: needsTempoMatch ? `BPM ${loopBpm} -> ${projectBpm}` : "Tempo match",
    keyLabel: needsKeyMatch ? `Key ${loopKey} -> ${projectKey}` : "Key match"
  };
}
