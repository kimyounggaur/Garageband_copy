import type { Clip } from "../types/project";

export type ClipAudioTiming = {
  offsetSeconds: number;
  durationSeconds: number;
  sourceDurationToPlaySeconds: number;
  sourceDurationSeconds: number;
  playbackRate: number;
};

export type ClipFadeDurations = {
  fadeInSeconds: number;
  fadeOutSeconds: number;
};

export type ClipAudioSegment = ClipAudioTiming & {
  elapsedSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  initialGain: number;
};

export function clipGain(clip: Clip) {
  const gain = Number(clip.gain ?? 1);
  return Number.isFinite(gain) ? Math.max(0, gain) : 1;
}

export function secondsPerBeat(bpm: number) {
  return 60 / Math.max(1, bpm);
}

function finiteSeconds(value: number | undefined) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function finiteBeats(value: number | undefined) {
  const beats = Number(value ?? 0);
  return Number.isFinite(beats) ? Math.max(0, beats) : 0;
}

export function resolveClipPlaybackRate(clip: Pick<Clip, "playbackRate" | "pitchSemitones">) {
  const rate = Number(clip.playbackRate ?? 1);
  const pitch = Number(clip.pitchSemitones ?? 0);
  const safeRate = Number.isFinite(rate) ? Math.max(0.25, Math.min(4, rate)) : 1;
  const safePitch = Number.isFinite(pitch) ? Math.max(-24, Math.min(24, pitch)) : 0;
  return safeRate * Math.pow(2, safePitch / 12);
}

export function resolveClipAudioTiming(clip: Clip, bpm: number, sourceDurationSeconds: number): ClipAudioTiming {
  const trimStart = finiteSeconds(clip.trimStartSeconds);
  const trimEnd = finiteSeconds(clip.trimEndSeconds);
  const playbackRate = resolveClipPlaybackRate(clip);
  const sourceEnd = Math.max(0, sourceDurationSeconds - trimEnd);
  const offsetSeconds = Math.min(trimStart, sourceEnd);
  const availableSeconds = Math.max(0, sourceEnd - offsetSeconds);
  const availableTimelineSeconds = availableSeconds / playbackRate;
  const timelineSeconds = Math.max(0, clip.lengthBeats * secondsPerBeat(bpm));
  const durationSeconds = Math.max(0, Math.min(availableTimelineSeconds, timelineSeconds));

  return {
    offsetSeconds,
    durationSeconds,
    sourceDurationToPlaySeconds: durationSeconds * playbackRate,
    sourceDurationSeconds,
    playbackRate
  };
}

export function resolveClipFadeDurations(clip: Clip, durationSeconds: number, bpm = 120): ClipFadeDurations {
  const halfDuration = Math.max(0, durationSeconds) / 2;
  const fadeIn = Math.max(finiteSeconds(clip.fadeInSeconds), finiteBeats(clip.fadeInBeats) * secondsPerBeat(bpm));
  const fadeOut = Math.max(finiteSeconds(clip.fadeOutSeconds), finiteBeats(clip.fadeOutBeats) * secondsPerBeat(bpm));
  return {
    fadeInSeconds: Math.min(fadeIn, halfDuration),
    fadeOutSeconds: Math.min(fadeOut, halfDuration)
  };
}

/** The playable portion of a clip when the transport enters it at startBeat. */
export function resolveClipAudioSegment(clip: Clip, bpm: number, sourceDurationSeconds: number, startBeat: number): ClipAudioSegment {
  const timing = resolveClipAudioTiming(clip, bpm, sourceDurationSeconds);
  const safeStartBeat = Number.isFinite(startBeat) ? Math.max(0, startBeat) : 0;
  const elapsedSeconds = Math.min(
    timing.durationSeconds,
    Math.max(0, safeStartBeat - clip.startBeat) * secondsPerBeat(bpm)
  );
  const durationSeconds = Math.max(0, timing.durationSeconds - elapsedSeconds);
  const fades = resolveClipFadeDurations(clip, timing.durationSeconds, bpm);
  const fadeInSeconds = Math.min(durationSeconds, Math.max(0, fades.fadeInSeconds - elapsedSeconds));
  const fadeOutSeconds = Math.min(durationSeconds, fades.fadeOutSeconds);
  const fadeInGain = fades.fadeInSeconds > 0 ? Math.min(1, elapsedSeconds / fades.fadeInSeconds) : 1;
  const fadeOutGain = fades.fadeOutSeconds > 0
    ? Math.min(1, durationSeconds / fades.fadeOutSeconds)
    : 1;

  return {
    ...timing,
    offsetSeconds: timing.offsetSeconds + elapsedSeconds * timing.playbackRate,
    durationSeconds,
    sourceDurationToPlaySeconds: durationSeconds * timing.playbackRate,
    elapsedSeconds,
    fadeInSeconds,
    fadeOutSeconds,
    initialGain: Math.min(fadeInGain, fadeOutGain)
  };
}

/** Original clip fade level at a point within a seeked playback segment. */
export function segmentGainAt(segment: ClipAudioSegment, elapsedSeconds: number) {
  const fadeIn = segment.fadeInSeconds > 0
    ? segment.initialGain + (1 - segment.initialGain) * Math.min(1, elapsedSeconds / segment.fadeInSeconds)
    : 1;
  const fadeOutStart = segment.durationSeconds - segment.fadeOutSeconds;
  const fadeOut = segment.fadeOutSeconds > 0 && elapsedSeconds >= fadeOutStart
    ? fadeOutStart <= 0
      ? segment.initialGain * Math.max(0, 1 - elapsedSeconds / segment.fadeOutSeconds)
      : Math.max(0, (segment.durationSeconds - elapsedSeconds) / segment.fadeOutSeconds)
    : 1;
  return Math.max(0, Math.min(fadeIn, fadeOut));
}
