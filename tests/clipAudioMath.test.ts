import { describe, expect, it } from "vitest";
import {
  clipGain, resolveClipAudioSegment, resolveClipAudioTiming, resolveClipFadeDurations,
  resolveClipPlaybackRate, secondsPerBeat, segmentGainAt
} from "../src/audio/clipAudioMath";
import { clip } from "./fixtures";

describe("clip audio math", () => {
  it("uses safe gain, rate, and beat duration bounds", () => {
    expect([clipGain(clip()), clipGain(clip({ gain: -2 })), clipGain(clip({ gain: Number.NaN }))])
      .toEqual([1, 0, 1]);
    expect(secondsPerBeat(120)).toBe(0.5);
    expect(secondsPerBeat(0)).toBe(60);
    expect(resolveClipPlaybackRate({ playbackRate: 2, pitchSemitones: 12 })).toBe(4);
    expect(resolveClipPlaybackRate({ playbackRate: Number.NaN, pitchSemitones: Number.NaN })).toBe(1);
    expect(resolveClipPlaybackRate({ playbackRate: 100, pitchSemitones: 100 })).toBe(16);
  });

  it("limits playback by source trim and timeline length", () => {
    expect(resolveClipAudioTiming(clip({ lengthBeats: 4, trimStartSeconds: 1, trimEndSeconds: 2 }), 120, 10))
      .toEqual({ offsetSeconds: 1, durationSeconds: 2, sourceDurationToPlaySeconds: 2, sourceDurationSeconds: 10, playbackRate: 1 });
    expect(resolveClipAudioTiming(clip({ lengthBeats: 20, trimStartSeconds: 1, trimEndSeconds: 2, playbackRate: 2 }), 120, 10))
      .toEqual({ offsetSeconds: 1, durationSeconds: 3.5, sourceDurationToPlaySeconds: 7, sourceDurationSeconds: 10, playbackRate: 2 });
    expect(resolveClipAudioTiming(clip({ trimStartSeconds: 50 }), 120, 4).durationSeconds).toBe(0);
  });

  it("uses the greater seconds or beats fade but never exceeds half the clip", () => {
    expect(resolveClipFadeDurations(clip({ fadeInSeconds: 0.3, fadeInBeats: 2, fadeOutSeconds: 10 }), 2, 120))
      .toEqual({ fadeInSeconds: 1, fadeOutSeconds: 1 });
    expect(resolveClipFadeDurations(clip({ fadeInSeconds: Number.NaN, fadeOutBeats: -2 }), -1))
      .toEqual({ fadeInSeconds: 0, fadeOutSeconds: 0 });
  });

  it("starts an audio clip midway using source trim and playback rate", () => {
    const audioClip = clip({
      type: "audio", startBeat: 4, lengthBeats: 8,
      trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2,
      fadeInSeconds: 1, fadeOutSeconds: 1
    });

    expect(resolveClipAudioSegment(audioClip, 120, 10, 6)).toMatchObject({
      offsetSeconds: 3,
      elapsedSeconds: 1,
      durationSeconds: 3,
      sourceDurationToPlaySeconds: 6,
      playbackRate: 2,
      fadeInSeconds: 0,
      fadeOutSeconds: 1,
      initialGain: 1
    });
  });

  it("continues the original fade envelope when seeking inside a fade", () => {
    const audioClip = clip({
      type: "audio", startBeat: 4, lengthBeats: 8,
      trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2,
      fadeInSeconds: 1, fadeOutSeconds: 1
    });

    expect(resolveClipAudioSegment(audioClip, 120, 10, 5)).toMatchObject({
      offsetSeconds: 2,
      elapsedSeconds: 0.5,
      durationSeconds: 3.5,
      sourceDurationToPlaySeconds: 7,
      fadeInSeconds: 0.5,
      initialGain: 0.5
    });
    expect(resolveClipAudioSegment(audioClip, 120, 10, 11)).toMatchObject({
      offsetSeconds: 8,
      elapsedSeconds: 3.5,
      durationSeconds: 0.5,
      sourceDurationToPlaySeconds: 1,
      fadeOutSeconds: 0.5,
      initialGain: 0.5
    });
  });

  it("does not schedule past the clip or the trimmed source end", () => {
    const audioClip = clip({
      type: "audio", startBeat: 4, lengthBeats: 20,
      trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2
    });

    expect(resolveClipAudioSegment(audioClip, 120, 5, 4)).toMatchObject({
      offsetSeconds: 1,
      durationSeconds: 1.5,
      sourceDurationToPlaySeconds: 3
    });
    expect(resolveClipAudioSegment(audioClip, 120, 5, 8).durationSeconds).toBe(0);
    expect(resolveClipAudioSegment(audioClip, 120, 5, 25).durationSeconds).toBe(0);
  });

  it("uses the clip start when playback begins before the region", () => {
    const audioClip = clip({ type: "audio", startBeat: 4, lengthBeats: 8, trimStartSeconds: 1 });
    expect(resolveClipAudioSegment(audioClip, 120, 10, 2)).toMatchObject({
      offsetSeconds: 1,
      elapsedSeconds: 0,
      durationSeconds: 4,
      sourceDurationToPlaySeconds: 4
    });
  });

  it("keeps the original fade level when playback enters during fade-out", () => {
    const segment = resolveClipAudioSegment(
      clip({ startBeat: 4, lengthBeats: 8, fadeOutSeconds: 1 }), 120, 10, 11
    );
    expect(segmentGainAt(segment, 0)).toBeCloseTo(0.5);
    expect(segmentGainAt(segment, 0.25)).toBeCloseTo(0.25);
    expect(segmentGainAt(segment, 0.5)).toBe(0);
  });
});
