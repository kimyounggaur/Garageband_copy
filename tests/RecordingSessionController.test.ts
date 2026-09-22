import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPTURE_AUDIO_CONSTRAINTS,
  RECORDING_AUDIO_BITS_PER_SECOND,
  RecordingSessionController,
  chooseRecordingMimeType,
  decodeRecordingDuration,
  describeCaptureSettings,
  type RecordingResult,
  type UnusableRecording
} from "../src/audio/RecordingSessionController";

class FakeTrack {
  stop = vi.fn();
  getSettings = vi.fn(() => ({ sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false }));
}

class FakeStream {
  track = new FakeTrack();
  getAudioTracks = () => [this.track];
  getTracks = () => [this.track];
}

class FakeMediaRecorder {
  static supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
  static chunks: Blob[] = [new Blob(["recording data"], { type: "audio/webm;codecs=opus" })];
  static instances: FakeMediaRecorder[] = [];
  static deferStartEvent = false;
  static deferStopEvents = false;
  static isTypeSupported = vi.fn((mimeType: string) => FakeMediaRecorder.supported.has(mimeType));
  state: RecordingState = "inactive";
  mimeType: string;
  audioBitsPerSecond: number;
  onstart: ((event: Event) => void) | null = null;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
    if (!FakeMediaRecorder.deferStartEvent) this.onstart?.(new Event("start"));
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    if (!FakeMediaRecorder.deferStopEvents) this.emitStopEvents();
  });
  emitStopEvents = () => {
    if (FakeMediaRecorder.deferStartEvent) this.onstart?.(new Event("start"));
    for (const chunk of FakeMediaRecorder.chunks) this.ondataavailable?.({ data: chunk } as BlobEvent);
    this.onstop?.(new Event("stop"));
  };

  constructor(_stream: MediaStream, options: MediaRecorderOptions = {}) {
    this.mimeType = options.mimeType ?? "audio/webm";
    this.audioBitsPerSecond = options.audioBitsPerSecond ?? 0;
    FakeMediaRecorder.instances.push(this);
  }
}

class FakeAudioContext {
  static duration = 3.25;
  static decodeFailure = false;
  static pendingDecode?: Promise<AudioBuffer>;
  static instances: FakeAudioContext[] = [];
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => {
    if (FakeAudioContext.pendingDecode) return FakeAudioContext.pendingDecode;
    if (FakeAudioContext.decodeFailure) throw new Error("decode failed");
    return { duration: FakeAudioContext.duration } as AudioBuffer;
  });
  close = vi.fn(async () => undefined);
  constructor() { FakeAudioContext.instances.push(this); }
}

const fakeRecorderCtor = FakeMediaRecorder as unknown as typeof MediaRecorder;
const fakeContextCtor = FakeAudioContext as unknown as typeof AudioContext;
const request = { projectId: "project-a", trackId: "track-a", startBeat: 6, countIn: true };

function makeController(stream: FakeStream, onCommit = vi.fn(async (_recording: RecordingResult) => undefined), onUnusableRecording = vi.fn(async (_recording: UnusableRecording) => undefined)) {
  const getUserMedia = vi.fn(async (_constraints: MediaStreamConstraints) => stream as unknown as MediaStream);
  const controller = new RecordingSessionController({
    onCommit,
    onUnusableRecording,
    mediaDevices: { getUserMedia } as Pick<MediaDevices, "getUserMedia">,
    mediaRecorderCtor: fakeRecorderCtor,
    audioContextCtor: fakeContextCtor,
    now: () => 1000,
    monotonicNow: () => 50
  });
  return { controller, getUserMedia, onCommit, onUnusableRecording };
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeMediaRecorder.supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
  FakeMediaRecorder.chunks = [new Blob(["recording data"], { type: "audio/webm;codecs=opus" })];
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.deferStartEvent = false;
  FakeMediaRecorder.deferStopEvents = false;
  FakeAudioContext.duration = 3.25;
  FakeAudioContext.decodeFailure = false;
  FakeAudioContext.pendingDecode = undefined;
  FakeAudioContext.instances = [];
});

