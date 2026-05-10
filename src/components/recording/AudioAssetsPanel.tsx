import { RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { audioAssetRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { AudioAsset } from "../../types/project";

type AssetStatus = "idle" | "working" | "done" | "error";

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatSize(blob: Blob) {
  const size = blob.size;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function AudioAssetsPanel() {
  const project = useDawStore((state) => state.project);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [status, setStatus] = useState<AssetStatus>("idle");
  const usedAssetIds = useMemo(() => {
    return new Set(
      project.tracks
        .flatMap((track) => track.clips)
        .map((clip) => clip.audioAssetId)
        .filter((assetId): assetId is string => Boolean(assetId))
    );
  }, [project.tracks]);

  async function refresh() {
    setStatus("working");
    try {
      const nextAssets = await audioAssetRepository.listAudioAssets(project.id);
      setAssets(nextAssets.sort((left, right) => right.createdAt - left.createdAt));
      setStatus("idle");
    } catch {
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
    } catch {
      setStatus("error");
      await refresh();
    }
  }

  async function deleteAsset(asset: AudioAsset) {
    if (usedAssetIds.has(asset.id)) return;
    setStatus("working");
    try {
      await audioAssetRepository.deleteAudioAsset(asset.id);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  async function cleanUnusedAssets() {
    setStatus("working");
    try {
      await audioAssetRepository.deleteUnusedAudioAssets(project.id, [...usedAssetIds]);
      await refresh();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, [project.id, project.updatedAt]);

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Audio Assets</div>
          <div className="text-[11px] font-semibold text-slate-500">
            {assets.length} files · {assets.filter((asset) => !usedAssetIds.has(asset.id)).length} unused
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="Refresh audio assets" aria-label="Refresh audio assets">
            <RefreshCcw size={13} />
          </button>
          <button className="studio-icon-button h-7 w-7" onClick={() => void cleanUnusedAssets()} title="Clean unused audio assets" aria-label="Clean unused audio assets">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {status === "error" ? (
        <div className="mb-2 rounded border border-meter-rose/30 bg-meter-rose/10 p-2 text-[11px] font-semibold text-rose-100">
          오디오 asset 작업을 완료하지 못했어요.
        </div>
      ) : null}

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {assets.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.045] p-2 text-xs text-slate-500">
            저장된 오디오가 아직 없습니다.
          </div>
        ) : (
          assets.map((asset) => {
            const used = usedAssetIds.has(asset.id);
            return (
              <div key={asset.id} className="rounded-md border border-white/10 bg-white/[0.045] p-2">
                <div className="flex items-center gap-1">
                  <input
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs font-bold text-slate-100 outline-none focus:border-white/20 focus:bg-black/20"
                    value={asset.name}
                    onChange={(event) =>
                      setAssets((current) =>
                        current.map((item) => (item.id === asset.id ? { ...item, name: event.target.value } : item))
                      )
                    }
                    onBlur={(event) => void renameAsset(asset, event.target.value)}
                    aria-label={`${asset.name} audio asset name`}
                  />
                  <button
                    className="studio-icon-button h-7 w-7"
                    onClick={() => void deleteAsset(asset)}
                    disabled={used}
                    title={used ? "Asset is used by a clip" : "Delete audio asset"}
                    aria-label={`Delete ${asset.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <span>{formatDuration(asset.durationSeconds)}</span>
                  <span>{formatSize(asset.blob)}</span>
                  <span className={used ? "text-meter-green" : "text-meter-amber"}>{used ? "Used" : "Unused"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
