import { Download, Plus, RefreshCcw } from "../icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { audioAssetRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { AudioAsset } from "../../types/project";
import { snapBeat } from "../../utils/timeline";
import { logError } from "../../utils/logger";
import { decodeRecordingDuration } from "../../audio/RecordingSessionController";
import { referencedAudioAssetIds } from "../../audio/recordingAttachment";

type AssetStatus = "idle" | "working" | "done" | "error";

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatSize(blob: Blob) {
  const size = blob.size;
  if (size === 0) return "원본 열기 전";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function AudioAssetsPanel() {
  const project = useDawStore((state) => state.project);
  const addAudioClip = useDawStore((state) => state.addAudioClip);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [status, setStatus] = useState<AssetStatus>("idle");
  const [message, setMessage] = useState("");
  const refreshGeneration = useRef(0);
  const usedAssetIds = useMemo(() => referencedAudioAssetIds(project), [project]);

  async function refresh() {
    const generation = ++refreshGeneration.current;
    setStatus("working");
    try {
      const currentProject = useDawStore.getState().project;
      const owned = await audioAssetRepository.listAudioAssets(currentProject.id);
      const ownedIds = new Set(owned.map((asset) => asset.id));
      // Project duplication keeps source asset IDs. Show those shared originals
      // so a copied project can still download and retry its audio.
      const sharedIds = [...referencedAudioAssetIds(currentProject)].filter((id) => !ownedIds.has(id));
      const shared = await Promise.all(sharedIds.map((id) => audioAssetRepository.loadAudioAsset(id)));
      if (generation !== refreshGeneration.current || useDawStore.getState().project.id !== currentProject.id) return;
      setAssets([...owned, ...shared.filter((asset): asset is AudioAsset => Boolean(asset))]
        .sort((left, right) => right.createdAt - left.createdAt));
      setStatus("idle");
    } catch (error) {
      if (generation !== refreshGeneration.current) return;
      logError("AudioAssetsPanel.refresh", error);
      setStatus("error");
    }
  }

  async function renameAsset(asset: AudioAsset, name: string) {
    const nextName = name.trim() || asset.name;
    if (nextName === asset.name) return;
    setAssets((current) => current.map((item) => (item.id === asset.id ? { ...item, name: nextName } : item)));
    try {
      await audioAssetRepository.renameAudioAsset(asset.id, nextName);
      setStatus("done");
    } catch (error) {
      logError("AudioAssetsPanel.renameAsset", error);
      setStatus("error");
      await refresh();
    }
  }

  function insertAsset(asset: AudioAsset) {
    if (asset.durationSeconds <= 0) return;
    addAudioClip(selectedTrackId, snapBeat(currentBeat, snapBeats), asset.name, undefined, asset.durationSeconds, asset.id);
  }

  async function retryDecode(asset: AudioAsset) {
    setStatus("working");
    setMessage("");
    try {
      const original = await audioAssetRepository.loadAudioAsset(asset.id);
      if (!original) throw new Error("보관된 오디오 원본을 찾지 못했습니다.");
      const durationSeconds = await decodeRecordingDuration(original.blob);
      await audioAssetRepository.saveAudioAsset({ ...original, durationSeconds });
      await refresh();
      setMessage("원본 오디오를 읽었습니다. 이제 타임라인에 넣을 수 있어요.");
      setStatus("done");
    } catch (error) {
      logError("AudioAssetsPanel.retryDecode", error);
      setStatus("error");
      setMessage("아직 이 오디오를 읽을 수 없습니다. 원본 파일을 내려받아 보관하거나 다른 브라우저에서 가져와 주세요.");
    }
  }

  async function downloadAsset(asset: AudioAsset) {
    try {
      const original = await audioAssetRepository.loadAudioAsset(asset.id);
      if (!original) throw new Error("보관된 오디오 원본을 찾지 못했습니다.");
      const { downloadBlob } = await import("../../audio/exportProject");
      const extension = original.mimeType.includes("mp4") ? "m4a" : original.mimeType.includes("wav") ? "wav" : "webm";
      downloadBlob(original.blob, `${asset.name.replace(/[\\/:*?"<>|]+/g, "-")}.${extension}`);
    } catch (error) {
      logError("AudioAssetsPanel.downloadAsset", error);
      setStatus("error");
      setMessage("원본 오디오를 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    }
  }

  useEffect(() => {
    void refresh();
  }, [project.id]);

  useEffect(() => {
    const onChanged = () => { void refresh(); };
    window.addEventListener("webband:audio-assets-changed", onChanged);
    return () => window.removeEventListener("webband:audio-assets-changed", onChanged);
  }, [project.id]);

  return (
    <div className="rounded-md border border-line bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">샘플 라이브러리</div>
          <div className="text-[11px] font-semibold text-ink-body">
            파일 {assets.length}개 · 미사용 파일도 원본 보관
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="샘플 새로고침" aria-label="샘플 새로고침">
            <RefreshCcw size={13} />
          </button>
        </div>
      </div>

      {status === "error" ? (
        <div className="mb-2 rounded border border-meter-rose/30 bg-meter-rose/10 p-2 text-[11px] font-semibold text-rose-100">
          {message || "오디오 샘플 작업을 완료하지 못했어요. 다시 시도해 주세요."}
        </div>
      ) : null}
      {status !== "error" && message ? <div className="mb-2 text-[11px] text-meter-green" role="status">{message}</div> : null}

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {assets.length === 0 ? (
          <div className="rounded-md border border-line bg-white/[0.045] p-2 text-xs text-ink-body">
            저장된 샘플이 아직 없습니다.
          </div>
        ) : (
          assets.map((asset) => {
            const used = usedAssetIds.has(asset.id);
            return (
              <div key={asset.id} className="rounded-md border border-line bg-white/[0.045] p-2">
                <div className="flex items-center gap-1">
                  <input
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs font-bold text-ink-high outline-none focus:border-white/20 focus:bg-black/20"
                    value={asset.name}
                    onChange={(event) =>
                      setAssets((current) =>
                        current.map((item) => (item.id === asset.id ? { ...item, name: event.target.value } : item))
                      )
                    }
                    onBlur={(event) => void renameAsset(asset, event.target.value)}
                    aria-label={`${asset.name} 샘플 이름`}
                  />
                  <button className="studio-icon-button h-7 w-7" onClick={() => insertAsset(asset)} disabled={asset.durationSeconds <= 0} title={asset.durationSeconds <= 0 ? "오디오를 다시 읽어 주세요" : "타임라인에 삽입"} aria-label={`${asset.name} 삽입`}>
                    <Plus size={12} />
                  </button>
                  {asset.durationSeconds <= 0 ? (
                      <button className="studio-icon-button h-7 w-7" onClick={() => void retryDecode(asset)} title="원본 다시 읽기" aria-label={`${asset.name} 다시 읽기`}>
                        <RefreshCcw size={12} />
                      </button>
                  ) : null}
                  <button className="studio-icon-button h-7 w-7" onClick={() => void downloadAsset(asset)} title="원본 내려받기" aria-label={`${asset.name} 원본 내려받기`}>
                    <Download size={12} />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-body">
                  <span>{asset.durationSeconds > 0 ? formatDuration(asset.durationSeconds) : "읽기 실패 · 원본 보관"}</span>
                  <span>{formatSize(asset.blob)}</span>
                  <span className={used ? "text-meter-green" : "text-meter-amber"}>{asset.projectId !== project.id ? "공유 원본" : used ? "사용 중" : "미사용 · 보관 중"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
