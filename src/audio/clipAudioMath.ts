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
