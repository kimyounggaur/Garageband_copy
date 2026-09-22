import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SampleLibrary, samplePlaybackRate, selectSampleForNote } from "../src/audio/sampleLibrary";
import { parseSampleManifest } from "../src/audio/sampleManifest";

const manifest = JSON.parse(readFileSync(new URL("../public/samples/manifest.json", import.meta.url), "utf8"));
const buffer = { duration: 0.8 } as AudioBuffer;

function makeLibrary() {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify(manifest), { status: 200 });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  });
  const decoder = vi.fn(async () => buffer);
  return { library: new SampleLibrary(fetcher as typeof fetch, decoder, "/Garageband_copy/"), fetcher, decoder };
}

describe("sample manifest and library", () => {
  it("accepts authored fixture metadata and rejects unreviewed or unsafe files", () => {
    expect(parseSampleManifest(manifest).packs[0].kind).toBe("test-tone");
    const unreviewed = structuredClone(manifest);
    unreviewed.packs[0].files[0].redistributionReview.status = "pending";
    expect(() => parseSampleManifest(unreviewed)).toThrow(/재배포/);
    const traversal = structuredClone(manifest);
    traversal.packs[0].files[0].file = "../secret.wav";
    expect(() => parseSampleManifest(traversal)).toThrow(/메타데이터/);
    traversal.packs[0].files[0].file = "%2e%2e/secret.wav";
    expect(() => parseSampleManifest(traversal)).toThrow(/메타데이터/);
    const gap = structuredClone(manifest);
    gap.packs[0].files.forEach((file: { velocityLayer: { max: number } }) => { file.velocityLayer.max = 0.5; });
    expect(() => parseSampleManifest(gap)).toThrow(/velocity 범위/);
  });

  it("loads only on demand and deduplicates simultaneous and later requests", async () => {
    const { library, fetcher, decoder } = makeLibrary();
    expect(fetcher).not.toHaveBeenCalled();
    const [left, right] = await Promise.all([library.loadPack("webband-test-tones"), library.loadPack("webband-test-tones")]);
    expect(left.samples).toHaveLength(2);
    expect(right.samples[0].buffer).toBe(left.samples[0].buffer);
    await library.loadPack("webband-test-tones");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(decoder).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toContain("/Garageband_copy/samples/manifest.json");
  });

  it("resolves Vite relative base paths within a deployed project subdirectory", async () => {
    const { fetcher, decoder } = makeLibrary();
    vi.stubGlobal("location", { href: "https://example.test/Garageband_copy/" });
    try {
      const library = new SampleLibrary(fetcher as typeof fetch, decoder, "./");
      await library.loadPack("webband-test-tones");
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "https://example.test/Garageband_copy/samples/manifest.json",
        "https://example.test/Garageband_copy/samples/test-tones/c4.wav",
        "https://example.test/Garageband_copy/samples/test-tones/g4.wav"
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("calls the browser's default fetch with its required global receiver", async () => {
    const fetcher = vi.fn(function (this: unknown, url: string) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(url.endsWith("manifest.json")
        ? new Response(JSON.stringify(manifest))
        : new Response(new Uint8Array([1, 2, 3])));
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      const library = new SampleLibrary(undefined, async () => buffer, "/Garageband_copy/");
      await expect(library.loadPack("webband-test-tones")).resolves.toMatchObject({ samples: [{}, {}] });
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("allows one caller to cancel without cancelling another", async () => {
    const { library } = makeLibrary();
    const controller = new AbortController();
    const cancelled = library.loadPack("webband-test-tones", controller.signal);
    const active = library.loadPack("webband-test-tones");
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    await expect(active).resolves.toMatchObject({ samples: [{ file: { note: 60 } }, { file: { note: 67 } }] });
  });

  it("tries an alternate MIME file after a primary download failure", async () => {
    const alternate = structuredClone(manifest);
    alternate.packs[0].files[0].alternates.push({ file: "c4-alt.wav", mimeType: "audio/wav" });
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("manifest.json")) return new Response(JSON.stringify(alternate));
      if (url.endsWith("/c4.wav")) return new Response("missing", { status: 404 });
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const library = new SampleLibrary(fetcher as typeof fetch, vi.fn(async () => buffer), "/Garageband_copy/");
    await expect(library.loadPack("webband-test-tones")).resolves.toMatchObject({ pack: { id: "webband-test-tones" } });
    expect(fetcher.mock.calls.map(([url]) => url)).toContain("http://localhost/Garageband_copy/samples/test-tones/c4-alt.wav");
  });

  it("retries after failed fetch and uses the same nearest-root pitch rule as Tone.Sampler", async () => {
    const { library, fetcher } = makeLibrary();
    fetcher.mockImplementationOnce(async () => new Response("error", { status: 503 }));
    await expect(library.loadPack("webband-test-tones")).rejects.toThrow(/503/);
    const pack = await library.loadPack("webband-test-tones");
    expect(selectSampleForNote(pack, 63, 0.6).file.note).toBe(60);
    expect(selectSampleForNote(pack, 64, 0.6).file.note).toBe(67);
    expect(samplePlaybackRate(72, 60)).toBe(2);
  });

  it("does not cache a decoding failure and closes the decoding context", async () => {
    const { fetcher } = makeLibrary();
    const close = vi.fn(async () => undefined);
    const decodeAudioData = vi.fn().mockRejectedValueOnce(new Error("decode failed")).mockResolvedValue(buffer);
    vi.stubGlobal("AudioContext", class { decodeAudioData = decodeAudioData; close = close; });
    try {
      const library = new SampleLibrary(fetcher as typeof fetch, undefined, "/Garageband_copy/");
      await expect(library.loadPack("webband-test-tones")).rejects.toThrow(/샘플 파일/);
      const recovered = await library.loadPack("webband-test-tones");
      expect(recovered.samples).toHaveLength(2);
      expect(recovered.samples[0].file.id).toBe("test-c4");
      expect(close).toHaveBeenCalledTimes(3);
      expect(decodeAudioData).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
