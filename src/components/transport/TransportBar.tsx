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
import { IconButton, LcdDisplay, SegmentedToggle } from "../ui";

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
  const modeOptions: Array<{ value: StudioMode; label: string; icon: ReactNode }> = [
    { value: "studio", label: "스튜디오", icon: <SlidersHorizontal size={14} /> },
    { value: "lesson", label: "레슨", icon: <GraduationCap size={14} /> },
    { value: "review", label: "검토", icon: <ClipboardCheck size={14} /> }
  ];
  const educationOptions: Array<{ value: "student" | "teacher"; label: string; icon: ReactNode }> = [
    { value: "student", label: "학생", icon: <GraduationCap size={14} /> },
    { value: "teacher", label: "교사", icon: <School size={14} /> }
  ];

  return (
    <header className="flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-2 border-b border-graphite-700 bg-graphite-950 px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] lg:h-14 lg:flex-nowrap lg:px-3 lg:py-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
        <div className="flex h-10 items-center gap-2 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <IconButton
            label={isPlaying ? "일시정지" : "재생"}
            tooltip={isPlaying ? "일시정지" : "재생"}
            active={isPlaying}
            tone="play"
            onClick={() => setPlaying(!isPlaying)}
          >
            <Play size={16} fill={isPlaying ? "currentColor" : "none"} />
          </IconButton>
          <IconButton
            label="정지"
            tooltip="정지"
            onClick={() => {
              setPlaying(false);
              setCurrentBeat(0);
            }}
          >
            <Square size={15} />
          </IconButton>
          <IconButton label="처음으로 이동" tooltip="처음으로 이동" onClick={() => setCurrentBeat(0)}>
            <RotateCcw size={15} />
          </IconButton>
          <IconButton label="되돌리기" tooltip="되돌리기" onClick={undo} disabled={!canUndo}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="다시 실행" tooltip="다시 실행" onClick={redo} disabled={!canRedo}>
            <Redo2 size={15} />
          </IconButton>
        </div>

        <LcdDisplay
          currentBeat={currentBeat}
          bpm={project.bpm}
          timeSignature={project.timeSignature}
          label="재생 위치 LCD"
          className="h-10"
        />

        <label className="flex h-10 items-center gap-2 rounded-md border border-graphite-700 bg-graphite-975/80 px-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-600">Tempo</span>
          <input
            className="h-7 w-16 rounded border border-graphite-700 bg-graphite-900 px-2 text-center text-sm font-bold text-slate-100 outline-none focus:border-accent-sel"
            type="number"
            min={40}
            max={220}
            value={project.bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            aria-label="템포"
          />
        </label>

        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
          <input
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none transition focus:border-graphite-700 focus:bg-black/20 sm:w-[clamp(150px,16vw,280px)]"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            aria-label="프로젝트 이름"
          />
          <div className="text-[11px] text-graphite-600">
            v{project.version} · 트랙 {project.tracks.length}개 · {project.timeSignature.join("/")}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
        <SegmentedToggle
          value={educationView}
          options={educationOptions}
          onChange={onEducationViewChange}
          ariaLabel="교육 보기"
          className="grid-cols-2"
        />
        <SegmentedToggle value={mode} options={modeOptions} onChange={setMode} ariaLabel="작업 모드" className="grid-cols-3" />
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
