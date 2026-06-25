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
  resolveClipPlaybackRate,
  resolveClipAudioTiming,
  resolveClipFadeDurations,
  secondsPerBeat
} = await server.ssrLoadModule("/src/audio/clipAudioMath.ts");
const {
  buildCompedAudioClip,
  buildDefaultTakeSections,
  normalizeTakeSections
} = await server.ssrLoadModule("/src/audio/audioComping.ts");
const {
  buildSmartControlPatch,
  normalizeMasterFx,
  normalizeTrackFx,
  normalizeTrackSends,
  resolveSmartControlMacros
} = await server.ssrLoadModule("/src/audio/fx.ts");
const {
  buildRulerTicks,
  clipTypeRegionColor,
  formatBarBeatTick,
  normalizeCycleRange
} = await server.ssrLoadModule("/src/utils/timeline.ts");
const {
  detectPitchFromBuffer,
  estimateTapTempo,
  masterVolumeToDb,
  nextLcdMode,
  normalizeCountInBars,
  normalizeMasterVolume,
  normalizeProjectKey,
  normalizeTimeSignature,
  pitchToTunerReading
} = await server.ssrLoadModule("/src/utils/transport.ts");
const {
  LOOP_LIBRARY,
  filterLoops,
  loopMatchSummary,
  transposeLoopNote
} = await server.ssrLoadModule("/src/data/loops.ts");
const {
  INSTRUMENT_PATCHES,
  defaultInstrumentForTrack,
  getInstrumentPatch,
  instrumentPatchesByCategory
} = await server.ssrLoadModule("/src/data/instruments.ts");
const {
  buildChordNotes,
  buildDiatonicChordStrips,
  buildKeyboardNote,
  buildStepSequencerNotes,
  generateSmartDrumPattern,
  keyboardKeyToMidi,
  timelineBeatToClipBeat
} = await server.ssrLoadModule("/src/utils/touchInstruments.ts");
const {
  DRUMMER_PRESETS,
  defaultDrummerSettings,
  generateDrummerPattern
} = await server.ssrLoadModule("/src/audio/drummer.ts");
const {
  cloneNotesForPaste,
  isPitchInScale,
  normalizePianoRollScale,
  quantizeMidiNotes,
  scalePitchClasses
} = await server.ssrLoadModule("/src/utils/pianoRoll.ts");
const { useDawStore } = await server.ssrLoadModule("/src/store/useDawStore.ts");
const {
  faderValueToPercent,
  formatLcdBeat,
  knobValueToDegrees,
  meterLevelToPercent
} = await server.ssrLoadModule("/src/components/ui/controlMath.ts");

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

  assertEqual(migrated.version, 9, "프로젝트 버전 보정");
  assertEqual(migrated.name, "새 프로젝트", "깨진 프로젝트 이름 보정");
  assertEqual(migrated.cycleStart, 0, "사이클 시작 기본값");
  assertEqual(migrated.cycleEnd, 8, "사이클 끝 기본값");
  assertEqual(migrated.cycleEnabled, false, "사이클 토글 기본값");
  assertEqual(migrated.key, "C", "프로젝트 키 기본값");
  assertEqual(migrated.scale, "major", "프로젝트 스케일 기본값");
  assertEqual(migrated.metronomeOn, false, "메트로놈 기본값");
  assertEqual(migrated.countInBars, 0, "카운트인 기본값");
  assertEqual(migrated.masterVolume, 0.85, "마스터 볼륨 기본값");
  assertDeepEqual(migrated.master, { volume: 0.85, limiterOn: true, reverb: 0.25, delay: 0.18 }, "Phase 8 master fx defaults");
  assertEqual(migrated.bpm, 220, "BPM 상한 보정");
  assertEqual(migrated.tracks[0].name, "비트", "깨진 트랙 이름 보정");
  assertEqual(migrated.tracks[0].role, "beat", "드럼 트랙 역할 보정");
  assertEqual(migrated.tracks[0].instrumentId, "studio-drum-kit", "Phase 3 드럼 트랙 악기 기본값");
  assertDeepEqual(migrated.tracks[0].sends, { reverb: 0, delay: 0 }, "Phase 8 send defaults");
  assertDeepEqual(
    migrated.tracks[0].fx,
    { eq: { low: 0, mid: 0, high: 0 }, comp: { threshold: -24, ratio: 2 } },
    "Phase 8 track fx defaults"
  );
  assertEqual(migrated.tracks[0].clips[0].name, "그리드 룸 드럼", "깨진 루프 클립 이름 보정");
  assertEqual(migrated.tracks[0].clips[0].startBeat, 0, "클립 시작 위치 보정");
  assertEqual(migrated.tracks[0].clips[0].lengthBeats, 0.25, "클립 최소 길이 보정");
  assertEqual(migrated.tracks[0].clips[0].trimStartSeconds, 0, "음수 trim 보정");
  assertEqual(migrated.tracks[0].clips[0].fadeInSeconds, 0, "음수 fade 보정");
  assertEqual(migrated.tracks[0].clips[0].fadeInBeats, 0, "박자 fade in 기본값");
  assertEqual(migrated.tracks[0].clips[0].fadeOutBeats, 0, "박자 fade out 기본값");
  assertEqual(migrated.tracks[0].clips[0].loopEnabled, false, "클립 루프 기본값");
  assertEqual(migrated.tracks[0].clips[0].gain, 0, "음수 gain 하한 보정");
  assertEqual(migrated.tracks[0].clips[0].instructions, undefined, "깨진 안내문 제거");
});

