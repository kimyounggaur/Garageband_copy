import { lazy, Suspense, type ChangeEvent, useEffect, useRef, useState } from "react";
import { loadLastProject, projectRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import { Download, FileArchive, FileInput, Upload } from "../icons";
import { ShortcutHelpDialog } from "../shortcuts/ShortcutHelpDialog";
import { ArrangementTimeline } from "../timeline/ArrangementTimeline";
import { TransportBar } from "../transport/TransportBar";
import { resolveShortcutKey, type ShortcutId } from "../../utils/shortcutOverlay";
import { readStoredTheme, writeStoredTheme, type AppTheme } from "../../utils/theme";

type Status = "idle" | "working" | "done" | "error";
type ShareFormat = "wav" | "mp3";
type ShareQuality = "standard" | "high";
type ShareRange = "full" | "cycle";
type AudioEngineInstance = import("../../audio/AudioEngine").AudioEngine;

const ClipEditor = lazy(() => import("../editor/ClipEditor").then((module) => ({ default: module.ClipEditor })));
const LessonPanel = lazy(() => import("../education/LessonPanel").then((module) => ({ default: module.LessonPanel })));
const ReviewPanel = lazy(() => import("../education/ReviewPanel").then((module) => ({ default: module.ReviewPanel })));
const StudentPanel = lazy(() => import("../education/StudentPanel").then((module) => ({ default: module.StudentPanel })));
const StudioPanel = lazy(() => import("../studio/StudioPanel").then((module) => ({ default: module.StudioPanel })));
const TeacherPanel = lazy(() => import("../education/TeacherPanel").then((module) => ({ default: module.TeacherPanel })));

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "웹밴드-세션";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function PanelFallback() {
  return (
    <div className="panel flex h-full min-h-[140px] items-center justify-center rounded-lg text-xs font-bold text-graphite-600">
      불러오는 중...
    </div>
  );
}

export function AppShell() {
  const project = useDawStore((state) => state.project);
  const mode = useDawStore((state) => state.mode);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const liveLoopPlayback = useDawStore((state) => state.liveLoopPlayback);
  const hydrated = useDawStore((state) => state.hydrated);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const markLiveLoopTriggered = useDawStore((state) => state.markLiveLoopTriggered);
  const loadProjectIntoStore = useDawStore((state) => state.loadProject);
  const setHydrated = useDawStore((state) => state.setHydrated);
  const refreshLessonProgress = useDawStore((state) => state.refreshLessonProgress);
  const [saveStatus, setSaveStatus] = useState<Status>("idle");
  const [exportStatus, setExportStatus] = useState<Status>("idle");
  const [educationView, setEducationView] = useState<"student" | "teacher">("student");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFormat, setShareFormat] = useState<ShareFormat>("wav");
  const [shareQuality, setShareQuality] = useState<ShareQuality>("standard");
  const [shareRange, setShareRange] = useState<ShareRange>("full");
  const [shareMessage, setShareMessage] = useState("");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [activeShortcutId, setActiveShortcutId] = useState<ShortcutId | undefined>();
  const [appTheme, setAppTheme] = useState<AppTheme>(() => readStoredTheme());
  const audioEngineRef = useRef<AudioEngineInstance | null>(null);
  const firstLoadRef = useRef(false);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutHighlightTimerRef = useRef<number | undefined>(undefined);

  async function getLazyAudioEngine() {
    if (audioEngineRef.current) return audioEngineRef.current;
    const module = await import("../../audio/AudioEngine");
    audioEngineRef.current = module.getAudioEngine();
    return audioEngineRef.current;
  }

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    loadLastProject()
      .then((lastProject) => {
        if (lastProject) loadProjectIntoStore(lastProject);
      })
      .finally(() => setHydrated(true));
  }, [loadProjectIntoStore, setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    refreshLessonProgress();
  }, [hydrated, project, refreshLessonProgress]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      projectRepository.saveProject(project)
        .then(() => setSaveStatus("done"))
        .catch(() => setSaveStatus("error"));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [hydrated, project]);

  useEffect(() => {
    let cancelled = false;
    if (isPlaying) {
      void getLazyAudioEngine()
        .then((engine) => {
          if (cancelled) {
            engine.stop();
            return;
          }
          return engine.play(
            useDawStore.getState().project,
            (beat) => useDawStore.getState().setCurrentBeat(beat),
            () => {
              useDawStore.getState().setPlaying(false);
              useDawStore.getState().setRecording(false);
              useDawStore.getState().setMasterLevel(0);
            },
            {
              countIn: useDawStore.getState().isRecording,
              onMeter: (level) => useDawStore.getState().setMasterLevel(level)
            }
          );
        })
        .catch(() => {
          useDawStore.getState().setPlaying(false);
          useDawStore.getState().setRecording(false);
          useDawStore.getState().setMasterLevel(0);
        });
    } else {
      audioEngineRef.current?.stop();
      useDawStore.getState().setMasterLevel(0);
      setCurrentBeat(0);
    }
    return () => {
      cancelled = true;
    };
  }, [isPlaying, setCurrentBeat]);

  useEffect(() => {
    audioEngineRef.current?.updateTrackControls(project);
  }, [project]);

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
    writeStoredTheme(appTheme);
  }, [appTheme]);

  useEffect(
    () => () => {
      if (shortcutHighlightTimerRef.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const queuedCellIds = liveLoopPlayback.queuedCellIds;
    if (queuedCellIds.length === 0) {
      if (liveLoopPlayback.activeCellIds.length === 0) audioEngineRef.current?.stopLiveLoops();
      return;
    }
    if (!isPlaying) {
      setPlaying(true);
      return;
    }

    const cellIds = [...queuedCellIds];
    const triggerBeat = liveLoopPlayback.triggerBeat;
    const timeoutId = window.setTimeout(() => {
      void getLazyAudioEngine()
        .then((engine) => engine.triggerLiveLoopCells(useDawStore.getState().project, cellIds, triggerBeat))
        .then(() => markLiveLoopTriggered(cellIds));
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [isPlaying, liveLoopPlayback, markLiveLoopTriggered, setPlaying]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shortcutHelpOpen) {
        event.preventDefault();
        event.stopPropagation();
        const shortcut = resolveShortcutKey(event);
        if (!shortcut) {
          closeShortcutHelp();
          return;
        }
        flashShortcut(shortcut.id);
        return;
      }

      if (isEditableTarget(event.target) || event.altKey) return;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === "z" && event.shiftKey) {
          event.preventDefault();
          useDawStore.getState().redo();
          return;
        }
        if (key === "z") {
          event.preventDefault();
          useDawStore.getState().undo();
          return;
        }
        if (key === "y") {
          event.preventDefault();
          useDawStore.getState().redo();
        }
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        const state = useDawStore.getState();
        state.setPlaying(!state.isPlaying);
        if (state.isPlaying) state.setRecording(false);
        return;
      }

      if (key === "r") {
        event.preventDefault();
        const state = useDawStore.getState();
        if (state.isRecording) {
          state.setPlaying(false);
          state.setRecording(false);
          return;
        }
        state.setRecording(true);
        state.setPlaying(true);
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        useDawStore.getState().setCurrentBeat(0);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutHelpOpen]);

  function flashShortcut(shortcutId: ShortcutId) {
    if (shortcutHighlightTimerRef.current !== undefined) {
      window.clearTimeout(shortcutHighlightTimerRef.current);
    }
    setActiveShortcutId(shortcutId);
    shortcutHighlightTimerRef.current = window.setTimeout(() => {
      setActiveShortcutId(undefined);
      shortcutHighlightTimerRef.current = undefined;
    }, 900);
  }

  function openShortcutHelp() {
    if (shortcutHighlightTimerRef.current !== undefined) {
      window.clearTimeout(shortcutHighlightTimerRef.current);
      shortcutHighlightTimerRef.current = undefined;
    }
    setActiveShortcutId(undefined);
    setShortcutHelpOpen(true);
  }

  function closeShortcutHelp() {
    if (shortcutHighlightTimerRef.current !== undefined) {
      window.clearTimeout(shortcutHighlightTimerRef.current);
      shortcutHighlightTimerRef.current = undefined;
    }
    setActiveShortcutId(undefined);
    setShortcutHelpOpen(false);
  }

  async function handleSave() {
    setSaveStatus("working");
    try {
      await projectRepository.saveProject(useDawStore.getState().project);
      setSaveStatus("done");
    } catch {
      setSaveStatus("error");
    }
  }

  async function handleExport() {
    setShareMessage("");
    setShareOpen(true);
  }

  function shareOptions() {
    return {
      format: shareFormat,
      quality: shareQuality,
      range: shareRange
    };
  }

  async function handleExportMix() {
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { downloadBlob, exportProjectAudio } = await import("../../audio/exportProject");
      const result = await exportProjectAudio(currentProject, shareOptions());
      downloadBlob(result.blob, result.fileName);
      setShareMessage(result.fallbackReason ?? "Mix exported.");
      setExportStatus("done");
    } catch {
      setShareMessage("Export failed.");
      setExportStatus("error");
    }
  }

  async function handleExportStems() {
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { downloadBlob, exportProjectStemsZip, resolveExportFileName } = await import("../../audio/exportProject");
      const blob = await exportProjectStemsZip(currentProject, shareOptions());
      downloadBlob(blob, resolveExportFileName(currentProject.name, "stems.zip"));
      setShareMessage("Stems exported.");
      setExportStatus("done");
    } catch {
      setShareMessage("Stem export failed.");
      setExportStatus("error");
    }
  }

  async function handleExportProjectFile() {
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { createProjectFileBlob, downloadBlob, resolveExportFileName } = await import("../../audio/exportProject");
      await projectRepository.saveProject(currentProject);
      downloadBlob(createProjectFileBlob(currentProject), resolveExportFileName(currentProject.name, "webband.json"));
      setShareMessage("Project file exported.");
      setExportStatus("done");
    } catch {
      setShareMessage("Project export failed.");
      setExportStatus("error");
    }
  }

  async function handleProjectFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExportStatus("working");
    setShareMessage("");
    try {
      await projectRepository.saveProject(useDawStore.getState().project);
      const { parseProjectFile } = await import("../../audio/exportProject");
      const importedProject = await parseProjectFile(file);
      loadProjectIntoStore(importedProject);
      await projectRepository.saveProject(importedProject);
      setShareMessage("Project imported.");
      setExportStatus("done");
    } catch {
      setShareMessage("Project import failed.");
      setExportStatus("error");
    }
  }

  function renderEducationPanel() {
    if (educationView === "teacher") return <TeacherPanel />;
    if (mode === "review") return <ReviewPanel />;
    if (mode === "lesson") return <LessonPanel />;
    return <StudentPanel />;
  }

  const exportWorking = exportStatus === "working";
  const cycleAvailable = Boolean(project.cycleEnabled && (project.cycleEnd ?? 0) > (project.cycleStart ?? 0));
  const optionClass = (active: boolean) =>
    `h-8 rounded-md border px-3 text-xs font-bold transition ${
      active ? "border-accent-sel bg-accent-sel/20 text-white" : "border-graphite-700 bg-graphite-900 text-graphite-300 hover:border-graphite-500"
    }`;

  return (
    <div
      data-theme={appTheme}
      className="grid h-dvh w-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(220px,34dvh)] overflow-hidden bg-graphite-975 text-slate-100 lg:grid-rows-[56px_minmax(0,1fr)_260px]"
    >
      <TransportBar
        onSave={handleSave}
        saveStatus={saveStatus}
        onExport={handleExport}
        exportStatus={exportStatus}
        educationView={educationView}
        onEducationViewChange={setEducationView}
        onShortcutHelp={openShortcutHelp}
        appTheme={appTheme}
        onAppThemeChange={setAppTheme}
      />

      <main className="grid min-h-0 w-full min-w-0 grid-cols-1 grid-rows-[minmax(360px,1fr)_minmax(320px,40dvh)] gap-2 overflow-auto bg-gradient-to-b from-graphite-950 to-graphite-975 p-2 lg:grid-cols-[minmax(0,1fr)_clamp(280px,22vw,420px)] lg:grid-rows-none lg:overflow-hidden">
        <ArrangementTimeline />
        <Suspense fallback={<PanelFallback />}>
          <StudioPanel mode={mode} lessonContent={renderEducationPanel()} />
        </Suspense>
      </main>

      <Suspense fallback={<PanelFallback />}>
        <ClipEditor />
      </Suspense>

      <input
        ref={projectFileInputRef}
        type="file"
        className="hidden"
        accept=".webband.json,application/json"
        onChange={(event) => void handleProjectFileChange(event)}
      />

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Share"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShareOpen(false);
          }}
        >
          <div className="w-[min(560px,calc(100vw-24px))] rounded-lg border border-graphite-700 bg-graphite-950 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Share</h2>
                <div className="text-xs text-graphite-500">{project.name}</div>
              </div>
              <button className="studio-button h-8 px-3 text-xs" onClick={() => setShareOpen(false)}>
                Close
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">Format</div>
                <div className="grid grid-cols-2 gap-1">
                  <button className={optionClass(shareFormat === "wav")} onClick={() => setShareFormat("wav")}>
                    WAV
                  </button>
                  <button className={optionClass(shareFormat === "mp3")} onClick={() => setShareFormat("mp3")}>
                    MP3
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">Quality</div>
                <div className="grid grid-cols-2 gap-1">
                  <button className={optionClass(shareQuality === "standard")} onClick={() => setShareQuality("standard")}>
                    Standard
                  </button>
                  <button className={optionClass(shareQuality === "high")} onClick={() => setShareQuality("high")}>
                    High
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">Range</div>
                <div className="grid grid-cols-2 gap-1">
                  <button className={optionClass(shareRange === "full")} onClick={() => setShareRange("full")}>
                    Full
                  </button>
                  <button
                    className={optionClass(shareRange === "cycle")}
                    onClick={() => setShareRange("cycle")}
                    disabled={!cycleAvailable}
                  >
                    Cycle
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportMix()} disabled={exportWorking}>
                <Download size={15} />
                <span>Mix</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportStems()} disabled={exportWorking}>
                <FileArchive size={15} />
                <span>Stems ZIP</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportProjectFile()} disabled={exportWorking}>
                <FileInput size={15} />
                <span>Project</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => projectFileInputRef.current?.click()} disabled={exportWorking}>
                <Upload size={15} />
                <span>Import</span>
              </button>
            </div>

            <div className="mt-3 min-h-5 text-xs font-semibold text-graphite-400">{exportWorking ? "Working..." : shareMessage}</div>
          </div>
        </div>
      ) : null}

      {shortcutHelpOpen ? <ShortcutHelpDialog activeShortcutId={activeShortcutId} onClose={closeShortcutHelp} /> : null}
    </div>
  );
}
