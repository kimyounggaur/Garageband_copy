import { logError } from "../utils/logger";

export type RecordingStatus = "idle" | "requesting" | "ready" | "counting" | "starting" | "recording" | "stopping" | "saving" | "error";

export type RecordingRequest = {
  projectId: string;
  trackId: string;
  startBeat: number;
  countIn?: boolean;
  name?: string;
  /** Check again before committing, because the project or track may have changed. */
  isCurrent?: () => boolean;
};

export type RecordingMetadata = {
  projectId: string;
  trackId: string;
  requestedStartBeat: number;
  transportBeatAtStart?: number;
  requestedMimeType?: string;
  actualMimeType: string;
  requestedAudioBitsPerSecond: number;
  actualAudioBitsPerSecond?: number;
  audioSettings?: MediaTrackSettings;
  captureStartedAtUnixMs?: number;
  captureStoppedAtUnixMs: number;
  captureStartedAtMonotonicMs?: number;
  captureStoppedAtMonotonicMs: number;
};

export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  name?: string;
  metadata: RecordingMetadata;
};

export type UnusableRecording = {
  blob: Blob;
  mimeType: string;
  name?: string;
  metadata: RecordingMetadata;
  reason: "decode" | "commit" | "interrupted";
};

export type RecordingSnapshot = {
  status: RecordingStatus;
  message: string;
  warning: string;
  projectId?: string;
  trackId?: string;
  audioSettings?: MediaTrackSettings;
  mimeType?: string;
};

export type RecordingSessionControllerOptions = {
  onCommit: (recording: RecordingResult) => Promise<void> | void;
  /** Persist the original Blob separately so a failed decode remains recoverable. */
  onUnusableRecording?: (recording: UnusableRecording) => Promise<void> | void;
  onChange?: (snapshot: RecordingSnapshot) => void;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  mediaRecorderCtor?: typeof MediaRecorder;
  audioContextCtor?: typeof AudioContext;
  now?: () => number;
  monotonicNow?: () => number;
};

type ActiveSession = {
  token: number;
  request: RecordingRequest;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  chunks: Blob[];
  settings?: MediaTrackSettings;
  requestedMimeType?: string;
  transportBeatAtStart?: number;
  captureStartedAtUnixMs?: number;
  captureStartedAtMonotonicMs?: number;
  stopPromise?: Promise<RecordingResult | undefined>;
  settleStop?: (result: RecordingResult | undefined) => void;
  recorderError?: unknown;
  rawCapture?: UnusableRecording;
  interrupted?: boolean;
  preservationStarted?: boolean;
};

export const CAPTURE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 }
};

export const RECORDING_AUDIO_BITS_PER_SECOND = 128000;
export const RECORDING_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

export function chooseRecordingMimeType(isSupported: (mimeType: string) => boolean): string | undefined {
  return RECORDING_MIME_CANDIDATES.find((mimeType) => {
    try {
      return isSupported(mimeType);
    } catch {
      return false;
    }
  });
}

export function describeCaptureSettings(settings?: MediaTrackSettings): string {
  if (!settings) return "";
  const activeProcessing = [
    settings.echoCancellation === true ? "에코 제거" : undefined,
    settings.noiseSuppression === true ? "소음 억제" : undefined,
    settings.autoGainControl === true ? "자동 음량 조절" : undefined
  ].filter((value): value is string => Boolean(value));
  return activeProcessing.length
    ? `이 장치에서는 ${activeProcessing.join("·")} 기능을 끌 수 없었습니다. 녹음 소리가 달라질 수 있습니다.`
    : "";
}

export async function decodeRecordingDuration(blob: Blob, audioContextCtor: typeof AudioContext = AudioContext): Promise<number> {
  const context = new audioContextCtor();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error("Invalid decoded duration");
    return buffer.duration;
  } finally {
    try {
      await context.close();
    } catch (error) {
      logError("RecordingSessionController.closeAudioContext", error);
    }
  }
}

function errorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "마이크 권한이 거부됐습니다. 브라우저 주소창의 마이크 권한을 허용한 뒤 다시 시도해 주세요.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "사용할 마이크를 찾지 못했습니다. 마이크 연결과 시스템 입력 장치를 확인해 주세요.";
  if (name === "NotReadableError" || name === "TrackStartError") return "마이크를 열 수 없습니다. 다른 앱에서 마이크를 사용 중인지 확인한 뒤 다시 시도해 주세요.";
  return "마이크 녹음을 시작하지 못했습니다. 마이크 연결과 브라우저 권한을 확인한 뒤 다시 시도해 주세요.";
}

