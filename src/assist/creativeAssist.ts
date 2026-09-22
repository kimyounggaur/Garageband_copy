import type { MidiNote, Project } from "../types/project";
import { optionalMusicFeedback } from "../education/musicFeedback";

export type ChordSuggestion = {
  id: string;
  title: string;
  chords: string[];
  mood: string;
  reason: string;
  notes: Array<Omit<MidiNote, "id">>;
};

export type DrumPreset = "basic" | "pop" | "hiphop" | "dance";

export type DrumSuggestion = {
  id: DrumPreset;
  title: string;
  description: string;
  notes: Array<Omit<MidiNote, "id">>;
};

export type MelodySuggestion = {
  id: string;
  title: string;
  sourceClipId?: string;
  startBeat: number;
  notes: Array<Omit<MidiNote, "id">>;
  explanation: string;
};

export type LearningFeedback = ReturnType<typeof optionalMusicFeedback>;

const NOTE_NAMES = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
const CHORD_TONES: Record<string, number[]> = {
  C: [60, 64, 67],
  Am: [57, 60, 64],
  F: [53, 57, 60],
  G: [55, 59, 62],
  Dm: [62, 65, 69],
  Em: [64, 67, 71]
};

function allMidiClips(project: Project) {
  return project.tracks.flatMap((track) => track.clips).filter((clip) => clip.type === "midi");
}

function allMidiNotes(project: Project) {
  return allMidiClips(project).flatMap((clip) => clip.notes ?? []);
}

function pitchName(pitch: number) {
  return NOTE_NAMES[pitch % 12];
}

