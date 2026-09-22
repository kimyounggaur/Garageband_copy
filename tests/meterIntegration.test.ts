import { beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultLiveLoops, createLiveLoopCellFromLoop, liveLoopTriggerBeat, normalizeLiveLoops
} from "../src/audio/liveLoops";
import { useDawStore } from "../src/store/useDawStore";
import { clip, project, track } from "./fixtures";

describe("meter-aware editing and live-loop boundaries", () => {
  beforeEach(() => {
    useDawStore.getState().setSnapBeats(0.25);
    useDawStore.getState().loadProject(project({
      timeSignature: [4, 4],
      tracks: [track({ clips: [clip({ startBeat: 8, lengthBeats: 4 })] })]
    }));
  });

  it("preserves numeric four-quarter snapping and uses a named bar selection for 3/4 and 6/8", () => {
    useDawStore.getState().setSnapBeats(4);
    useDawStore.getState().setTimeSignature([6, 8]);
    expect(useDawStore.getState()).toMatchObject({ snapSelection: 4, snapBeats: 4 });

    useDawStore.getState().setSnapBeats("bar");
    expect(useDawStore.getState()).toMatchObject({ snapSelection: "bar", snapBeats: 3 });
    useDawStore.getState().setCycleRange(0.2, 2.7);
    expect(useDawStore.getState().project).toMatchObject({ cycleStart: 0, cycleEnd: 3 });

    useDawStore.getState().setTimeSignature([4, 4]);
    expect(useDawStore.getState().snapBeats).toBe(4);
    useDawStore.getState().setTimeSignature([3, 4]);
    expect(useDawStore.getState().snapBeats).toBe(3);
    expect(useDawStore.getState().project.tracks[0].clips[0].startBeat).toBe(8);
    expect(useDawStore.getState().project).toMatchObject({ cycleStart: 0, cycleEnd: 3 });
  });

  it("recomputes named-bar snapping after loading a project without changing stored positions", () => {
    useDawStore.getState().setSnapBeats("bar");
    useDawStore.getState().loadProject(project({
      timeSignature: [6, 8], cycleStart: 4, cycleEnd: 8,
      tracks: [track({ clips: [clip({ startBeat: 8, lengthBeats: 4 })] })]
    }));
    expect(useDawStore.getState().snapBeats).toBe(3);
    expect(useDawStore.getState().project).toMatchObject({ cycleStart: 4, cycleEnd: 8 });
    expect(useDawStore.getState().project.tracks[0].clips[0]).toMatchObject({ startBeat: 8, lengthBeats: 4 });
  });

  it("uses one-bar quantization in new projects while preserving legacy numeric four-quarter grids", () => {
    const modern = normalizeLiveLoops(createDefaultLiveLoops(), []);
    const legacy = normalizeLiveLoops({ quantizeBeats: 4 }, []);
    expect(modern.quantizeMode).toBe("bar");
    expect(legacy.quantizeMode).toBeUndefined();
    expect(liveLoopTriggerBeat(2.8, [6, 8], modern.quantizeBeats, modern.quantizeMode)).toBe(3);
    expect(liveLoopTriggerBeat(3.2, [6, 8], modern.quantizeBeats, modern.quantizeMode)).toBe(6);
    expect(liveLoopTriggerBeat(2.8, [6, 8], legacy.quantizeBeats, legacy.quantizeMode)).toBe(4);
    expect(liveLoopTriggerBeat(4, [4, 4], legacy.quantizeBeats, legacy.quantizeMode)).toBe(4);
  });

  it("queues a new-project live loop on the next 6/8 bar in the store", () => {
    const sceneId = "scene-1";
    const cell = createLiveLoopCellFromLoop("drums-grid", "track-1", sceneId);
    useDawStore.getState().loadProject(project({
      timeSignature: [6, 8],
      tracks: [track({ type: "drum" })],
      liveLoops: { ...createDefaultLiveLoops(), cells: [cell] }
    }));
    useDawStore.getState().setCurrentBeat(2.8);
    useDawStore.getState().triggerLiveLoopCell("track-1", sceneId);
    expect(useDawStore.getState().liveLoopPlayback.triggerBeat).toBe(3);
  });
});