test("Phase 1 타임라인 유틸이 룰러, 사이클, 리전 색상 값을 계산한다", () => {
  assertEqual(formatBarBeatTick(0, [4, 4]), "001|1|000", "첫 박자 LCD 표기");
  assertEqual(formatBarBeatTick(7.5, [4, 4]), "002|4|240", "마디 박자 틱 표기");

  const ticks = buildRulerTicks(8, [4, 4]);
  assertEqual(ticks.filter((tick) => tick.kind === "bar").length, 2, "2마디 굵은 눈금");
  assertEqual(ticks.filter((tick) => tick.kind === "beat").length, 6, "박자 가는 눈금");
  assertEqual(ticks[0].label, "1", "첫 마디 라벨");
  assertEqual(ticks[4].label, "2", "둘째 마디 라벨");

  assertDeepEqual(normalizeCycleRange(7, 2, 0.25), { start: 2, end: 7 }, "사이클 역방향 드래그 정규화");
  assertDeepEqual(normalizeCycleRange(2, 2.1, 0.25), { start: 2, end: 2.25 }, "사이클 최소 길이 보장");

  assertEqual(clipTypeRegionColor("midi"), "#5ec26b", "MIDI 리전 색");
  assertEqual(clipTypeRegionColor("audio"), "#46a7e0", "오디오 리전 색");
  assertEqual(clipTypeRegionColor("loop"), "#7d8cff", "루프 리전 색");
});

test("Phase 2 transport utilities compute LCD modes, tap tempo, tuner pitch, and master gain", () => {
  assertEqual(nextLcdMode("beats"), "time", "LCD beats 다음 모드");
  assertEqual(nextLcdMode("time"), "tuner", "LCD time 다음 모드");
  assertEqual(nextLcdMode("tuner"), "beats", "LCD tuner 다음 모드");

  assertEqual(normalizeProjectKey("Am"), "Am", "마이너 키 보존");
  assertEqual(normalizeProjectKey("H"), "C", "잘못된 키 기본값");
  assertDeepEqual(normalizeTimeSignature([3, 4]), [3, 4], "3/4 박자표 보존");
  assertDeepEqual(normalizeTimeSignature([13, 3]), [4, 4], "잘못된 박자표 기본값");
  assertEqual(normalizeCountInBars(9), 2, "카운트인 상한");
  assertEqual(normalizeCountInBars(-1), 0, "카운트인 하한");
  assertEqual(normalizeMasterVolume(2), 1, "마스터 볼륨 상한");
  assertEqual(normalizeMasterVolume(-1), 0, "마스터 볼륨 하한");

  assertApprox(estimateTapTempo([0, 500, 1000, 1500]), 120, "탭템포 120BPM");
  assertApprox(masterVolumeToDb(1), 0, "마스터 볼륨 1은 0dB");
  assertApprox(masterVolumeToDb(0.5), -6.020599913279624, "마스터 볼륨 0.5 dB");
  assertEqual(masterVolumeToDb(0), -60, "마스터 볼륨 0은 뮤트 근사");

  const sampleRate = 44100;
  const samples = Float32Array.from({ length: 4096 }, (_, index) => Math.sin((Math.PI * 2 * 440 * index) / sampleRate));
  assertApprox(detectPitchFromBuffer(samples, sampleRate) ?? 0, 440, "A4 피치 검출", 2);
  const reading = pitchToTunerReading(440);
  assertEqual(reading.note, "A4", "A4 튜너 노트");
  assertApprox(reading.cents, 0, "A4 튜너 센트");
});

test("Phase 3 library utilities filter loops, report tempo/key matching, and define instrument patches", () => {
  assert(LOOP_LIBRARY.every((loop) => loop.key && loop.genre && loop.mood?.length && loop.type), "모든 루프가 브라우저 메타데이터를 가진다");

  const electroLoops = filterLoops({ category: "Drums", genre: "Electronic", query: "electro" });
  assertDeepEqual(
    electroLoops.map((loop) => loop.id),
    ["drums-electro"],
    "드럼/일렉트로닉/검색 필터"
  );

  const darkLoops = filterLoops({ mood: "Dark" });
  assert(darkLoops.some((loop) => loop.id === "bass-midnight"), "무드 필터가 루프를 찾는다");
  assertEqual(transposeLoopNote("C4", "C", "D"), "D4", "C에서 D로 전조");
  assertEqual(transposeLoopNote("A#1", "Bb", "C"), "C2", "Bb에서 C로 전조");

  const summary = loopMatchSummary(LOOP_LIBRARY.find((loop) => loop.id === "bass-midnight"), { bpm: 100, key: "D" });
  assertEqual(summary.needsTempoMatch, true, "템포 보정 필요");
  assertEqual(summary.needsKeyMatch, true, "키 보정 필요");
  assertApprox(summary.tempoRatio, 100 / 120, "템포 비율");
  assertEqual(summary.pitchShift, 2, "키 반음 보정");

  assert(INSTRUMENT_PATCHES.length >= 6, "악기 패치 목록");
  assertEqual(getInstrumentPatch("classic-electric-piano").category, "Keys", "악기 패치 조회");
  assertEqual(defaultInstrumentForTrack({ type: "drum", role: "beat" }), "studio-drum-kit", "드럼 기본 패치");
  assert(instrumentPatchesByCategory().some((group) => group.category === "Synths" && group.patches.length > 0), "카테고리 그룹");
});

