import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioEngine } from "../../audio/AudioEngine";
import { downloadBlob, exportProjectToWav } from "../../audio/exportProject";
import { loadLastProject, saveProject } from "../../db/projectsDb";
import { useDawStore } from "../../store/useDawStore";
import { ArrangementTimeline } from "../timeline/ArrangementTimeline";
import { ClipEditor } from "../editor/ClipEditor";
import { MixerPanel } from "../mixer/MixerPanel";
import { SoundLibrary } from "../library/SoundLibrary";
import { TransportBar } from "../transport/TransportBar";

type Status = "idle" | "working" | "done" | "error";

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "webband-session";
}

export function AppShell() {
  const project = useDawStore((state) => state.project);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const hydrated = useDawStore((state) => state.hydrated);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const loadProjectIntoStore = useDawStore((state) => state.loadProject);
  const setHydrated = useDawStore((state) => state.setHydrated);
  const [saveStatus, setSaveStatus] = useState<Status>("idle");
  const [exportStatus, setExportStatus] = useState<Status>("idle");
  const engine = useMemo(() => getAudioEngine(), []);
  const firstLoadRef = useRef(false);

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
    const timer = window.setTimeout(() => {
      saveProject(project)
        .then(() => setSaveStatus("done"))
        .catch(() => setSaveStatus("error"));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [hydrated, project]);

  useEffect(() => {
    if (isPlaying) {
      engine.play(
        useDawStore.getState().project,
        (beat) => useDawStore.getState().setCurrentBeat(beat),
        () => useDawStore.getState().setPlaying(false)
      );
    } else {
      engine.stop();
      setCurrentBeat(0);
    }
  }, [engine, isPlaying, setCurrentBeat]);

  useEffect(() => {
    engine.updateTrackControls(project);
  }, [engine, project]);

  async function handleSave() {
    setSaveStatus("working");
    try {
      await saveProject(useDawStore.getState().project);
      setSaveStatus("done");
    } catch {
      setSaveStatus("error");
    }
  }

  async function handleExport() {
    setExportStatus("working");
    try {
      const currentProject = useDawStore.getState().project;
      const blob = await exportProjectToWav(currentProject);
      downloadBlob(blob, `${fileSafeName(currentProject.name)}.wav`);
      setExportStatus("done");
    } catch {
      setExportStatus("error");
    }
  }

  return (
    <div className="grid h-screen grid-rows-[56px_minmax(0,1fr)_260px] bg-studio-950 text-slate-100">
      <TransportBar
        onSave={handleSave}
        saveStatus={saveStatus}
        onExport={handleExport}
        exportStatus={exportStatus}
      />

      <main className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)_300px] gap-2 p-2">
        <SoundLibrary />
        <ArrangementTimeline />
        <MixerPanel />
      </main>

      <ClipEditor />
    </div>
  );
}
