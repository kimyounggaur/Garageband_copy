import { audioAssetRepository } from "../db/studioRepository";
import type { Clip } from "../types/project";
import { resolveClipAudioTiming } from "./clipAudioMath";
export { clipGain, resolveClipAudioTiming, resolveClipFadeDurations, secondsPerBeat } from "./clipAudioMath";
export type { ClipAudioTiming, ClipFadeDurations } from "./clipAudioMath";

const MAX_PEAK_CACHE_ENTRIES = 24;
const MAX_SAMPLES_PER_PEAK_BIN = 2048;
const peakCache = new Map<string, Promise<PeakOverview>>();

export type PeakOverview = {
  peaks: Float32Array;
  durationSeconds: number;
};

function audioKey(clip: Clip, bins?: number) {
  if (clip.audioAssetId) return `asset:${clip.audioAssetId}:${bins ?? "raw"}`;
  if (clip.audioUrl) return `url:${clip.audioUrl.slice(0, 80)}:${clip.audioUrl.length}:${bins ?? "raw"}`;
  return `clip:${clip.id}:${bins ?? "raw"}`;
}

function rememberPeak(key: string, promise: Promise<PeakOverview>) {
  peakCache.set(key, promise);
  if (peakCache.size <= MAX_PEAK_CACHE_ENTRIES) return;
  const oldestKey = peakCache.keys().next().value as string | undefined;
  if (oldestKey) peakCache.delete(oldestKey);
}

export async function getClipAudioBlob(clip: Clip) {
  try {
    if (clip.audioAssetId) {
      const asset = await audioAssetRepository.loadAudioAsset(clip.audioAssetId);
      if (asset?.blob) return asset.blob;
    }

    if (!clip.audioUrl) return undefined;
    const response = await fetch(clip.audioUrl);
    if (!response.ok) return undefined;
    return response.blob();
  } catch {
    return undefined;
  }
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
    if (!blob) throw new Error("오디오 클립에서 읽을 수 있는 소스를 찾지 못했습니다");
    const buffer = await decodeAudioBlob(blob);
    const peaks = new Float32Array(bins);
    const samplesPerBin = Math.max(1, Math.floor(buffer.length / bins));

    for (let bin = 0; bin < bins; bin += 1) {
      const start = bin * samplesPerBin;
      const end = Math.min(buffer.length, start + samplesPerBin);
      const stride = Math.max(1, Math.ceil((end - start) / MAX_SAMPLES_PER_PEAK_BIN));
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let index = start; index < end; index += stride) {
          peak = Math.max(peak, Math.abs(data[index] ?? 0));
        }
      }
      peaks[bin] = peak;
    }

    return { peaks, durationSeconds: buffer.duration };
  })();

  rememberPeak(key, promise);
  return promise.catch(() => undefined);
}

export async function measureClipPeak(clip: Clip, bpm: number) {
  try {
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
  } catch {
    return undefined;
  }
}
