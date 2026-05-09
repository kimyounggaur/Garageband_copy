import { Download, FolderPlus, Play, RotateCcw, Save, Square } from "lucide-react";
import { useDawStore } from "../../store/useDawStore";
import { formatBeat } from "../../utils/timeline";

type Status = "idle" | "working" | "done" | "error";

type TransportBarProps = {
  onSave: () => void;
  saveStatus: Status;
  onExport: () => void;
  exportStatus: Status;
};

function statusText(status: Status, fallback: string) {
  if (status === "working") return "Working";
  if (status === "done") return "Done";
  if (status === "error") return "Error";
  return fallback;
}

export function TransportBar({ onSave, saveStatus, onExport, exportStatus }: TransportBarProps) {
  const project = useDawStore((state) => state.project);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const setBpm = useDawStore((state) => state.setBpm);
  const createProject = useDawStore((state) => state.createProject);

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-studio-900 px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2">
          <button
            className="studio-icon-button"
            title={isPlaying ? "Pause" : "Play"}
            onClick={() => setPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <Play size={16} fill={isPlaying ? "currentColor" : "none"} />
          </button>
          <button
            className="studio-icon-button"
            title="Stop"
            onClick={() => {
              setPlaying(false);
              setCurrentBeat(0);
            }}
            aria-label="Stop"
          >
            <Square size={15} />
          </button>
          <button
            className="studio-icon-button"
            title="Return to start"
            onClick={() => setCurrentBeat(0)}
            aria-label="Return to start"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">BPM</span>
          <input
            className="h-7 w-16 rounded border border-white/10 bg-studio-950 px-2 text-center text-sm font-bold text-slate-100 outline-none focus:border-meter-cyan"
            type="number"
            min={40}
            max={220}
            value={project.bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            aria-label="BPM"
          />
        </div>

        <div className="flex h-9 min-w-24 items-center justify-center rounded-md border border-white/10 bg-black/20 px-3 font-mono text-sm text-meter-green">
          {formatBeat(currentBeat)}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{project.name}</div>
          <div className="text-[11px] text-slate-500">
            {project.tracks.length} tracks · {project.timeSignature.join("/")}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="studio-button" onClick={() => createProject("Untitled Session")} title="New project">
          <FolderPlus size={15} />
          New
        </button>
        <button className="studio-button" onClick={onSave} title="Save project">
          <Save size={15} />
          {statusText(saveStatus, "Save")}
        </button>
        <button className="studio-button" onClick={onExport} title="Export WAV">
          <Download size={15} />
          {statusText(exportStatus, "Export")}
        </button>
      </div>
    </header>
  );
}
