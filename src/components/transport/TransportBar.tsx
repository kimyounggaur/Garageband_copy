import {
  Circle,
  ClipboardCheck,
  Copy,
  Download,
  FolderPlus,
  GraduationCap,
  Mic,
  Pause,
  Play,
  Redo2,
  Repeat2,
  Rewind,
  Save,
  School,
  SlidersHorizontal,
  Square,
  Undo2,
  Volume1
} from "../icons";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { StudioMode } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { statusLabel } from "../../utils/labels";
import { detectPitchFromBuffer, pitchToTunerReading, projectKeyOptions } from "../../utils/transport";
import { IconButton, LcdDisplay, Meter, SegmentedToggle } from "../ui";

type Status = "idle" | "working" | "done" | "error";

type TransportBarProps = {
  onSave: () => void;
  saveStatus: Status;
  onExport: () => void;
  exportStatus: Status;
  educationView: "student" | "teacher";
  onEducationViewChange: (view: "student" | "teacher") => void;
};

const TIME_SIGNATURE_OPTIONS: Array<[number, number]> = [
  [4, 4],
  [3, 4],
  [6, 8],
  [5, 4],
  [7, 8]
];

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
  const isRecording = useDawStore((state) => state.isRecording);
  const lcdMode = useDawStore((state) => state.lcdMode);
  const tunerReading = useDawStore((state) => state.tunerReading);
  const masterLevel = useDawStore((state) => state.masterLevel);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const setRecording = useDawStore((state) => state.setRecording);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
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
    { value: "studio", label: "Studio", icon: <SlidersHorizontal size={14} /> },
    { value: "lesson", label: "Lesson", icon: <GraduationCap size={14} /> },
    { value: "review", label: "Review", icon: <ClipboardCheck size={14} /> }
  ];
  const educationOptions: Array<{ value: "student" | "teacher"; label: string; icon: ReactNode }> = [
    { value: "student", label: "Student", icon: <GraduationCap size={14} /> },
    { value: "teacher", label: "Teacher", icon: <School size={14} /> }
  ];
  const lcdValue =
    lcdMode === "tuner" && tunerReading
      ? `${tunerReading.note} ${tunerReading.cents > 0 ? "+" : ""}${tunerReading.cents}`
      : lcdMode === "tuner"
        ? "Mic needed"
        : undefined;
  const lcdDetail =
    lcdMode === "tuner" && tunerReading
      ? `${tunerReading.frequency.toFixed(1)} Hz`
      : lcdMode === "tuner"
        ? tunerStatus === "blocked"
          ? "permission needed"
          : "tuner"
        : undefined;

  useEffect(() => () => stopTuner(false), []);

  function stopTuner(resetStatus = true) {
    cancelAnimationFrame(tunerFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
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
    } catch {
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

  function stopTransport() {
    setPlaying(false);
    setRecording(false);
    setCurrentBeat(0);
  }

  function togglePlay() {
    if (isPlaying) {
      setPlaying(false);
      setRecording(false);
      return;
    }
    setPlaying(true);
  }

  function toggleRecord() {
    if (isRecording) {
      stopTransport();
      return;
    }
    setRecording(true);
    setPlaying(true);
  }

  return (
    <header className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-2 border-b border-graphite-700 bg-graphite-950 px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] lg:h-16 lg:flex-nowrap lg:px-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap">
        <div className="flex h-10 items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <IconButton label="Go to beginning" tooltip="Go to beginning" onClick={() => setCurrentBeat(0)}>
            <Rewind size={15} />
          </IconButton>
          <IconButton label={isPlaying ? "Pause" : "Play"} tooltip={isPlaying ? "Pause" : "Play"} active={isPlaying} tone="play" onClick={togglePlay}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </IconButton>
          <IconButton label="Stop" tooltip="Stop" onClick={stopTransport}>
            <Square size={15} />
          </IconButton>
          <IconButton label="Record" tooltip="Record" active={isRecording} tone="record" onClick={toggleRecord}>
            <Circle size={15} fill={isRecording ? "currentColor" : "none"} />
          </IconButton>
          <IconButton label="Cycle" tooltip="Cycle region" active={Boolean(project.cycleEnabled)} tone="cycle" onClick={() => toggleCycle()}>
            <Repeat2 size={15} />
          </IconButton>
          <IconButton label="Undo" tooltip="Undo" onClick={undo} disabled={!canUndo}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="Redo" tooltip="Redo" onClick={redo} disabled={!canRedo}>
            <Redo2 size={15} />
          </IconButton>
        </div>

        <LcdDisplay
          mode={lcdMode}
          currentBeat={currentBeat}
          bpm={project.bpm}
          timeSignature={project.timeSignature}
          value={lcdValue}
          detail={lcdDetail}
          label="Playback LCD"
          className="h-10 min-w-[148px]"
          onClick={cycleLcdMode}
        />

        <div className="flex h-10 items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-975/80 px-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-600">Tempo</span>
            <input
              className="h-7 w-16 rounded border border-graphite-700 bg-graphite-900 px-2 text-center text-sm font-bold text-slate-100 outline-none focus:border-accent-sel"
              type="number"
              min={40}
              max={220}
              value={project.bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
              aria-label="Tempo"
            />
          </label>
          <button className="studio-button h-7 px-2 text-[11px]" onClick={() => tapTempo()} title="Tap tempo">
            Tap
          </button>
          <select
            className="h-7 rounded border border-graphite-700 bg-graphite-900 px-2 text-xs font-bold text-slate-100 outline-none focus:border-accent-sel"
            value={`${project.timeSignature[0]}/${project.timeSignature[1]}`}
            onChange={(event) => setTimeSignature(event.target.value.split("/").map(Number) as [number, number])}
            aria-label="Time signature"
          >
            {TIME_SIGNATURE_OPTIONS.map(([top, bottom]) => (
              <option key={`${top}/${bottom}`} value={`${top}/${bottom}`}>
                {top}/{bottom}
              </option>
            ))}
          </select>
          <select
            className="h-7 rounded border border-graphite-700 bg-graphite-900 px-2 text-xs font-bold text-slate-100 outline-none focus:border-accent-sel"
            value={project.key ?? "C"}
            onChange={(event) => setProjectKey(event.target.value)}
            aria-label="Project key"
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
            className={`studio-button h-7 px-2 text-[11px] ${project.metronomeOn ? "border-accent-cycle bg-accent-cycle/15 text-white" : ""}`}
            onClick={() => toggleMetronome()}
            title="Metronome"
          >
            Metro
          </button>
          <select
            className="h-7 rounded border border-graphite-700 bg-graphite-900 px-2 text-xs font-bold text-slate-100 outline-none focus:border-accent-sel"
            value={project.countInBars ?? 0}
            onChange={(event) => setCountInBars(Number(event.target.value))}
            aria-label="Count in"
          >
            <option value={0}>No count</option>
            <option value={1}>1 bar</option>
            <option value={2}>2 bars</option>
          </select>
          <button
            className={`studio-button h-7 px-2 text-[11px] ${tunerStatus === "listening" ? "border-accent-sel bg-accent-sel/15 text-white" : ""}`}
            onClick={startTuner}
            title="Tuner"
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
            aria-label="Master volume"
          />
          <Meter label="Master peak meter" value={masterLevel} className="w-12" />
        </div>

        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
          <input
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none transition focus:border-graphite-700 focus:bg-black/20 sm:w-[clamp(120px,13vw,220px)]"
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            aria-label="Project name"
          />
          <div className="text-[11px] text-graphite-600">
            v{project.version} | {project.tracks.length} tracks | {project.key ?? "C"}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
        <SegmentedToggle value={educationView} options={educationOptions} onChange={onEducationViewChange} ariaLabel="Education view" className="grid-cols-2" />
        <SegmentedToggle value={mode} options={modeOptions} onChange={setMode} ariaLabel="Workspace mode" className="grid-cols-3" />
        <button className="studio-button" onClick={() => createProject("New Project")} title="New project">
          <FolderPlus size={15} />
          <span className="hidden sm:inline">New</span>
        </button>
        <button className="studio-button" onClick={duplicateProject} title="Duplicate project">
          <Copy size={15} />
          <span className="hidden sm:inline">Duplicate</span>
        </button>
        <button className="studio-button" onClick={onSave} title="Save project">
          <Save size={15} />
          <span className="hidden sm:inline">{statusLabel(saveStatus, "Save")}</span>
        </button>
        <button className="studio-button" onClick={onExport} title="Export WAV">
          <Download size={15} />
          <span className="hidden sm:inline">{statusLabel(exportStatus, "Export")}</span>
        </button>
      </div>
    </header>
  );
}
