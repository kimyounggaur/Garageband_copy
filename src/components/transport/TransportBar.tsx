import {
  BookOpen,
  Circle,
  ClipboardCheck,
  Copy,
  Download,
  FolderPlus,
  GraduationCap,
  Heart,
  Keyboard,
  Mic,
  Moon,
  Pause,
  Play,
  PlayCircle,
  Redo2,
  Repeat2,
  Rewind,
  Save,
  School,
  SlidersHorizontal,
  Square,
  Sparkles,
  Sun,
  Undo2,
  Volume1
} from "../icons";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { StudioMode } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { logError } from "../../utils/logger";
import type { AppTheme } from "../../utils/theme";
import { statusLabel } from "../../utils/labels";
import { detectPitchFromBuffer, pitchToTunerReading, projectKeyOptions } from "../../utils/transport";
import { IconButton, LcdDisplay, Meter, SegmentedToggle } from "../ui";

type Status = "idle" | "working" | "done" | "error";

type TransportBarProps = {
  onPlayToggle: () => void;
  onStop: () => void;
  onRecord: () => void;
  recordingStatus: string;
  exportDisabled?: boolean;
  onSave: () => void;
  saveStatus: Status;
  onExport: () => void;
  exportStatus: Status;
  educationView: "student" | "teacher";
  onEducationViewChange: (view: "student" | "teacher") => void;
  onShortcutHelp: () => void;
  appTheme: AppTheme;
  onAppThemeChange: (theme: AppTheme) => void;
};

const TIME_SIGNATURE_OPTIONS: Array<[number, number]> = [
  [4, 4],
  [3, 4],
  [6, 8],
  [5, 4],
  [7, 8]
];

function CurrentBeatLcd(props: ComponentProps<typeof LcdDisplay>) {
  const currentBeat = useDawStore((state) => state.currentBeat);
  return <LcdDisplay {...props} currentBeat={currentBeat} />;
}

function CurrentMasterMeter() {
  const masterLevel = useDawStore((state) => state.masterLevel);
  return <Meter label="마스터 피크 미터" value={masterLevel} className="w-12" />;
}

