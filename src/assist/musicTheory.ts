import type { Project } from "../types/project";

const PITCH_CLASS_NAMES = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];

function midiNotes(project: Project) {
  return project.tracks.flatMap((track) => track.clips).flatMap((clip) => clip.notes ?? []);
}

export function analyzeProjectNotes(project: Project) {
  const notes = midiNotes(project);
  const pitches = notes.map((note) => note.pitch);
  const pitchClasses = Array.from(new Set(pitches.map((pitch) => pitch % 12))).sort((a, b) => a - b);
  const rangeSemitones = pitches.length > 0 ? Math.max(...pitches) - Math.min(...pitches) : 0;

  return {
    noteCount: notes.length,
    pitchClassNames: pitchClasses.map((pitchClass) => PITCH_CLASS_NAMES[pitchClass]),
    rangeSemitones,
    hasStableBeginnerRange: rangeSemitones > 0 && rangeSemitones <= 18
  };
}

export function getTheoryHint(project: Project) {
  const analysis = analyzeProjectNotes(project);
  if (analysis.noteCount === 0) return undefined;

  if (analysis.pitchClassNames.length < 3) {
    return `사용한 음 종류는 ${analysis.pitchClassNames.length}개입니다. 다른 음 하나를 더 넣어 앞뒤 느낌을 비교해 보세요.`;
  }

  if (!analysis.hasStableBeginnerRange) {
    return `사용한 음은 ${analysis.pitchClassNames.join(", ")}이고 음역은 ${analysis.rangeSemitones}반음입니다. 다음 시도에서는 한 구간의 음역을 좁혀 차이를 들어보세요.`;
  }

  return `사용한 음은 ${analysis.pitchClassNames.join(", ")}이고 음역은 ${analysis.rangeSemitones}반음입니다. 한 구간에서 음 하나를 바꿔 느낌을 비교해 보세요.`;
}
