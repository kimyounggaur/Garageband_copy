import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true }
});

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertApprox(actual, expected, message, epsilon = 0.000001) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function note(id, pitch, startBeat, durationBeats = 1, velocity = 0.8) {
  return { id, pitch, startBeat, durationBeats, velocity };
}

function clip(overrides = {}) {
  return {
    id: "clip-1",
    trackId: "track-1",
    type: "midi",
    name: "테스트 클립",
    startBeat: 0,
    lengthBeats: 4,
    color: "#38bdf8",
    notes: [],
    ...overrides
  };
}

function track(overrides = {}) {
  const id = overrides.id ?? "track-1";
  return {
    id,
    name: "테스트 트랙",
    type: "instrument",
    role: "melody",
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    color: "#38bdf8",
    clips: [],
    ...overrides
  };
}

function project(overrides = {}) {
  return {
    id: "project-1",
    version: 2,
    name: "테스트 프로젝트",
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [],
    lessonProgress: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function mission(check) {
  return {
    id: `mission-${check.type}`,
    title: "테스트 미션",
    description: "테스트 설명",
    hint: "테스트 힌트",
    check
  };
}

const { evaluateMission, getProjectEndBeat } = await server.ssrLoadModule("/src/education/evaluateMission.ts");
const { createReviewSummary, reviewProject } = await server.ssrLoadModule("/src/education/reviewProject.ts");
const { normalizeProject } = await server.ssrLoadModule("/src/utils/projectMigration.ts");
const { analyzeProjectNotes, getTheoryHint } = await server.ssrLoadModule("/src/assist/musicTheory.ts");
const {
  clipGain,
  resolveClipAudioTiming,
  resolveClipFadeDurations,
  secondsPerBeat
} = await server.ssrLoadModule("/src/audio/clipAudioMath.ts");
const { useDawStore } = await server.ssrLoadModule("/src/store/useDawStore.ts");

const goodProject = project({
  tracks: [
    track({
      id: "beat",
      name: "비트",
      type: "drum",
      role: "beat",
      clips: [clip({ id: "beat-loop", trackId: "beat", type: "loop", name: "드럼 루프", lengthBeats: 32, loopId: "drums-grid" })]
    }),
    track({
      id: "bass",
      name: "베이스",
      role: "bass",
      clips: [clip({ id: "bass-loop", trackId: "bass", type: "loop", name: "베이스 루프", lengthBeats: 32, loopId: "bass-midnight" })]
    }),
    track({
      id: "melody",
      name: "멜로디",
      role: "melody",
      clips: [
        clip({
          id: "melody-midi",
          trackId: "melody",
          name: "멜로디 미디",
          lengthBeats: 32,
          notes: [
            note("n1", 60, 0),
            note("n2", 62, 1),
            note("n3", 64, 2),
            note("n4", 65, 3),
            note("n5", 67, 4),
            note("n6", 69, 5)
          ]
        })
      ]
    })
  ]
});

test("evaluateMission이 클립 길이, 노트, 오디오, 역할 조건을 계산한다", () => {
  assertEqual(getProjectEndBeat(goodProject), 32, "곡 끝 박자");

  const beatMission = evaluateMission(goodProject, mission({ type: "minTrackClipBeats", role: "beat", beats: 16 }));
  assertEqual(beatMission.completed, true, "비트 클립 길이 미션 완료");
  assertEqual(beatMission.progress, 32, "비트 클립 길이 진행도");

  const noteMission = evaluateMission(goodProject, mission({ type: "minMidiNotes", role: "melody", count: 6 }));
  assertEqual(noteMission.completed, true, "멜로디 노트 미션 완료");
  assertEqual(noteMission.progress, 6, "멜로디 노트 진행도");

  const audioProject = project({
    tracks: [track({ id: "recording", type: "audio", role: "recording", clips: [clip({ type: "audio", trackId: "recording" })] })]
  });
  const audioMission = evaluateMission(audioProject, mission({ type: "minAudioClips", count: 1 }));
  assertEqual(audioMission.completed, true, "오디오 클립 미션 완료");

  const roleMission = evaluateMission(goodProject, mission({ type: "minTracksWithClips", roles: ["beat", "bass", "melody"] }));
  assertEqual(roleMission.completed, true, "역할별 트랙 미션 완료");
});

test("reviewProject가 부족한 프로젝트와 제출 가능한 프로젝트를 구분한다", () => {
  const emptyProject = project({ tracks: [track({ id: "empty", clips: [] })] });
  const emptySummary = createReviewSummary(emptyProject);
  assertEqual(emptySummary.ready, false, "빈 프로젝트는 제출 준비 전");
  assert(emptySummary.items.some((item) => item.id === "length" && item.severity === "warning"), "빈 프로젝트 길이 경고");
  assert(emptySummary.items.some((item) => item.id === "track-balance" && item.severity === "warning"), "빈 프로젝트 트랙 경고");

  const goodSummary = createReviewSummary(goodProject);
  assertEqual(goodSummary.ready, true, "완성 프로젝트는 제출 준비 완료");
  assert(goodSummary.rubricScore.percent >= 80, "완성 프로젝트 루브릭 점수");
  assertDeepEqual(
    reviewProject(goodProject).map((item) => item.id),
    goodSummary.items.map((item) => item.id),
    "reviewProject는 createReviewSummary 항목과 같은 결과를 돌려준다"
  );
});

test("projectMigration이 이전 데이터와 깨진 문자열을 보정한다", () => {
  const migrated = normalizeProject({
    id: "legacy",
    name: "??broken??",
    bpm: 999,
    timeSignature: [4, 4],
    tracks: [
      {
        id: "legacy-track",
        name: "??track??",
        type: "drum",
        clips: [
          {
            id: "legacy-clip",
            type: "loop",
            name: "??clip??",
            trackId: "legacy-track",
            startBeat: -4,
            lengthBeats: 0,
            color: "#000",
            loopId: "drums-grid",
            trimStartSeconds: -1,
            fadeInSeconds: -2,
            gain: -3,
            instructions: "??instruction??"
          }
        ]
      }
    ],
    createdAt: 1,
    updatedAt: 1
  });

  assertEqual(migrated.version, 2, "프로젝트 버전 보정");
  assertEqual(migrated.name, "새 프로젝트", "깨진 프로젝트 이름 보정");
  assertEqual(migrated.bpm, 220, "BPM 상한 보정");
  assertEqual(migrated.tracks[0].name, "비트", "깨진 트랙 이름 보정");
  assertEqual(migrated.tracks[0].role, "beat", "드럼 트랙 역할 보정");
  assertEqual(migrated.tracks[0].clips[0].name, "그리드 룸 드럼", "깨진 루프 클립 이름 보정");
  assertEqual(migrated.tracks[0].clips[0].startBeat, 0, "클립 시작 위치 보정");
  assertEqual(migrated.tracks[0].clips[0].lengthBeats, 0.25, "클립 최소 길이 보정");
  assertEqual(migrated.tracks[0].clips[0].trimStartSeconds, 0, "음수 trim 보정");
  assertEqual(migrated.tracks[0].clips[0].fadeInSeconds, 0, "음수 fade 보정");
  assertEqual(migrated.tracks[0].clips[0].gain, 0, "음수 gain 하한 보정");
  assertEqual(migrated.tracks[0].clips[0].instructions, undefined, "깨진 안내문 제거");
});

test("musicTheory가 사용 음, 음역, 학습 힌트를 분석한다", () => {
  const theoryProject = project({
    tracks: [
      track({
        clips: [
          clip({
            notes: [note("c", 60, 0), note("e", 64, 1), note("g", 67, 2), note("c2", 72, 3)]
          })
        ]
      })
    ]
  });
  const analysis = analyzeProjectNotes(theoryProject);
  assertEqual(analysis.noteCount, 4, "노트 수 분석");
  assertDeepEqual(analysis.pitchClassNames, ["도", "미", "솔"], "사용 음 분석");
  assertEqual(analysis.rangeSemitones, 12, "음역 분석");
  assertEqual(analysis.hasStableBeginnerRange, true, "초보자 안정 음역");
  assert(getTheoryHint(theoryProject).includes("사용한 음"), "이론 힌트 생성");

  const wideProject = project({ tracks: [track({ clips: [clip({ notes: [note("low", 36, 0), note("high", 84, 1)] })] })] });
  assertEqual(analyzeProjectNotes(wideProject).hasStableBeginnerRange, false, "넓은 음역 감지");
});

test("오디오 trim/fade/gain 계산이 재생과 내보내기에서 공유 가능한 순수 결과를 낸다", () => {
  const audioClip = clip({
    type: "audio",
    lengthBeats: 8,
    trimStartSeconds: 2,
    trimEndSeconds: 3,
    gain: 1.5,
    fadeInSeconds: 3,
    fadeOutSeconds: 9
  });

  const timing = resolveClipAudioTiming(audioClip, 120, 10);
  assertApprox(timing.offsetSeconds, 2, "trim 시작 오프셋");
  assertApprox(timing.durationSeconds, 4, "trim과 타임라인을 반영한 재생 길이");
  assertApprox(timing.sourceDurationSeconds, 10, "원본 길이 보존");

  const fades = resolveClipFadeDurations(audioClip, timing.durationSeconds);
  assertApprox(fades.fadeInSeconds, 2, "fade in은 클립 길이 절반으로 제한");
  assertApprox(fades.fadeOutSeconds, 2, "fade out은 클립 길이 절반으로 제한");
  assertApprox(clipGain(audioClip), 1.5, "gain 값 보존");
  assertApprox(clipGain(clip({ gain: -4 })), 0, "gain 하한");
  assertApprox(clipGain(clip({ gain: Number.NaN })), 1, "잘못된 gain 기본값");
  assertApprox(secondsPerBeat(0), 60, "비정상 BPM 보호");
});

test("미디 노트 입력이 4박에 갇히지 않고 클립 전체를 확장한다", () => {
  const store = useDawStore.getState();
  store.createProject("미디 입력 테스트");
  const clipId = store.addMidiClip(undefined, 0);
  let midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assert(midiClip, "새 미디 클립 생성");
  assertEqual(midiClip.lengthBeats, 16, "새 미디 클립 기본 길이");

  const noteId = store.addNote(clipId, { pitch: 60, startBeat: 24, durationBeats: 2, velocity: 0.8 });
  midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  const addedNote = midiClip.notes.find((item) => item.id === noteId);
  assertEqual(addedNote.startBeat, 24, "4박 이후 위치에 노트 추가");
  assertEqual(midiClip.lengthBeats, 26, "노트 추가 시 클립 자동 확장");

  store.moveNote(clipId, noteId, 30, 62);
  midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  const movedNote = midiClip.notes.find((item) => item.id === noteId);
  assertEqual(movedNote.startBeat, 30, "노트를 뒤쪽 박자로 이동");
  assertEqual(midiClip.lengthBeats, 32, "노트 이동 시 클립 자동 확장");

  store.resizeNote(clipId, noteId, 4);
  midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  const resizedNote = midiClip.notes.find((item) => item.id === noteId);
  assertEqual(resizedNote.durationBeats, 4, "노트 길이 확장");
  assertEqual(midiClip.lengthBeats, 34, "노트 길이 조절 시 클립 자동 확장");
});

test("duplicateClip이 선택 클립을 편집 가능한 복사본으로 만든다", () => {
  const store = useDawStore.getState();
  store.createProject("클립 복제 테스트");
  const clipId = store.addMidiClip(undefined, 0);
  const noteId = store.addNote(clipId, { pitch: 60, startBeat: 0, durationBeats: 1, velocity: 0.8 });
  const duplicatedId = store.duplicateClip(clipId);
  const clips = useDawStore.getState().project.tracks.flatMap((item) => item.clips);
  const sourceClip = clips.find((item) => item.id === clipId);
  const duplicatedClip = clips.find((item) => item.id === duplicatedId);

  assert(duplicatedClip, "복사본 생성");
  assertEqual(duplicatedClip.name, `${sourceClip.name} 복사`, "복사본 이름");
  assertEqual(duplicatedClip.startBeat, sourceClip.startBeat + sourceClip.lengthBeats, "복사본 시작 위치");
  assertEqual(duplicatedClip.locked, false, "복사본은 편집 가능");
  assert(duplicatedClip.notes[0].id !== noteId, "복사본 노트 ID 재생성");
  assertEqual(useDawStore.getState().selectedClipId, duplicatedId, "복사본 선택");
});

let failed = false;

try {
  for (const { name, fn } of tests) {
    await fn();
    console.log(`통과: ${name}`);
  }
} catch (error) {
  failed = true;
  console.error(`실패: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await server.close();
}

if (failed) process.exit(1);

console.log(`QA smoke checks passed: ${tests.length}개 실제 로직 테스트 통과`);