export class RecordingSessionController {
  private readonly options: RecordingSessionControllerOptions;
  private readonly listeners = new Set<() => void>();
  private snapshot: RecordingSnapshot = { status: "idle", message: "", warning: "" };
  private generation = 0;
  private session?: ActiveSession;
  private disposed = false;
  private unusableRecording?: UnusableRecording;

  constructor(options: RecordingSessionControllerOptions) {
    this.options = options;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getUnusableRecording() {
    return this.unusableRecording;
  }

  async start(request: RecordingRequest): Promise<boolean> {
    if (this.disposed || (this.snapshot.status !== "idle" && this.snapshot.status !== "error")) return false;
    this.cancel();
    const session: ActiveSession = { token: ++this.generation, request, chunks: [] };
    this.session = session;
    this.update({ status: "requesting", message: "마이크 권한을 확인하고 있습니다.", warning: "", projectId: request.projectId, trackId: request.trackId });

    let stream: MediaStream | undefined;
    try {
      const devices = this.options.mediaDevices ?? navigator.mediaDevices;
      stream = await devices.getUserMedia({ audio: CAPTURE_AUDIO_CONSTRAINTS });
      if (!this.isCurrent(session)) {
        this.stopTracks(stream);
        if (this.session === session) this.cancel();
        return false;
      }
      session.stream = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error("No audio track");
      try {
        session.settings = audioTrack.getSettings();
      } catch (error) {
        logError("RecordingSessionController.getSettings", error);
      }
      session.recorder = this.createRecorder(stream, session);
      this.attachRecorder(session);
      this.update({
        status: request.countIn ? "counting" : "ready",
        message: request.countIn ? "마이크가 준비됐습니다. 카운트인을 기다리고 있습니다." : "마이크가 준비됐습니다.",
        warning: describeCaptureSettings(session.settings),
        projectId: request.projectId,
        trackId: request.trackId,
        audioSettings: session.settings,
        mimeType: session.recorder.mimeType || session.requestedMimeType
      });
      return true;
    } catch (error) {
      if (!this.isCurrent(session)) {
        if (stream) this.stopTracks(stream);
        return false;
      }
      this.cleanup(session);
      this.session = undefined;
      this.update({ status: "error", message: errorMessage(error), warning: "", projectId: request.projectId, trackId: request.trackId });
      return false;
    }
  }

  /** Call from AudioEngine's transport-start callback, after its count-in completes. */
  beginCapture(transportBeatAtStart?: number): boolean {
    const session = this.session;
    if (!session) return false;
    if (!this.isCurrent(session)) {
      this.cancel();
      return false;
    }
    if (this.snapshot.status !== "ready" && this.snapshot.status !== "counting") return false;
    if (!session.recorder) return false;
    session.transportBeatAtStart = Number.isFinite(transportBeatAtStart) ? transportBeatAtStart : undefined;
    this.update({ ...this.snapshot, status: "starting", message: "마이크 녹음을 시작하고 있습니다." });
    try {
      session.recorder.start();
      return true;
    } catch (error) {
      this.fail(session, errorMessage(error));
      return false;
    }
  }

  async stop(): Promise<RecordingResult | undefined> {
    const session = this.session;
    if (!session) return undefined;
    if (session.stopPromise) return session.stopPromise;
    if (this.snapshot.status === "requesting" || this.snapshot.status === "ready" || this.snapshot.status === "counting") {
      this.cancel();
      return undefined;
    }
    if (this.snapshot.status !== "recording" && this.snapshot.status !== "starting") return undefined;
    const recorder = session.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.fail(session, "녹음이 시작되지 않았습니다. 마이크를 확인한 뒤 다시 시도해 주세요.");
      return undefined;
    }
    session.stopPromise = new Promise((resolve) => { session.settleStop = resolve; });
    this.update({ ...this.snapshot, status: "stopping", message: "녹음을 마무리하고 있습니다." });
    try {
      recorder.stop();
    } catch (error) {
      this.fail(session, "녹음을 마무리하지 못했습니다. 다시 녹음해 주세요.", error);
    }
    return session.stopPromise;
  }

