import type { LoopCategory, LoopDefinition, LoopStep } from "../types/project";
import { CURATED_LOOPS } from "./loopCatalog";

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
    musicalRole: "drums",
    type: "midi",
    trackType: "drum",
    genre: "Pop",
    mood: ["Steady", "Bright"],
    bpm: 120,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#38bdf8",
    description: "킥, 스네어, 하이햇으로 만든 촘촘한 4박자 드럼 리듬입니다.",
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
    musicalRole: "drums",
    type: "midi",
    trackType: "drum",
    genre: "Electronic",
    mood: ["Energetic", "Bright"],
    bpm: 124,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#22c55e",
    description: "클랩이 뒷박을 살리는 힘찬 전자 비트입니다.",
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
    name: "한밤의 베이스",
    category: "Bass",
    musicalRole: "bass",
    type: "midi",
    trackType: "instrument",
    key: "Cm",
    genre: "Hip Hop",
    mood: ["Dark", "Steady"],
    bpm: 120,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#f59e0b",
    description: "드럼과 건반이 들어갈 공간을 남긴 따뜻한 베이스 구절입니다.",
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
    name: "맑은 서브 베이스",
    category: "Bass",
    musicalRole: "bass",
    type: "midi",
    trackType: "instrument",
    key: "Fm",
    genre: "R&B",
    mood: ["Smooth", "Warm"],
    bpm: 110,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#fb7185",
    description: "여백이 많은 편곡에 어울리는 단순한 서브 베이스입니다.",
    pattern: [
      { beat: 0, note: "F1", durationBeats: 0.75, velocity: 0.82 },
      { beat: 1, note: "F2", durationBeats: 0.5, velocity: 0.65 },
      { beat: 2, note: "D#1", durationBeats: 0.75, velocity: 0.8 },
      { beat: 3, note: "C2", durationBeats: 0.5, velocity: 0.62 }
    ]
  },
  {
    id: "synth-glass",
    name: "유리빛 아르페지오",
    category: "Synth",
    musicalRole: "melody",
    type: "midi",
    trackType: "instrument",
    key: "C",
    genre: "Electronic",
    mood: ["Bright", "Dreamy"],
    bpm: 120,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#a78bfa",
    description: "밝은 8분음표 신스 아르페지오입니다.",
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
    name: "부드러운 상승음",
    category: "FX",
    musicalRole: "melody",
    type: "midi",
    trackType: "instrument",
    key: "C",
    genre: "Cinematic",
    mood: ["Rising", "Tense"],
    bpm: 120,
    timeSignature: [4, 4],
    lengthBeats: 4,
    color: "#eab308",
    description: "구간이 바뀔 때 쓰는 짧은 전환 효과입니다.",
    pattern: [
      { beat: 0, note: "C4", durationBeats: 1, velocity: 0.25 },
      { beat: 1, note: "D4", durationBeats: 1, velocity: 0.32 },
      { beat: 2, note: "F4", durationBeats: 1, velocity: 0.38 },
      { beat: 3, note: "A4", durationBeats: 1, velocity: 0.44 }
    ]
  },
  ...CURATED_LOOPS
];

export const LOOP_CATEGORIES: LoopCategory[] = ["Drums", "Bass", "Synth", "FX"];

export const LOOP_GENRE_LABELS: Record<string, string> = {
  Pop: "팝", Electronic: "일렉트로닉", "Hip Hop": "힙합", "R&B": "알앤비", Cinematic: "영화음악",
  Rock: "록", Funk: "펑크", Jazz: "재즈", Blues: "블루스", Latin: "라틴", Reggae: "레게",
  Classical: "클래식", Folk: "포크"
};
export const LOOP_MOOD_LABELS: Record<string, string> = {
  Steady: "안정적인", Bright: "밝은", Energetic: "활기찬", Dark: "어두운",
  Smooth: "부드러운", Warm: "따뜻한", Dreamy: "몽환적인", Rising: "고조되는", Tense: "긴장감 있는"
};

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

export function resolveLoopPattern(loop: LoopDefinition, projectKey?: string): LoopStep[] {
  return loop.pattern.map((step) => step.note
    ? { ...step, note: transposeLoopNote(step.note, loop.key, projectKey) }
    : step);
}

export function loopMatchSummary(
  loop: LoopDefinition | undefined,
  project: { bpm?: number; key?: string; timeSignature?: [number, number] }
) {
  const loopBpm = loop?.bpm ?? project.bpm ?? 120;
  const projectBpm = Number(project.bpm ?? loopBpm);
  const loopKey = loop?.key;
  const projectKey = project.key;
  const pitchShift = loopKey && projectKey ? loopPitchShift(loopKey, projectKey) : 0;
  const modeMismatch = Boolean(loopKey && projectKey && loopKey.endsWith("m") !== projectKey.endsWith("m"));
  const loopMeter = loop?.timeSignature ?? project.timeSignature ?? [4, 4];
  const projectMeter = project.timeSignature ?? loopMeter;
  const needsMeterMatch = loopMeter[0] !== projectMeter[0] || loopMeter[1] !== projectMeter[1];
  const needsTempoMatch = loopBpm !== projectBpm;
  const needsKeyMatch = pitchShift !== 0 || modeMismatch;
  return {
    needsTempoMatch,
    needsKeyMatch,
    needsMeterMatch,
    keyConvertible: !modeMismatch,
    tempoRatio: projectBpm / Math.max(1, loopBpm),
    pitchShift,
    tempoLabel: needsTempoMatch ? `템포 ${loopBpm} → ${projectBpm} BPM` : "템포 일치",
    keyLabel: modeMismatch
      ? `조성이 다릅니다: ${loopKey} → ${projectKey}. 음계가 맞는지 확인하세요.`
      : pitchShift !== 0 ? `조성 ${loopKey} → ${projectKey} 전조` : "조성 일치",
    meterLabel: needsMeterMatch
      ? `박자표가 다릅니다: ${loopMeter.join("/")} → ${projectMeter.join("/")}. 배치 전 확인하세요.`
      : "박자표 일치"
  };
}
