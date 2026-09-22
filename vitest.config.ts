import { defineConfig } from "vitest/config";

// Pure characterization tests run in Node. DOM tests opt into jsdom with a
// per-file @vitest-environment annotation when they are added.
export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/utils/timeline.ts",
        "src/utils/projectMigration.ts",
        "src/audio/clipAudioMath.ts",
        "src/components/ui/controlMath.ts",
        "src/education/evaluateMission.ts",
        "src/audio/automation.ts",
        "src/audio/fx.ts"
      ],
      thresholds: { lines: 70, perFile: true }
    }
  }
});
