import { beforeEach, describe, expect, it } from "vitest";
import { useDawStore } from "../src/store/useDawStore";
import { project } from "./fixtures";

describe("transport state", () => {
  beforeEach(() => {
    useDawStore.getState().loadProject(project());
  });

  it("plays from the selected beat and preserves it through pause and resume", () => {
    useDawStore.getState().seekToBeat(8.5);
    expect(useDawStore.getState()).toMatchObject({
      transportState: "stopped",
      isPlaying: false,
      currentBeat: 8.5
    });

    useDawStore.getState().setPlaying(true);
    expect(useDawStore.getState()).toMatchObject({ transportState: "playing", isPlaying: true, currentBeat: 8.5 });

    useDawStore.getState().setPlaying(false);
    expect(useDawStore.getState()).toMatchObject({ transportState: "paused", isPlaying: false, currentBeat: 8.5 });

    useDawStore.getState().setPlaying(true);
    expect(useDawStore.getState()).toMatchObject({ transportState: "playing", isPlaying: true, currentBeat: 8.5 });
  });

  it("rewinds only on stop and clears an active recording", () => {
    useDawStore.getState().seekToBeat(12);
    useDawStore.getState().setPlaying(true);
    useDawStore.getState().setRecording(true);

    useDawStore.getState().stopTransport();
    expect(useDawStore.getState()).toMatchObject({
      transportState: "stopped",
      isPlaying: false,
      isRecording: false,
      currentBeat: 0
    });

    useDawStore.getState().setPlaying(false);
    expect(useDawStore.getState().transportState).toBe("stopped");
  });

  it("normalizes invalid seek positions and advances seek revision", () => {
    useDawStore.getState().seekToBeat(4);
    const initialRevision = useDawStore.getState().seekRevision;
    useDawStore.getState().seekToBeat(-3);
    expect(useDawStore.getState().currentBeat).toBe(0);
    expect(useDawStore.getState().seekRevision).toBe(initialRevision + 1);

    useDawStore.getState().seekToBeat(Number.NaN);
    expect(useDawStore.getState().currentBeat).toBe(0);
    expect(useDawStore.getState().seekRevision).toBe(initialRevision + 1);
  });

  it("resets transient transport state when loading another project", () => {
    useDawStore.getState().seekToBeat(6);
    useDawStore.getState().setPlaying(true);
    useDawStore.getState().loadProject(project({ id: "another", bpm: 90 }));
    expect(useDawStore.getState()).toMatchObject({
      transportState: "stopped",
      isPlaying: false,
      currentBeat: 0
    });
  });
});
