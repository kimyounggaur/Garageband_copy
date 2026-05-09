import type { Clip, Project, Track, TrackRole } from "../types/project";
import { analyzeProjectNotes, getTheoryHint } from "../assist/musicTheory";
import { evaluateLesson, getProjectEndBeat } from "./evaluateMission";
import { getLessonById } from "./lessons";
import type { Lesson, ReviewItem, ReviewRubricCheck, ReviewRubricStatus, ReviewSummary } from "./types";

const MIN_PROJECT_BEATS = 32;
const MIN_CLIP_BEATS = 1;
const MIN_MIDI_NOTES = 6;

function roleLabel(track: Track) {
  return track.role ?? track.type;
}

function trackRole(track: Track): TrackRole {
  if (track.role) return track.role;
  const lower = track.name.toLowerCase();
  if (track.type === "drum" || lower.includes("beat") || lower.includes("drum")) return "beat";
  if (track.type === "audio" || lower.includes("record")) return "recording";
  if (lower.includes("bass")) return "bass";
  if (lower.includes("chord") || lower.includes("key") || lower.includes("pad")) return "harmony";
  return "melody";
}

function clips(project: Project) {
  return project.tracks.flatMap((track) => track.clips);
}

function clipsForRole(project: Project, role: TrackRole) {
  return project.tracks.filter((track) => trackRole(track) === role).flatMap((track) => track.clips);
}

function hasRole(project: Project, role: TrackRole) {
  return clipsForRole(project, role).length > 0;
}

function midiNoteCount(project: Project) {
  return clips(project)
    .filter((clip) => clip.type === "midi")
    .reduce((sum, clip) => sum + (clip.notes?.length ?? 0), 0);
}

function audioClipCount(project: Project) {
  return clips(project).filter((clip) => clip.type === "audio").length;
}

function shortClips(project: Project) {
  return clips(project).filter((clip) => clip.lengthBeats < MIN_CLIP_BEATS);
}

function repeatedLoopCount(project: Project) {
  return clips(project).filter((clip) => clip.type === "loop" && clip.lengthBeats >= 8).length;
}

function distinctSections(project: Project, minGapBeats = 24) {
  const starts = clips(project)
    .map((clip) => clip.startBeat)
    .sort((a, b) => a - b);
  if (starts.length === 0) return 0;

  let sections = 1;
  let sectionStart = starts[0];
  starts.forEach((start) => {
    if (start - sectionStart >= minGapBeats) {
      sections += 1;
      sectionStart = start;
    }
  });
  return sections;
}

function barsForBeat(beat: number) {
  return Math.round((beat / 4) * 10) / 10;
}

function goodCheck(id: string, label: string, detail: string): ReviewRubricCheck {
  return { id, label, completed: true, detail };
}

function missingCheck(id: string, label: string, detail: string): ReviewRubricCheck {
  return { id, label, completed: false, detail };
}

