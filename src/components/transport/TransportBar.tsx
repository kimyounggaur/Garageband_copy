import {
  ClipboardCheck,
  Copy,
  Download,
  FolderPlus,
  GraduationCap,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Square,
  Redo2,
  School,
  Undo2
} from "lucide-react";
import type { ReactNode } from "react";
import type { StudioMode } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { formatBeat } from "../../utils/timeline";

type Status = "idle" | "working" | "done" | "error";

type TransportBarProps = {
  onSave: () => void;
  saveStatus: Status;
  onExport: () => void;
  exportStatus: Status;
  educationView: "student" | "teacher";
  onEducationViewChange: (view: "student" | "teacher") => void;
};

function statusText(status: Status, fallback: string) {
  if (status === "working") return "Working";
  if (status === "done") return "Done";
  if (status === "error") return "Error";
  return fallback;
}

export function TransportBar({
  onSave,
  saveStatus,
  onExport,
  exportStatus,
  educationView,
  onEducationViewChange
}: TransportBarProps) {
  const project = useDawStore((state) => state.project);
  const mode = useDawStore((state) => state.mode);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const setBpm = useDawStore((state) => state.setBpm);
  const setMode = useDawStore((state) => state.setMode);
  const renameProject = useDawStore((state) => state.renameProject);
  const createProject = useDawStore((state) => state.createProject);
  const duplicateProject = useDawStore((state) => state.duplicateProject);
  const undo = useDawStore((state) => state.undo);
  const redo = useDawStore((state) => state.redo);
  const canUndo = useDawStore((state) => state.undoStack.length > 0);
  const canRedo = useDawStore((state) => state.redoStack.length > 0);
  const modes: Array<{ id: StudioMode; label: string; icon: ReactNode }> = [
    { id: "studio", label: "Studio", icon: <SlidersHorizontal size={14} /> },
    { id: "lesson", label: "Lesson", icon: <GraduationCap size={14} /> },
    { id: "review", label: "Review", icon: <ClipboardCheck size={14} /> }
  ];

  return (
    <header className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-studio-900 px-3">
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
          <button
            className="studio-icon-button"
            title="Undo"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="studio-icon-button"
            title="Redo"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 size={15} />
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
          <input
            className="h-6 w-[clamp(150px,16vw,280px)] rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none transition focus:border-white/20 focus:bg-black/20"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            aria-label="Project name"
          />
          <div className="text-[11px] text-slate-500">
            v{project.version} · {project.tracks.length} tracks · {project.timeSignature.join("/")}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
          <button
            className={`inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
              educationView === "student" ? "bg-meter-green text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
            }`}
            onClick={() => onEducationViewChange("student")}
            title="Student View"
          >
            <GraduationCap size={14} />
            Student
          </button>
          <button
            className={`inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
              educationView === "teacher" ? "bg-meter-amber text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
            }`}
            onClick={() => onEducationViewChange("teacher")}
            title="Teacher View"
          >
            <School size={14} />
            Teacher
          </button>
        </div>
        <div className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
          {modes.map((item) => (
            <button
              key={item.id}
              className={`inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
                mode === item.id ? "bg-meter-cyan text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
              }`}
              onClick={() => setMode(item.id)}
              title={`${item.label} mode`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <button className="studio-button" onClick={() => createProject("Untitled Session")} title="New project">
          <FolderPlus size={15} />
          New
        </button>
        <button className="studio-button" onClick={duplicateProject} title="Duplicate project">
          <Copy size={15} />
          Duplicate
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