test("Phase 4 touch instrument utilities create quantized keyboard, drum, smart drum, and chord notes", () => {
  assertEqual(keyboardKeyToMidi("a", 4), 60, "A key maps to C4");
  assertEqual(keyboardKeyToMidi("k", 4), 72, "K key maps to the next C");

  const keyboardNote = buildKeyboardNote({
    pitch: keyboardKeyToMidi("d", 4),
    startBeat: 1.13,
    snapBeats: 0.25,
    durationBeats: 0.48,
    velocity: 1.4
  });
  assertDeepEqual(
    keyboardNote,
    { pitch: 64, startBeat: 1.25, durationBeats: 0.5, velocity: 1 },
    "keyboard input is quantized and clamped"
  );

  const stepNotes = buildStepSequencerNotes(
    [
      { lane: "kick", step: 0, velocity: 0.8 },
      { lane: "snare", step: 4, velocity: 0.7 },
      { lane: "hat", step: 1, velocity: 0.4 }
    ],
    { startBeat: 2, stepBeats: 0.25, swing: 0.5 }
  );
  assertDeepEqual(
    stepNotes.map((item) => [item.pitch, item.startBeat, item.durationBeats, item.velocity]),
    [
      [36, 2, 0.25, 0.8],
      [38, 3, 0.25, 0.7],
      [42, 2.31, 0.25, 0.4]
    ],
    "step sequencer maps lanes and swing to drum MIDI notes"
  );

  const smartPattern = generateSmartDrumPattern({ complexity: 0.75, loudness: 0.8, lengthBeats: 4, seed: 7 });
  assertDeepEqual(
    smartPattern,
    generateSmartDrumPattern({ complexity: 0.75, loudness: 0.8, lengthBeats: 4, seed: 7 }),
    "smart drum generation is deterministic with a seed"
  );
  assert(smartPattern.some((item) => item.pitch === 36), "smart drums include kick notes");
  assert(smartPattern.every((item) => item.velocity <= 0.9 && item.velocity >= 0.2), "smart drum loudness scales velocity");

  const dChords = buildDiatonicChordStrips("D");
  assertDeepEqual(dChords[0].notes, [62, 66, 69], "D major I strip uses D-F#-A");
  assertEqual(dChords[4].roman, "V", "major keys expose the V chord strip");

  const strummed = buildChordNotes(dChords[0], { startBeat: 4, durationBeats: 1.5, strumBeats: 0.05, velocity: 0.72 });
  assertDeepEqual(
    strummed.map((item) => [item.pitch, item.startBeat, item.durationBeats, item.velocity]),
    [
      [62, 4, 1.5, 0.72],
      [66, 4.05, 1.45, 0.72],
      [69, 4.1, 1.4, 0.72]
    ],
    "chord strips strum notes across the beat"
  );
});

test("Phase 4 touch instrument notes are written through MIDI store actions", () => {
  const store = useDawStore.getState();
  store.createProject("phase 4 touch instrument test");
  const melodicClipId = useDawStore.getState().addMidiClip(undefined, 4);
  const keyboardNote = buildKeyboardNote({
    pitch: keyboardKeyToMidi("a", 4),
    startBeat: timelineBeatToClipBeat(5.13, 4, 0.25),
    snapBeats: 0.25,
    durationBeats: 0.5,
    velocity: 0.8
  });
  useDawStore.getState().addNotes(melodicClipId, [keyboardNote]);

  const melodicClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === melodicClipId);
  assertEqual(melodicClip.notes.length, 1, "keyboard note recorded into MIDI clip");
  assertEqual(melodicClip.notes[0].startBeat, 1.25, "recorded note is clip-relative and quantized");

  const drumTrackId = useDawStore.getState().addTrack("drum", "Touch Drums");
  const drumClipId = useDawStore.getState().addMidiClip(drumTrackId, 0);
  const drumNotes = buildStepSequencerNotes(
    [
      { lane: "kick", step: 0, velocity: 0.9 },
      { lane: "snare", step: 4, velocity: 0.7 },
      { lane: "hat", step: 2, velocity: 0.45 }
    ],
    { startBeat: 0, stepBeats: 0.25 }
  );
  useDawStore.getState().addNotes(drumClipId, drumNotes);
  const drumClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === drumClipId);
  assertDeepEqual(
    drumClip.notes.map((item) => item.pitch),
    [36, 38, 42],
    "beat sequencer writes drum MIDI pitches"
  );
  assertEqual(useDawStore.getState().undoStack.length > 0, true, "touch instrument writes are undoable");
});