export function TransportBar({
  onPlayToggle,
  onStop,
  onRecord,
  recordingStatus,
  exportDisabled,
  onSave,
  saveStatus,
  onExport,
  exportStatus,
  educationView,
  onEducationViewChange,
  onShortcutHelp,
  appTheme,
  onAppThemeChange
}: TransportBarProps) {
  const project = useDawStore((state) => state.project);
  const mode = useDawStore((state) => state.mode);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const isRecording = useDawStore((state) => state.isRecording);
  const lcdMode = useDawStore((state) => state.lcdMode);
  const tunerReading = useDawStore((state) => state.tunerReading);
  const seekToBeat = useDawStore((state) => state.seekToBeat);
  const setBpm = useDawStore((state) => state.setBpm);
  const setMode = useDawStore((state) => state.setMode);
  const renameProject = useDawStore((state) => state.renameProject);
  const createProject = useDawStore((state) => state.createProject);
  const duplicateProject = useDawStore((state) => state.duplicateProject);
  const undo = useDawStore((state) => state.undo);
  const redo = useDawStore((state) => state.redo);
  const toggleCycle = useDawStore((state) => state.toggleCycle);
  const cycleLcdMode = useDawStore((state) => state.cycleLcdMode);
  const toggleMetronome = useDawStore((state) => state.toggleMetronome);
  const setCountInBars = useDawStore((state) => state.setCountInBars);
  const setProjectKey = useDawStore((state) => state.setProjectKey);
  const setTimeSignature = useDawStore((state) => state.setTimeSignature);
  const setMasterVolume = useDawStore((state) => state.setMasterVolume);
  const setTunerReading = useDawStore((state) => state.setTunerReading);
  const tapTempo = useDawStore((state) => state.tapTempo);
  const canUndo = useDawStore((state) => state.undoStack.length > 0);
  const canRedo = useDawStore((state) => state.redoStack.length > 0);
  const [tunerStatus, setTunerStatus] = useState<"idle" | "listening" | "blocked">("idle");
  const tunerFrameRef = useRef(0);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);

  const modeOptions: Array<{ value: StudioMode; label: string; icon: ReactNode }> = [
    { value: "studio", label: "스튜디오", icon: <SlidersHorizontal size={14} /> },
    { value: "lesson", label: "수업", icon: <GraduationCap size={14} /> },
    { value: "review", label: "검토", icon: <ClipboardCheck size={14} /> }
  ];
  const educationOptions: Array<{ value: "student" | "teacher"; label: string; icon: ReactNode }> = [
    { value: "student", label: "학생", icon: <GraduationCap size={14} /> },
    { value: "teacher", label: "교사", icon: <School size={14} /> }
  ];
  const themeOptions: Array<{ value: AppTheme; label: string; icon: ReactNode }> = [
    { value: "dark", label: "어두운", icon: <Moon size={14} /> },
    { value: "light", label: "밝은", icon: <Sun size={14} /> },
    { value: "pretty", label: "화사한", icon: <Sparkles size={14} /> },
    { value: "cute", label: "귀여운", icon: <Heart size={14} /> }
  ];
  const lcdValue =
    lcdMode === "tuner" && tunerReading
      ? `${tunerReading.note} ${tunerReading.cents > 0 ? "+" : ""}${tunerReading.cents}`
      : lcdMode === "tuner"
        ? "마이크 필요"
        : undefined;
  const lcdDetail =
    lcdMode === "tuner" && tunerReading
      ? `${tunerReading.frequency.toFixed(1)} Hz`
      : lcdMode === "tuner"
        ? tunerStatus === "blocked"
          ? "마이크 권한 필요"
          : "튜너"
        : undefined;

  useEffect(() => () => stopTuner(false), []);

  function stopTuner(resetStatus = true) {
    cancelAnimationFrame(tunerFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch((error) => logError("TransportBar.stopTuner", error));
    mediaStreamRef.current = undefined;
    analyserRef.current = undefined;
    audioContextRef.current = undefined;
    if (resetStatus) setTunerStatus("idle");
  }

  async function startTuner() {
    if (tunerStatus === "listening") {
      stopTuner();
      setTunerReading(undefined);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setTunerStatus("blocked");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setTunerStatus("listening");
      readTuner();
    } catch (error) {
      logError("TransportBar.startTuner", error);
      setTunerStatus("blocked");
    }
  }

  function readTuner() {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !audioContext) return;

    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    const pitch = detectPitchFromBuffer(samples, audioContext.sampleRate);
    setTunerReading(pitch ? pitchToTunerReading(pitch) : undefined);
    tunerFrameRef.current = requestAnimationFrame(readTuner);
  }

  return (
    <header className="flex min-h-16 min-w-0 flex-wrap items-center gap-2 border-b border-graphite-700 bg-graphite-950 px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] lg:px-3">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className="flex h-10 items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <IconButton label="처음으로 이동" tooltip="처음으로 이동" onClick={() => seekToBeat(0)}>
            <Rewind size={15} />
          </IconButton>
          <IconButton label={isPlaying ? "일시정지" : "재생"} tooltip={isPlaying ? "일시정지" : "재생"} active={isPlaying} tone="play" onClick={onPlayToggle}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </IconButton>
          <IconButton label="정지" tooltip="정지" onClick={onStop}>
            <Square size={15} />
          </IconButton>
          <IconButton label={recordingStatus === "requesting" ? "마이크 권한 확인 중" : "녹음"} tooltip={recordingStatus === "requesting" ? "마이크 권한 확인 중" : "녹음"} active={isRecording || recordingStatus !== "idle" && recordingStatus !== "error"} tone="record" onClick={onRecord}>
            <Circle size={15} fill={isRecording ? "currentColor" : "none"} />
          </IconButton>
          <IconButton label="반복 구간" tooltip="반복 구간" active={Boolean(project.cycleEnabled)} tone="cycle" onClick={() => toggleCycle()}>
            <Repeat2 size={15} />
          </IconButton>
          <IconButton label="실행 취소" tooltip="실행 취소" onClick={undo} disabled={!canUndo}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="다시 실행" tooltip="다시 실행" onClick={redo} disabled={!canRedo}>
            <Redo2 size={15} />
          </IconButton>
        </div>

        <CurrentBeatLcd
          mode={lcdMode}
          bpm={project.bpm}
          timeSignature={project.timeSignature}
          value={lcdValue}
          detail={lcdDetail}
          label="재생 위치 표시"
          className="h-10 min-w-[148px]"
          onClick={cycleLcdMode}
        />

        <div className="flex h-10 items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-600">템포</span>
            <input
              className="h-7 w-16 rounded border border-line bg-surface-panel px-2 text-center text-sm font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
              type="number"
              min={40}
              max={220}
              value={project.bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
              aria-label="템포"
            />
          </label>
          <button className="studio-button h-7 px-2 text-[11px]" onClick={() => tapTempo()} title="누른 간격으로 템포 맞추기">
            탭
          </button>
          <select
            className="h-7 rounded border border-line bg-surface-panel px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            value={`${project.timeSignature[0]}/${project.timeSignature[1]}`}
            onChange={(event) => setTimeSignature(event.target.value.split("/").map(Number) as [number, number])}
            aria-label="박자표"
          >
            {TIME_SIGNATURE_OPTIONS.map(([top, bottom]) => (
              <option key={`${top}/${bottom}`} value={`${top}/${bottom}`}>
                {top}/{bottom}
              </option>
            ))}
          </select>
          <select
            className="h-7 rounded border border-line bg-surface-panel px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            value={project.key ?? "C"}
            onChange={(event) => setProjectKey(event.target.value)}
            aria-label="프로젝트 조성"
          >
            {projectKeyOptions().map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        <div className="flex h-10 items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <button
            className={`studio-button h-7 px-2 text-[11px] ${project.metronomeOn ? "border-accent-cycle bg-accent-cycle/15 text-ink-high" : ""}`}
            onClick={() => toggleMetronome()}
            title="메트로놈"
          >
            메트로놈
          </button>
          <select
            className="h-7 rounded border border-line bg-surface-panel px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            value={project.countInBars ?? 0}
            onChange={(event) => setCountInBars(Number(event.target.value))}
            aria-label="카운트인"
          >
            <option value={0}>카운트인 없음</option>
            <option value={1}>1마디</option>
            <option value={2}>2마디</option>
          </select>
          <button
            className={`studio-button h-7 px-2 text-[11px] ${tunerStatus === "listening" ? "border-accent-sel bg-accent-sel/15 text-ink-high" : ""}`}
            onClick={startTuner}
            title="튜너"
          >
            <Mic size={13} />
          </button>
        </div>

        <div className="flex h-10 min-w-[138px] items-center gap-2 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <Volume1 size={14} className="text-graphite-500" />
          <input
            className="w-20"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={project.masterVolume ?? 0.85}
            onChange={(event) => setMasterVolume(Number(event.target.value))}
            aria-label="마스터 음량"
          />
          <CurrentMasterMeter />
        </div>

        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
          <input
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-sm font-bold text-ink-high outline-none transition focus-visible:border-ink-accent focus-visible:ring-2 focus-visible:ring-ink-accent sm:w-[clamp(120px,13vw,220px)]"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            aria-label="프로젝트 이름"
          />
          <div className="text-[11px] text-ink-muted">
            v{project.version} | 트랙 {project.tracks.length}개 | {project.key ?? "C"}
          </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
        <SegmentedToggle value={educationView} options={educationOptions} onChange={onEducationViewChange} ariaLabel="학생·교사 화면" className="grid-cols-2" />
        <SegmentedToggle value={mode} options={modeOptions} onChange={setMode} ariaLabel="작업 화면" className="grid-cols-3" />
        <SegmentedToggle
          value={appTheme}
          options={themeOptions}
          onChange={onAppThemeChange}
          ariaLabel="화면 테마"
          className="grid-cols-4"
          labelClassName="hidden 2xl:inline"
        />
        <button className="studio-button" onClick={onShortcutHelp} title="단축키 확인">
          <Keyboard size={15} />
          <span className="hidden 2xl:inline">단축키 확인</span>
        </button>
        <a
          className="studio-button"
          href="./manual/quickstart/garageband-quickstart-user-manual.html"
          target="_blank"
          rel="noreferrer"
          title="퀵스타트 설명서"
        >
          <PlayCircle size={15} />
          <span className="hidden 2xl:inline">퀵스타트</span>
        </a>
        <a
          className="studio-button"
          href="./manual/user/garageband-user-manual.html"
          target="_blank"
          rel="noreferrer"
          title="사용 설명서"
        >
          <BookOpen size={15} />
          <span className="hidden 2xl:inline">사용 설명서</span>
        </a>
        <button className="studio-button" onClick={() => createProject("새 프로젝트")} title="새 프로젝트">
          <FolderPlus size={15} />
          <span className="hidden sm:inline">새 프로젝트</span>
        </button>
        <button className="studio-button" onClick={duplicateProject} title="프로젝트 복제">
          <Copy size={15} />
          <span className="hidden sm:inline">복제</span>
        </button>
        <button className="studio-button" onClick={onSave} title={saveStatus === "error" ? "저장 다시 시도" : "프로젝트 저장"}>
          <Save size={15} />
          <span className={saveStatus === "error" ? "inline" : "hidden sm:inline"}>
            {saveStatus === "error" ? "저장 실패 · 다시 시도" : saveStatus === "working" ? "저장 중" : saveStatus === "done" ? "저장됨" : "저장"}
          </span>
        </button>
        <button className="studio-button" onClick={onExport} disabled={exportDisabled} title={exportDisabled ? "녹음 저장을 마친 뒤 내보내기" : "공유 및 내보내기"}>
          <Download size={15} />
          <span className="hidden sm:inline">{exportStatus === "error" ? "내보내기 실패" : statusLabel(exportStatus, "공유")}</span>
        </button>
      </div>
    </header>
  );
}
