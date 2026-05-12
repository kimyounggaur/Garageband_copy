import type { Clip } from "../types/project";

export type ClipAudioTiming = {
  offsetSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds: number;
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

export function resolveClipAudioTiming(clip: Clip, bpm: number, sourceDurationSeconds: number): ClipAudioTiming {
  const trimStart = finiteSeconds(clip.trimStartSeconds);
  const trimEnd = finiteSeconds(clip.trimEndSeconds);
  const sourceEnd = Math.max(0, sourceDurationSeconds - trimEnd);
  const offsetSeconds = Math.min(trimStart, sourceEnd);
  const availableSeconds = Math.max(0, sourceEnd - offsetSeconds);
  const timelineSeconds = Math.max(0, clip.lengthBeats * secondsPerBeat(bpm));

  return {
    offsetSeconds,
    durationSeconds: Math.max(0, Math.min(availableSeconds, timelineSeconds)),
    sourceDurationSeconds
  };
}

export function resolveClipFadeDurations(clip: Clip, durationSeconds: number): ClipFadeDurations {
  const halfDuration = Math.max(0, durationSeconds) / 2;
  return {
    fadeInSeconds: Math.min(finiteSeconds(clip.fadeInSeconds), halfDuration),
    fadeOutSeconds: Math.min(finiteSeconds(clip.fadeOutSeconds), halfDuration)
  };
}
