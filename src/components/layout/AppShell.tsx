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
const SoundLibrary = lazy(() => import("../library/SoundLibrary").then((module) => ({ default: module.SoundLibrary })));
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
  const hydrated = useDawStore((state) => state.hydrated);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
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
            () => useDawStore.getState().setPlaying(false)
          );
        })
        .catch(() => useDawStore.getState().setPlaying(false));
    } else {
      audioEngineRef.current?.stop();
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
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
      const key = event.key.toLowerCase();
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

  function renderSidePanel() {
    if (educationView === "teacher") return <TeacherPanel />;
    if (mode === "review") return <ReviewPanel />;
    if (mode === "lesson") return <LessonPanel />;
    return <StudioPanel />;
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

      <main className="grid min-h-0 w-full min-w-0 grid-cols-1 grid-rows-[minmax(220px,30dvh)_minmax(360px,1fr)_minmax(300px,38dvh)] gap-2 overflow-auto bg-gradient-to-b from-graphite-950 to-graphite-975 p-2 lg:grid-cols-[clamp(220px,14vw,320px)_minmax(0,1fr)_clamp(260px,17vw,380px)] lg:grid-rows-none lg:overflow-hidden">
        <Suspense fallback={<PanelFallback />}>
          <SoundLibrary />
        </Suspense>
        <ArrangementTimeline />
        <Suspense fallback={<PanelFallback />}>{renderSidePanel()}</Suspense>
      </main>

      <Suspense fallback={<PanelFallback />}>
        <ClipEditor />
      </Suspense>
    </div>
  );
}
