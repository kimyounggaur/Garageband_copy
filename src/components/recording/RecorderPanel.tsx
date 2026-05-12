import { Mic, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { audioAssetRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { AudioAsset } from "../../types/project";
import { makeId } from "../../utils/id";
import { statusLabel } from "../../utils/labels";
import { snapBeat } from "../../utils/timeline";

type RecorderStatus = "idle" | "recording" | "saving" | "error";

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
      addAudioClip(selectedTrackId, snapBeat(currentBeat, snapBeats), name, undefined, durationSeconds, asset.id);
      setStatus("idle");
      setMessage("오디오 클립을 만들었어요.");
    } catch {
      setStatus("error");
      setMessage("오디오를 저장하지 못했어요.");
    }
  }

  async function startRecording() {
    try {
      setMessage("");
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
        if (blob.size === 0) {
          setStatus("error");
          setMessage("녹음된 오디오가 비어 있어요.");
          return;
        }
        const duration = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000);
        void saveBlob(blob, duration, `녹음 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      };
      recorder.start();
      setStatus("recording");
    } catch {
      setStatus("error");
      setMessage("마이크 권한을 확인해 주세요.");
    }
  }

  function stopRecording() {
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
      setMessage("이 오디오는 읽을 수 없어요. WAV, MP3, M4A, WebM 파일로 다시 시도해 주세요.");
      return;
    }
    await saveBlob(file, duration, file.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">녹음</span>
        <span className="text-[10px] font-bold text-slate-500">{statusLabel(status, "대기")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {status === "recording" ? (
          <button className="studio-button w-full bg-meter-rose/20" onClick={stopRecording}>
            <Square size={14} />
            정지
          </button>
        ) : (
          <button className="studio-button w-full" onClick={startRecording} disabled={status === "saving"}>
            <Mic size={14} />
            녹음
          </button>
        )}
        <label className="studio-button w-full cursor-pointer">
          <Upload size={14} />
          업로드
          <input
            className="hidden"
            type="file"
            accept="audio/*"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
        </label>
      </div>
      {message ? (
        <div className={`mt-2 rounded border p-2 text-[11px] font-semibold ${
          status === "error" ? "border-meter-rose/30 bg-meter-rose/10 text-rose-100" : "border-meter-green/30 bg-meter-green/10 text-green-100"
        }`}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
