import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioExportError, createProjectFileBlob, createStoredZipBlob, encodeWav, exportProjectAudio,
  exportProjectStemsZip, exportProjectToWav, normalizeExportOptions, resolveExportFileName
} from "../src/audio/exportProject";
import { clip, project, track } from "./fixtures";
import { sampleLibrary } from "../src/audio/sampleLibrary";
import { clearSampleNotice, getSampleNotice } from "../src/audio/sampleNotice";
import type { LoadedSamplePack } from "../src/types/samples";

function wavView(blob: Blob) {
  return blob.arrayBuffer().then((bytes) => new DataView(bytes));
}

function ascii(view: DataView, offset: number, count: number) {
  return String.fromCharCode(...Array.from({ length: count }, (_, index) => view.getUint8(offset + index)));
}

function fakeBuffer(sampleRate: number, length = 3) {
  const samples = [new Float32Array(length), new Float32Array(length)];
  samples[0].set([-1, 0, 1]);
  samples[1].set([1, 0, -1]);
  return {
    length,
    sampleRate,
    getChannelData: (channel: number) => samples[channel]
  } as AudioBuffer;
}

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode {
  connectedTo?: FakeNode;
  gain = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  delayTime = new FakeParam();
  pan = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = "";
  buffer?: unknown;
  playbackRate = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
  connect(node: FakeNode) { this.connectedTo = node; return node; }
}

const contexts: FakeOfflineAudioContext[] = [];

class FakeOfflineAudioContext {
  static decodeError = false;
  static renderFullLength = false;
  destination = new FakeNode();
  sources: FakeNode[] = [];
  oscillators: FakeNode[] = [];
  startRendering = vi.fn(async () => fakeBuffer(
    this.sampleRate,
    FakeOfflineAudioContext.renderFullLength ? this.length : 3
  ));
  decodeAudioData = vi.fn(async () => {
    if (FakeOfflineAudioContext.decodeError) throw new Error("decode failed");
    return Object.assign(fakeBuffer(this.sampleRate), { duration: 10 });
  });
  constructor(public channels: number, public length: number, public sampleRate: number) {
    contexts.push(this);
  }
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createConvolver() { return new FakeNode(); }
  createDelay() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  createOscillator() { const oscillator = new FakeNode(); this.oscillators.push(oscillator); return oscillator; }
  createBufferSource() {
    const source = new FakeNode();
    this.sources.push(source);
    return source;
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel: number) => data[channel] };
  }
}

