import {
  ClipboardCheck,
  Copy,
  Download,
  FolderPlus,
  GraduationCap,
  Play,
  Redo2,
  RotateCcw,
  Save,
  School,
  SlidersHorizontal,
  Square,
  Undo2
} from "../icons";
import type { ReactNode } from "react";
import type { StudioMode } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { statusLabel } from "../../utils/labels";
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
    { id: "studio", label: "스튜디오", icon: <SlidersHorizontal size={14} /> },
    { id: "lesson", label: "레슨", icon: <GraduationCap size={14} /> },
    { id: "review", label: "검토", icon: <ClipboardCheck size={14} /> }
  ];

  return (
    <header className="flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-studio-900 px-2 py-2 lg:h-14 lg:flex-nowrap lg:px-3 lg:py-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
        <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2">
          <button
            className="studio-icon-button"
            title={isPlaying ? "일시정지" : "재생"}
            onClick={() => setPlaying(!isPlaying)}
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            <Play size={16} fill={isPlaying ? "currentColor" : "none"} />
          </button>
          <button
            className="studio-icon-button"
            title="정지"
            onClick={() => {
              setPlaying(false);
              setCurrentBeat(0);
            }}
            aria-label="정지"
          >
            <Square size={15} />
          </button>
          <button
            className="studio-icon-button"
            title="처음으로 이동"
            onClick={() => setCurrentBeat(0)}
            aria-label="처음으로 이동"
          >
            <RotateCcw size={15} />
          </button>
          <button className="studio-icon-button" title="되돌리기" onClick={undo} disabled={!canUndo} aria-label="되돌리기">
            <Undo2 size={15} />
          </button>
          <button className="studio-icon-button" title="다시 실행" onClick={redo} disabled={!canRedo} aria-label="다시 실행">
            <Redo2 size={15} />
          </button>
        </div>

        <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">템포</span>
          <input
            className="h-7 w-16 rounded border border-white/10 bg-studio-950 px-2 text-center text-sm font-bold text-slate-100 outline-none focus:border-meter-cyan"
            type="number"
            min={40}
            max={220}
            value={project.bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            aria-label="템포"
          />
        </div>

        <div className="flex h-9 min-w-24 items-center justify-center rounded-md border border-white/10 bg-black/20 px-3 font-mono text-sm text-meter-green">
          {formatBeat(currentBeat)}
        </div>

        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
          <input
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none transition focus:border-white/20 focus:bg-black/20 sm:w-[clamp(150px,16vw,280px)]"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            aria-label="프로젝트 이름"
          />
          <div className="text-[11px] text-slate-500">
            v{project.version} · 트랙 {project.tracks.length}개 · {project.timeSignature.join("/")}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
        <div className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
          <button
            className={`inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
              educationView === "student" ? "bg-meter-green text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
            }`}
            onClick={() => onEducationViewChange("student")}
            title="학생 보기"
          >
            <GraduationCap size={14} />
            <span className="hidden sm:inline">학생</span>
          </button>
          <button
            className={`inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
              educationView === "teacher" ? "bg-meter-amber text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
            }`}
            onClick={() => onEducationViewChange("teacher")}
            title="교사 보기"
          >
            <School size={14} />
            <span className="hidden sm:inline">교사</span>
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
              title={`${item.label} 모드`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
        <button className="studio-button" onClick={() => createProject("새 프로젝트")} title="새 프로젝트">
          <FolderPlus size={15} />
          <span className="hidden sm:inline">새로 만들기</span>
        </button>
        <button className="studio-button" onClick={duplicateProject} title="프로젝트 복제">
          <Copy size={15} />
          <span className="hidden sm:inline">복제</span>
        </button>
        <button className="studio-button" onClick={onSave} title="프로젝트 저장">
          <Save size={15} />
          <span className="hidden sm:inline">{statusLabel(saveStatus, "저장")}</span>
        </button>
        <button className="studio-button" onClick={onExport} title="WAV 내보내기">
          <Download size={15} />
          <span className="hidden sm:inline">{statusLabel(exportStatus, "내보내기")}</span>
        </button>
      </div>
    </header>
  );
}
