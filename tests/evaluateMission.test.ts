import { describe, expect, it } from "vitest";
import { evaluateLesson, evaluateMission, getProjectEndBeat, summarizeLesson } from "../src/education/evaluateMission";
import type { Mission, MissionCheck } from "../src/education/types";
import { clip, project, track } from "./fixtures";

function mission(check: MissionCheck): Mission {
  return { id: "mission-1", title: "미션", description: "", hint: "", check };
}

describe("mission progress characterization", () => {
  const beatClip = clip({ id: "beat", type: "loop", lengthBeats: 8 });
  const melodyClip = clip({ id: "melody", trackId: "melody", startBeat: 24, notes: [
    { id: "note-1", pitch: 60, startBeat: 0, durationBeats: 1, velocity: 0.8 },
    { id: "note-2", pitch: 64, startBeat: 1, durationBeats: 1, velocity: 0.8 }
  ] });
  const recordingClip = clip({ id: "recording", trackId: "recording", type: "audio", startBeat: 30 });
  const arranged = project({ tracks: [
    track({ id: "beat", role: "beat", clips: [beatClip] }),
    track({ id: "melody", role: "melody", clips: [melodyClip] }),
    track({ id: "recording", role: "recording", clips: [recordingClip] })
  ] });

  it("counts clip beats for the requested role", () => {
    expect(evaluateMission(arranged, mission({ type: "minTrackClipBeats", role: "beat", beats: 6 })))
      .toEqual({ missionId: "mission-1", completed: true, progress: 8, target: 6, summary: "6 / 6박" });
    expect(evaluateMission(arranged, mission({ type: "minTrackClipBeats", role: "bass", beats: 4 })).completed).toBe(false);
  });

  it("counts MIDI notes with and without a role filter", () => {
    expect(evaluateMission(arranged, mission({ type: "minMidiNotes", role: "melody", count: 2 })).progress).toBe(2);
    expect(evaluateMission(arranged, mission({ type: "minMidiNotes", count: 3 })))
      .toMatchObject({ completed: false, progress: 2, target: 3 });
  });

  it("uses the latest clip end as project length", () => {
    expect(getProjectEndBeat(arranged)).toBe(34);
    expect(getProjectEndBeat(project())).toBe(0);
    expect(evaluateMission(arranged, mission({ type: "minProjectLength", beats: 32 })).completed).toBe(true);
  });

  it("counts sections from clip starts and the selected gap", () => {
    expect(evaluateMission(arranged, mission({ type: "minDistinctSections", sections: 2 })).progress).toBe(2);
    expect(evaluateMission(arranged, mission({ type: "minDistinctSections", sections: 3, minGapBeats: 4 })).progress).toBe(3);
    expect(evaluateMission(project(), mission({ type: "minDistinctSections", sections: 1 })).progress).toBe(0);
  });

  it("counts only audio clips", () => {
    expect(evaluateMission(arranged, mission({ type: "minAudioClips", count: 1 })))
      .toMatchObject({ completed: true, progress: 1, target: 1 });
    expect(evaluateMission(arranged, mission({ type: "minAudioClips", count: 2 })).completed).toBe(false);
  });

  it("requires a populated track for each role", () => {
    expect(evaluateMission(arranged, mission({ type: "minTracksWithClips", roles: ["beat", "melody"] })))
      .toMatchObject({ completed: true, progress: 2, target: 2 });
    expect(evaluateMission(arranged, mission({ type: "minTracksWithClips", roles: ["beat", "bass"] })))
      .toMatchObject({ completed: false, progress: 1, target: 2 });
  });

  it("summarizes lesson completion and handles missing lessons", () => {
    expect(evaluateLesson(arranged)).toEqual([]);
    expect(summarizeLesson(arranged)).toMatchObject({ completed: 0, total: 0, percent: 0 });
    const lesson = {
      missions: [mission({ type: "minAudioClips", count: 1 }), mission({ type: "minMidiNotes", count: 3 })]
    } as Parameters<typeof summarizeLesson>[1];
    expect(summarizeLesson(arranged, lesson)).toMatchObject({ completed: 1, total: 2, percent: 50 });
  });
});
