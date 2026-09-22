import { Mic, Square, Upload, Download, RefreshCcw } from "../icons";

export type RecordingDisplayStatus =
  | "idle"
  | "permission"
  | "ready"
  | "counting"
  | "starting"
  | "recording"
  | "stopping"
  | "saving"
  | "error";

export type RecordingControls = {
  status: RecordingDisplayStatus;
  message: string;
  targetTrackName?: string;
  hasRecovery: boolean;
  onRecord: () => void;
  onStop: () => void;
  onImportFile: (file: File) => void;
  onRetry: () => void;
  onDownloadRecovery: () => void;
};

const statusText: Record<RecordingDisplayStatus, string> = {
  idle: "준비됨",
  permission: "마이크 권한 확인 중",
  ready: "녹음 준비됨",
  counting: "카운트인",
  starting: "녹음 시작 중",
  recording: "녹음 중",
  stopping: "녹음 마무리 중",
  saving: "저장 중",
  error: "오류"
};

export function RecorderPanel({ controls }: { controls: RecordingControls }) {
  const active = ["permission", "ready", "counting", "starting", "recording", "stopping"].includes(controls.status);
  const busy = controls.status === "saving" || controls.status === "stopping";
  return (
    <div className="rounded-md border border-line bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">녹음</span>
        <span className="truncate text-[10px] font-bold text-ink-body" aria-live="polite">
          {controls.targetTrackName ?? "오디오 트랙을 선택해 주세요"} · {statusText[controls.status]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {active ? (
          <button className="studio-button w-full bg-meter-rose/20" onClick={controls.onStop} disabled={busy}>
            <Square size={14} /> 정지
          </button>
        ) : (
          <button className="studio-button w-full" onClick={controls.onRecord} disabled={busy || !controls.targetTrackName}>
            <Mic size={14} /> 녹음
          </button>
        )}
        <label className={`studio-button w-full ${busy ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
          <Upload size={14} /> 오디오 가져오기
          <input
            className="hidden"
            type="file"
            accept="audio/*"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) controls.onImportFile(file);
            }}
          />
        </label>
      </div>
      {controls.message ? (
        <div
          className={`mt-2 rounded border p-2 text-[11px] font-semibold ${
            controls.status === "error"
              ? "border-meter-rose/30 bg-meter-rose/10 text-rose-100"
              : "border-meter-green/30 bg-meter-green/10 text-green-100"
          }`}
          role={controls.status === "error" ? "alert" : "status"}
        >
          {controls.message}
        </div>
      ) : null}
      {controls.hasRecovery ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="studio-button h-8 px-2 text-[11px]" onClick={controls.onRetry}>
            <RefreshCcw size={13} /> 다시 시도
          </button>
          <button className="studio-button h-8 px-2 text-[11px]" onClick={controls.onDownloadRecovery}>
            <Download size={13} /> 원본 파일 저장
          </button>
        </div>
      ) : null}
    </div>
  );
}
