import { lazy, Suspense, type ChangeEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audioAssetRepositoryForMode, getRepositoryMode, loadLastProject, markCurrentProject, projectRepositoryForMode, subscribeRepositoryMode } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import { RecordingSessionController, decodeRecordingDuration, type RecordingResult, type UnusableRecording } from "../../audio/RecordingSessionController";
import type { AudioAsset, Project } from "../../types/project";
import { makeId } from "../../utils/id";
import { snapBeat } from "../../utils/timeline";
import { createProjectSaveQueue } from "../../utils/projectSaveQueue";
import type { RecordingControls, RecordingDisplayStatus } from "../recording/RecorderPanel";
import { Download, FileArchive, FileInput, Upload } from "../icons";
import { ShortcutHelpDialog } from "../shortcuts/ShortcutHelpDialog";
import { AccessibleModal } from "../ui/AccessibleModal";
import { ArrangementTimeline } from "../timeline/ArrangementTimeline";
import { TransportBar } from "../transport/TransportBar";
import { ErrorBoundary } from "../system/ErrorBoundary";
import { PwaStatusPanel } from "../system/PwaStatusPanel";
import { logError } from "../../utils/logger";
import { resolveShortcutKey, type ShortcutHandlers, type ShortcutId } from "../../utils/shortcutOverlay";
import { readStoredTheme, writeStoredTheme, type AppTheme } from "../../utils/theme";
import { clearSampleNotice, getSampleNotice, subscribeSampleNotice } from "../../audio/sampleNotice";
import { hasAppBusy, hasUnsavedDrafts } from "../../utils/unsavedDrafts";

type Status = "idle" | "working" | "done" | "error";
type ShareQuality = "standard" | "high";
type ShareRange = "full" | "cycle";
type AudioEngineInstance = import("../../audio/AudioEngine").AudioEngine;
type RecoveryRecording = {
  blob: Blob;
  mimeType: string;
  name: string;
  projectId: string;
  trackId: string;
  startBeat: number;
  repositoryMode: ReturnType<typeof getRepositoryMode>;
};
type RepositoryMode = ReturnType<typeof getRepositoryMode>;
type ProjectSaveSnapshot = { project: Project; repositoryMode: RepositoryMode };
type ProjectSaveQueue = ReturnType<typeof createProjectSaveQueue<Project>>;

const ClipEditor = lazy(() => import("../editor/ClipEditor").then((module) => ({ default: module.ClipEditor })));
const LessonPanel = lazy(() => import("../education/LessonPanel").then((module) => ({ default: module.LessonPanel })));
const ReviewPanel = lazy(() => import("../education/ReviewPanel").then((module) => ({ default: module.ReviewPanel })));
const StudentPanel = lazy(() => import("../education/StudentPanel").then((module) => ({ default: module.StudentPanel })));
const StudioPanel = lazy(() => import("../studio/StudioPanel").then((module) => ({ default: module.StudioPanel })));
const TeacherPanel = lazy(() => import("../education/TeacherPanel").then((module) => ({ default: module.TeacherPanel })));

