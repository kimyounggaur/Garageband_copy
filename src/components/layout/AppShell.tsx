import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { loadLastProject, projectRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import { ArrangementTimeline } from "../timeline/ArrangementTimeline";
import { TransportBar } from "../transport/TransportBar";

type Status = "idle" | "working" | "done" | "error";
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
  const audioEngineRef = useRef<AudioEngineInstance | null>(null);
  const firstLoadRef = useRef(false);

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
  }, []);

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
    setExportStatus("working");
    try {
      const currentProject = useDawStore.getState().project;
      const { downloadBlob, exportProjectToWav } = await import("../../audio/exportProject");
      const blob = await exportProjectToWav(currentProject);
      downloadBlob(blob, `${fileSafeName(currentProject.name)}.wav`);
      setExportStatus("done");
    } catch {
      setExportStatus("error");
    }
  }

  function renderEducationPanel() {
    if (educationView === "teacher") return <TeacherPanel />;
    if (mode === "review") return <ReviewPanel />;
    if (mode === "lesson") return <LessonPanel />;
    return <StudentPanel />;
  }

  return (
    <div className="grid h-dvh w-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(220px,34dvh)] overflow-hidden bg-graphite-975 text-slate-100 lg:grid-rows-[56px_minmax(0,1fr)_260px]">
      <TransportBar
        onSave={handleSave}
        saveStatus={saveStatus}
        onExport={handleExport}
        exportStatus={exportStatus}
        educationView={educationView}
        onEducationViewChange={setEducationView}
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
    </div>
  );
}
