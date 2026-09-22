import { beforeEach, describe, expect, it } from "vitest";
import { useDawStore } from "../src/store/useDawStore";
import { referencedAudioAssetIds } from "../src/audio/recordingAttachment";
import { clip, project, track } from "./fixtures";

const audioTrack = track({ id: "audio-track", type: "audio", role: "recording", clips: [] });

describe("audio clip store length and target", () => {
  beforeEach(() => {
    useDawStore.getState().loadProject(project({ bpm: 120, tracks: [audioTrack] }));
    useDawStore.setState({ snapBeats: 0.25, preventClipOverlap: false });
  });

  it("keeps the decoded duration as an unsnapped audio length", () => {
    const clipId = useDawStore.getState().addAudioClip("audio-track", 2, "녹음", undefined, 5.13, "asset-a");
    const stored = useDawStore.getState().project.tracks[0].clips.find((entry) => entry.id === clipId);
    expect(stored?.lengthBeats).toBeCloseTo(10.26, 10);
    expect(stored).toMatchObject({ type: "audio", audioAssetId: "asset-a", startBeat: 2 });
  });

  it("preserves unsnapped audio lengths in direct addClip and project restore", () => {
    const directId = useDawStore.getState().addClip("audio-track", {
      type: "audio", name: "가져온 오디오", startBeat: 0, lengthBeats: 2.13, color: "#fff"
    });
    expect(useDawStore.getState().project.tracks[0].clips.find((entry) => entry.id === directId)?.lengthBeats).toBe(2.13);

    useDawStore.getState().loadProject(project({
      tracks: [track({ ...audioTrack, clips: [clip({ type: "audio", lengthBeats: 2.13 })] })]
    }));
    expect(useDawStore.getState().project.tracks[0].clips[0].lengthBeats).toBe(2.13);
  });

  it("still snaps MIDI clip lengths to the edit grid", () => {
    const clipId = useDawStore.getState().addClip("audio-track", {
      type: "midi", name: "음표", startBeat: 0, lengthBeats: 2.13, color: "#fff"
    });
    expect(useDawStore.getState().project.tracks[0].clips.find((entry) => entry.id === clipId)?.lengthBeats).toBe(2.25);
  });

  it("does not reroute an explicit deleted track ID or create a replacement track", () => {
    const before = useDawStore.getState().project;
    expect(() => useDawStore.getState().addAudioClip("deleted-track", 0, "녹음", undefined, 2, "asset-a"))
      .toThrow("오디오 클립을 넣을 트랙이 없어졌습니다.");
    expect(useDawStore.getState().project).toBe(before);
  });

  it("removes a visible recording clip when its project write fails without discarding other edits", () => {
    useDawStore.getState().addAudioClip("audio-track", 0, "실패한 녹음", undefined, 2, "failed-asset");
    useDawStore.getState().renameProject("계속 편집한 프로젝트");
    useDawStore.getState().discardUnpersistedAudioAsset("failed-asset");
    const state = useDawStore.getState();
    expect(state.project.name).toBe("계속 편집한 프로젝트");
    expect(state.project.tracks[0].clips).toHaveLength(0);
  });

  it("removes only the failed take and restores the original active take", () => {
    const clipId = useDawStore.getState().addAudioClip("audio-track", 0, "테이크", undefined, 2, "take-a");
    useDawStore.getState().addAudioTake(clipId, "take-b", { activate: true });
    useDawStore.getState().discardUnpersistedAudioAsset("take-b");
    const stored = useDawStore.getState().project.tracks[0].clips[0];
    expect(stored).toMatchObject({ audioAssetId: "take-a", activeTakeId: "take-a", takeIds: ["take-a"] });
    expect(stored.takeSections?.every((section) => section.takeId === "take-a")).toBe(true);
  });

  it("rejects a direct addClip for a missing track instead of returning a phantom clip ID", () => {
    const before = useDawStore.getState().project;
    expect(() => useDawStore.getState().addClip("deleted-track", {
      type: "audio", name: "녹음", startBeat: 0, lengthBeats: 2, color: "#fff"
    })).toThrow("클립을 넣을 트랙을 찾지 못했습니다.");
    expect(useDawStore.getState().project).toBe(before);
  });

  it("routes an unspecified target to an audio track and rejects unknown duration", () => {
    useDawStore.getState().loadProject(project({ tracks: [track({ id: "midi-track", clips: [] })] }));
    const clipId = useDawStore.getState().addAudioClip(undefined, 0, "녹음", undefined, 2.13, "asset-a");
    const audioTracks = useDawStore.getState().project.tracks.filter((entry) => entry.type === "audio");
    expect(audioTracks).toHaveLength(1);
    expect(audioTracks[0].clips.find((entry) => entry.id === clipId)?.lengthBeats).toBeCloseTo(4.26, 10);
    expect(() => useDawStore.getState().addAudioClip(undefined, 0, "오류", undefined, Number.NaN))
      .toThrow("오디오 길이를 확인할 수 없습니다.");
  });

  it("keeps cycle take IDs and comp sections after the audio length change", () => {
    useDawStore.getState().loadProject(project({
      bpm: 120, cycleEnabled: true, cycleStart: 4, cycleEnd: 8,
      tracks: [audioTrack]
    }));
    const clipId = useDawStore.getState().addAudioClip("audio-track", 4, "반복 녹음", undefined, 2.13, "take-a");
    expect(useDawStore.getState().project.tracks[0].clips[0].lengthBeats).toBeCloseTo(4.26, 10);
    useDawStore.getState().resizeClip(clipId, 4);
    useDawStore.getState().addAudioTake(clipId, "take-b", { activate: true });
    const source = useDawStore.getState().project.tracks[0].clips.find((entry) => entry.id === clipId);
    expect(source).toMatchObject({ lengthBeats: 4, activeTakeId: "take-b", takeIds: ["take-a", "take-b"] });

    const compId = useDawStore.getState().createCompedAudioClip(clipId);
    const comp = useDawStore.getState().project.tracks[0].clips.find((entry) => entry.id === compId);
    expect(comp?.takeIds).toHaveLength(2);
    expect(new Set(comp?.takeIds)).toEqual(new Set(["take-a", "take-b"]));
    expect(comp?.takeSections?.every((section) => section.startBeat + section.lengthBeats <= comp.lengthBeats)).toBe(true);
  });

  it("protects inactive takes from unused-audio cleanup", () => {
    const clipId = useDawStore.getState().addAudioClip("audio-track", 0, "테이크", undefined, 2, "take-a");
    useDawStore.getState().addAudioTake(clipId, "take-b", { activate: true });
    const references = referencedAudioAssetIds(useDawStore.getState().project);
    expect(references).toEqual(new Set(["take-a", "take-b"]));
  });
});