function fileSafeName(name: string) {
  return name.trim().replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^-+|-+$/g, "") || "웹밴드-세션";
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
  const transportState = useDawStore((state) => state.transportState);
  const seekRevision = useDawStore((state) => state.seekRevision);
  const liveLoopPlayback = useDawStore((state) => state.liveLoopPlayback);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const hydrated = useDawStore((state) => state.hydrated);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const setPlaying = useDawStore((state) => state.setPlaying);
  const stopTransport = useDawStore((state) => state.stopTransport);
  const markLiveLoopTriggered = useDawStore((state) => state.markLiveLoopTriggered);
  const loadProjectIntoStore = useDawStore((state) => state.loadProject);
  const setHydrated = useDawStore((state) => state.setHydrated);
  const refreshLessonProgress = useDawStore((state) => state.refreshLessonProgress);
  const [saveStatus, setSaveStatus] = useState<Status>("idle");
  const [backgroundSaveError, setBackgroundSaveError] = useState(false);
  const [exportStatus, setExportStatus] = useState<Status>("idle");
  const [educationView, setEducationView] = useState<"student" | "teacher">("student");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareQuality, setShareQuality] = useState<ShareQuality>("standard");
  const [shareRange, setShareRange] = useState<ShareRange>("full");
  const [shareMessage, setShareMessage] = useState("");
  const sampleNotice = useSyncExternalStore(subscribeSampleNotice, getSampleNotice, getSampleNotice);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [activeShortcutId, setActiveShortcutId] = useState<ShortcutId | undefined>();
  const [appTheme, setAppTheme] = useState<AppTheme>(() => readStoredTheme());
  const [repositoryMode, setRepositoryModeState] = useState<RepositoryMode>(() => getRepositoryMode());
  const [recordingMessage, setRecordingMessage] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "saving" | "error">("idle");
  const [recoveryRecording, setRecoveryRecording] = useState<RecoveryRecording | null>(null);
  const audioEngineRef = useRef<AudioEngineInstance | null>(null);
  const playReadyRef = useRef<Promise<void> | null>(null);
  const firstLoadRef = useRef(false);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutHighlightTimerRef = useRef<number | undefined>(undefined);
  const audioAssetIdsRef = useRef(new WeakMap<Blob, string>());
  const activeRecordingModeRef = useRef<ReturnType<typeof getRepositoryMode> | null>(null);
  const activeRecordingGuardRef = useRef<(() => boolean) | null>(null);
  const recordingControllerRef = useRef<RecordingSessionController | null>(null);
  const saveQueuesRef = useRef<Map<string, ProjectSaveQueue> | null>(null);
  const currentRepositoryModeRef = useRef<RepositoryMode>(repositoryMode);
  const lastQueuedProjectRef = useRef<ProjectSaveSnapshot | null>(null);
  const autoSaveTimerRef = useRef<number | undefined>(undefined);
  if (!recordingControllerRef.current) {
    recordingControllerRef.current = new RecordingSessionController({
      onCommit: (result) => commitRecordedAudio(result),
      onUnusableRecording: (result) => preserveUnusableAudio(result)
    });
  }
  const recordingController = recordingControllerRef.current;
  const recordingSnapshot = useSyncExternalStore(recordingController.subscribe, recordingController.getSnapshot);
  if (!saveQueuesRef.current) saveQueuesRef.current = new Map();
  const saveQueues = saveQueuesRef.current;

  function saveQueueFor(mode: RepositoryMode, projectId: string) {
    const key = `${mode}:${projectId}`;
    let queue = saveQueues.get(key);
    if (!queue) {
      queue = createProjectSaveQueue<Project>((snapshot) => projectRepositoryForMode(mode).saveProject(snapshot));
      saveQueues.set(key, queue);
    }
    return queue;
  }

  const saveQueue = saveQueueFor(repositoryMode, project.id);

  function queueProject(snapshot: Project) {
    const mode = getRepositoryMode();
    lastQueuedProjectRef.current = { project: snapshot, repositoryMode: mode };
    const queue = saveQueueFor(mode, snapshot.id);
    queue.update(snapshot);
    return queue;
  }

  async function getLazyAudioEngine() {
    if (audioEngineRef.current) return audioEngineRef.current;
    const module = await import("../../audio/AudioEngine");
    audioEngineRef.current = module.getAudioEngine();
    return audioEngineRef.current;
  }

  function audioTarget() {
    const state = useDawStore.getState();
    const armed = state.project.tracks.find((track) => track.type === "audio" && track.recordEnabled);
    const selected = state.project.tracks.find((track) => track.id === state.selectedTrackId);
    return armed ?? (selected?.type === "audio" ? selected : undefined);
  }

  function recordingAssetId(blob: Blob) {
    const existing = audioAssetIdsRef.current.get(blob);
    if (existing) return existing;
    const id = makeId("audio");
    audioAssetIdsRef.current.set(blob, id);
    return id;
  }

  async function persistAudio(
    blob: Blob,
    durationSeconds: number,
    context: Omit<RecoveryRecording, "blob">,
    canCommit?: () => boolean
  ) {
    const before = useDawStore.getState();
    const target = before.project.tracks.find((track) => track.id === context.trackId && track.type === "audio");
    if (before.project.id !== context.projectId || !target || getRepositoryMode() !== context.repositoryMode || canCommit?.() === false) {
      throw new Error("녹음 중 프로젝트 또는 오디오 트랙이 바뀌었습니다.");
    }
    const asset: AudioAsset = {
      id: recordingAssetId(blob),
      projectId: context.projectId,
      name: context.name,
      blob,
      mimeType: context.mimeType || blob.type || "application/octet-stream",
      durationSeconds,
      createdAt: Date.now()
    };
    await audioAssetRepositoryForMode(context.repositoryMode).saveAudioAsset(asset);
    window.dispatchEvent(new Event("webband:audio-assets-changed"));
    const state = useDawStore.getState();
    const liveTrack = state.project.tracks.find((track) => track.id === context.trackId && track.type === "audio");
    if (state.project.id !== context.projectId || !liveTrack || getRepositoryMode() !== context.repositoryMode || canCommit?.() === false) {
      throw new Error("저장하는 동안 프로젝트 또는 오디오 트랙이 바뀌었습니다. 원본 오디오는 보관했습니다.");
    }
    // A retry after the project write failed must reuse the clip/take already
    // attached in memory. The Blob-to-id mapping remains stable for this tab.
    const alreadyAttached = liveTrack.clips.some(
      (clip) => clip.audioAssetId === asset.id || clip.takeIds?.includes(asset.id)
    );
    const cycleStart = state.project.cycleStart ?? 0;
    const cycleLength = Math.max(0.25, (state.project.cycleEnd ?? cycleStart + 0.25) - cycleStart);
    const takeFolder = state.project.cycleEnabled
      ? liveTrack.clips.find((clip) => clip.type === "audio" && Math.abs(clip.startBeat - cycleStart) < 0.001 && Math.abs(clip.lengthBeats - cycleLength) < 0.001)
      : undefined;
    if (!alreadyAttached && takeFolder) {
      if (takeFolder.locked) throw new Error("잠긴 테이크 폴더에는 녹음을 넣을 수 없습니다. 잠금을 해제한 뒤 다시 시도해 주세요.");
      state.addAudioTake(takeFolder.id, asset.id, { activate: true });
      const savedTake = useDawStore.getState().project.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === takeFolder.id);
      if (!savedTake?.takeIds?.includes(asset.id) || savedTake.activeTakeId !== asset.id) {
        throw new Error("새 테이크를 클립에 연결하지 못했습니다. 원본 오디오를 보관한 뒤 다시 시도해 주세요.");
      }
    } else if (!alreadyAttached) {
      const clipId = state.addAudioClip(context.trackId, context.startBeat, context.name, undefined, durationSeconds, asset.id);
      if (state.project.cycleEnabled) state.resizeClip(clipId, cycleLength);
      const savedClip = useDawStore.getState().project.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === clipId);
      if (savedClip?.audioAssetId !== asset.id) {
        throw new Error("녹음 파일을 클립에 연결하지 못했습니다. 원본 오디오를 보관한 뒤 다시 시도해 주세요.");
      }
    }
    const completedProject = useDawStore.getState().project;
    const projectQueue = saveQueueFor(context.repositoryMode, context.projectId);
    const wasAlreadyQueued = lastQueuedProjectRef.current?.project === completedProject
      && lastQueuedProjectRef.current.repositoryMode === context.repositoryMode;
    lastQueuedProjectRef.current = { project: completedProject, repositoryMode: context.repositoryMode };
    const recordingRevision = wasAlreadyQueued
      ? projectQueue.getState().revision
      : projectQueue.update(completedProject);
    try {
      await projectQueue.flush();
    } catch (error) {
      // flush drains the entire queue. A later edit can fail after this recording
      // has already been saved; that failure must not remove a durable clip.
      if (projectQueue.getState().lastSavedRevision >= recordingRevision) {
        setRecoveryRecording(null);
        setImportStatus("idle");
        setRecordingMessage("녹음은 저장했습니다. 이후 편집 내용은 저장되지 않았으니 다시 저장해 주세요.");
        return;
      }
      const current = useDawStore.getState();
      if (current.project.id === context.projectId) {
        current.discardUnpersistedAudioAsset(asset.id);
        const restoredProject = useDawStore.getState().project;
        lastQueuedProjectRef.current = { project: restoredProject, repositoryMode: context.repositoryMode };
        projectQueue.update(restoredProject);
      }
      setRecordingMessage("프로젝트 저장에 실패해 클립을 화면에서 제거했습니다. 원본 오디오는 보관했으니 다시 시도하거나 내려받아 주세요.");
      throw error;
    }
    if (canCommit?.() === false) {
      throw new Error("저장하는 동안 작업 대상이 바뀌었습니다. 원본 오디오를 보관했습니다.");
    }
    setRecoveryRecording(null);
    setImportStatus("idle");
    setRecordingMessage(alreadyAttached ? "오디오 저장을 완료했습니다." : takeFolder ? "새 테이크를 기존 폴더에 저장했습니다." : "오디오 클립을 저장했습니다.");
  }

  async function commitRecordedAudio(result: RecordingResult) {
    const repositoryMode = activeRecordingModeRef.current;
    if (!repositoryMode) throw new Error("녹음 저장 위치를 확인할 수 없습니다.");
    const context = {
      mimeType: result.mimeType,
      name: result.name ?? "오디오 녹음",
      projectId: result.metadata.projectId,
      trackId: result.metadata.trackId,
      startBeat: result.metadata.requestedStartBeat,
      repositoryMode
    };
    try {
      await persistAudio(result.blob, result.durationSeconds, context, activeRecordingGuardRef.current ?? undefined);
    } catch (error) {
      setRecoveryRecording({ blob: result.blob, ...context });
      if (saveQueueFor(context.repositoryMode, context.projectId).getState().status === "error") {
        setRecordingMessage("프로젝트 저장에 실패해 클립을 화면에서 제거했습니다. 원본 오디오는 보관했으니 다시 시도하거나 내려받아 주세요.");
      }
      throw error;
    }
  }

  async function preserveUnusableAudio(result: UnusableRecording) {
    const repositoryMode = activeRecordingModeRef.current;
    if (!repositoryMode) return;
    const recovery: RecoveryRecording = {
      blob: result.blob,
      mimeType: result.mimeType,
      name: result.name ?? "복구할 녹음",
      projectId: result.metadata.projectId,
      trackId: result.metadata.trackId,
      startBeat: result.metadata.requestedStartBeat,
      repositoryMode
    };
    setRecoveryRecording(recovery);
    if (result.reason === "interrupted") {
      setRecordingMessage("화면이 바뀌어 녹음을 중단했습니다. 원본 파일을 내려받아 보관해 주세요.");
      return;
    }
    try {
      await audioAssetRepositoryForMode(recovery.repositoryMode).saveAudioAsset({
        id: recordingAssetId(result.blob),
        projectId: recovery.projectId,
        name: recovery.name,
        blob: recovery.blob,
        mimeType: recovery.mimeType,
        durationSeconds: 0,
        createdAt: Date.now()
      });
      window.dispatchEvent(new Event("webband:audio-assets-changed"));
    } catch (error) {
      logError("AppShell.preserveUnusableAudio", error);
      setRecordingMessage("원본 파일은 이 탭에 임시 보관 중입니다. 파일을 내려받아 보관해 주세요.");
    }
  }

  function stopActiveRecording() {
    const status = recordingController.getSnapshot().status;
    if (status === "requesting" || status === "ready" || status === "counting") {
      recordingController.cancel();
    } else if (status === "starting" || status === "recording" || status === "stopping") {
      void recordingController.stop();
    }
  }

  function handleStop() {
    stopActiveRecording();
    useDawStore.getState().stopTransport();
  }

  function handlePlayToggle() {
    const state = useDawStore.getState();
    const status = recordingController.getSnapshot().status;
    if (state.isRecording || ["requesting", "ready", "counting", "starting", "recording", "stopping"].includes(status)) {
      handleStop();
      return;
    }
    state.setPlaying(!state.isPlaying);
  }

  async function handleRecord() {
    const state = useDawStore.getState();
    const status = recordingController.getSnapshot().status;
    if (state.isRecording || ["requesting", "ready", "counting", "starting", "recording", "stopping"].includes(status)) {
      handleStop();
      return;
    }
    const target = audioTarget();
    if (!target) {
      state.setRecording(true);
      state.setPlaying(true);
      return;
    }
    const initialProjectId = state.project.id;
    const initialSelectedTrackId = state.selectedTrackId;
    const repositoryMode = getRepositoryMode();
    const startBeat = state.project.cycleEnabled
      ? state.project.cycleStart ?? 0
      : snapBeat(state.currentBeat, state.snapBeats);
    const countIn = (state.project.countInBars ?? 0) > 0;
    if (state.isPlaying) state.setPlaying(false);
    setRecordingMessage("");
    setImportStatus("idle");
    activeRecordingModeRef.current = repositoryMode;
    const isCurrent = () => {
      const latest = useDawStore.getState();
      return latest.project.id === initialProjectId
        && latest.selectedTrackId === initialSelectedTrackId
        && getRepositoryMode() === repositoryMode
        && latest.project.tracks.some((track) => track.id === target.id && track.type === "audio");
    };
    activeRecordingGuardRef.current = isCurrent;
    const ready = await recordingController.start({
      projectId: initialProjectId,
      trackId: target.id,
      startBeat,
      countIn,
      name: `녹음 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
      isCurrent
    });
    if (!ready) return;
    const latest = useDawStore.getState();
    latest.setRecording(true);
    latest.setPlaying(true);
  }

  async function handleImportAudio(file: File) {
    const state = useDawStore.getState();
    const target = audioTarget();
    if (!target) {
      setImportStatus("error");
      setRecordingMessage("오디오 트랙을 선택하거나 추가한 뒤 파일을 가져와 주세요.");
      return;
    }
    const context = {
      mimeType: file.type || "application/octet-stream",
      name: file.name.replace(/\.[^.]+$/, "") || "가져온 오디오",
      projectId: state.project.id,
      trackId: target.id,
      startBeat: state.project.cycleEnabled ? state.project.cycleStart ?? 0 : snapBeat(state.currentBeat, state.snapBeats),
      repositoryMode: getRepositoryMode()
    };
    setImportStatus("saving");
    setRecordingMessage("오디오 파일을 확인하고 있습니다.");
    try {
      const duration = await decodeRecordingDuration(file);
      await persistAudio(file, duration, context);
    } catch (error) {
      logError("AppShell.handleImportAudio", error);
      setRecoveryRecording({ blob: file, ...context });
      setImportStatus("error");
      setRecordingMessage("오디오를 읽거나 저장하지 못했습니다. 다시 시도하거나 원본 파일을 보관해 주세요.");
    }
  }

  async function retryRecovery() {
    const recovery = recoveryRecording;
    if (!recovery) return;
    setImportStatus("saving");
    setRecordingMessage("원본 오디오를 다시 확인하고 있습니다.");
    try {
      const duration = await decodeRecordingDuration(recovery.blob);
      await persistAudio(recovery.blob, duration, recovery);
    } catch (error) {
      logError("AppShell.retryRecovery", error);
      setImportStatus("error");
      setRecordingMessage("원본 오디오를 아직 읽거나 저장할 수 없습니다. 파일을 내려받아 보관해 주세요.");
    }
  }

  async function downloadRecovery() {
    if (!recoveryRecording) return;
    const { downloadBlob } = await import("../../audio/exportProject");
    const extension = recoveryRecording.mimeType.includes("mp4") ? "m4a" : recoveryRecording.mimeType.includes("wav") ? "wav" : "webm";
    downloadBlob(recoveryRecording.blob, `${fileSafeName(recoveryRecording.name)}.${extension}`);
  }

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    loadLastProject()
      .then((lastProject) => {
        if (lastProject) loadProjectIntoStore(lastProject);
      })
      .catch((error) => logError("AppShell.loadLastProject", error))
      .finally(() => setHydrated(true));
  }, [loadProjectIntoStore, setHydrated]);

  useEffect(() => {
    const unsubscribeStore = useDawStore.subscribe((next, previous) => {
      const status = recordingController.getSnapshot().status;
      const active = ["requesting", "ready", "counting", "starting", "recording", "stopping"].includes(status);
      if (!active) return;
      if (next.project.id !== previous.project.id || next.selectedTrackId !== previous.selectedTrackId) {
        recordingController.cancel();
        if (next.isRecording) next.stopTransport();
        return;
      }
      if (previous.transportState !== "stopped" && next.transportState === "stopped") {
        stopActiveRecording();
      }
    });
    const unsubscribeMode = subscribeRepositoryMode((nextMode) => {
      const previousMode = currentRepositoryModeRef.current;
      if (previousMode !== nextMode) {
        for (const [key, queue] of saveQueues) {
          if (key.startsWith(`${previousMode}:`) && !queue.getState().completed) {
            void queue.flush().catch((error) => {
              logError("AppShell.repositorySwitchSave", error);
              setBackgroundSaveError(true);
            });
          }
        }
        currentRepositoryModeRef.current = nextMode;
        setRepositoryModeState(nextMode);
      }
      const status = recordingController.getSnapshot().status;
      if (["requesting", "ready", "counting", "starting", "recording", "stopping"].includes(status)) {
        recordingController.cancel();
        useDawStore.getState().stopTransport();
        setRecordingMessage("저장 위치가 바뀌어 녹음을 취소했습니다. 다시 녹음해 주세요.");
      }
    });
    return () => {
      unsubscribeStore();
      unsubscribeMode();
      recordingController.cancel();
    };
  }, [recordingController, saveQueues]);

  useEffect(() => {
    if (!hydrated) return;
    refreshLessonProgress();
  }, [hydrated, project, refreshLessonProgress]);

  useEffect(() => {
    const syncStatus = (state: ReturnType<ProjectSaveQueue["getState"]>) => {
      setSaveStatus(state.status === "error" ? "error" : state.completed ? "done" : "working");
    };
    syncStatus(saveQueue.getState());
    return saveQueue.subscribe(syncStatus);
  }, [saveQueue]);

  useEffect(() => {
    if (!hydrated) return;
    const queue = saveQueueFor(getRepositoryMode(), project.id);
    if (lastQueuedProjectRef.current?.project !== project || lastQueuedProjectRef.current.repositoryMode !== getRepositoryMode()) {
      queueProject(project);
    }
    if (autoSaveTimerRef.current !== undefined) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = undefined;
      void queue.flush().catch((error) => logError("AppShell.autoSave", error));
    }, 1000);
    return () => {
      if (autoSaveTimerRef.current !== undefined) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [hydrated, project, repositoryMode, saveQueues]);

  useEffect(() => {
    if (hydrated) markCurrentProject(useDawStore.getState().project.id, getRepositoryMode());
  }, [hydrated, project.id, repositoryMode]);

  useEffect(() => {
    if (!hydrated) return;
    // Queue every project revision synchronously. React can batch an edit and
    // a project switch before the debounce effect gets to observe the edit.
    return useDawStore.subscribe((next, previous) => {
      if (next.project === previous.project) return;
      const mode = getRepositoryMode();
      const nextQueue = saveQueueFor(mode, next.project.id);
      lastQueuedProjectRef.current = { project: next.project, repositoryMode: mode };
      nextQueue.update(next.project);
      if (next.project.id !== previous.project.id) {
        markCurrentProject(next.project.id, mode);
        const previousQueue = saveQueueFor(mode, previous.project.id);
        if (!previousQueue.getState().completed) {
          void previousQueue.flush().catch((error) => {
            logError("AppShell.projectSwitchSave", error);
            setBackgroundSaveError(true);
          });
        }
      }
    });
  }, [hydrated, saveQueues]);

  useEffect(() => {
    if (recordingSnapshot.status === "error" && useDawStore.getState().isRecording) {
      useDawStore.getState().stopTransport();
    }
  }, [recordingSnapshot.status]);

  useEffect(() => {
    function flushHidden() {
      if (document.visibilityState !== "hidden") return;
      if (autoSaveTimerRef.current !== undefined) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = undefined;
      }
      const latest = useDawStore.getState().project;
      if (lastQueuedProjectRef.current?.project !== latest || lastQueuedProjectRef.current.repositoryMode !== getRepositoryMode()) {
        queueProject(latest);
      }
      for (const queue of saveQueues.values()) {
        if (!queue.getState().completed) {
          void queue.flush().catch((error) => {
            logError("AppShell.hiddenSave", error);
            setBackgroundSaveError(true);
          });
        }
      }
    }
    function warnOnUnsaved(event: BeforeUnloadEvent) {
      const latest = useDawStore.getState().project;
      if ([...saveQueues.values()].every((queue) => queue.getState().completed)
        && lastQueuedProjectRef.current?.project === latest
        && lastQueuedProjectRef.current.repositoryMode === getRepositoryMode()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("visibilitychange", flushHidden);
    window.addEventListener("beforeunload", warnOnUnsaved);
    return () => {
      document.removeEventListener("visibilitychange", flushHidden);
      window.removeEventListener("beforeunload", warnOnUnsaved);
    };
  }, [saveQueues]);

  useEffect(() => {
    let cancelled = false;
    if (transportState === "playing") {
      const playReady = getLazyAudioEngine()
        .then(async (engine) => {
          if (cancelled) return;
          await engine.play(
            useDawStore.getState().project,
            (beat) => useDawStore.getState().setCurrentBeat(beat),
            () => {
              useDawStore.getState().stopTransport();
              useDawStore.getState().setMasterLevel(0);
            },
            {
              startBeat: useDawStore.getState().currentBeat,
              countIn: useDawStore.getState().isRecording,
              onTransportStart: (beat) => recordingController.beginCapture(beat),
              onMeter: (level) => useDawStore.getState().setMasterLevel(level)
            }
          );
          if (!cancelled && useDawStore.getState().transportState === "playing") {
            const live = useDawStore.getState().liveLoopPlayback;
            if (live.activeCellIds.length > 0 && live.queuedCellIds.length === 0) {
              await engine.triggerLiveLoopCells(useDawStore.getState().project, live.activeCellIds, useDawStore.getState().currentBeat);
            }
          }
          if (cancelled) {
            const latestState = useDawStore.getState().transportState;
            if (latestState === "paused") engine.pause();
            if (latestState === "stopped") engine.stop();
          }
        })
        .catch((error) => {
          if (cancelled) return;
          logError("AppShell.play", error);
          useDawStore.getState().stopTransport();
          useDawStore.getState().setMasterLevel(0);
        });
      playReadyRef.current = playReady;
    } else if (transportState === "paused") {
      playReadyRef.current = null;
      const pausedBeat = audioEngineRef.current?.pause();
      if (pausedBeat !== undefined) setCurrentBeat(pausedBeat);
      useDawStore.getState().setMasterLevel(0);
    } else {
      playReadyRef.current = null;
      audioEngineRef.current?.stop();
      useDawStore.getState().setMasterLevel(0);
      setCurrentBeat(0);
    }
    return () => {
      cancelled = true;
    };
  }, [transportState, project.id, setCurrentBeat]);

  useEffect(() => {
    if (useDawStore.getState().transportState === "stopped") return;
    audioEngineRef.current?.seek(useDawStore.getState().currentBeat);
  }, [seekRevision]);

  useEffect(() => {
    audioEngineRef.current?.updateTrackControls(project);
  }, [project]);

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
    writeStoredTheme(appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (!project.cycleEnabled || (project.cycleEnd ?? 0) <= (project.cycleStart ?? 0)) {
      setShareRange("full");
    }
  }, [project.cycleEnabled, project.cycleStart, project.cycleEnd]);

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
      if (useDawStore.getState().transportState === "paused") return;
      setPlaying(true);
      return;
    }

    let cancelled = false;
    const cellIds = [...queuedCellIds];
    const triggerBeat = liveLoopPlayback.triggerBeat;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        await playReadyRef.current;
        if (cancelled || useDawStore.getState().transportState !== "playing") return;
        const engine = await getLazyAudioEngine();
        if (cancelled || useDawStore.getState().transportState !== "playing") return;
        await engine.triggerLiveLoopCells(useDawStore.getState().project, cellIds, triggerBeat, () => {
          if (!cancelled && useDawStore.getState().transportState === "playing") markLiveLoopTriggered(cellIds);
        });
      })().catch((error) => logError("AppShell.triggerLiveLoopCells", error));
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isPlaying, liveLoopPlayback, markLiveLoopTriggered, setPlaying]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (shortcutHelpOpen) {
        if (event.key === "Tab" || event.key === "Escape") return;
        if (isEditableTarget(event.target)) return;
        const shortcut = resolveShortcutKey(event);
        if (!shortcut) return;
        event.preventDefault();
        flashShortcut(shortcut.id);
        return;
      }
      if (shareOpen || isEditableTarget(event.target)) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = resolveShortcutKey(event);
      if (!shortcut) return;
      if (target?.closest('[role="menu"]')) return;
      if (!shortcut.command && target?.closest('button, a, [role="button"], [role="menu"], [role="menuitem"], [role="slider"]')) return;
      if (shortcut.scope === "timeline" && !target?.closest("[data-timeline-surface]")) return;

      const selectedClip = () => {
        const state = useDawStore.getState();
        return state.project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === state.selectedClipId);
      };
      const moveSelectedClip = (direction: -1 | 1) => {
        const state = useDawStore.getState();
        const clip = selectedClip();
        if (clip && !clip.locked) state.moveClip(clip.id, Math.max(0, clip.startBeat + direction * state.snapBeats));
      };
      const selectAdjacentTrack = (direction: -1 | 1) => {
        const state = useDawStore.getState();
        const index = state.project.tracks.findIndex((track) => track.id === state.selectedTrackId);
        const next = state.project.tracks[Math.max(0, Math.min(state.project.tracks.length - 1, index + direction))];
        if (next) state.selectTrack(next.id);
      };
      const seek = (direction: -1 | 1) => {
        const state = useDawStore.getState();
        state.seekToBeat(Math.max(0, state.currentBeat + direction * state.snapBeats));
      };
      const actions: ShortcutHandlers = {
        playPause: handlePlayToggle,
        record: () => { void handleRecord(); },
        stop: handleStop,
        undo: () => useDawStore.getState().undo(),
        redo: () => useDawStore.getState().redo(),
        save: () => { void handleSave(); },
        duplicateClip: () => { const clip = selectedClip(); if (clip) useDawStore.getState().duplicateClip(clip.id); },
        deleteClip: () => { const clip = selectedClip(); if (clip && !clip.locked) useDawStore.getState().removeClip(clip.id); },
        moveClipBack: () => moveSelectedClip(-1),
        moveClipForward: () => moveSelectedClip(1),
        selectPreviousTrack: () => selectAdjacentTrack(-1),
        selectNextTrack: () => selectAdjacentTrack(1),
        seekBack: () => seek(-1),
        seekForward: () => seek(1),
        toggleCycle: () => useDawStore.getState().toggleCycle(),
        help: openShortcutHelp
      };
      event.preventDefault();
      shortcut.handler(actions);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shareOpen, shortcutHelpOpen]);

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
      queueProject(useDawStore.getState().project);
      const results = await Promise.allSettled([...saveQueues.values()]
        .filter((queue) => !queue.getState().completed)
        .map((queue) => queue.flush()));
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failed) throw failed.reason;
      setBackgroundSaveError(false);
      setSaveStatus("done");
    } catch (error) {
      logError("AppShell.handleSave", error);
      setBackgroundSaveError(true);
      setSaveStatus("error");
    }
  }

  async function prepareForPwaRefresh() {
    if (!hydrated || recoveryRecording || hasUnsavedDrafts() || hasAppBusy() || recordingExportBusy() || exportStatus === "working" || importStatus === "saving") return false;
    if (autoSaveTimerRef.current !== undefined) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = undefined;
    }
    const latest = useDawStore.getState().project;
    const mode = getRepositoryMode();
    if (lastQueuedProjectRef.current?.project !== latest || lastQueuedProjectRef.current.repositoryMode !== mode) {
      queueProject(latest);
    }
    try {
      await Promise.all([...saveQueues.values()].map((queue) => queue.flush()));
    } catch (error) {
      logError("AppShell.prepareForPwaRefresh", error);
      return false;
    }
    return [...saveQueues.values()].every((queue) => queue.getState().completed)
      && lastQueuedProjectRef.current?.project === useDawStore.getState().project
      && lastQueuedProjectRef.current.repositoryMode === getRepositoryMode();
  }

  async function handleExport() {
    setShareMessage("");
    setShareOpen(true);
  }

  function recordingExportBusy() {
    return ["requesting", "ready", "counting", "starting", "recording", "stopping", "saving"]
      .includes(recordingController.getSnapshot().status);
  }

  function shareOptions() {
    return {
      quality: shareQuality,
      range: shareRange
    };
  }

  async function handleExportMix() {
    if (recordingExportBusy()) {
      setShareMessage("녹음 저장이 끝난 뒤 WAV를 내보내 주세요.");
      return;
    }
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { downloadBlob, exportProjectAudio } = await import("../../audio/exportProject");
      const result = await exportProjectAudio(currentProject, shareOptions());
      downloadBlob(result.blob, result.fileName);
      setShareMessage("믹스 WAV 파일을 저장했어요.");
      setExportStatus("done");
    } catch (error) {
      logError("AppShell.handleExportMix", error);
      setShareMessage(error instanceof Error && error.name === "AudioExportError"
        ? `${error.message} 원본 오디오를 다시 가져오거나 해당 클립을 정리한 뒤 시도해 주세요.`
        : "믹스를 내보내지 못했어요. 녹음 파일을 확인한 뒤 다시 시도해 주세요.");
      setExportStatus("error");
    }
  }

  async function handleExportStems() {
    if (recordingExportBusy()) {
      setShareMessage("녹음 저장이 끝난 뒤 트랙별 음원을 내보내 주세요.");
      return;
    }
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { downloadBlob, exportProjectStemsZip, resolveExportFileName } = await import("../../audio/exportProject");
      const blob = await exportProjectStemsZip(currentProject, shareOptions());
      downloadBlob(blob, resolveExportFileName(currentProject.name, "stems.zip"));
      setShareMessage("트랙별 WAV ZIP 파일을 저장했어요.");
      setExportStatus("done");
    } catch (error) {
      logError("AppShell.handleExportStems", error);
      setShareMessage(error instanceof Error && error.name === "AudioExportError"
        ? `${error.message} 원본 오디오를 다시 가져오거나 해당 클립을 정리한 뒤 시도해 주세요.`
        : "트랙별 오디오를 내보내지 못했어요. 녹음 파일을 확인한 뒤 다시 시도해 주세요.");
      setExportStatus("error");
    }
  }

  async function handleExportProjectFile() {
    setExportStatus("working");
    setShareMessage("");
    try {
      const currentProject = useDawStore.getState().project;
      const { createProjectFileBlob, downloadBlob, resolveExportFileName } = await import("../../audio/exportProject");
      const queue = queueProject(currentProject);
      let savedLocally = true;
      try {
        await queue.flush();
      } catch (saveError) {
        logError("AppShell.handleExportProjectFile.save", saveError);
        savedLocally = false;
      }
      downloadBlob(createProjectFileBlob(currentProject), resolveExportFileName(currentProject.name, "webband.json"));
      setShareMessage(savedLocally
        ? "프로젝트 파일을 저장했어요. 녹음 원본은 포함되지 않으니 샘플 라이브러리에서 따로 내려받아 주세요."
        : "프로젝트 파일을 내려받았습니다. 앱 내부 저장은 실패했습니다. 이 파일에는 녹음 원본이 없으니 샘플 라이브러리에서 따로 내려받아 보관해 주세요.");
      setExportStatus("done");
    } catch (error) {
      logError("AppShell.handleExportProjectFile", error);
      setShareMessage("프로젝트 파일을 내보내지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.");
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
      const currentQueue = queueProject(useDawStore.getState().project);
      await currentQueue.flush();
      const { parseProjectFile } = await import("../../audio/exportProject");
      const importedProject = await parseProjectFile(file);
      loadProjectIntoStore(importedProject);
      const importedQueue = queueProject(importedProject);
      await importedQueue.flush();
      setShareMessage("프로젝트 파일을 가져왔어요.");
      setExportStatus("done");
    } catch (error) {
      logError("AppShell.handleProjectFileChange", error);
      setShareMessage("프로젝트 파일을 가져오지 못했어요. 파일 형식을 확인한 뒤 다시 시도해 주세요.");
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
  const recordingBusy = recordingExportBusy();
  const recordingDisplayStatus: RecordingDisplayStatus =
    recordingSnapshot.status === "requesting" ? "permission"
      : recordingSnapshot.status === "idle" && importStatus !== "idle" ? importStatus
        : recordingSnapshot.status;
  const recordingControls: RecordingControls = {
    status: recordingDisplayStatus,
    message: [recordingMessage || recordingSnapshot.message, recordingSnapshot.warning].filter(Boolean).join(" "),
    targetTrackName: audioTarget()?.name,
    hasRecovery: Boolean(recoveryRecording),
    onRecord: () => { void handleRecord(); },
    onStop: handleStop,
    onImportFile: (file) => { void handleImportAudio(file); },
    onRetry: () => { void retryRecovery(); },
    onDownloadRecovery: () => { void downloadRecovery(); }
  };
  const cycleAvailable = Boolean(project.cycleEnabled && (project.cycleEnd ?? 0) > (project.cycleStart ?? 0));
  const optionClass = (active: boolean) =>
    `h-8 rounded-md border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "border-accent-sel bg-accent-sel/20 text-ink-high" : "border-graphite-700 bg-graphite-900 text-ink-body hover:border-graphite-500"
    }`;

  return (
    <div
      data-theme={appTheme}
      className="grid h-dvh w-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(220px,34dvh)] overflow-hidden bg-graphite-975 text-ink-high lg:grid-rows-[auto_minmax(0,1fr)_260px]"
    >
      <TransportBar
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        onRecord={() => { void handleRecord(); }}
        recordingStatus={recordingSnapshot.status}
        exportDisabled={recordingBusy}
        onSave={handleSave}
        saveStatus={backgroundSaveError ? "error" : saveStatus}
        onExport={handleExport}
        exportStatus={exportStatus}
        educationView={educationView}
        onEducationViewChange={setEducationView}
        onShortcutHelp={openShortcutHelp}
        appTheme={appTheme}
        onAppThemeChange={setAppTheme}
      />

      {sampleNotice ? (
        <div role="status" className="fixed right-4 top-16 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-amber-400/60 bg-graphite-900 p-3 text-xs text-amber-100 shadow-xl">
          <span>{sampleNotice}</span>
          <button type="button" aria-label="샘플 안내 닫기" className="font-bold text-amber-200" onClick={clearSampleNotice}>닫기</button>
        </div>
      ) : null}

      <PwaStatusPanel prepareForRefresh={prepareForPwaRefresh} />

      <main className="grid min-h-0 w-full min-w-0 grid-cols-1 grid-rows-[minmax(360px,1fr)_minmax(320px,40dvh)] gap-2 overflow-auto bg-gradient-to-b from-graphite-950 to-graphite-975 p-2 lg:grid-cols-[minmax(0,1fr)_clamp(280px,22vw,420px)] lg:grid-rows-none lg:overflow-hidden">
        <ArrangementTimeline />
        <ErrorBoundary areaLabel="스튜디오 패널">
          <Suspense fallback={<PanelFallback />}>
            <StudioPanel
              mode={mode}
              recordingControls={recordingControls}
              lessonContent={
                <ErrorBoundary key={`${educationView}:${mode}`} areaLabel="교육 패널">
                  <Suspense fallback={<PanelFallback />}>{renderEducationPanel()}</Suspense>
                </ErrorBoundary>
              }
            />
          </Suspense>
        </ErrorBoundary>
      </main>

      <ErrorBoundary areaLabel="클립 편집기">
        <Suspense fallback={<PanelFallback />}>
          <ClipEditor />
        </Suspense>
      </ErrorBoundary>

      <input
        ref={projectFileInputRef}
        type="file"
        className="hidden"
        accept=".webband.json,application/json"
        onChange={(event) => void handleProjectFileChange(event)}
      />

      {shareOpen ? (
        <AccessibleModal
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm"
          label="공유 및 내보내기"
          onClose={() => setShareOpen(false)}
        >
          <div className="w-[min(560px,calc(100vw-24px))] rounded-lg border border-graphite-700 bg-graphite-950 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink-high">공유 및 내보내기</h2>
                <div className="text-xs text-graphite-500">{project.name}</div>
              </div>
              <button className="studio-button h-8 px-3 text-xs" onClick={() => setShareOpen(false)}>
                닫기
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">형식</div>
                <div className={`${optionClass(true)} flex items-center`}>WAV (PCM)</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">음질</div>
                <div className="grid grid-cols-1 gap-1">
                  <button className={optionClass(shareQuality === "standard")} onClick={() => setShareQuality("standard")}>
                    표준 44.1 kHz / 16비트
                  </button>
                  <button className={optionClass(shareQuality === "high")} onClick={() => setShareQuality("high")}>
                    고음질 48 kHz / 24비트
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">범위</div>
                <div className="grid grid-cols-2 gap-1">
                  <button className={optionClass(shareRange === "full")} onClick={() => setShareRange("full")}>
                    전체
                  </button>
                  <button
                    className={optionClass(shareRange === "cycle")}
                    onClick={() => setShareRange("cycle")}
                    disabled={!cycleAvailable}
                    title={cycleAvailable ? "반복 구간만 내보내기" : "반복 구간을 먼저 켜 주세요"}
                  >
                    반복
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-graphite-400">음질과 범위는 WAV 내보내기에 적용됩니다. 파일 끝에는 효과 잔향이 약 1초 포함됩니다.</p>
            {recordingBusy ? <p className="mt-2 text-xs font-semibold text-meter-amber" role="status">녹음 저장이 끝나면 내보내기를 사용할 수 있습니다.</p> : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportMix()} disabled={exportWorking || recordingBusy}>
                <Download size={15} />
                <span>믹스 WAV</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportStems()} disabled={exportWorking || recordingBusy}>
                <FileArchive size={15} />
                <span>트랙별 WAV ZIP</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => void handleExportProjectFile()} disabled={exportWorking || recordingBusy}>
                <FileInput size={15} />
                <span>프로젝트 파일</span>
              </button>
              <button className="studio-button h-10 justify-center" onClick={() => projectFileInputRef.current?.click()} disabled={exportWorking || recordingBusy}>
                <Upload size={15} />
                <span>프로젝트 가져오기</span>
              </button>
            </div>

            <div className="mt-3 min-h-5 text-xs font-semibold text-graphite-400">{exportWorking ? "처리 중..." : shareMessage}</div>
          </div>
        </AccessibleModal>
      ) : null}

      {shortcutHelpOpen ? <ShortcutHelpDialog activeShortcutId={activeShortcutId} onClose={closeShortcutHelp} /> : null}
    </div>
  );
}
