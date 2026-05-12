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
    return "사용한 음 종류가 적습니다. 3~5개의 음으로 작은 질문-대답 패턴을 만들어보세요.";
  }

  if (!analysis.hasStableBeginnerRange) {
    return `사용한 음은 ${analysis.pitchClassNames.join(", ")}입니다. 음역이 ${analysis.rangeSemitones}반음이라 넓게 들릴 수 있으니 중심 음 주변으로 조금 모아보세요.`;
  }

  return `사용한 음은 ${analysis.pitchClassNames.join(", ")}입니다. ${analysis.rangeSemitones}반음 안에서 움직여 초보자 멜로디로 안정적입니다.`;
}