describe("project audio export", () => {
  beforeEach(() => {
    contexts.length = 0;
    FakeOfflineAudioContext.decodeError = false;
    FakeOfflineAudioContext.renderFullLength = false;
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  });

  afterEach(() => {
    clearSampleNotice();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves full/cycle ranges and real PCM quality settings", () => {
    const source = project({ cycleEnabled: true, cycleStart: 4, cycleEnd: 8 });
    expect(normalizeExportOptions(source)).toMatchObject({
      quality: "standard", range: "full", startBeat: 0, endBeat: 16,
      sampleRate: 44100, bitDepth: 16
    });
    expect(normalizeExportOptions(source, { range: "cycle", quality: "high" })).toMatchObject({
      quality: "high", range: "cycle", startBeat: 4, endBeat: 8,
      sampleRate: 48000, bitDepth: 24
    });
    expect(normalizeExportOptions(project({ cycleEnabled: false }), { range: "cycle" }).range).toBe("full");
    expect(normalizeExportOptions(project({ cycleEnabled: true, cycleStart: 8, cycleEnd: 4 }), { range: "cycle" }).range).toBe("full");
  });

  it.each([
    [16, 44100, 4, 56],
    [24, 48000, 6, 62]
  ] as const)("writes a valid %i-bit stereo PCM WAV header", async (bitDepth, sampleRate, blockAlign, byteLength) => {
    const blob = encodeWav(fakeBuffer(sampleRate), bitDepth);
    const header = await wavView(blob);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(byteLength);
    expect(ascii(header, 0, 4)).toBe("RIFF");
    expect(header.getUint32(4, true)).toBe(byteLength - 8);
    expect(ascii(header, 8, 4)).toBe("WAVE");
    expect(ascii(header, 12, 4)).toBe("fmt ");
    expect(header.getUint16(20, true)).toBe(1);
    expect(header.getUint16(22, true)).toBe(2);
    expect(header.getUint32(24, true)).toBe(sampleRate);
    expect(header.getUint32(28, true)).toBe(sampleRate * blockAlign);
    expect(header.getUint16(32, true)).toBe(blockAlign);
    expect(header.getUint16(34, true)).toBe(bitDepth);
    expect(ascii(header, 36, 4)).toBe("data");
    expect(header.getUint32(40, true)).toBe(byteLength - 44);
    if (bitDepth === 24) {
      expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(44, 50)))
        .toEqual([0, 0, 128, 255, 255, 127]);
    }
  });

  it("uses quality and cycle range in the offline context and returned file", async () => {
    const source = project({ name: "Demo", cycleEnabled: true, cycleStart: 4, cycleEnd: 8 });
    const result = await exportProjectAudio(source, { quality: "high", range: "cycle" });
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({ channels: 2, sampleRate: 48000, length: 144000 });
    expect(result).toMatchObject({ fileName: "Demo.wav", format: "wav", mimeType: "audio/wav", sampleRate: 48000, bitDepth: 24 });
    expect((await wavView(result.blob)).getUint16(34, true)).toBe(24);
  });

  it("rejects a missing in-range audio asset instead of exporting silence", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project({ tracks: [track({ type: "audio", clips: [clip({ type: "audio", name: "노래", lengthBeats: 4 })] })] });
    const error = await exportProjectToWav(source).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AudioExportError);
    expect(error).toMatchObject({ name: "AudioExportError", clipId: "clip-1", clipName: "노래" });
    expect((error as Error).message).toContain("“노래” 오디오 클립을 내보내지 못했습니다");
    expect(contexts[0].startRendering).not.toHaveBeenCalled();
  });

  it("rejects a damaged in-range audio recording", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    FakeOfflineAudioContext.decodeError = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["broken"]) })));
    const source = project({ tracks: [track({ type: "audio", clips: [clip({ type: "audio", name: "목소리", audioUrl: "/broken.webm" })] })] });
    const error = await exportProjectToWav(source).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AudioExportError);
    expect((error as Error).message).toContain("“목소리” 오디오 클립을 내보내지 못했습니다");
  });

  it("does not load an audio asset outside the selected cycle", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const source = project({
      cycleEnabled: true, cycleStart: 8, cycleEnd: 12,
      tracks: [track({ type: "audio", clips: [clip({ type: "audio", audioUrl: "/missing.webm", startBeat: 0, lengthBeats: 4 })] })]
    });
    await expect(exportProjectToWav(source, { range: "cycle" })).resolves.toBeInstanceOf(Blob);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starts an in-range cycle excerpt at the correct source offset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["audio"]) })));
    const source = project({
      cycleEnabled: true, cycleStart: 8, cycleEnd: 12,
      tracks: [track({ type: "audio", clips: [clip({
        type: "audio", audioUrl: "/recording.webm", startBeat: 4, lengthBeats: 8,
        trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2
      })] })]
    });
    await exportProjectToWav(source, { range: "cycle" });
    expect(contexts[0].sources).toHaveLength(1);
    expect(contexts[0].sources[0].start).toHaveBeenCalledWith(0, 5, 4);
    expect(contexts[0].sources[0].stop).toHaveBeenCalledWith(2);
  });

  it("keeps the original fade level when a cycle begins inside fade-out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["audio"]) })));
    const source = project({
      cycleEnabled: true, cycleStart: 11, cycleEnd: 12,
      tracks: [track({ type: "audio", clips: [clip({
        type: "audio", audioUrl: "/recording.webm", startBeat: 4, lengthBeats: 8,
        fadeOutSeconds: 1
      })] })]
    });
    await exportProjectToWav(source, { range: "cycle" });
    const audioSource = contexts[0].sources[0];
    expect(audioSource.start).toHaveBeenCalledWith(0, 3.5, 0.5);
    expect(audioSource.connectedTo?.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 0);
    expect(audioSource.connectedTo?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.5);
  });

  it("renders the same decoded sample, root pitch and level used by the realtime sampler", async () => {
    const decoded = { duration: 0.8 } as AudioBuffer;
    const pack = {
      pack: { id: "webband-test-tones" },
      samples: [{ file: { id: "test-c4", note: 60, velocityLayer: { min: 0, max: 1 }, gain: 1 }, buffer: decoded },
        { file: { id: "test-g4", note: 67, velocityLayer: { min: 0, max: 1 }, gain: 1 }, buffer: decoded }]
    } as LoadedSamplePack;
    const load = vi.spyOn(sampleLibrary, "loadPack").mockResolvedValue(pack);
    const source = project({ tracks: [track({ instrumentId: "webband-test-tone", clips: [clip({ notes: [{ id: "n1", pitch: 72, startBeat: 0, durationBeats: 1, velocity: 0.5 }] })] })] });
    await exportProjectToWav(source);
    expect(load).toHaveBeenCalledWith("webband-test-tones");
    expect(contexts[0].sources).toHaveLength(1);
    const sampleSource = contexts[0].sources[0];
    expect(sampleSource.buffer).toBe(decoded);
    expect(sampleSource.playbackRate.value).toBeCloseTo(2 ** (5 / 12));
    expect(sampleSource.start).toHaveBeenCalledWith(0);
    expect(sampleSource.stop).toHaveBeenCalledWith(0.505);
    expect(sampleSource.connectedTo?.gain.setValueAtTime).toHaveBeenCalledWith(0.13, 0);
    expect(sampleSource.connectedTo?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.505);
    expect(contexts[0].startRendering).toHaveBeenCalledOnce();
  });

  it("uses a visible synth fallback when an offline sample cannot load", async () => {
    vi.spyOn(sampleLibrary, "loadPack").mockRejectedValue(new Error("HTTP 503"));
    const source = project({ tracks: [track({ instrumentId: "webband-test-tone", clips: [clip({ notes: [{ id: "n1", pitch: 60, startBeat: 0, durationBeats: 1, velocity: 0.5 }] })] })] });
    await expect(exportProjectToWav(source)).resolves.toBeInstanceOf(Blob);
    expect(contexts[0].sources).toHaveLength(0);
    expect(contexts[0].oscillators).toHaveLength(1);
    expect(contexts[0].oscillators[0].type).toBe("sine");
    expect(getSampleNotice()).toContain("합성음으로 재생");
  });

  it("puts high-quality WAV stems inside a ZIP file", async () => {
    const source = project({ tracks: [track({ name: "Piano" })] });
    const zip = await exportProjectStemsZip(source, { quality: "high" });
    const view = await wavView(zip);
    const dataOffset = 30 + view.getUint16(26, true);
    expect(ascii(view, dataOffset, 4)).toBe("RIFF");
    expect(view.getUint32(dataOffset + 24, true)).toBe(48000);
    expect(view.getUint16(dataOffset + 34, true)).toBe(24);
  });

  it.each([
    ["full", 44100, 16, 132300],
    ["cycle", 48000, 24, 86400]
  ] as const)("aligns all %s stems to the original project range", async (range, sampleRate, bitDepth, frames) => {
    FakeOfflineAudioContext.renderFullLength = true;
    const source = project({
      bpm: 600,
      cycleEnabled: true,
      cycleStart: 4,
      cycleEnd: 12,
      tracks: [
        track({ id: "short", name: "Short", clips: [clip({ id: "short-clip", trackId: "short", lengthBeats: 4 })] }),
        track({ id: "long", name: "Long", clips: [clip({ id: "long-clip", trackId: "long", lengthBeats: 20 })] })
      ]
    });
    const zip = await exportProjectStemsZip(source, { range, quality: bitDepth === 24 ? "high" : "standard" });
    expect(contexts.map((context) => context.length)).toEqual([frames, frames]);

    const view = await wavView(zip);
    const pcmLengths: number[] = [];
    let offset = 0;
    for (let index = 0; index < 2; index += 1) {
      expect(view.getUint32(offset, true)).toBe(0x04034b50);
      const dataOffset = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
      expect(ascii(view, dataOffset, 4)).toBe("RIFF");
      expect(view.getUint32(dataOffset + 24, true)).toBe(sampleRate);
      expect(view.getUint16(dataOffset + 34, true)).toBe(bitDepth);
      pcmLengths.push(view.getUint32(dataOffset + 40, true));
      offset = dataOffset + view.getUint32(offset + 18, true);
    }
    expect(pcmLengths).toEqual([frames * 2 * (bitDepth / 8), frames * 2 * (bitDepth / 8)]);
  });

  it("creates ZIP entries containing WAV files and valid local/central headers", async () => {
    const wav = encodeWav(fakeBuffer(44100));
    const zip = await createStoredZipBlob([{ name: "stems/01-track.wav", blob: wav }]);
    const view = await wavView(zip);
    expect(zip.type).toBe("application/zip");
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const nameLength = view.getUint16(26, true);
    const dataOffset = 30 + nameLength;
    expect(ascii(view, 30, nameLength)).toBe("stems/01-track.wav");
    expect(ascii(view, dataOffset, 4)).toBe("RIFF");
    const centralOffset = dataOffset + wav.size;
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(zip.size - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.size - 12, true)).toBe(1);
  });

  it("marks Korean ZIP entry names as UTF-8 in both headers", async () => {
    const name = "stems/01-비트.wav";
    const zip = await createStoredZipBlob([{ name, blob: new Blob(["audio"]) }]);
    const view = await wavView(zip);
    const nameLength = view.getUint16(26, true);
    const centralOffset = 30 + nameLength + 5;
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(view.getUint16(centralOffset + 8, true) & 0x0800).toBe(0x0800);
    expect(new TextDecoder().decode(new Uint8Array(await zip.slice(30, 30 + nameLength).arrayBuffer()))).toBe(name);
  });

  it("writes the standard CRC-32 for a stored ZIP entry", async () => {
    const zip = await createStoredZipBlob([{ name: "check.txt", blob: new Blob(["123456789"]) }]);
    const view = await wavView(zip);
    expect(view.getUint32(14, true)).toBe(0xcbf43926);
  });

  it("keeps project JSON distinct from audio and names each artifact correctly", async () => {
    const file = createProjectFileBlob(project());
    expect(file.type).toBe("application/json");
    expect(JSON.parse(await file.text()).version).toBeGreaterThan(0);
    expect(resolveExportFileName("Demo", "wav")).toBe("Demo.wav");
    expect(resolveExportFileName("수업 녹음", "wav")).toBe("수업-녹음.wav");
    expect(resolveExportFileName("Demo", "stems.zip")).toBe("Demo.stems.zip");
    expect(resolveExportFileName("Demo", "webband.json")).toBe("Demo.webband.json");
  });
});