test("Phase 6 drummer generator creates deterministic grooves from presets and XY controls", () => {
  assert(DRUMMER_PRESETS.length >= 4, "drummer exposes genre presets");
  assertEqual(defaultDrummerSettings().preset, "Pop", "drummer defaults to Pop");

  const dense = generateDrummerPattern({
    preset: "Pop",
    complexity: 0.82,
    loudness: 0.75,
    swing: 0.45,
    fills: 0.85,
    lengthBeats: 8,
    seed: 11
  });
  const repeated = generateDrummerPattern({
    preset: "Pop",
    complexity: 0.82,
    loudness: 0.75,
    swing: 0.45,
    fills: 0.85,
    lengthBeats: 8,
    seed: 11
  });
  const sparse = generateDrummerPattern({
    preset: "Pop",
    complexity: 0.15,
    loudness: 0.75,
    swing: 0,
    fills: 0,
    lengthBeats: 8,
    seed: 11
  });

  assertDeepEqual(dense, repeated, "same drummer settings generate the same notes");
  assert(dense.length > sparse.length, "complexity increases note density");
  assert(dense.some((item) => item.pitch === 36), "drummer groove includes kick");
  assert(dense.some((item) => item.pitch === 38), "drummer groove includes snare");
  assert(dense.some((item) => item.pitch === 42 || item.pitch === 46), "drummer groove includes hats");
  assert(dense.some((item) => item.pitch === 45 || item.pitch === 47 || item.pitch === 39), "drummer fills add accent notes");
  assert(dense.some((item) => Math.abs((item.startBeat * 100) % 50) > 0.001), "swing moves offbeat notes off the straight grid");
  assert(dense.every((item) => item.velocity >= 0.2 && item.velocity <= 1), "loudness keeps velocities playable");
});

test("Phase 6 store actions create and regenerate drummer MIDI clips", () => {
  const store = useDawStore.getState();
  store.createProject("phase 6 drummer store test");

  const drummerClipId = useDawStore.getState().addDrummerClip(undefined, 0);
  let drummerTrack = useDawStore.getState().project.tracks.find((item) => item.clips.some((clip) => clip.id === drummerClipId));
  let drummerClip = drummerTrack?.clips.find((item) => item.id === drummerClipId);

  assert(drummerTrack, "drummer track is created");
  assertEqual(drummerTrack.role, "drummer", "drummer track role is saved");
  assertEqual(drummerTrack.type, "drum", "drummer track uses drum playback");
  assert(drummerTrack.instrumentId === "studio-drum-kit", "drummer track uses the drum kit");
  assert(drummerClip, "drummer clip is created");
  assertEqual(drummerClip.type, "midi", "drummer clip saves as MIDI");
  assertEqual(drummerClip.drummerPreset, "Pop", "drummer preset is saved");
  assert(drummerClip.notes.length > 0, "drummer clip contains generated MIDI notes");
  assertEqual(useDawStore.getState().selectedClipId, drummerClipId, "drummer clip is selected");

  const initialSignature = drummerClip.notes.map((item) => [item.pitch, item.startBeat, item.durationBeats, item.velocity]);
  useDawStore.getState().updateDrummerClip(drummerClipId, {
    drummerPreset: "EDM",
    drummerComplexity: 0.92,
    drummerLoudness: 0.46,
    drummerSwing: 0.38,
    drummerFills: 0.72
  });

  drummerTrack = useDawStore.getState().project.tracks.find((item) => item.clips.some((clip) => clip.id === drummerClipId));
  drummerClip = drummerTrack?.clips.find((item) => item.id === drummerClipId);
  assertEqual(drummerClip.drummerPreset, "EDM", "updated drummer preset is saved");
  assertEqual(drummerClip.drummerComplexity, 0.92, "updated drummer complexity is saved");
  assert(
    JSON.stringify(drummerClip.notes.map((item) => [item.pitch, item.startBeat, item.durationBeats, item.velocity])) !==
      JSON.stringify(initialSignature),
    "drummer notes regenerate when settings change"
  );
  assert(useDawStore.getState().undoStack.length > 0, "drummer edits are undoable");
});

