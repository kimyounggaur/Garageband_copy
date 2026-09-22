import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { hmr: false, middlewareMode: true }
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// These four drum events are implemented by preview, transport, and WAV export.
const validDrums = new Set(["kick", "snare", "hat", "clap"]);
const legacyIds = ["drums-grid", "drums-electro", "bass-midnight", "bass-clean", "synth-glass", "fx-rise"];

try {
  const {
    LOOP_LIBRARY, LOOP_GENRE_LABELS, LOOP_MOOD_LABELS, filterLoops,
    getLoopById, resolveLoopPattern
  } = await server.ssrLoadModule("/src/data/loops.ts");
  const { barLengthBeats } = await server.ssrLoadModule("/src/utils/meterMath.ts");
  const final = process.argv.includes("--final");
  assert(LOOP_LIBRARY.length >= (final ? 48 : 24), `루프 수가 부족합니다: ${LOOP_LIBRARY.length}`);
  assert(new Set(LOOP_LIBRARY.map((loop) => loop.id)).size === LOOP_LIBRARY.length, "중복 루프 ID가 있습니다");
  for (const id of legacyIds) assert(getLoopById(id), `기존 프로젝트의 ${id} 루프가 사라졌습니다`);

  const roleCounts = Object.fromEntries(["drums", "bass", "harmony", "melody"].map((role) => [role, 0]));
  const signatures = new Set();
  const patternSignatures = new Set();
  const keys = new Set();
  const genres = new Set();
  for (const loop of LOOP_LIBRARY) {
    assert(/^[a-z0-9-]+$/.test(loop.id), `${loop.id}: 잘못된 ID`);
    assert(/[가-힣]/.test(loop.name), `${loop.id}: 한국어 이름이 없습니다`);
    assert(/[가-힣]/.test(loop.description) && loop.description.length >= 12, `${loop.id}: 학생용 한국어 설명이 부족합니다`);
    assert(loop.type === "midi" && !loop.audioUrl, `${loop.id}: Phase 11은 MIDI 루프만 허용합니다`);
    assert(loop.genre in LOOP_GENRE_LABELS, `${loop.id}: 장르 필터 번역이 없습니다`);
    assert(loop.mood.length > 0 && loop.mood.every((item) => item in LOOP_MOOD_LABELS), `${loop.id}: 분위기 필터 번역이 없습니다`);
    assert(Number.isFinite(loop.bpm) && loop.bpm >= 50 && loop.bpm <= 180, `${loop.id}: BPM이 잘못됐습니다`);
    assert([4, 8].includes(loop.timeSignature[1]), `${loop.id}: 지원하지 않는 박자표입니다`);
    const barBeats = barLengthBeats(loop.timeSignature);
    assert(loop.lengthBeats > 0 && Math.abs(loop.lengthBeats / barBeats - Math.round(loop.lengthBeats / barBeats)) < 1e-9,
      `${loop.id}: 길이가 ${loop.timeSignature.join("/")} 마디 경계에 맞지 않습니다`);
    if (loop.timeSignature.join("/") === "4/4") {
      assert([4, 8, 16, 48].includes(loop.lengthBeats), `${loop.id}: 4/4 길이가 잘못됐습니다`);
    }
    if (loop.musicalRole === "drums") assert(loop.key === undefined, `${loop.id}: 드럼에 조성이 지정됐습니다`);
    else assert(/^[A-G](?:#|b)?m?$/.test(loop.key ?? ""), `${loop.id}: 유효한 조성이 없습니다`);
    assert(loop.musicalRole in roleCounts, `${loop.id}: 음악적 역할이 없습니다`);
    assert(loop.pattern.length > 0, `${loop.id}: 빈 패턴입니다`);
    for (const step of loop.pattern) {
      assert(Number.isFinite(step.beat) && step.beat >= 0 && step.beat < loop.lengthBeats, `${loop.id}: 범위 밖 step`);
      assert(Boolean(step.note) !== Boolean(step.drum), `${loop.id}: step은 음 또는 드럼 하나여야 합니다`);
      assert(Number.isFinite(step.velocity) && step.velocity > 0 && step.velocity <= 1, `${loop.id}: 세기가 잘못됐습니다`);
      if (step.note) {
        assert(/^[A-G](?:#|b)?-?\d+$/.test(step.note), `${loop.id}: 잘못된 MIDI 음 ${step.note}`);
        assert(Number.isFinite(step.durationBeats) && step.durationBeats > 0 && step.beat + step.durationBeats <= loop.lengthBeats,
          `${loop.id}: 음 길이가 패턴 밖으로 나갑니다`);
      }
      if (step.drum) assert(validDrums.has(step.drum), `${loop.id}: 지원하지 않는 드럼 ${step.drum}`);
    }
    roleCounts[loop.musicalRole] += 1;
    signatures.add(loop.timeSignature.join("/"));
    patternSignatures.add(JSON.stringify(loop.pattern));
    if (loop.key) keys.add(loop.key);
    genres.add(loop.genre);
    assert(filterLoops({ category: loop.category, genre: loop.genre, mood: loop.mood[0] }).some((item) => item.id === loop.id),
      `${loop.id}: 브라우저 필터에서 찾을 수 없습니다`);
    assert(resolveLoopPattern(loop, loop.key).length === loop.pattern.length, `${loop.id}: 미리듣기 이벤트가 손실됐습니다`);
  }
  assert(patternSignatures.size === LOOP_LIBRARY.length, "서로 완전히 같은 패턴이 있습니다");
  for (const [role, count] of Object.entries(roleCounts)) {
    assert(count >= (final ? 12 : 6), `${role} 역할 루프가 부족합니다: ${count}`);
  }
  assert(keys.size >= (final ? 6 : 4), "조성 다양성이 부족합니다");
  assert(genres.size >= (final ? 6 : 4), "장르 다양성이 부족합니다");

  const pop = getLoopById("chords-pop-c");
  assert(pop?.progression === "I-V-vi-IV" && pop.lengthBeats === 16, "C장조 진행의 이름과 길이가 맞지 않습니다");
  for (const [beat, expected] of [[0,["C4","E4","G4"]],[4,["G3","B3","D4"]],[8,["A3","C4","E4"]],[12,["F3","A3","C4"]]]) {
    const actual = pop.pattern.filter((step) => step.beat === beat).map((step) => step.note).sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected.sort()), `C장조 ${beat}박 코드 음이 맞지 않습니다`);
  }
  if (signatures.has("6/8")) {
    const sixEight = getLoopById("drums-six-eight");
    assert(sixEight?.timeSignature.join("/") === "6/8", "6/8 대표 드럼 루프가 없습니다");
    assert(sixEight.pattern.some((step) => step.beat === 0 && step.drum === "kick"), "6/8 첫 강박이 없습니다");
    assert(sixEight.pattern.some((step) => step.beat === 1.5 && step.drum === "kick"), "6/8 넷째 8분음표 강박이 없습니다");
    for (const beat of [0, 0.5, 1, 1.5, 2, 2.5]) {
      assert(sixEight.pattern.some((step) => step.beat === beat && step.drum === "hat"), `6/8 ${beat}박 8분음표가 없습니다`);
    }
  }
  if (final) {
    assert(signatures.has("3/4") && signatures.has("6/8"), "최종 목록에 3/4와 6/8이 모두 필요합니다");
    assert(getLoopById("blues-twelve-bar")?.lengthBeats === 48, "12마디 블루스는 48박이어야 합니다");
  }
  console.log(`루프 QA 통과: ${LOOP_LIBRARY.length}개, 역할 ${JSON.stringify(roleCounts)}, 박자표 ${[...signatures].join(", ")}, 조성 ${keys.size}종, 장르 ${genres.size}종`);
} finally {
  await server.close();
}