  cancel() {
    this.generation += 1;
    const session = this.session;
    const status = this.snapshot.status;
    this.session = undefined;
    if (session) {
      session.settleStop?.(undefined);
      session.interrupted = true;
      if (session.rawCapture) {
        this.preserveInterrupted(session);
        this.cleanup(session);
      } else if (status === "stopping" && session.recorder) {
        // onstop can still deliver the final dataavailable event after Stop.
        // Keep its handlers until that event has produced a recoverable Blob.
        this.stopTracks(session.stream);
        if (session.recorder.state !== "inactive") {
          try { session.recorder.stop(); } catch (error) {
            logError("RecordingSessionController.cancelStop", error);
            this.cleanup(session);
          }
        }
      } else {
        this.cleanup(session);
      }
    }
    if (!this.disposed) this.update({ status: "idle", message: "", warning: "" });
  }

  dispose() {
    this.disposed = true;
    this.cancel();
    this.listeners.clear();
  }

  private update(snapshot: RecordingSnapshot) {
    this.snapshot = snapshot;
    this.options.onChange?.(snapshot);
    this.listeners.forEach((listener) => listener());
  }

  private isCurrent(session: ActiveSession) {
    return !this.disposed && this.session === session && session.token === this.generation && (session.request.isCurrent?.() ?? true);
  }