describe("RecordingSessionController", () => {
  it("chooses the first supported MIME and reports only processing that remained enabled", () => {
    expect(chooseRecordingMimeType((type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(chooseRecordingMimeType(() => false)).toBeUndefined();
    expect(describeCaptureSettings({ echoCancellation: true, noiseSuppression: false, autoGainControl: false })).toContain("에코 제거");
    expect(describeCaptureSettings({ echoCancellation: false, noiseSuppression: false, autoGainControl: false })).toBe("");
  });

  it("falls back to MP4 when WebM is unsupported", async () => {
    FakeMediaRecorder.supported = new Set(["audio/mp4"]);
    const { controller } = makeController(new FakeStream());
    expect(await controller.start(request)).toBe(true);
    expect(FakeMediaRecorder.instances[0].mimeType).toBe("audio/mp4");
    expect(FakeMediaRecorder.instances[0].audioBitsPerSecond).toBeGreaterThanOrEqual(128000);
    controller.cancel();
  });

  it("closes the decoder context when checking an imported Blob", async () => {
    const duration = await decodeRecordingDuration(new Blob(["audio"]), fakeContextCtor);
    expect(duration).toBe(3.25);
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });

  it("waits for AudioEngine's transport start, then decodes and commits exact duration and MIME", async () => {
    const stream = new FakeStream();
    const { controller, getUserMedia, onCommit } = makeController(stream);
    expect(await controller.start(request)).toBe(true);
    expect(controller.getSnapshot().status).toBe("counting");
    expect(getUserMedia).toHaveBeenCalledWith({ audio: CAPTURE_AUDIO_CONSTRAINTS });
    expect(FakeMediaRecorder.instances[0].start).not.toHaveBeenCalled();
    expect(controller.getSnapshot().warning).toContain("에코 제거");
    expect(controller.beginCapture(6)).toBe(true);
    expect(controller.getSnapshot().status).toBe("recording");
    const result = await controller.stop();
    expect(result?.durationSeconds).toBe(3.25);
    expect(result?.mimeType).toBe("audio/webm;codecs=opus");
    expect(result?.blob.type).toBe(result?.mimeType);
    expect(result?.metadata).toMatchObject({ projectId: "project-a", trackId: "track-a", requestedStartBeat: 6, transportBeatAtStart: 6, requestedAudioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND, actualAudioBitsPerSecond: 128000, audioSettings: { sampleRate: 44100 } });
    expect(onCommit).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(stream.track.stop).toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("records a delayed onstart timestamp without reverting stopping back to recording", async () => {
    FakeMediaRecorder.deferStartEvent = true;
    const { controller } = makeController(new FakeStream());
    const statuses: string[] = [];
    controller.subscribe(() => { statuses.push(controller.getSnapshot().status); });
    await controller.start(request);
    controller.beginCapture(6);
    expect(controller.getSnapshot().status).toBe("starting");
    const result = await controller.stop();
    expect(result?.metadata.captureStartedAtUnixMs).toBe(1000);
    expect(statuses.slice(statuses.indexOf("stopping") + 1)).not.toContain("recording");
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("finishes a recorder that stops by itself before the user presses Stop", async () => {
    const { controller, onCommit } = makeController(new FakeStream());
    await controller.start(request);
    controller.beginCapture();
    FakeMediaRecorder.instances[0].stop();
    const result = await controller.stop();
    expect(result?.durationSeconds).toBe(3.25);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("prevents duplicate starts and cancels a count-in without recording", async () => {
    const stream = new FakeStream();
    const { controller, onCommit } = makeController(stream);
    expect(await controller.start(request)).toBe(true);
    expect(await controller.start(request)).toBe(false);
    expect(await controller.stop()).toBeUndefined();
    expect(controller.beginCapture()).toBe(false);
    expect(FakeMediaRecorder.instances[0].start).not.toHaveBeenCalled();
    expect(stream.track.stop).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps Stop data events after a project switch before onstop", async () => {
    FakeMediaRecorder.deferStopEvents = true;
    const { controller, onCommit, onUnusableRecording } = makeController(new FakeStream());
    await controller.start(request);
    controller.beginCapture();
    const pendingStop = controller.stop();
    expect(controller.getSnapshot().status).toBe("stopping");
    controller.cancel();
    FakeMediaRecorder.instances[0].emitStopEvents();
    expect(await pendingStop).toBeUndefined();
    await vi.waitFor(() => expect(onUnusableRecording).toHaveBeenCalledOnce());
    expect(onUnusableRecording.mock.calls[0][0]).toMatchObject({ reason: "interrupted", metadata: { projectId: "project-a", trackId: "track-a" } });
    expect(controller.getUnusableRecording()?.blob.size).toBeGreaterThan(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("preserves raw capture when cancelled during decoding", async () => {
    let resolveDecode!: (buffer: AudioBuffer) => void;
    FakeAudioContext.pendingDecode = new Promise((resolve) => { resolveDecode = resolve; });
    const { controller, onCommit, onUnusableRecording } = makeController(new FakeStream());
    await controller.start(request);
    controller.beginCapture();
    const pendingStop = controller.stop();
    await vi.waitFor(() => expect(FakeAudioContext.instances[0]?.decodeAudioData).toHaveBeenCalledOnce());
    controller.cancel();
    expect(controller.getUnusableRecording()).toMatchObject({ reason: "interrupted", metadata: { requestedStartBeat: 6 } });
    expect(onUnusableRecording).toHaveBeenCalledOnce();
    resolveDecode({ duration: 3.25 } as AudioBuffer);
    expect(await pendingStop).toBeUndefined();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("preserves raw capture if the target becomes invalid during decoding without an explicit cancel", async () => {
    let current = true;
    let resolveDecode!: (buffer: AudioBuffer) => void;
    FakeAudioContext.pendingDecode = new Promise((resolve) => { resolveDecode = resolve; });
    const { controller, onCommit, onUnusableRecording } = makeController(new FakeStream());
    await controller.start({ ...request, isCurrent: () => current });
    controller.beginCapture();
    const pendingStop = controller.stop();
    await vi.waitFor(() => expect(FakeAudioContext.instances[0]?.decodeAudioData).toHaveBeenCalledOnce());
    current = false;
    resolveDecode({ duration: 3.25 } as AudioBuffer);
    expect(await pendingStop).toBeUndefined();
    expect(controller.getUnusableRecording()?.reason).toBe("interrupted");
    expect(onUnusableRecording).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps the interrupted original in memory when preservation fails", async () => {
    const onUnusableRecording = vi.fn(async () => { throw new Error("storage full"); });
    const { controller } = makeController(new FakeStream(), vi.fn(), onUnusableRecording);
    await controller.start(request);
    controller.beginCapture();
    FakeMediaRecorder.deferStopEvents = true;
    const pendingStop = controller.stop();
    controller.cancel();
    FakeMediaRecorder.instances[0].emitStopEvents();
    expect(await pendingStop).toBeUndefined();
    await vi.waitFor(() => expect(onUnusableRecording).toHaveBeenCalledOnce());
    expect(controller.getUnusableRecording()?.reason).toBe("interrupted");
    expect(controller.getUnusableRecording()?.blob.size).toBeGreaterThan(0);
  });

  it("does not preserve an empty Blob when recording is cancelled before Stop", async () => {
    const { controller, onCommit, onUnusableRecording } = makeController(new FakeStream());
    await controller.start(request);
    controller.beginCapture();
    controller.cancel();
    expect(controller.getUnusableRecording()).toBeUndefined();
    expect(onUnusableRecording).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("discards a late permission result after cancellation", async () => {
    let resolvePermission!: (stream: MediaStream) => void;
    const stream = new FakeStream();
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolvePermission = resolve; }));
    const controller = new RecordingSessionController({ onCommit: vi.fn(), mediaDevices: { getUserMedia } as Pick<MediaDevices, "getUserMedia">, mediaRecorderCtor: fakeRecorderCtor, audioContextCtor: fakeContextCtor });
    const pending = controller.start(request);
    expect(controller.getSnapshot().status).toBe("requesting");
    controller.cancel();
    resolvePermission(stream as unknown as MediaStream);
    expect(await pending).toBe(false);
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("reports permission denial in Korean and can be retried", async () => {
    const getUserMedia = vi.fn().mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" })).mockResolvedValueOnce(new FakeStream() as unknown as MediaStream);
    const controller = new RecordingSessionController({ onCommit: vi.fn(), mediaDevices: { getUserMedia } as Pick<MediaDevices, "getUserMedia">, mediaRecorderCtor: fakeRecorderCtor, audioContextCtor: fakeContextCtor });
    expect(await controller.start(request)).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ status: "error", message: expect.stringContaining("권한") });
    expect(await controller.start(request)).toBe(true);
    controller.cancel();
  });

  it("rejects an empty Blob without calling the save callback", async () => {
    FakeMediaRecorder.chunks = [];
    const { controller, onCommit } = makeController(new FakeStream());
    expect(await controller.start({ ...request, countIn: false })).toBe(true);
    expect(controller.getSnapshot().status).toBe("ready");
    controller.beginCapture();
    expect(await controller.stop()).toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", message: expect.stringContaining("비어") });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("stops and releases the stream after a MediaRecorder error", async () => {
    const stream = new FakeStream();
    const { controller, onCommit } = makeController(stream);
    await controller.start(request);
    controller.beginCapture();
    FakeMediaRecorder.instances[0].onerror?.(Object.assign(new Event("error"), { error: new Error("device failed") }));
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe("error"));
    expect(stream.track.stop).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("preserves an undecodable original Blob and closes AudioContext", async () => {
    FakeAudioContext.decodeFailure = true;
    const { controller, onCommit, onUnusableRecording } = makeController(new FakeStream());
    await controller.start(request);
    controller.beginCapture();
    expect(await controller.stop()).toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", message: expect.stringContaining("원본") });
    expect(controller.getUnusableRecording()?.reason).toBe("decode");
    expect(controller.getUnusableRecording()?.blob.size).toBeGreaterThan(0);
    expect(onUnusableRecording).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });

  it("keeps a decoded Blob available when the repository callback fails", async () => {
    const onCommit = vi.fn(async () => { throw new Error("quota"); });
    const { controller } = makeController(new FakeStream(), onCommit);
    await controller.start(request);
    controller.beginCapture();
    expect(await controller.stop()).toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", message: expect.stringContaining("저장 공간") });
    expect(controller.getUnusableRecording()?.reason).toBe("commit");
    expect(controller.getUnusableRecording()?.blob.size).toBeGreaterThan(0);
  });

  it("does not commit after the active project or track becomes invalid", async () => {
    let current = true;
    const { controller, onCommit } = makeController(new FakeStream());
    await controller.start({ ...request, isCurrent: () => current });
    controller.beginCapture();
    current = false;
    expect(await controller.stop()).toBeUndefined();
    expect(onCommit).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("settles an in-flight stop when the session is cancelled during saving", async () => {
    let releaseCommit!: () => void;
    const onCommit = vi.fn(() => new Promise<void>((resolve) => { releaseCommit = resolve; }));
    const { controller, onUnusableRecording } = makeController(new FakeStream(), onCommit);
    await controller.start(request);
    controller.beginCapture();
    const pendingStop = controller.stop();
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe("saving"));
    controller.cancel();
    expect(controller.getUnusableRecording()?.reason).toBe("interrupted");
    expect(onUnusableRecording).toHaveBeenCalledOnce();
    releaseCommit();
    expect(await pendingStop).toBeUndefined();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("discards a completed save response after the target changes during commit", async () => {
    let current = true;
    let releaseCommit!: () => void;
    const onCommit = vi.fn(() => new Promise<void>((resolve) => { releaseCommit = resolve; }));
    const { controller } = makeController(new FakeStream(), onCommit);
    await controller.start({ ...request, isCurrent: () => current });
    controller.beginCapture();
    const pendingStop = controller.stop();
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe("saving"));
    current = false;
    releaseCommit();
    expect(await pendingStop).toBeUndefined();
    expect(controller.getSnapshot().status).toBe("idle");
  });
});
