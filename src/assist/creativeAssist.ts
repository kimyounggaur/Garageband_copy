import type { Clip, MidiNote, Project, Track, TrackRole } from "../types/project";

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

export type LearningFeedback = {
  usedNotes: string;
  repeatedPattern: string;
  range: string;
  density: string;
  tension: string;
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
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

function trackRole(track: Track): TrackRole {
  if (track.role) return track.role;
  if (track.type === "drum") return "beat";
  if (track.type === "audio") return "recording";
  const lower = track.name.toLowerCase();
  if (lower.includes("bass")) return "bass";
  if (lower.includes("chord") || lower.includes("key") || lower.includes("pad")) return "harmony";
  return "melody";
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
      ? "아직 MIDI 음이 적어서 가장 익숙한 C장조 진행으로 시작합니다."
      : `프로젝트에서 ${NOTE_NAMES[pitchClass]} 계열 음이 자주 보여서 C장조 안에서 안정적인 진행을 골랐습니다.`;
  const energy = bpm >= 125 ? "밝고 빠른 느낌" : bpm <= 90 ? "차분한 느낌" : "자연스러운 팝 느낌";

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
      mood: bpm >= 120 ? "시원한 후렴 느낌" : "부드러운 전개",
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
    { id: "basic", title: "Basic", description: "킥과 스네어가 분명해서 처음 편곡에 잘 맞아요.", notes: repeatPattern(basic) },
    { id: "pop", title: "Pop", description: "하이햇이 촘촘해서 밝은 팝 느낌이 납니다.", notes: repeatPattern(pop) },
    { id: "hiphop", title: "Hiphop", description: "킥 위치가 살짝 밀려서 여유로운 그루브가 생깁니다.", notes: repeatPattern(hiphop) },
    { id: "dance", title: "Dance", description: "4비트 킥이 계속 나와서 몸이 움직이는 느낌입니다.", notes: repeatPattern(dance) }
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
    { id: "answer", title: "대답처럼 이어쓰기", intervals: [0, 2, 4, 2, 0, -2, 0, -5] },
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
      explanation: `마지막 음 ${lastNote ? pitchName(lastNote.pitch) : "C"} 근처에서 시작하고, 기존 리듬 길이를 반복해서 자연스럽게 이어집니다.`
    };
  });
}

export function explainProject(project: Project, selectedClipId?: string): LearningFeedback {
  const notes = selectedMidiClip(project, selectedClipId)?.notes ?? allMidiNotes(project);
  const pitchClasses = Array.from(new Set(notes.map((note) => pitchName(note.pitch))));
  const durations = notes.map((note) => note.durationBeats);
  const range = notes.length ? Math.max(...notes.map((note) => note.pitch)) - Math.min(...notes.map((note) => note.pitch)) : 0;
  const shortNotes = durations.filter((duration) => duration <= 0.5).length;
  const longNotes = durations.filter((duration) => duration >= 1).length;
  const density = notes.length >= 16 ? "음이 촘촘해서 에너지가 있어요." : notes.length >= 6 ? "음이 적당해서 따라 부르기 쉬워요." : "음 사이에 쉼이 많아서 여유롭게 들려요.";
  const hasRepeatedDuration = durations.some((duration, index) => index > 0 && duration === durations[index - 1]);
  const roles = project.tracks.filter((track) => track.clips.length > 0).map(trackRole);

  return {
    usedNotes: pitchClasses.length > 0 ? `사용한 음은 ${pitchClasses.join(", ")}입니다.` : "아직 분석할 MIDI 음이 많지 않아요.",
    repeatedPattern: hasRepeatedDuration ? "비슷한 길이의 음이 반복되어 기억하기 쉬운 패턴이 생깁니다." : "리듬 길이가 다양해서 말하듯이 들립니다.",
    range: range > 18 ? `음역이 ${range}반음이라 넓고 극적으로 들려요.` : range > 0 ? `음역이 ${range}반음이라 안정적으로 들려요.` : "음역은 아직 좁습니다.",
    density: `${density} 짧은 음 ${shortNotes}개, 긴 음 ${longNotes}개가 보여요.`,
    tension: roles.includes("beat") && roles.includes("bass") ? "비트와 베이스가 안정감을 만들고, 높은 멜로디 음은 살짝 긴장감을 줍니다." : "아직 반주 역할이 적어서 멜로디가 더 도드라지게 들립니다."
  };
}
