import type { LoopCategory, LoopDefinition } from "../types/project";

export const LOOP_LIBRARY: LoopDefinition[] = [
  {
    id: "drums-grid",
    name: "Grid Room Kit",
    category: "Drums",
    trackType: "drum",
    bpm: 120,
    lengthBeats: 4,
    color: "#38bdf8",
    description: "Tight four-beat drum groove",
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
    trackType: "drum",
    bpm: 124,
    lengthBeats: 4,
    color: "#22c55e",
    description: "Club-ready kick and hat pattern",
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
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#f59e0b",
    description: "Rounded syncopated bass phrase",
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
    name: "Clean Octaves",
    category: "Bass",
    trackType: "instrument",
    bpm: 110,
    lengthBeats: 4,
    color: "#fb7185",
    description: "Simple octave bass motion",
    pattern: [
      { beat: 0, note: "F1", durationBeats: 0.75, velocity: 0.82 },
      { beat: 1, note: "F2", durationBeats: 0.5, velocity: 0.65 },
      { beat: 2, note: "D#1", durationBeats: 0.75, velocity: 0.8 },
      { beat: 3, note: "C2", durationBeats: 0.5, velocity: 0.62 }
    ]
  },
  {
    id: "synth-glass",
    name: "Glass Arps",
    category: "Synth",
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#a78bfa",
    description: "Bright eighth-note arpeggio",
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
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#eab308",
    description: "Minimal tonal transition",
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