test("Phase 5 piano roll utilities enforce scale lock, quantize notes, and prepare paste copies", () => {
  assertEqual(normalizePianoRollScale(undefined, "Am"), "minor", "minor key defaults to minor scale");
  assertDeepEqual(scalePitchClasses("D", "major"), [2, 4, 6, 7, 9, 11, 1], "D major pitch classes");
  assertEqual(isPitchInScale(61, "C", "major"), false, "C# is disabled in C major scale lock");
  assertEqual(isPitchInScale(61, "C", "chromatic"), true, "chromatic mode allows every pitch");

  const sourceNotes = [
    note("q1", 60, 0.13, 0.41, 0.8),
    note("q2", 62, 1.36, 0.74, 0.7)
  ];
  const quantized = quantizeMidiNotes(sourceNotes, ["q1", "q2"], { gridBeats: 0.25, strength: 0.5 });
  assertDeepEqual(
    quantized.map((item) => [item.id, item.startBeat, item.durationBeats]),
    [
      ["q1", 0.19, 0.46],
      ["q2", 1.31, 0.75]
    ],
    "quantize applies strength to selected note starts and lengths"
  );

  const pasted = cloneNotesForPaste(sourceNotes, { startBeat: 4, pitchOffset: 12 });
  assertDeepEqual(
    pasted.map((item) => [item.pitch, item.startBeat, item.durationBeats, item.velocity]),
    [
      [72, 4, 0.41, 0.8],
      [74, 5.23, 0.74, 0.7]
    ],
    "copy/paste clones notes relative to the earliest source beat"
  );
});

test("Phase 5 store actions update velocity, quantized note groups, deletion, and project scale with undo history", () => {
  const store = useDawStore.getState();
  store.createProject("phase 5 piano roll store test");
  useDawStore.getState().setProjectKey("D");
  useDawStore.getState().setProjectScale("minor");
  assertEqual(useDawStore.getState().project.scale, "minor", "project scale saved");

  const clipId = useDawStore.getState().addMidiClip(undefined, 0);
  const firstId = useDawStore.getState().addNote(clipId, { pitch: 60, startBeat: 0.13, durationBeats: 0.41, velocity: 0.8 });
  const secondId = useDawStore.getState().addNote(clipId, { pitch: 62, startBeat: 1.36, durationBeats: 0.74, velocity: 0.7 });

  useDawStore.getState().updateNotes(
    clipId,
    [
      { id: firstId, startBeat: 0.07, durationBeats: 0.46, velocity: 0.42 },
      { id: secondId, startBeat: 1.43, durationBeats: 0.75, pitch: 64 }
    ],
    { snap: false }
  );
  let midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assertDeepEqual(
    midiClip.notes.map((item) => [item.id, item.pitch, item.startBeat, item.durationBeats, item.velocity]),
    [
      [firstId, 60, 0.07, 0.46, 0.42],
      [secondId, 64, 1.43, 0.75, 0.7]
    ],
    "bulk note update preserves sub-grid quantize strength and velocity"
  );

  useDawStore.getState().removeNotes(clipId, [firstId, secondId]);
  midiClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assertEqual(midiClip.notes.length, 0, "bulk note delete removes selected notes");
  assert(useDawStore.getState().undoStack.length > 0, "phase 5 edits are undoable");
});

