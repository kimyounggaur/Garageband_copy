import { describe, expect, it } from "vitest";
import { reviewProject } from "../src/education/reviewProject";
import { clip, project, track } from "./fixtures";

describe("review length labels by meter", () => {
  it.each([
    [[4, 4], 32],
    [[3, 4], 24],
    [[6, 8], 24]
  ] as const)("treats eight %j bars as the length goal", (timeSignature, lengthBeats) => {
    const source = project({
      timeSignature: [...timeSignature],
      tracks: [track({ clips: [clip({ lengthBeats })] })]
    });
    const length = reviewProject(source).find((item) => item.id === "length");
    expect(length).toMatchObject({ severity: "good" });
    expect(length?.message).toContain("8마디");
  });

  it("does not call six 4/4 bars eight bars", () => {
    const source = project({ tracks: [track({ clips: [clip({ lengthBeats: 24 })] })] });
    const length = reviewProject(source).find((item) => item.id === "length");
    expect(length).toMatchObject({ severity: "warning" });
    expect(length?.message).toContain("6마디");
  });
});
