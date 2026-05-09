import { Mic, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { saveAudioAsset } from "../../db/projectsDb";
import { useDawStore } from "../../store/useDawStore";
import type { AudioAsset } from "../../types/project";
import { makeId } from "../../utils/id";
import { snapBeat } from "../../utils/timeline";

type RecorderStatus = "idle" | "recording" | "saving" | "error";

async function getAudioDuration(url: string) {
  return new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 4);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      resolve(4);
    };
    audio.src = url;
  });
}

export function RecorderPanel() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const addAudioClip = useDawStore((state) => state.addAudioClip);
  const projectId = useDawStore((state) => state.project.id);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);

  async function saveBlob(blob: Blob, durationSeconds: number, name: string) {
    setStatus("saving");
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
      await saveAudioAsset(asset);
      addAudioClip(selectedTrackId, snapBeat(currentBeat, snapBeats), name, undefined, durationSeconds, asset.id);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const duration = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000);
        void saveBlob(blob, duration, `Recording ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      };
      recorder.start();
      setStatus("recording");
    } catch {
      setStatus("error");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const duration = await getAudioDuration(objectUrl);
    await saveBlob(file, duration, file.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Recording</span>
        <span className="text-[10px] font-bold text-slate-500">{status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {status === "recording" ? (
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
          <input
            className="hidden"
            type="file"
            accept="audio/*"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