test("Phase 3 store actions select instrument patches and annotate loop tempo/key matching", () => {
  const store = useDawStore.getState();
  store.createProject("phase 3 library test");
  const instrumentTrack = useDawStore.getState().project.tracks.find((item) => item.type === "instrument");
  assert(instrumentTrack, "기본 악기 트랙");

  useDawStore.getState().setTrackInstrument(instrumentTrack.id, "classic-electric-piano");
  assertEqual(
    useDawStore.getState().project.tracks.find((item) => item.id === instrumentTrack.id).instrumentId,
    "classic-electric-piano",
    "악기 패치 저장"
  );

  useDawStore.getState().setBpm(100);
  useDawStore.getState().setProjectKey("D");
  const loopClipId = useDawStore.getState().addLoopClip("bass-midnight", instrumentTrack.id, 4);
  const loopClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === loopClipId);
  assert(loopClip, "루프 클립 생성");
  assert(loopClip.instructions?.includes("BPM 120 -> 100"), "루프 템포 보정 표시");
  assert(loopClip.instructions?.includes("Key C -> D"), "루프 키 보정 표시");
  assertEqual(useDawStore.getState().selectedClipId, loopClipId, "배치된 루프 선택");
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

test("Phase 7 audio math supports beat fades, playback rate, and pitch transpose", () => {
  const transformedClip = clip({
    type: "audio",
    lengthBeats: 4,
    trimStartSeconds: 1,
    trimEndSeconds: 2,
    gain: 0.8,
    fadeInBeats: 1,
    fadeOutBeats: 0.5,
    playbackRate: 1.25,
    pitchSemitones: 12
  });

  assertApprox(resolveClipPlaybackRate(transformedClip), 2.5, "pitch transpose multiplies playback rate");
  const timing = resolveClipAudioTiming(transformedClip, 120, 12);
  assertApprox(timing.offsetSeconds, 1, "transformed trim offset");
  assertApprox(timing.playbackRate, 2.5, "timing exposes playback rate");
  assertApprox(timing.durationSeconds, 2, "timeline duration is limited by clip beats");
  assertApprox(timing.sourceDurationToPlaySeconds, 5, "source duration accounts for playback rate");

  const fades = resolveClipFadeDurations(transformedClip, timing.durationSeconds, 120);
  assertApprox(fades.fadeInSeconds, 0.5, "fade in beats convert to seconds");
  assertApprox(fades.fadeOutSeconds, 0.25, "fade out beats convert to seconds");
});

test("Phase 7 take folder utilities normalize sections and build comp clips", () => {
  const sourceClip = clip({
    id: "take-folder",
    type: "audio",
    audioAssetId: "take-a",
    takeIds: ["take-a", "take-b", "take-c"],
    activeTakeId: "take-b",
    lengthBeats: 8,
    takeSections: [
      { id: "section-1", takeId: "take-b", startBeat: 0, lengthBeats: 4 },
      { id: "section-2", takeId: "missing-take", startBeat: 4, lengthBeats: 8 }
    ]
  });

  assertDeepEqual(
    buildDefaultTakeSections(sourceClip).map((section) => [section.takeId, section.startBeat, section.lengthBeats]),
    [["take-b", 0, 8]],
    "default take section uses active take"
  );
  assertDeepEqual(
    normalizeTakeSections(sourceClip).map((section) => [section.takeId, section.startBeat, section.lengthBeats]),
    [
      ["take-b", 0, 4],
      ["take-b", 4, 4]
    ],
    "take sections clamp length and replace missing take ids"
  );

  const comp = buildCompedAudioClip(sourceClip, { id: "comp-1", name: "Lead Vocal Comp", startBeat: 12 });
  assertEqual(comp.id, "comp-1", "comp id is applied");
  assertEqual(comp.name, "Lead Vocal Comp", "comp name is applied");
  assertEqual(comp.startBeat, 12, "comp start is applied");
  assertEqual(comp.audioAssetId, "take-b", "comp points at the active take for preview playback");
  assertEqual(comp.activeTakeId, "take-b", "comp keeps active take");
  assertDeepEqual(
    comp.takeSections.map((section) => [section.takeId, section.startBeat, section.lengthBeats]),
    [
      ["take-b", 0, 4],
      ["take-b", 4, 4]
    ],
    "comp preserves normalized take sections"
  );
});

test("Phase 7 store actions arm tracks, manage takes, and create comp clips", () => {
  const store = useDawStore.getState();
  store.createProject("phase 7 audio take test");
  const audioTrackId = useDawStore.getState().addTrack("audio", "Vocal");
  const secondAudioTrackId = useDawStore.getState().addTrack("audio", "Guitar");

  useDawStore.getState().setTrackRecordEnabled(audioTrackId, true);
  let tracks = useDawStore.getState().project.tracks;
  assertEqual(tracks.find((item) => item.id === audioTrackId).recordEnabled, true, "selected track is record enabled");
  assertEqual(tracks.find((item) => item.id === secondAudioTrackId).recordEnabled, false, "other audio tracks are disarmed");

  const clipId = useDawStore.getState().addAudioClip(audioTrackId, 0, "Take Folder", undefined, 8, "take-1");
  let audioClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assertDeepEqual(audioClip.takeIds, ["take-1"], "first audio asset initializes take folder");
  assertEqual(audioClip.activeTakeId, "take-1", "first take is active");

  useDawStore.getState().addAudioTake(clipId, "take-2", { activate: true });
  audioClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assertDeepEqual(audioClip.takeIds, ["take-1", "take-2"], "new take is appended");
  assertEqual(audioClip.activeTakeId, "take-2", "new take can become active");

  useDawStore.getState().setClipTakeSections(clipId, [
    { id: "a", takeId: "take-1", startBeat: 0, lengthBeats: 4 },
    { id: "b", takeId: "take-2", startBeat: 4, lengthBeats: 4 }
  ]);
  const compId = useDawStore.getState().createCompedAudioClip(clipId);
  const compClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === compId);
  assert(compClip, "comp clip is created");
  assertEqual(compClip.name.endsWith("Comp"), true, "comp clip is named");
  assertDeepEqual(
    compClip.takeSections.map((section) => [section.takeId, section.startBeat, section.lengthBeats]),
    [
      ["take-1", 0, 4],
      ["take-2", 4, 4]
    ],
    "comp clip keeps chosen take sections"
  );

  useDawStore.getState().updateClipAudioSettings(clipId, { playbackRate: 0.5, pitchSemitones: -12, fadeInBeats: 1 });
  audioClip = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId);
  assertEqual(audioClip.playbackRate, 0.5, "playback rate is saved");
  assertEqual(audioClip.pitchSemitones, -12, "pitch transpose is saved");
  assertEqual(audioClip.fadeInBeats, 1, "fade beats are saved");
  assert(useDawStore.getState().undoStack.length > 0, "phase 7 edits are undoable");
});

