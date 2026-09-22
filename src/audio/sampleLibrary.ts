import type { LoadedSample, LoadedSamplePack, SampleManifest } from "../types/samples";
import { parseSampleManifest } from "./sampleManifest";

export const TEST_TONE_PACK_ID = "webband-test-tones";
export const SAMPLE_PLAYBACK_GAIN = 0.26;

type Fetcher = typeof fetch;
type Decoder = (bytes: ArrayBuffer) => Promise<AudioBuffer>;

function aborted() {
  return new DOMException("샘플 로딩을 취소했습니다.", "AbortError");
}

class SharedLoad<T> {
  private readonly completed = new Map<string, T>();
  private readonly pending = new Map<string, { promise: Promise<T>; controller: AbortController; users: number }>();

  async get(key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw aborted();
    if (this.completed.has(key)) return this.completed.get(key)!;
    let entry = this.pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: { controller: AbortController; users: number; promise: Promise<T> } = { controller, users: 0, promise: Promise.resolve(undefined as T) };
      created.promise = load(controller.signal).then((value) => {
        if (!controller.signal.aborted) this.completed.set(key, value);
        return value;
      }).finally(() => {
        if (this.pending.get(key) === created) this.pending.delete(key);
      });
      // A cancelled last caller may leave the load rejecting without a waiter.
      void created.promise.catch(() => undefined);
      this.pending.set(key, created);
      entry = created;
    }
    entry.users += 1;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        entry!.users -= 1;
        if (entry!.users === 0 && this.pending.get(key) === entry) {
          this.pending.delete(key);
          entry!.controller.abort();
        }
        return true;
      };
      const onAbort = () => { if (finish()) reject(aborted()); };
      signal?.addEventListener("abort", onAbort, { once: true });
      entry!.promise.then((value) => { if (finish()) resolve(value); }, (error) => { if (finish()) reject(error); });
      if (signal?.aborted) onAbort();
    });
  }
}

async function decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const context = new AudioContext();
  try { return await context.decodeAudioData(bytes); }
  finally { await context.close(); }
}

function browserSupports(mimeType: string) {
  if (typeof document === "undefined") return true;
  return document.createElement("audio").canPlayType(mimeType) !== "";
}

export class SampleLibrary {
  private readonly manifests = new SharedLoad<SampleManifest>();
  private readonly files = new SharedLoad<AudioBuffer>();

  constructor(
    private readonly fetcher: Fetcher = (...args) => globalThis.fetch(...args),
    private readonly decoder: Decoder = decodeAudio,
    private readonly baseUrl = import.meta.env.BASE_URL
  ) {}

  private url(path: string) {
    const pageUrl = globalThis.document?.baseURI ?? globalThis.location?.href ?? "http://localhost/";
    return new URL(path, new URL(this.baseUrl, pageUrl)).href;
  }

  async manifest(signal?: AbortSignal) {
    return this.manifests.get("manifest", async (sharedSignal) => {
      const response = await this.fetcher(this.url("samples/manifest.json"), { signal: sharedSignal });
      if (!response.ok) throw new Error(`샘플 목록을 불러오지 못했습니다 (${response.status}).`);
      return parseSampleManifest(await response.json());
    }, signal);
  }

  async loadPack(id: string, signal?: AbortSignal): Promise<LoadedSamplePack> {
    const manifest = await this.manifest(signal);
    const pack = manifest.packs.find((item) => item.id === id);
    if (!pack) throw new Error(`샘플 팩 ${id}을 찾을 수 없습니다.`);
    const samples = await Promise.all(pack.files.map(async (file): Promise<LoadedSample> => {
      const candidates = [{ file: file.file, mimeType: file.mimeType }, ...file.alternates];
      const compatible = candidates.filter((candidate) => browserSupports(candidate.mimeType));
      if (compatible.length === 0) throw new Error(`${file.id}: 재생 가능한 샘플 형식이 없습니다.`);
      let lastError: unknown;
      for (const candidate of compatible) {
        if (signal?.aborted) throw aborted();
        const url = this.url(pack.baseUrl + candidate.file);
        try {
          const buffer = await this.files.get(url, async (sharedSignal) => {
            const response = await this.fetcher(url, { signal: sharedSignal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const decoded = await this.decoder(await response.arrayBuffer());
            if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) throw new Error("샘플 길이가 올바르지 않습니다.");
            return decoded;
          }, signal);
          return { file, buffer };
        } catch (error) {
          if (signal?.aborted) throw aborted();
          lastError = error;
        }
      }
      throw new Error(`${file.id}: 샘플 파일을 사용할 수 없습니다. ${String(lastError)}`);
    }));
    return { pack, samples };
  }
}

export const sampleLibrary = new SampleLibrary();

export function selectSampleForNote(pack: LoadedSamplePack, pitch: number, velocity: number): LoadedSample {
  const matching = pack.samples.filter(({ file }) => velocity >= file.velocityLayer.min && velocity <= file.velocityLayer.max);
  if (matching.length === 0) throw new Error("해당 velocity의 샘플이 없습니다.");
  // Tone.Sampler 14.9.17 searches upward first at equal pitch distance.
  return matching.sort((left, right) => Math.abs(left.file.note - pitch) - Math.abs(right.file.note - pitch) || right.file.note - left.file.note)[0];
}

export function samplePlaybackRate(pitch: number, rootNote: number) {
  return 2 ** ((pitch - rootNote) / 12);
}