function buildReviewItems(project: Project, lesson?: Lesson): ReviewItem[] {
  const items: ReviewItem[] = [];
  const allClips = clips(project);
  const endBeat = getProjectEndBeat(project);
  const bars = barsForBeat(endBeat);
  const activeTracks = project.tracks.filter((track) => track.clips.length > 0);
  const emptyTracks = project.tracks.filter((track) => track.clips.length === 0);
  const tinyClips = shortClips(project);
  const hasBeat = hasRole(project, "beat") || project.tracks.some((track) => track.type === "drum" && track.clips.length > 0);
  const hasBass = hasRole(project, "bass");
  const hasMelody = hasRole(project, "melody") && midiNoteCount(project) > 0;
  const hasAudio = audioClipCount(project) > 0;
  const repeats = repeatedLoopCount(project);
  const sections = distinctSections(project);
  const notes = midiNoteCount(project);

  items.push({
    id: "length",
    title: "곡 길이",
    severity: endBeat >= MIN_PROJECT_BEATS ? "good" : "warning",
    category: "length",
    autoCheck: true,
    message:
      endBeat >= MIN_PROJECT_BEATS
        ? `${bars}마디예요. 제출 길이는 충분합니다.`
        : `지금은 ${bars}마디예요. 8마디까지 늘려보세요.`,
    detail: `현재 ${endBeat} / ${MIN_PROJECT_BEATS} beats`
  });

  items.push({
    id: "track-balance",
    title: "트랙 구성",
    severity: activeTracks.length >= 2 ? "good" : "warning",
    category: "tracks",
    autoCheck: true,
    message:
      activeTracks.length >= 2
        ? `${activeTracks.length}개 트랙이 소리를 내고 있어요.`
        : "비트, 베이스, 멜로디 중 하나를 더 추가해보세요.",
    detail: `Active tracks: ${activeTracks.length} / ${project.tracks.length}`
  });

  if (emptyTracks.length > 0) {
    items.push({
      id: "empty-tracks",
      title: "빈 트랙",
      severity: "info",
      category: "tracks",
      autoCheck: true,
      message: `${emptyTracks.length}개 빈 트랙이 있어요. 필요 없으면 정리해도 됩니다.`,
      detail: emptyTracks.map((track) => `${track.name}(${roleLabel(track)})`).join(", ")
    });
  }

  items.push({
    id: "short-clips",
    title: "너무 짧은 클립",
    severity: tinyClips.length === 0 ? "good" : "warning",
    category: "clips",
    autoCheck: true,
    message:
      tinyClips.length === 0
        ? "너무 짧게 잘린 클립은 보이지 않아요."
        : `${tinyClips.length}개 클립이 아주 짧아요. 실수로 잘렸는지 확인해보세요.`,
    detail: tinyClips.map((clip) => `${clip.name}(${clip.lengthBeats}b)`).join(", ") || "No tiny clips"
  });

  items.push({
    id: "arrangement-balance",
    title: "드럼/베이스/멜로디 균형",
    severity: hasBeat && hasBass && hasMelody ? "good" : hasBeat && (hasBass || hasMelody) ? "info" : "warning",
    category: "balance",
    autoCheck: true,
    message:
      hasBeat && hasBass && hasMelody
        ? "드럼, 베이스, 멜로디가 모두 들려요."
        : hasBeat && (hasBass || hasMelody)
          ? "기본 반주는 좋아요. 빠진 역할을 하나 더 넣으면 탄탄해집니다."
          : "먼저 드럼 비트를 기준으로 잡아보세요.",
    detail: `Drums ${hasBeat ? "yes" : "no"}, bass ${hasBass ? "yes" : "no"}, melody ${hasMelody ? "yes" : "no"}`
  });

  items.push({
    id: "repetition",
    title: "반복 구간",
    severity: repeats >= 2 || sections >= 2 ? "good" : "warning",
    category: "structure",
    autoCheck: true,
    message:
      repeats >= 2 || sections >= 2
        ? "반복되는 구간이 보여요. 곡의 흐름이 잡혔습니다."
        : "좋은 부분을 한 번 더 반복하면 곡처럼 들려요.",
    detail: `Repeated long loops: ${repeats}, sections: ${sections}`
  });

  items.push({
    id: "midi-notes",
    title: "MIDI 노트",
    severity: notes >= MIN_MIDI_NOTES ? "good" : "warning",
    category: "midi",
    autoCheck: true,
    message: notes >= MIN_MIDI_NOTES ? `${notes}개 노트가 있어요.` : `MIDI 노트를 ${MIN_MIDI_NOTES - notes}개 더 넣어보세요.`,
    detail: `${notes} / ${MIN_MIDI_NOTES} notes`
  });

  items.push({
    id: "audio-recording",
    title: "오디오 녹음",
    severity: hasAudio ? "good" : lesson?.id === "recording-layer" ? "warning" : "info",
    category: "audio",
    autoCheck: true,
    message: hasAudio ? "직접 녹음하거나 업로드한 오디오가 있어요." : "직접 만든 소리를 넣으면 더 개성 있어요.",
    detail: `${audioClipCount(project)} audio clips`
  });

  const lessonResults = evaluateLesson(project, lesson);
  if (lesson) {
    const incomplete = lessonResults.filter((result) => !result.completed);
    items.push({
      id: "missions",
      title: "레슨 미션",
      severity: incomplete.length === 0 ? "good" : "warning",
      category: "lesson",
      autoCheck: true,
      message:
        incomplete.length === 0
          ? "레슨 미션을 모두 완료했어요."
          : `${incomplete.length}개 미션이 남았어요. Lesson 모드에서 힌트를 확인해보세요.`,
      detail: lessonResults.map((result) => `${result.missionId}: ${result.summary}`).join("; ")
    });
  }

  const noteAnalysis = analyzeProjectNotes(project);
  const theoryHint = getTheoryHint(project);
  if (theoryHint && allClips.length > 0) {
    items.push({
      id: "theory-notes",
      title: "멜로디 힌트",
      severity: noteAnalysis.pitchClassNames.length >= 4 && noteAnalysis.hasStableBeginnerRange ? "good" : "info",
      category: "midi",
      autoCheck: true,
      message: theoryHint,
      detail: `Pitch classes: ${noteAnalysis.pitchClassNames.join(", ") || "none"}`
    });
  }

  return items;
}

