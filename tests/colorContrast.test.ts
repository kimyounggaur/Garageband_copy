import { describe, expect, it } from "vitest";
import { bestTextColor, contrastRatio } from "../src/utils/colorContrast";

describe("contrast on editable regions", () => {
  it("chooses a readable label for the existing MIDI, audio, drummer, and loop colors", () => {
    for (const background of ["#5ec26b", "#46a7e0", "#e0b341", "#7d8cff"]) {
      const foreground = bestTextColor(background);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(bestTextColor("#5ec26b")).toBe("#10141c");
  });
});
