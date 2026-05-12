import type { LoopCategory, LoopDefinition } from "../types/project";

export const LOOP_LIBRARY: LoopDefinition[] = [
  {
    id: "drums-grid",
    name: "그리드 룸 드럼",
    category: "Drums",
    trackType: "drum",
    bpm: 120,
    lengthBeats: 4,
    color: "#38bdf8",
    description: "단단한 4박 드럼 그루브",
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
    name: "일렉트로 펄스",
    category: "Drums",
    trackType: "drum",
    bpm: 124,
    lengthBeats: 4,
    color: "#22c55e",
    description: "킥과 하이햇이 분명한 댄스 패턴",
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
    name: "미드나잇 베이스",
    category: "Bass",
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#f59e0b",
    description: "부드럽게 당겨지는 베이스 프레이즈",
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
    name: "클린 옥타브",
    category: "Bass",
    trackType: "instrument",
    bpm: 110,
    lengthBeats: 4,
    color: "#fb7185",
    description: "간단한 옥타브 베이스 움직임",
    pattern: [
      { beat: 0, note: "F1", durationBeats: 0.75, velocity: 0.82 },
      { beat: 1, note: "F2", durationBeats: 0.5, velocity: 0.65 },
      { beat: 2, note: "D#1", durationBeats: 0.75, velocity: 0.8 },
      { beat: 3, note: "C2", durationBeats: 0.5, velocity: 0.62 }
    ]
  },
  {
    id: "synth-glass",
    name: "글래스 아르페지오",
    category: "Synth",
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#a78bfa",
    description: "밝은 8분음표 아르페지오",
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
    name: "소프트 라이저",
    category: "FX",
    trackType: "instrument",
    bpm: 120,
    lengthBeats: 4,
    color: "#eab308",
    description: "간단한 전환용 음색",
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
