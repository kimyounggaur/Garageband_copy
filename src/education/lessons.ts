import { CURRENT_PROJECT_VERSION, type Clip, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "../utils/id";
import type { Lesson, Mission, Rubric } from "./types";

const startedAt = 1_764_800_000_000;

function clip(
  id: string,
  trackId: string,
  name: string,
  loopId: string,
  color: string,
  startBeat: number,
  lengthBeats: number,
  locked = true,
  instructions?: string
): Clip {
  return {
    id,
    trackId,
    type: "loop",
    name,
    loopId,
    color,
    startBeat,
    lengthBeats,
    locked,
    instructions
  };
}

function midiClip(id: string, trackId: string, name: string, color: string, startBeat: number, notes = 0): Clip {
  return {
    id,
    trackId,
    type: "midi",
    name,
    color,
    startBeat,
    lengthBeats: 8,
    notes: Array.from({ length: notes }, (_, index) => ({
      id: `${id}-note-${index}`,
      pitch: 60 + (index % 5) * 2,
      startBeat: index,
      durationBeats: 0.75,
      velocity: 0.74
    })),
    locked: notes > 0,
    instructions: notes > 0 ? "예시 멜로디입니다. 이어지는 빈 공간에 자신만의 응답을 만들어보세요." : undefined
  };
}

function track(id: string, name: string, type: TrackType, role: TrackRole, color: string, clips: Clip[] = []): Track {
  return {
    id,
    name,
    type,
    role,
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    color,
    clips
  };
}

function project(id: string, name: string, bpm: number, tracks: Track[]): Project {
  return {
    id,
    version: CURRENT_PROJECT_VERSION,
    name,
    bpm,
    timeSignature: [4, 4],
    tracks,
    lessonProgress: {},
    createdAt: startedAt,
    updatedAt: startedAt
  };
}

const sharedRubric: Rubric = {
  criteria: [
    {
      id: "rhythm",
      title: "리듬",
      levels: [
        { label: "시작", description: "마디에 맞춰 기본 패턴을 배치했다." },
        { label: "성장", description: "반복과 변화가 구분된다." },
        { label: "완성", description: "비트가 곡 전체를 안정적으로 이끈다." }
      ]
    },
    {
      id: "structure",
      title: "구조",
      levels: [
        { label: "시작", description: "8마디 이상의 흐름이 있다." },
        { label: "성장", description: "A/B처럼 구간의 차이가 있다." },
        { label: "완성", description: "시작, 전개, 마무리가 자연스럽다." }
      ]
    },
    {
      id: "creativity",
      title: "창의성",
      levels: [
        { label: "시작", description: "루프를 조합해 의도를 표현했다." },
        { label: "성장", description: "직접 만든 미디나 녹음이 포함된다." },
        { label: "완성", description: "자신만의 소리 선택과 변형이 들린다." }
      ]
    }
  ]
};

const drumMissions: Mission[] = [
  {
    id: "drum-8-bars",
    title: "8마디 비트 만들기",
    description: "드럼 역할 트랙에 8마디 이상 루프를 배치하세요.",
    hint: "왼쪽 사운드 패널의 드럼 루프를 비트 트랙으로 드래그하면 빠르게 시작할 수 있어요.",
    check: { type: "minTrackClipBeats", role: "beat", beats: 32 }
  },
  {
    id: "drum-length",
    title: "곡 길이 확보",
    description: "프로젝트 전체 길이를 8마디 이상으로 만드세요.",
    hint: "클립의 오른쪽 모서리를 잡아 길이를 늘려보세요.",
    check: { type: "minProjectLength", beats: 32 }
  }
];

const bassMissions: Mission[] = [
  {
    id: "bass-phrase",
    title: "베이스 8마디 추가",
    description: "베이스 역할 트랙에 8마디 이상 사운드를 배치하세요.",
    hint: "베이스 카테고리의 루프를 사용하거나 미디 클립으로 직접 만들 수 있어요.",
    check: { type: "minTrackClipBeats", role: "bass", beats: 32 }
  },
  {
    id: "beat-bass-balance",
    title: "비트와 베이스 함께 듣기",
    description: "비트와 베이스 트랙이 모두 소리를 내야 합니다.",
    hint: "두 트랙 모두 음소거가 꺼져 있는지 확인하세요.",
    check: { type: "minTracksWithClips", roles: ["beat", "bass"] }
  }
];

const melodyMissions: Mission[] = [
  {
    id: "melody-notes",
    title: "멜로디 노트 6개 입력",
    description: "멜로디 역할 미디 클립에 노트 6개 이상을 입력하세요.",
    hint: "미디 클립을 선택하면 아래 피아노롤에서 노트를 추가할 수 있어요.",
    check: { type: "minMidiNotes", role: "melody", count: 6 }
  },
  {
    id: "melody-length",
    title: "8마디 안에서 멜로디 완성",
    description: "멜로디가 들어간 프로젝트 길이를 8마디 이상으로 유지하세요.",
    hint: "비어 있는 뒤쪽 마디에 질문과 대답처럼 음을 배치해보세요.",
    check: { type: "minProjectLength", beats: 32 }
  }
];

const structureMissions: Mission[] = [
  {
    id: "structure-16-bars",
    title: "16마디 구조 만들기",
    description: "곡 길이를 16마디 이상으로 확장하세요.",
    hint: "A구간 8마디, B구간 8마디처럼 생각하면 쉬워요.",
    check: { type: "minProjectLength", beats: 64 }
  },
  {
    id: "structure-two-sections",
    title: "A/B 구간 구분",
    description: "서로 떨어진 두 구간에 클립을 배치해 구조를 만드세요.",
    hint: "9마디 이후에 다른 루프나 미디 아이디어를 추가해보세요.",
    check: { type: "minDistinctSections", sections: 2, minGapBeats: 24 }
  }
];

const recordingMissions: Mission[] = [
  {
    id: "recording-audio-clip",
    title: "녹음 클립 추가",
    description: "녹음 역할 트랙에 오디오 클립을 1개 이상 추가하세요.",
    hint: "목소리, 박수, 악기 소리를 녹음하거나 오디오 파일을 업로드해보세요.",
    check: { type: "minAudioClips", count: 1 }
  },
  {
    id: "recording-balance",
    title: "녹음과 반주 균형",
    description: "비트와 녹음 트랙이 함께 구성되어야 합니다.",
    hint: "녹음 소리가 너무 크면 믹서에서 볼륨을 낮춰보세요.",
    check: { type: "minTracksWithClips", roles: ["beat", "recording"] }
  }
];

export const LESSONS: Lesson[] = [
  {
    id: "drum-foundation",
    title: "드럼 만들기",
    goal: "4/4 박자 위에 8마디 비트를 만들며 마디 감각을 익힙니다.",
    difficulty: "starter",
    estimatedMinutes: 12,
    templateProject: project("lesson-drum-template", "레슨 1 - 드럼 기초", 120, [
      track("lesson-drum-beat", "비트", "drum", "beat", "#38bdf8"),
      track("lesson-drum-bass", "베이스", "instrument", "bass", "#f59e0b")
    ]),
    missions: drumMissions,
    rubric: sharedRubric
  },
  {
    id: "bass-layer",
    title: "베이스 추가",
    goal: "드럼 위에 베이스를 얹어 곡의 중심을 만듭니다.",
    difficulty: "starter",
    estimatedMinutes: 15,
    templateProject: project("lesson-bass-template", "레슨 2 - 베이스 레이어", 116, [
      track("lesson-bass-beat", "비트", "drum", "beat", "#38bdf8", [
        clip("lesson-bass-drum-loop", "lesson-bass-beat", "잠긴 드럼 가이드", "drums-grid", "#38bdf8", 0, 32, true, "이 비트는 기준 반주입니다.")
      ]),
      track("lesson-bass-track", "베이스", "instrument", "bass", "#f59e0b")
    ]),
    missions: bassMissions,
    rubric: sharedRubric
  },
  {
    id: "melody-sketch",
    title: "멜로디 만들기",
    goal: "짧은 음들을 배치해 질문과 대답이 있는 멜로디를 만듭니다.",
    difficulty: "builder",
    estimatedMinutes: 18,
    templateProject: project("lesson-melody-template", "레슨 3 - 멜로디 스케치", 110, [
      track("lesson-melody-beat", "비트", "drum", "beat", "#38bdf8", [
        clip("lesson-melody-drum-loop", "lesson-melody-beat", "부드러운 비트 가이드", "drums-electro", "#22c55e", 0, 32, true)
      ]),
      track("lesson-melody-bass", "베이스", "instrument", "bass", "#f59e0b", [
        clip("lesson-melody-bass-loop", "lesson-melody-bass", "베이스 가이드", "bass-clean", "#fb7185", 0, 32, true)
      ]),
      track("lesson-melody-track", "멜로디", "instrument", "melody", "#a78bfa", [
        midiClip("lesson-melody-empty", "lesson-melody-track", "나의 멜로디", "#a78bfa", 0)
      ])
    ]),
    missions: melodyMissions,
    rubric: sharedRubric
  },
  {
    id: "song-structure",
    title: "A/B 구조 만들기",
    goal: "반복되는 A구간과 달라지는 B구간을 만들어 곡의 흐름을 설계합니다.",
    difficulty: "builder",
    estimatedMinutes: 22,
    templateProject: project("lesson-structure-template", "레슨 4 - A/B 구조", 122, [
      track("lesson-structure-beat", "비트", "drum", "beat", "#38bdf8", [
        clip("lesson-structure-a-beat", "lesson-structure-beat", "A 비트", "drums-grid", "#38bdf8", 0, 32, true)
      ]),
      track("lesson-structure-bass", "베이스", "instrument", "bass", "#f59e0b", [
        clip("lesson-structure-a-bass", "lesson-structure-bass", "A 베이스", "bass-midnight", "#f59e0b", 0, 32, true)
      ]),
      track("lesson-structure-melody", "멜로디", "instrument", "melody", "#a78bfa")
    ]),
    missions: structureMissions,
    rubric: sharedRubric
  },
  {
    id: "recording-layer",
    title: "녹음 추가",
    goal: "직접 만든 소리를 반주 위에 올려 개인적인 색깔을 더합니다.",
    difficulty: "challenge",
    estimatedMinutes: 25,
    templateProject: project("lesson-recording-template", "레슨 5 - 녹음 레이어", 100, [
      track("lesson-recording-beat", "비트", "drum", "beat", "#38bdf8", [
        clip("lesson-recording-drum-loop", "lesson-recording-beat", "비트 가이드", "drums-grid", "#38bdf8", 0, 32, true)
      ]),
      track("lesson-recording-audio", "녹음", "audio", "recording", "#4ade80")
    ]),
    missions: recordingMissions,
    rubric: sharedRubric
  }
];

export function getLessonById(lessonId?: string) {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

export function createLessonProject(lessonId: string): Project | undefined {
  const lesson = getLessonById(lessonId);
  if (!lesson) return undefined;

  const trackMap = new Map<string, string>();
  const tracks = lesson.templateProject.tracks.map((sourceTrack) => {
    const trackId = makeId("track");
    trackMap.set(sourceTrack.id, trackId);
    return {
      ...sourceTrack,
      id: trackId,
      clips: []
    };
  });

  const tracksWithClips = tracks.map((newTrack, index) => {
    const sourceTrack = lesson.templateProject.tracks[index];
    return {
      ...newTrack,
      clips: sourceTrack.clips.map((sourceClip) => ({
        ...sourceClip,
        id: makeId("clip"),
        trackId: trackMap.get(sourceClip.trackId) ?? newTrack.id,
        notes: sourceClip.notes?.map((note) => ({ ...note, id: makeId("note") }))
      }))
    };
  });

  const timestamp = Date.now();
  return {
    ...lesson.templateProject,
    id: makeId("project"),
    version: CURRENT_PROJECT_VERSION,
    name: `${lesson.title} - 나의 작업`,
    lessonId: lesson.id,
    lessonProgress: {},
    tracks: tracksWithClips,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
