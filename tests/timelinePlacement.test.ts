import { beforeEach, describe, expect, it } from "vitest";
import { useDawStore } from "../src/store/useDawStore";
import { project, track } from "./fixtures";

describe("timeline cursor placement", () => {
  beforeEach(() => {
    useDawStore.getState().loadProject(project({ tracks: [track()] }));
  });

  it("scrubs during playback and places new clips at the latest cursor beat", () => {
    const state = useDawStore.getState();
    state.setPlaying(true);
    state.setCurrentBeat(3.25);
    const beforeScrubRevision = useDawStore.getState().seekRevision;

    state.seekToBeat(6.5);
    expect(useDawStore.getState()).toMatchObject({
      currentBeat: 6.5,
      transportState: "playing",
      seekRevision: beforeScrubRevision + 1
    });

    const midiId = state.addMidiClip("track-1", useDawStore.getState().currentBeat);
    const midi = useDawStore.getState().project.tracks[0].clips.find((clip) => clip.id === midiId);
    expect(midi?.startBeat).toBe(6.5);

    state.setCurrentBeat(9.25);
    const drummerId = state.addDrummerClip(undefined, useDawStore.getState().currentBeat);
    const drummer = useDawStore.getState().project.tracks.flatMap((item) => item.clips).find((clip) => clip.id === drummerId);
    expect(drummer?.startBeat).toBe(9.25);
  });
});