  private createRecorder(stream: MediaStream, session: ActiveSession): MediaRecorder {
    const Recorder = this.options.mediaRecorderCtor ?? MediaRecorder;
    const supported = typeof Recorder.isTypeSupported === "function" ? Recorder.isTypeSupported.bind(Recorder) : () => false;
    const supports = (mimeType: string) => {
      try { return supported(mimeType); } catch { return false; }
    };
    const preferred = chooseRecordingMimeType(supports);
    const candidates = [preferred, ...RECORDING_MIME_CANDIDATES.filter((mimeType) => mimeType !== preferred && supports(mimeType)), undefined];
    let lastError: unknown;
    for (const mimeType of candidates) {
      for (const withBitrate of [true, false]) {
        try {
          const options: MediaRecorderOptions = { ...(mimeType ? { mimeType } : {}), ...(withBitrate ? { audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND } : {}) };
          const recorder = new Recorder(stream, options);
          session.requestedMimeType = mimeType;
          return recorder;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError ?? new Error("MediaRecorder unavailable");
  }

  private attachRecorder(session: ActiveSession) {
    const recorder = session.recorder;
    if (!recorder) return;
    recorder.onstart = () => {
      if (!this.isCurrent(session)) return;
      if (session.captureStartedAtUnixMs === undefined) {
        session.captureStartedAtUnixMs = this.now();
        session.captureStartedAtMonotonicMs = this.monotonicNow();
      }
      if (this.snapshot.status === "starting") this.update({ ...this.snapshot, status: "recording", message: "녹음 중입니다." });
    };
    recorder.ondataavailable = (event) => {
      if ((this.isCurrent(session) || session.interrupted) && event.data.size > 0) session.chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      session.recorderError = (event as Event & { error?: unknown }).error ?? new Error("MediaRecorder error");
      if (!this.isCurrent(session)) return;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
          return;
        } catch (error) {
          logError("RecordingSessionController.stopAfterError", error);
        }
      }
      this.fail(session, "마이크 녹음 중 오류가 발생했습니다. 마이크 연결을 확인하고 다시 녹음해 주세요.", session.recorderError);
    };
    recorder.onstop = () => { void this.finish(session); };
  }

  private async finish(session: ActiveSession) {
    const recorder = session.recorder;
    this.stopTracks(session.stream);
    if (!recorder) {
      if (this.session === session) this.cancel();
      return;
    }
    const mimeType = recorder.mimeType || session.chunks.find((chunk) => chunk.type)?.type || session.requestedMimeType || "application/octet-stream";
    const blob = new Blob(session.chunks, { type: mimeType });
    if (blob.size > 0) {
      const metadata: RecordingMetadata = {
        projectId: session.request.projectId,
        trackId: session.request.trackId,
        requestedStartBeat: session.request.startBeat,
        transportBeatAtStart: session.transportBeatAtStart,
        requestedMimeType: session.requestedMimeType,
        actualMimeType: mimeType,
        requestedAudioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
        actualAudioBitsPerSecond: recorder.audioBitsPerSecond || undefined,
        audioSettings: session.settings,
        captureStartedAtUnixMs: session.captureStartedAtUnixMs,
        captureStartedAtMonotonicMs: session.captureStartedAtMonotonicMs,
        captureStoppedAtUnixMs: this.now(),
        captureStoppedAtMonotonicMs: this.monotonicNow()
      };
      session.rawCapture = { blob, mimeType, name: session.request.name, metadata, reason: "decode" };
    }
    if (session.interrupted || !this.isCurrent(session)) {
      if (this.session === session) this.cancel();
      else {
        this.preserveInterrupted(session);
        this.cleanup(session);
      }
      return;
    }
    if (!session.stopPromise) session.stopPromise = new Promise((resolve) => { session.settleStop = resolve; });
    if (this.snapshot.status === "recording" || this.snapshot.status === "starting") {
      this.update({ ...this.snapshot, status: "stopping", message: "녹음을 마무리하고 있습니다." });
    }
    if (session.recorderError) {
      this.fail(session, "녹음 중 오류가 발생했습니다. 마이크 연결을 확인하고 다시 녹음해 주세요.", session.recorderError);
      return;
    }
    if (blob.size === 0) {
      this.fail(session, "녹음된 오디오가 비어 있습니다. 마이크 입력을 확인하고 다시 녹음해 주세요.");
      return;
    }
    const recovery = session.rawCapture!;
    let durationSeconds: number;
    try {
      durationSeconds = await decodeRecordingDuration(blob, this.options.audioContextCtor);
    } catch (error) {
      if (!this.isCurrent(session)) {
        if (this.session === session) this.cancel();
        return;
      }
      this.unusableRecording = recovery;
      session.preservationStarted = true;
      try {
        await this.options.onUnusableRecording?.(recovery);
      } catch (preserveError) {
        logError("RecordingSessionController.preserve", preserveError);
      }
      this.fail(session, "녹음 파일을 읽을 수 없습니다. 원본은 이 창에서 임시로 보관 중입니다. 다시 가져오거나 다른 브라우저에서 열어 주세요.", error);
      return;
    }
    if (!this.isCurrent(session)) {
      if (this.session === session) this.cancel();
      return;
    }
    const result: RecordingResult = { blob, mimeType, durationSeconds, name: session.request.name, metadata: recovery.metadata };
    this.update({ ...this.snapshot, status: "saving", message: "녹음을 저장하고 있습니다." });
    try {
      await this.options.onCommit(result);
      if (!this.isCurrent(session)) {
        if (this.session === session) this.cancel();
        return;
      }
      this.cleanup(session);
      this.session = undefined;
      this.update({ status: "idle", message: "오디오 녹음을 저장했습니다.", warning: this.snapshot.warning });
      session.settleStop?.(result);
    } catch (error) {
      if (!this.isCurrent(session)) {
        if (this.session === session) this.cancel();
        return;
      }
      this.unusableRecording = { ...recovery, reason: "commit" };
      this.fail(session, "녹음을 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요. 원본 녹음은 임시로 보관 중입니다.", error);
    }
  }

  private fail(session: ActiveSession, message: string, error?: unknown) {
    if (error) logError("RecordingSessionController", error);
    this.cleanup(session);
    if (!this.isCurrent(session)) {
      if (this.session === session) this.cancel();
      return;
    }
    this.session = undefined;
    session.settleStop?.(undefined);
    this.update({ status: "error", message, warning: this.snapshot.warning, projectId: session.request.projectId, trackId: session.request.trackId });
  }

  private preserveInterrupted(session: ActiveSession) {
    const original = session.rawCapture;
    if (!original || original.blob.size === 0 || session.preservationStarted) return;
    session.preservationStarted = true;
    const recovery: UnusableRecording = { ...original, reason: "interrupted" };
    this.unusableRecording = recovery;
    try {
      const pending = this.options.onUnusableRecording?.(recovery);
      void Promise.resolve(pending).catch((error) => logError("RecordingSessionController.preserveInterrupted", error));
    } catch (error) {
      logError("RecordingSessionController.preserveInterrupted", error);
    }
  }

  private cleanup(session: ActiveSession) {
    const recorder = session.recorder;
    if (recorder) {
      recorder.onstart = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") {
        try { recorder.stop(); } catch (error) { logError("RecordingSessionController.stop", error); }
      }
    }
    this.stopTracks(session.stream);
  }

  private stopTracks(stream?: MediaStream) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  private now() { return this.options.now?.() ?? Date.now(); }
  private monotonicNow() { return this.options.monotonicNow?.() ?? performance.now(); }
}