test("Phase 8 fx helpers normalize sends, eq, comp, master, and smart macros", () => {
  assertDeepEqual(normalizeTrackSends({ reverb: 2, delay: -1 }), { reverb: 1, delay: 0 }, "track sends are clamped");
  assertDeepEqual(
    normalizeTrackFx({ eq: { low: -50, mid: 3, high: 50 }, comp: { threshold: 12, ratio: 99 } }),
    { eq: { low: -24, mid: 3, high: 24 }, comp: { threshold: 0, ratio: 20 } },
    "track fx values are clamped"
  );
  assertDeepEqual(
    normalizeMasterFx({ volume: 2, limiterOn: false, reverb: 2, delay: -1 }, 0.42),
    { volume: 1, limiterOn: false, reverb: 1, delay: 0 },
    "master fx values are clamped"
  );

  const spacePatch = buildSmartControlPatch("space", 0.6);
  assertDeepEqual(spacePatch.sends, { reverb: 0.6, delay: 0.36 }, "space macro maps to reverb and delay sends");
  const punchPatch = buildSmartControlPatch("punch", 0.75);
  assertDeepEqual(punchPatch.fx.comp, { threshold: -18, ratio: 6.25 }, "punch macro maps to compressor");
  const macros = resolveSmartControlMacros({
    sends: { reverb: 0.6, delay: 0.36 },
    fx: { eq: { low: -4, mid: 1, high: 6 }, comp: { threshold: -18, ratio: 6.25 } }
  });
  assertApprox(macros.brightness, 0.75, "brightness macro resolves from high EQ");
  assertApprox(macros.space, 0.6, "space macro resolves from sends");
  assertApprox(macros.punch, 0.75, "punch macro resolves from compressor ratio");
});

test("Phase 8 store actions save track fx, sends, master fx, and smart controls", () => {
  const store = useDawStore.getState();
  store.createProject("phase 8 mixer fx test");
  const trackId = useDawStore.getState().project.tracks[0].id;

  useDawStore.getState().setTrackSends(trackId, { reverb: 0.45, delay: 0.25 });
  useDawStore.getState().setTrackFx(trackId, {
    eq: { low: -3, mid: 1.5, high: 4 },
    comp: { threshold: -20, ratio: 4 }
  });
  useDawStore.getState().applyTrackSmartControl(trackId, "brightness", 0.75);
  useDawStore.getState().applyTrackSmartControl(trackId, "space", 0.5);
  useDawStore.getState().applyTrackSmartControl(trackId, "punch", 0.5);
  useDawStore.getState().setMasterFx({ volume: 0.7, reverb: 0.4, delay: 0.2, limiterOn: false });

  const projectState = useDawStore.getState().project;
  const trackState = projectState.tracks.find((item) => item.id === trackId);
  assertDeepEqual(trackState.fx.eq, { low: -3, mid: 0, high: 6 }, "brightness macro updates EQ");
  assertDeepEqual(trackState.sends, { reverb: 0.5, delay: 0.3 }, "space macro updates sends");
  assertDeepEqual(trackState.fx.comp, { threshold: -30, ratio: 4.5 }, "punch macro updates compressor");
  assertDeepEqual(projectState.master, { volume: 0.7, limiterOn: false, reverb: 0.4, delay: 0.2 }, "master fx is saved");
  assertEqual(projectState.masterVolume, 0.7, "legacy master volume stays in sync");
  assert(useDawStore.getState().undoStack.length > 0, "phase 8 edits are undoable");
});

test("Phase 0 UI 컨트롤 변환이 노브, 페이더, 미터, LCD에서 일관된 값을 만든다", () => {
  assertEqual(knobValueToDegrees(0), -135, "노브 최소 회전각");
  assertEqual(knobValueToDegrees(0.5), 0, "노브 중앙 회전각");
  assertEqual(knobValueToDegrees(1), 135, "노브 최대 회전각");
  assertEqual(knobValueToDegrees(2), 135, "노브 상한 클램프");

  assertEqual(faderValueToPercent(0), 0, "페이더 최소 퍼센트");
  assertEqual(faderValueToPercent(0.75), 75, "페이더 현재값 퍼센트");
  assertEqual(faderValueToPercent(-1), 0, "페이더 하한 클램프");

  assertEqual(meterLevelToPercent(0.42), 42, "미터 레벨 퍼센트");
  assertEqual(meterLevelToPercent(Number.NaN), 0, "미터 비정상 입력 보호");

  assertEqual(formatLcdBeat(0, [4, 4]), "001|1|000", "LCD 시작 위치");
  assertEqual(formatLcdBeat(7.5, [4, 4]), "002|4|240", "LCD 마디 박자 틱");
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

test("Phase 1 store actions edit cycle, multi selection, left resize, loops, and grouped moves", () => {
  const store = useDawStore.getState();
  store.createProject("phase 1 store test");
  const firstClipId = useDawStore.getState().project.tracks[0].clips[0].id;
  const secondClipId = useDawStore.getState().addMidiClip(undefined, 16);

  useDawStore.getState().setCycleRange(7, 2);
  assertEqual(useDawStore.getState().project.cycleStart, 2, "cycle start sorted");
  assertEqual(useDawStore.getState().project.cycleEnd, 7, "cycle end sorted");
  assertEqual(useDawStore.getState().project.cycleEnabled, true, "cycle enabled by range edit");

  useDawStore.getState().selectClip(firstClipId);
  useDawStore.getState().selectClip(secondClipId, true);
  assertDeepEqual([...useDawStore.getState().selectedClipIds].sort(), [firstClipId, secondClipId].sort(), "multi selection ids");

  const beforeResize = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === firstClipId);
  useDawStore.getState().resizeClipStart(firstClipId, beforeResize.startBeat + 1);
  const resized = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === firstClipId);
  assertEqual(resized.startBeat, beforeResize.startBeat + 1, "left resize start");
  assertEqual(resized.lengthBeats, beforeResize.lengthBeats - 1, "left resize keeps end");

  useDawStore.getState().setClipLoopEnabled(firstClipId, true);
  assertEqual(
    useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((item) => item.id === firstClipId).loopEnabled,
    true,
    "clip loop enabled"
  );

  const startsBeforeMove = Object.fromEntries(
    useDawStore
      .getState()
      .project.tracks.flatMap((item) => item.clips)
      .filter((item) => [firstClipId, secondClipId].includes(item.id))
      .map((item) => [item.id, item.startBeat])
  );
  useDawStore.getState().moveSelectedClips(2);
  const startsAfterMove = Object.fromEntries(
    useDawStore
      .getState()
      .project.tracks.flatMap((item) => item.clips)
      .filter((item) => [firstClipId, secondClipId].includes(item.id))
      .map((item) => [item.id, item.startBeat])
  );
  assertEqual(startsAfterMove[firstClipId], startsBeforeMove[firstClipId] + 2, "group move first clip");
  assertEqual(startsAfterMove[secondClipId], startsBeforeMove[secondClipId] + 2, "group move second clip");
});

