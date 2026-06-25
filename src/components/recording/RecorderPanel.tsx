import { Mic, Square, Upload } from "../icons";
import { useEffect, useRef, useState } from "react";
import { audioAssetRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { AudioAsset, Track } from "../../types/project";
import { makeId } from "../../utils/id";
import { statusLabel } from "../../utils/labels";
import { snapBeat } from "../../utils/timeline";

type RecorderStatus = "idle" | "counting" | "recording" | "saving" | "error";

async function getAudioDuration(url: string) {
  return new Promise<number | undefined>((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      resolve(undefined);
    };
    audio.src = url;
  });
}

export function RecorderPanel() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [message, setMessage] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef(0);
  const countInTimeoutRef = useRef<number | undefined>(undefined);
  const countdownFrameRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const addAudioClip = useDawStore((state) => state.addAudioClip);
  const addAudioTake = useDawStore((state) => state.addAudioTake);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const project = useDawStore((state) => state.project);
  const projectId = useDawStore((state) => state.project.id);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const armedTrack = project.tracks.find((track) => track.type === "audio" && track.recordEnabled);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  const targetTrack = armedTrack ?? (selectedTrack?.type === "audio" ? selectedTrack : undefined);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (countInTimeoutRef.current) window.clearTimeout(countInTimeoutRef.current);
      cancelAnimationFrame(countdownFrameRef.current);
    };
  }, []);

  function stopMeter() {
    cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = 0;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setInputLevel(0);
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopMeter();
  }

  function startMeter(stream: MediaStream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const samples = new Uint8Array(analyser.frequencyBinCount);
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = audioContext;

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (let index = 0; index < samples.length; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index] - 128) / 128);
      }
      setInputLevel(Math.min(1, peak * 1.8));
      meterFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  function cycleLengthBeats() {
    const start = project.cycleStart ?? 0;
    return Math.max(0.25, (project.cycleEnd ?? start + 0.25) - start);
  }

  function findCycleTakeFolder(track: Track | undefined) {
    if (!track || !project.cycleEnabled) return undefined;
    const start = project.cycleStart ?? 0;
    const length = cycleLengthBeats();
    return track.clips.find(
      (clip) => clip.type === "audio" && Math.abs(clip.startBeat - start) < 0.001 && Math.abs(clip.lengthBeats - length) < 0.001
    );
  }

  async function saveBlob(blob: Blob, durationSeconds: number, name: string) {
    setStatus("saving");
    setMessage("");
    try {
      const asset: AudioAsset = {
        id: makeId("audio"),
        projectId,
        name,
        blob,
        mimeType: blob.type || "application/octet-stream",
        durationSeconds,
        createdAt: Date.now()
      };
      await audioAssetRepository.saveAudioAsset(asset);

      const targetTrackId = targetTrack?.id ?? selectedTrackId;
      const cycleTakeFolder = findCycleTakeFolder(targetTrack);
      if (cycleTakeFolder) {
        addAudioTake(cycleTakeFolder.id, asset.id, { activate: true });
      } else {
        const startBeat = project.cycleEnabled ? project.cycleStart ?? 0 : snapBeat(currentBeat, snapBeats);
        const clipId = addAudioClip(targetTrackId, startBeat, name, undefined, durationSeconds, asset.id);
        if (project.cycleEnabled) resizeClip(clipId, cycleLengthBeats());
      }

      setStatus("idle");
      setCountdown(0);
      setMessage(cycleTakeFolder ? "Take saved to folder." : "Audio clip created.");
    } catch {
      setStatus("error");
      setMessage("Could not save audio.");
    }
  }

  function beginRecorder(recorder: MediaRecorder) {
    startedAtRef.current = Date.now();
    recorder.start();
    setStatus("recording");
    setCountdown(0);
  }

  async function startRecording() {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startMeter(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setStatus("error");
          setMessage("Recorded audio was empty.");
          return;
        }
        const duration = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000);
        void saveBlob(blob, duration, `Recording ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      };

      const countInBeats = Math.max(0, project.countInBars ?? 0) * Math.max(1, project.timeSignature[0]);
      if (countInBeats > 0) {
        const seconds = countInBeats * (60 / Math.max(1, project.bpm));
        const countdownStartedAt = Date.now();
        setStatus("counting");
        setCountdown(seconds);

        const tickCountdown = () => {
          const remaining = Math.max(0, seconds - (Date.now() - countdownStartedAt) / 1000);
          setCountdown(remaining);
          if (remaining > 0) countdownFrameRef.current = requestAnimationFrame(tickCountdown);
        };
        tickCountdown();

        countInTimeoutRef.current = window.setTimeout(() => {
          countInTimeoutRef.current = undefined;
          beginRecorder(recorder);
        }, seconds * 1000);
        return;
      }

      beginRecorder(recorder);
    } catch {
      cleanupStream();
      setStatus("error");
      setMessage("Check microphone permission.");
    }
  }

  function stopRecording() {
    if (countInTimeoutRef.current) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = undefined;
      recorderRef.current = null;
      cleanupStream();
      setCountdown(0);
      setStatus("idle");
      return;
    }
    recorderRef.current?.stop();
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setMessage("");
    setStatus("saving");
    const objectUrl = URL.createObjectURL(file);
    const duration = await getAudioDuration(objectUrl);
    if (!duration) {
      setStatus("error");
      setMessage("Could not read that audio file.");
      return;
    }
    await saveBlob(file, duration, file.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Record</span>
        <span className="truncate text-[10px] font-bold text-slate-500">
          {targetTrack ? targetTrack.name : "No audio track"} · {statusLabel(status, "Ready")}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.08]" aria-label="Input level">
        <div
          className="h-full rounded-full bg-gradient-to-r from-meter-green via-meter-amber to-meter-rose transition-[width]"
          style={{ width: `${Math.round(inputLevel * 100)}%` }}
        />
      </div>
      {status === "counting" ? (
        <div className="mb-2 rounded bg-meter-amber/10 px-2 py-1 text-[11px] font-bold text-amber-100">Count-in {countdown.toFixed(1)}s</div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {status === "recording" || status === "counting" ? (
          <button className="studio-button w-full bg-meter-rose/20" onClick={stopRecording}>
            <Square size={14} />
            Stop
          </button>
        ) : (
          <button className="studio-button w-full" onClick={startRecording} disabled={status === "saving"}>
            <Mic size={14} />
            Record
          </button>
        )}
        <label className="studio-button w-full cursor-pointer">
          <Upload size={14} />
          Upload
          <input className="hidden" type="file" accept="audio/*" onChange={(event) => void handleUpload(event.target.files?.[0])} />
        </label>
      </div>
      {message ? (
        <div
          className={`mt-2 rounded border p-2 text-[11px] font-semibold ${
            status === "error" ? "border-meter-rose/30 bg-meter-rose/10 text-rose-100" : "border-meter-green/30 bg-meter-green/10 text-green-100"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