function rubricLevels(criterion: Lesson["rubric"]["criteria"][number], autoChecks: ReviewRubricCheck[]) {
  const completed = autoChecks.filter((check) => check.completed).length;
  const levelIndex = Math.max(0, Math.min(criterion.levels.length - 1, completed - 1));
  return criterion.levels[levelIndex]?.label ?? criterion.levels[0]?.label ?? "확인";
}

function defaultRubric(project: Project): Lesson["rubric"] {
  return {
    criteria: [
      {
        id: "readiness",
        title: "제출 준비",
        levels: [
          { label: "시작", description: "기본 아이디어가 있다." },
          { label: "성장", description: "길이와 트랙 구성이 갖춰진다." },
          { label: "완성", description: "반복과 직접 만든 요소가 들린다." }
        ]
      },
      {
        id: "balance",
        title: "균형",
        levels: [
          { label: "시작", description: "한 역할이 들린다." },
          { label: "성장", description: "두 역할 이상이 함께 들린다." },
          { label: "완성", description: "드럼, 베이스, 멜로디 또는 녹음이 어울린다." }
        ]
      },
      {
        id: "craft",
        title: "정리",
        levels: [
          { label: "시작", description: "클립이 배치되어 있다." },
          { label: "성장", description: "짧게 잘린 클립과 빈 트랙을 확인했다." },
          { label: "완성", description: "제출 전 체크를 끝냈다." }
        ]
      }
    ]
  };
}

