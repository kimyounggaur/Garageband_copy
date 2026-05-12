import { readFileSync } from "node:fs";

const checks = [
  ["src/utils/projectMigration.ts", "normalizeProject"],
  ["src/education/evaluateMission.ts", "evaluateMission"],
  ["src/education/reviewProject.ts", "createReviewSummary"],
  ["src/assist/musicTheory.ts", "analyzeProjectNotes"],
  ["src/store/useDawStore.ts", "updateClipAudioSettings"],
  ["src/db/repositories.ts", "ClassRoomRepository"],
  ["src/db/repositories.ts", "LessonRepository"],
  ["scripts/build.mjs", "--base"]
];

let failed = false;

for (const [file, token] of checks) {
  const content = readFileSync(file, "utf8");
  if (!content.includes(token)) {
    console.error(`누락: ${file} 안에서 ${token} 항목을 찾지 못했습니다.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("QA smoke checks passed");
