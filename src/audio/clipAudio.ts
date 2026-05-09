import { audioAssetRepository } from "../db/studioRepository";
import type { Clip } from "../types/project";

const peakCache = new Map<string, Promise<PeakOverview>>();

export type ClipAudioTiming = {
  offsetSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds: number;
};

export type PeakOverview = {
  peaks: Float32Array;
  durationSeconds: number;
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

function audioKey(clip: Clip, bins?: number) {
  if (clip.audioAssetId) return `asset:${clip.audioAssetId}:${bins ?? "raw"}`;
  if (clip.audioUrl) return `url:${clip.audioUrl.slice(0, 80)}:${clip.audioUrl.length}:${bins ?? "raw"}`;
  return `clip:${clip.id}:${bins ?? "raw"}`;
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

export async function getClipAudioBlob(clip: Clip) {
  if (clip.audioAssetId) {
    const asset = await audioAssetRepository.loadAudioAsset(clip.audioAssetId);
    if (asset?.blob) return asset.blob;
  }

  if (!clip.audioUrl) return undefined;
  const response = await fetch(clip.audioUrl);
  return response.blob();
}

export async function createClipAudioUrl(clip: Clip) {
  if (!clip.audioAssetId && clip.audioUrl) {
    return { url: clip.audioUrl, revoke: undefined as (() => void) | undefined };
  }

  const blob = await getClipAudioBlob(clip);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => URL.revokeObjectURL(url)
  };
}

async function decodeAudioBlob(blob: Blob) {
  const context = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function getClipPeakOverview(clip: Clip, bins = 512): Promise<PeakOverview | undefined> {
  const key = audioKey(clip, bins);
  const cached = peakCache.get(key);
  if (cached) return cached.catch(() => undefined);

  const promise = (async () => {
    const blob = await getClipAudioBlob(clip);
    if (!blob) throw new Error("Audio clip has no readable source");
    const buffer = await decodeAudioBlob(blob);
    const peaks = new Float32Array(bins);
    const samplesPerBin = Math.max(1, Math.floor(buffer.length / bins));

    for (let bin = 0; bin < bins; bin += 1) {
      const start = bin * samplesPerBin;
      const end = Math.min(buffer.length, start + samplesPerBin);
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let index = start; index < end; index += 1) {
          peak = Math.max(peak, Math.abs(data[index] ?? 0));
        }
      }
      peaks[bin] = peak;
    }

    return { peaks, durationSeconds: buffer.duration };
  })();

  peakCache.set(key, promise);
  return promise.catch(() => undefined);
}

export async function measureClipPeak(clip: Clip, bpm: number) {
  const blob = await getClipAudioBlob(clip);
  if (!blob) return undefined;
  const buffer = await decodeAudioBlob(blob);
  const timing = resolveClipAudioTiming(clip, bpm, buffer.duration);
  const startSample = Math.floor(timing.offsetSeconds * buffer.sampleRate);
  const endSample = Math.min(buffer.length, Math.ceil((timing.offsetSeconds + timing.durationSeconds) * buffer.sampleRate));
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = startSample; index < endSample; index += 1) {
      peak = Math.max(peak, Math.abs(data[index] ?? 0));
    }
  }

  return {
    peak,
    normalizedGain: peak > 0.0001 ? Math.min(8, 0.95 / peak) : 1,
    durationSeconds: timing.durationSeconds
  };
}