function buildRubricStatus(project: Project, lesson?: Lesson): ReviewRubricStatus[] {
  const rubric = lesson?.rubric ?? defaultRubric(project);
  const endBeat = getProjectEndBeat(project);
  const notes = midiNoteCount(project);
  const audioCount = audioClipCount(project);
  const tinyClipCount = shortClips(project).length;
  const repeats = repeatedLoopCount(project);
  const sections = distinctSections(project);
  const hasBeat = hasRole(project, "beat") || project.tracks.some((track) => track.type === "drum" && track.clips.length > 0);
  const hasBass = hasRole(project, "bass");
  const hasMelody = hasRole(project, "melody") && notes > 0;

  return rubric.criteria.map((criterion) => {
    let autoChecks: ReviewRubricCheck[];
    let manualChecks: ReviewRubricCheck[];

    if (criterion.id === "rhythm") {
      autoChecks = [
        hasBeat
          ? goodCheck("beat-track", "비트가 있음", "드럼 또는 beat 역할 트랙이 소리를 냅니다.")
          : missingCheck("beat-track", "비트가 있음", "드럼 루프나 비트 트랙을 추가하세요."),
        repeats >= 1
          ? goodCheck("rhythm-repeat", "반복이 있음", "긴 루프가 반복 구간을 만듭니다.")
          : missingCheck("rhythm-repeat", "반복이 있음", "좋은 리듬을 한 번 더 이어보세요.")
      ];
      manualChecks = [
        missingCheck("rhythm-feel", "박자가 자연스럽게 들림", "교사가 듣고 체크합니다."),
        missingCheck("rhythm-variation", "반복에 작은 변화가 있음", "교사가 듣고 체크합니다.")
      ];
    } else if (criterion.id === "structure") {
      autoChecks = [
        endBeat >= MIN_PROJECT_BEATS
          ? goodCheck("length", "8마디 이상", `${barsForBeat(endBeat)}마디 길이입니다.`)
          : missingCheck("length", "8마디 이상", "클립을 늘려 8마디를 채우세요."),
        sections >= 2 || endBeat >= 64
          ? goodCheck("sections", "구간이 나뉨", "두 구간 이상의 흐름이 보입니다.")
          : missingCheck("sections", "구간이 나뉨", "뒤쪽에 다른 클립이나 변화를 추가하세요.")
      ];
      manualChecks = [
        missingCheck("clear-start", "시작이 분명함", "교사가 듣고 체크합니다."),
        missingCheck("clear-ending", "마무리가 어색하지 않음", "교사가 듣고 체크합니다.")
      ];
    } else if (criterion.id === "creativity") {
      autoChecks = [
        notes >= MIN_MIDI_NOTES || audioCount > 0
          ? goodCheck("custom-sound", "직접 만든 요소", "MIDI 노트 또는 오디오 클립이 있습니다.")
          : missingCheck("custom-sound", "직접 만든 요소", "MIDI 노트나 녹음을 추가하세요."),
        audioCount > 0
          ? goodCheck("audio-layer", "녹음/업로드 활용", "오디오 클립이 포함되어 있습니다.")
          : missingCheck("audio-layer", "녹음/업로드 활용", "녹음은 선택이지만 개성을 더해줍니다.")
      ];
      manualChecks = [
        missingCheck("intent", "표현 의도가 느껴짐", "교사가 듣고 체크합니다."),
        missingCheck("sound-choice", "소리 선택이 어울림", "교사가 듣고 체크합니다.")
      ];
    } else if (criterion.id === "balance") {
      autoChecks = [
        hasBeat
          ? goodCheck("has-beat", "드럼/비트", "비트 역할이 있습니다.")
          : missingCheck("has-beat", "드럼/비트", "비트를 추가하세요."),
        hasBass || hasMelody
          ? goodCheck("has-second-role", "두 번째 역할", "베이스 또는 멜로디가 있습니다.")
          : missingCheck("has-second-role", "두 번째 역할", "베이스나 멜로디를 추가하세요.")
      ];
      manualChecks = [missingCheck("mix-balance", "소리 크기가 적당함", "교사가 듣고 체크합니다.")];
    } else if (criterion.id === "craft") {
      autoChecks = [
        tinyClipCount === 0
          ? goodCheck("no-tiny-clips", "짧은 클립 정리", "너무 짧은 클립이 없습니다.")
          : missingCheck("no-tiny-clips", "짧은 클립 정리", `${tinyClipCount}개 짧은 클립을 확인하세요.`),
        project.tracks.some((track) => track.clips.length > 0)
          ? goodCheck("has-clips", "클립 배치", "하나 이상의 클립이 있습니다.")
          : missingCheck("has-clips", "클립 배치", "타임라인에 클립을 추가하세요.")
      ];
      manualChecks = [missingCheck("student-name", "제출 전 이름/파일 확인", "교사가 확인하거나 학생이 체크합니다.")];
    } else {
      autoChecks = [
        endBeat >= MIN_PROJECT_BEATS
          ? goodCheck("length", "길이 확인", `${barsForBeat(endBeat)}마디입니다.`)
          : missingCheck("length", "길이 확인", "8마디 이상으로 늘려보세요."),
        clips(project).length > 0
          ? goodCheck("content", "소리 있음", "타임라인에 클립이 있습니다.")
          : missingCheck("content", "소리 있음", "클립을 추가하세요.")
      ];
      manualChecks = [missingCheck("teacher-listen", "교사 청취 확인", "교사가 듣고 체크합니다.")];
    }

    return {
      criterionId: criterion.id,
      title: criterion.title,
      autoChecks,
      manualChecks,
      suggestedLevel: rubricLevels(criterion, autoChecks),
      completed: autoChecks.every((check) => check.completed)
    };
  });
}

export function createReviewSummary(project: Project): ReviewSummary {
  const lesson = getLessonById(project.lessonId);
  const items = buildReviewItems(project, lesson);
  const missionResults = evaluateLesson(project, lesson);
  const rubric = buildRubricStatus(project, lesson);
  const blockingWarnings = items.filter((item) => item.severity === "warning");
  const incompleteMissions = missionResults.filter((result) => !result.completed);
  const incompleteRubric = rubric.filter((criterion) => !criterion.completed);
  const ready = blockingWarnings.length === 0 && incompleteMissions.length === 0 && incompleteRubric.length === 0;

  return {
    projectId: project.id,
    projectName: project.name,
    lessonId: lesson?.id,
    lessonTitle: lesson?.title,
    ready,
    statusLabel: ready ? "제출 준비됨" : "보완 필요",
    studentMessage: ready ? "좋아요. 제출해도 됩니다." : "조금만 더 다듬으면 좋아요.",
    teacherSummary: ready
      ? "자동 체크와 레슨 미션이 모두 완료되었습니다."
      : `${blockingWarnings.length}개 자동 보완 항목, ${incompleteMissions.length}개 미션, ${incompleteRubric.length}개 루브릭 기준 확인 필요`,
    items,
    missionResults,
    rubric
  };
}

export function reviewProject(project: Project): ReviewItem[] {
  return createReviewSummary(project).items;
}
