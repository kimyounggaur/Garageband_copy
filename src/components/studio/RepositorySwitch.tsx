import { Cloud, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import { getRepositoryMode, projectRepository, setRepositoryMode, subscribeRepositoryMode } from "../../db/studioRepository";
import type { RepositoryMode } from "../../repositories/cloudTypes";
import { useDawStore } from "../../store/useDawStore";

function modeLabel(mode: RepositoryMode) {
  return mode === "mockCloud" ? "Cloud Mock" : "Local";
}

export function RepositorySwitch() {
  const [mode, setMode] = useState<RepositoryMode>(getRepositoryMode());
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");

  useEffect(() => subscribeRepositoryMode(setMode), []);

  async function changeMode(nextMode: RepositoryMode) {
    if (nextMode === mode) return;
    setStatus("syncing");
    try {
      setRepositoryMode(nextMode);
      await projectRepository.saveProject(useDawStore.getState().project);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-studio-900/80 p-1">
      <div className="grid grid-cols-2 gap-1">
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition ${
            mode === "local" ? "bg-meter-cyan text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => void changeMode("local")}
          title="Use local storage"
        >
          <HardDrive size={13} />
          Local
        </button>
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition ${
            mode === "mockCloud" ? "bg-meter-amber text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => void changeMode("mockCloud")}
          title="Use cloud mock storage"
        >
          <Cloud size={13} />
          Cloud
        </button>
      </div>
      <div className="mt-1 truncate px-1 text-[10px] font-semibold text-slate-500">
        {status === "syncing" ? "Switching..." : status === "error" ? "Switch failed" : `${modeLabel(mode)} storage`}
      </div>
    </div>
  );
}