function dominantPitchClass(project: Project) {
  const counts = new Map<number, number>();
  allMidiNotes(project).forEach((note) => counts.set(note.pitch % 12, (counts.get(note.pitch % 12) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function chordNotes(chords: string[]) {
  return chords.flatMap((chord, chordIndex) => {
    const startBeat = chordIndex * 4;
    return (CHORD_TONES[chord] ?? CHORD_TONES.C).map((pitch) => ({
      pitch,
      startBeat,
      durationBeats: 3.75,
      velocity: 0.66
    }));
  });
}

export function suggestChordProgressions(project: Project): ChordSuggestion[] {
  const pitchClass = dominantPitchClass(project);
  const bpm = project.bpm;
  const baseReason =
    pitchClass === undefined
      ? "아직 미디 음이 적어서 C장조 코드 진행을 예시로 보여드립니다."
      : `${NOTE_NAMES[pitchClass]} 음이 자주 쓰였지만 이 음만으로 조성을 판정할 수는 없습니다. 아래 C장조 진행을 예시로 들어보고 맞는지 직접 선택하세요.`;
  const energy = bpm >= 125 ? "밝고 빠른 느낌" : bpm <= 90 ? "차분한 느낌" : "자연스러운 느낌";

  return [
    {
      id: "c-am-f-g",
      title: "C - Am - F - G",
      chords: ["C", "Am", "F", "G"],
      mood: energy,
      reason: `${baseReason} 네 코드가 반복되어 처음 듣는 사람도 흐름을 쉽게 따라갈 수 있어요.`,
      notes: chordNotes(["C", "Am", "F", "G"])
    },
    {
      id: "c-g-am-f",
      title: "C - G - Am - F",
      chords: ["C", "G", "Am", "F"],
      mood: bpm >= 120 ? "시원한 전개" : "부드러운 전개",
      reason: "시작은 안정적이고 중간에 살짝 올라갔다가 다시 편하게 내려오는 진행입니다.",
      notes: chordNotes(["C", "G", "Am", "F"])
    },
    {
      id: "am-f-c-g",
      title: "Am - F - C - G",
      chords: ["Am", "F", "C", "G"],
      mood: "조금 감성적인 느낌",
      reason: "마이너 코드로 시작해서 살짝 진지하게 들리고, 뒤에서 C와 G가 균형을 잡아줍니다.",
      notes: chordNotes(["Am", "F", "C", "G"])
    }
  ];
}

function drumNote(pitch: number, startBeat: number, durationBeats = 0.25, velocity = 0.8) {
  return { pitch, startBeat, durationBeats, velocity };
}

function repeatPattern(pattern: Array<Omit<MidiNote, "id">>, bars = 4) {
  return Array.from({ length: bars }, (_, bar) => pattern.map((note) => ({ ...note, startBeat: note.startBeat + bar * 4 }))).flat();
}

export function generateDrumSuggestions(): DrumSuggestion[] {
  const basic = [
    drumNote(36, 0, 0.25, 0.9),
    drumNote(38, 2, 0.25, 0.82),
    drumNote(42, 0, 0.25, 0.45),
    drumNote(42, 1, 0.25, 0.42),
    drumNote(42, 2, 0.25, 0.45),
    drumNote(42, 3, 0.25, 0.42)
  ];
  const pop = [...basic, drumNote(36, 2.5, 0.25, 0.72), drumNote(42, 0.5, 0.25, 0.38), drumNote(42, 1.5, 0.25, 0.38), drumNote(42, 2.5, 0.25, 0.38), drumNote(42, 3.5, 0.25, 0.38)];
  const hiphop = [
    drumNote(36, 0, 0.25, 0.94),
    drumNote(36, 1.5, 0.25, 0.65),
    drumNote(38, 2, 0.25, 0.86),
    drumNote(36, 3.25, 0.25, 0.7),
    drumNote(42, 0, 0.25, 0.34),
    drumNote(42, 0.75, 0.25, 0.28),
    drumNote(42, 1.5, 0.25, 0.34),
    drumNote(42, 2.5, 0.25, 0.3),
    drumNote(42, 3.25, 0.25, 0.34)
  ];
  const dance = [
    drumNote(36, 0, 0.25, 0.95),
    drumNote(36, 1, 0.25, 0.92),
    drumNote(36, 2, 0.25, 0.95),
    drumNote(36, 3, 0.25, 0.92),
    drumNote(38, 1, 0.25, 0.58),
    drumNote(38, 3, 0.25, 0.62),
    drumNote(42, 0.5, 0.25, 0.42),
    drumNote(42, 1.5, 0.25, 0.42),
    drumNote(42, 2.5, 0.25, 0.42),
    drumNote(42, 3.5, 0.25, 0.42)
  ];

  return [
    { id: "basic", title: "기본", description: "킥과 스네어가 분명해서 처음 편곡에 잘 맞아요.", notes: repeatPattern(basic) },
    { id: "pop", title: "팝", description: "하이햇이 촘촘해서 밝은 팝 느낌이 납니다.", notes: repeatPattern(pop) },
    { id: "hiphop", title: "힙합", description: "킥 위치가 살짝 밀려서 여유로운 그루브가 생깁니다.", notes: repeatPattern(hiphop) },
    { id: "dance", title: "댄스", description: "4비트 킥이 계속 나와서 몸이 움직이는 느낌입니다.", notes: repeatPattern(dance) }
  ];
}

function selectedMidiClip(project: Project, selectedClipId?: string) {
  const clip = project.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
  if (clip?.type === "midi") return clip;
  return allMidiClips(project).find((item) => (item.notes?.length ?? 0) > 0) ?? allMidiClips(project)[0];
}

export function continueMelody(project: Project, selectedClipId?: string): MelodySuggestion[] {
  const clip = selectedMidiClip(project, selectedClipId);
  if (!clip) return [];
  const notes = [...(clip.notes ?? [])].sort((a, b) => a.startBeat - b.startBeat);
  const fallbackPitches = [60, 62, 64, 67, 69, 67, 64, 62];
  const lastNote = notes[notes.length - 1];
  const minPitch = notes.length ? Math.min(...notes.map((note) => note.pitch)) : 60;
  const maxPitch = notes.length ? Math.max(...notes.map((note) => note.pitch)) : 69;
  const rhythm = notes.slice(-4).map((note) => Math.max(0.25, note.durationBeats));
  const durations = rhythm.length > 0 ? rhythm : [0.5, 0.5, 1, 1];
  const startBeat = Math.max(clip.lengthBeats, lastNote ? lastNote.startBeat + lastNote.durationBeats : 0);
  const center = lastNote?.pitch ?? 64;
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];

  function closestScalePitch(target: number) {
    const candidates = scale.flatMap((pitch) => [pitch - 12, pitch, pitch + 12]);
    return candidates.sort((left, right) => Math.abs(left - target) - Math.abs(right - target))[0];
  }

  const shapes = [
    { id: "answer", title: "대답처럼 이어가기", intervals: [0, 2, 4, 2, 0, -2, 0, -5] },
    { id: "lift", title: "살짝 올라가기", intervals: [0, 2, 4, 5, 7, 5, 4, 0] },
    { id: "calm", title: "차분하게 내려가기", intervals: [0, -2, -3, -5, -3, -2, 0, -7] }
  ];

  return shapes.map((shape) => {
    let beat = startBeat;
    const generated = shape.intervals.map((interval, index) => {
      const durationBeats = durations[index % durations.length];
      const rawPitch = notes.length ? center + interval : fallbackPitches[index % fallbackPitches.length];
      const pitch = Math.max(minPitch - 5, Math.min(maxPitch + 5, closestScalePitch(rawPitch)));
      const note = { pitch, startBeat: beat, durationBeats, velocity: index % 4 === 0 ? 0.82 : 0.72 };
      beat += durationBeats;
      return note;
    });
    return {
      id: shape.id,
      title: shape.title,
      sourceClipId: clip.id,
      startBeat,
      notes: generated,
      explanation: `마지막 음 ${lastNote ? pitchName(lastNote.pitch) : "도"} 근처에서 시작하고, 기존 리듬 길이를 반복해서 자연스럽게 이어집니다.`
    };
  });
}

export function explainProject(project: Project, selectedClipId?: string): LearningFeedback {
  return optionalMusicFeedback(project, selectedClipId);
}