test("Phase 2 store actions control transport settings and transient recording UI", () => {
  const store = useDawStore.getState();
  store.createProject("phase 2 transport test");

  assertEqual(useDawStore.getState().lcdMode, "beats", "LCD 기본 모드");
  assertEqual(useDawStore.getState().isRecording, false, "녹음 기본값");
  assertEqual(useDawStore.getState().masterLevel, 0, "마스터 미터 기본값");
  assertEqual(useDawStore.getState().project.key, "C", "키 기본값");
  assertEqual(useDawStore.getState().project.masterVolume, 0.85, "마스터 볼륨 기본값");

  useDawStore.getState().cycleLcdMode();
  assertEqual(useDawStore.getState().lcdMode, "time", "LCD time 전환");
  useDawStore.getState().cycleLcdMode();
  assertEqual(useDawStore.getState().lcdMode, "tuner", "LCD tuner 전환");

  useDawStore.getState().setRecording(true);
  useDawStore.getState().toggleMetronome(true);
  useDawStore.getState().setCountInBars(2);
  useDawStore.getState().setProjectKey("Am");
  useDawStore.getState().setTimeSignature([3, 4]);
  useDawStore.getState().setMasterVolume(0.42);
  useDawStore.getState().setMasterLevel(0.64);
  useDawStore.getState().setTunerReading({ note: "A4", cents: 0, frequency: 440 });

  assertEqual(useDawStore.getState().isRecording, true, "녹음 상태 토글");
  assertEqual(useDawStore.getState().project.metronomeOn, true, "메트로놈 상태 저장");
  assertEqual(useDawStore.getState().project.countInBars, 2, "카운트인 저장");
  assertEqual(useDawStore.getState().project.key, "Am", "키 저장");
  assertDeepEqual(useDawStore.getState().project.timeSignature, [3, 4], "박자표 저장");
  assertEqual(useDawStore.getState().project.masterVolume, 0.42, "마스터 볼륨 저장");
  assertEqual(useDawStore.getState().masterLevel, 0.64, "마스터 미터 갱신");
  assertEqual(useDawStore.getState().tunerReading.note, "A4", "튜너 읽기 저장");

  useDawStore.getState().tapTempo(0);
  useDawStore.getState().tapTempo(500);
  useDawStore.getState().tapTempo(1000);
  assertEqual(useDawStore.getState().project.bpm, 120, "탭템포 BPM 반영");
});

test("duplicateTrack이 트랙과 클립을 편집 가능한 복사본으로 만든다", () => {
  const store = useDawStore.getState();
  store.createProject("트랙 복제 테스트");
  const trackId = useDawStore.getState().project.tracks[0].id;
  const sourceClip = useDawStore.getState().project.tracks[0].clips[0];
  const duplicatedTrackId = store.duplicateTrack(trackId);
  const duplicatedTrack = useDawStore.getState().project.tracks.find((item) => item.id === duplicatedTrackId);

  assert(duplicatedTrack, "복제 트랙 생성");
  assertEqual(duplicatedTrack.name, `${useDawStore.getState().project.tracks[0].name} 복사`, "복제 트랙 이름");
  assertEqual(duplicatedTrack.clips.length, useDawStore.getState().project.tracks[0].clips.length, "트랙 클립 복사");
  assert(duplicatedTrack.clips[0].id !== sourceClip.id, "복제 클립 ID 재생성");
  assertEqual(duplicatedTrack.clips[0].trackId, duplicatedTrackId, "복제 클립 트랙 연결");
  assertEqual(duplicatedTrack.clips[0].locked, false, "복제 클립은 편집 가능");
  assertEqual(useDawStore.getState().selectedTrackId, duplicatedTrackId, "복제 트랙 선택");
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
