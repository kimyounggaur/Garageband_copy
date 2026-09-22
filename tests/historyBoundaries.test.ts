import { describe, expect, it } from "vitest";
import { useDawStore } from "../src/store/useDawStore";
import { clip, project, track } from "./fixtures";

describe("snapshot history boundary", () => {
  it("keeps 80 undo entries, clears redo on a new branch, and keeps audio as an asset id", () => {
    useDawStore.getState().loadProject(project({
      tracks: [track({
        id: "recording",
        type: "audio",
        role: "recording",
        clips: [clip({
          id: "take",
          trackId: "recording",
          type: "audio",
          audioAssetId: "asset-1",
          takeIds: ["asset-1"],
          activeTakeId: "asset-1",
          notes: undefined
        })]
      })]
    }));
    for (let index = 0; index < 81; index += 1) {
      useDawStore.getState().renameProject(`편집 ${index}`);
    }
    expect(useDawStore.getState().undoStack).toHaveLength(80);
    expect(JSON.stringify(useDawStore.getState().undoStack)).toContain("asset-1");
    expect(JSON.stringify(useDawStore.getState().undoStack)).not.toContain("audio/wav");
    useDawStore.getState().undo();
    expect(useDawStore.getState().redoStack).toHaveLength(1);
    useDawStore.getState().renameProject("다른 편집 분기");
    expect(useDawStore.getState().redoStack).toHaveLength(0);
  });
});
