import type { Project, Track } from "../types/project";
import { analyzeProjectNotes, getTheoryHint } from "../assist/musicTheory";
import { evaluateLesson, getProjectEndBeat } from "./evaluateMission";
import { getLessonById } from "./lessons";
import type { ReviewItem } from "./types";

function roleLabel(track: Track) {
  return track.role ?? track.type;
}

export function reviewProject(project: Project): ReviewItem[] {
  const items: ReviewItem[] = [];
  const endBeat = getProjectEndBeat(project);
  const bars = Math.round((endBeat / 4) * 10) / 10;
  const activeTracks = project.tracks.filter((track) => track.clips.length > 0);
  const emptyTracks = project.tracks.filter((track) => track.clips.length === 0);
  const hasBeat = project.tracks.some((track) => (track.role === "beat" || track.type === "drum") && track.clips.length > 0);
  const hasBass = project.tracks.some((track) => track.role === "bass" && track.clips.length > 0);
  const hasMelody = project.tracks.some((track) => track.role === "melody" && track.clips.some((clip) => clip.type === "midi" && (clip.notes?.length ?? 0) > 0));

  items.push({
    id: "length",
    title: "곡 길이",
    severity: endBeat >= 32 ? "good" : "warning",
    message: endBeat >= 32 ? `${bars}마디 길이로 수업 제출 기준을 충족합니다.` : "최소 8마디 이상으로 늘리면 아이디어가 더 잘 들립니다."
  });

  items.push({
    id: "track-balance",
    title: "트랙 구성",
    severity: activeTracks.length >= 2 ? "good" : "warning",
    message:
      activeTracks.length >= 2
        ? `${activeTracks.length}개 트랙이 소리를 내고 있습니다.`
        : "비트, 베이스, 멜로디 중 하나를 더 추가해보세요."
  });

  if (emptyTracks.length > 0) {
    items.push({
      id: "empty-tracks",
      title: "빈 트랙",
      severity: "info",
      message: `${emptyTracks.map((track) => `${track.name}(${roleLabel(track)})`).join(", ")} 트랙이 비어 있습니다. 필요 없으면 정리하거나 아이디어를 넣어보세요.`
    });
  }

  items.push({
    id: "arrangement-balance",
    title: "비트/베이스/멜로디 균형",
    severity: hasBeat && (hasBass || hasMelody) ? "good" : "warning",
    message:
      hasBeat && hasBass && hasMelody
        ? "리듬, 저음, 멜로디가 모두 있어서 완성된 편곡에 가깝습니다."
        : hasBeat && (hasBass || hasMelody)
          ? "기본 반주가 갖춰졌습니다. 남은 역할을 추가하면 더 탄탄해집니다."
          : "먼저 비트 트랙을 기준으로 잡고 다른 소리를 얹어보세요."
  });

  const lesson = getLessonById(project.lessonId);
  if (lesson) {
    const incomplete = evaluateLesson(project, lesson).filter((result) => !result.completed);
    items.push({
      id: "missions",
      title: "레슨 미션",
      severity: incomplete.length === 0 ? "good" : "warning",
      message:
        incomplete.length === 0
          ? "현재 레슨의 모든 미션이 완료되었습니다."
          : `${incomplete.length}개 미션이 남았습니다. Lesson 모드에서 힌트를 확인하세요.`
    });
  }

  const noteAnalysis = analyzeProjectNotes(project);
  const theoryHint = getTheoryHint(project);
  if (theoryHint) {
    items.push({
      id: "theory-notes",
      title: "멜로디 힌트",
      severity: noteAnalysis.pitchClassNames.length >= 4 && noteAnalysis.hasStableBeginnerRange ? "good" : "info",
      message: theoryHint
    });
  }

  return items;
}
