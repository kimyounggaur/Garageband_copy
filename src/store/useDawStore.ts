import { create } from "zustand";
import { summarizeLesson } from "../education/evaluateMission";
import { createLessonProject, getLessonById } from "../education/lessons";
import type { Assignment, StudioMode } from "../education/types";
import { defaultInstrumentForTrack, normalizeInstrumentId } from "../data/instruments";
import { LOOP_LIBRARY, getLoopById } from "../data/loops";
import { loopMatchSummary } from "../data/loops";
import { CURRENT_PROJECT_VERSION, type Clip, type MidiNote, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "../utils/id";
import { loopCategoryLabel } from "../utils/labels";
import { normalizeProject } from "../utils/projectMigration";
import {
  estimateTapTempo,
  nextLcdMode,
  normalizeCountInBars,
  normalizeMasterVolume,
  normalizeProjectKey,
  normalizeTimeSignature,
  type LcdMode,
  type TunerReading
} from "../utils/transport";
import {
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  SNAP_BEAT,
  clamp,
  normalizeCycleRange,
  snapBeat,
  type SnapBeats
} from "../utils/timeline";

type ClipDraft = Omit<Clip, "id" | "trackId"> & Partial<Pick<Clip, "id" | "trackId">>;
type EditOptions = { recordHistory?: boolean; snap?: boolean };
type ClipAudioSettings = Partial<
  Pick<Clip, "trimStartSeconds" | "trimEndSeconds" | "gain" | "fadeInSeconds" | "fadeOutSeconds" | "fadeInBeats" | "fadeOutBeats">
>;

const HISTORY_LIMIT = 80;

type DawState = {
  project: Project;
  mode: StudioMode;
  isPlaying: boolean;
  currentBeat: number;
  lcdMode: LcdMode;
  isRecording: boolean;
  masterLevel: number;
  tunerReading?: TunerReading;
  selectedTrackId?: string;
  selectedClipId?: string;
  selectedClipIds: string[];
  hydrated: boolean;
  undoStack: Project[];
  redoStack: Project[];
  pendingHistory?: Project;
  snapBeats: SnapBeats;
  timelineZoom: number;
  preventClipOverlap: boolean;
  tapTempoTimes: number[];
  createProject: (name?: string) => void;
  loadProject: (project: Project) => void;
  renameProject: (name: string) => void;
  duplicateProject: () => void;
  startLesson: (lessonId: string) => void;
  startAssignment: (assignment: Assignment) => void;
  refreshLessonProgress: () => void;
  setMode: (mode: StudioMode) => void;
  setHydrated: (hydrated: boolean) => void;
  undo: () => void;
  redo: () => void;
  beginHistorySnapshot: () => void;
  commitHistorySnapshot: () => void;
  setSnapBeats: (snapBeats: SnapBeats) => void;
  setTimelineZoom: (timelineZoom: number) => void;
  setPreventClipOverlap: (preventClipOverlap: boolean) => void;
  setCycleRange: (startBeat: number, endBeat: number, options?: EditOptions) => void;
  toggleCycle: (enabled?: boolean) => void;
  cycleLcdMode: () => void;
  setRecording: (isRecording: boolean) => void;
  toggleMetronome: (metronomeOn?: boolean) => void;
  setCountInBars: (countInBars: number) => void;
  setProjectKey: (key: string) => void;
  setTimeSignature: (timeSignature: [number, number]) => void;
  setMasterVolume: (masterVolume: number) => void;
  setMasterLevel: (masterLevel: number) => void;
  setTunerReading: (reading?: TunerReading) => void;
  tapTempo: (timestampMs?: number) => void;
  addTrack: (type?: TrackType, name?: string) => string;
  renameTrack: (trackId: string, name: string) => void;
  duplicateTrack: (trackId: string) => string | undefined;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: ClipDraft) => string;
  addLoopClip: (loopId: string, trackId?: string, startBeat?: number) => string;
  addMidiClip: (trackId?: string, startBeat?: number) => string;
  addAudioClip: (
    trackId: string | undefined,
    startBeat: number,
    name: string,
    audioUrl: string | undefined,
    durationSeconds: number,
    audioAssetId?: string
  ) => string;
  updateClipAudioSettings: (clipId: string, settings: ClipAudioSettings) => void;
  splitSelectedAudioClip: () => void;
  moveClip: (clipId: string, startBeat: number, targetTrackId?: string, options?: EditOptions) => void;
  moveSelectedClips: (deltaBeats: number, options?: EditOptions) => void;
  resizeClip: (clipId: string, lengthBeats: number, options?: EditOptions) => void;
  resizeClipStart: (clipId: string, startBeat: number, options?: EditOptions) => void;
  setClipLoopEnabled: (clipId: string, loopEnabled: boolean, options?: EditOptions) => void;
  duplicateClip: (clipId: string) => string | undefined;
  removeClip: (clipId: string) => void;
  selectTrack: (trackId?: string) => void;
  selectClip: (clipId?: string, additive?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  setBpm: (bpm: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentBeat: (beat: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  setTrackInstrument: (trackId: string, instrumentId: string) => void;
  addNote: (clipId: string, note: Omit<MidiNote, "id">) => string;
  addNotes: (clipId: string, notes: Array<Omit<MidiNote, "id">>, options?: EditOptions) => void;
  moveNote: (clipId: string, noteId: string, startBeat: number, pitch: number, options?: EditOptions) => void;
  resizeNote: (clipId: string, noteId: string, durationBeats: number, options?: EditOptions) => void;
  removeNote: (clipId: string, noteId: string) => void;
};

const TRACK_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#4ade80", "#fb7185", "#eab308"];

function now() {
  return Date.now();
}

function nonNegativeNumber(value: number | undefined, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, next) : fallback;
}

function clampedNumber(value: number | undefined, min: number, max: number, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? clamp(next, min, max) : fallback;
}

function touch(project: Project): Project {
  return { ...project, updatedAt: now() };
}

function snapshotProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

function sameProject(left: Project, right: Project) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushHistory(stack: Project[], project: Project) {
  return [...stack, snapshotProject(project)].slice(-HISTORY_LIMIT);
}

function inferTrackRole(type: TrackType, name?: string): TrackRole {
  const lower = (name ?? "").toLowerCase();
  if (type === "drum" || lower.includes("beat") || lower.includes("drum") || name?.includes("비트") || name?.includes("드럼")) return "beat";
  if (type === "audio" || lower.includes("record") || name?.includes("녹음")) return "recording";
  if (lower.includes("bass") || name?.includes("베이스")) return "bass";
  if (lower.includes("key") || lower.includes("chord") || lower.includes("pad") || name?.includes("건반") || name?.includes("화성") || name?.includes("코드")) return "harmony";
  return "melody";
}

function createTrack(type: TrackType, index: number, name?: string, role?: TrackRole): Track {
  const label = type === "drum" ? "드럼" : type === "audio" ? "오디오" : "악기";
  const trackName = name ?? `${label} ${index + 1}`;
  return {
    id: makeId("track"),
    name: trackName,
    type,
    role: role ?? inferTrackRole(type, trackName),
    instrumentId: defaultInstrumentForTrack({ type, role: role ?? inferTrackRole(type, trackName) }),
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    clips: []
  };
}

function createInitialProject(): Project {
  const timestamp = now();
  const drums = createTrack("drum", 0, "비트");
  const bass = createTrack("instrument", 1, "베이스");
  const keys = createTrack("instrument", 2, "건반");

  drums.clips.push({
    id: makeId("clip"),
    trackId: drums.id,
    type: "loop",
    name: "그리드 룸 드럼",
    startBeat: 0,
    lengthBeats: 8,
    color: "#38bdf8",
    loopId: "drums-grid"
  });

  bass.clips.push({
    id: makeId("clip"),
    trackId: bass.id,
    type: "loop",
    name: "미드나잇 베이스",
    startBeat: 0,
    lengthBeats: 8,
    color: "#f59e0b",
    loopId: "bass-midnight"
  });

  keys.clips.push({
    id: makeId("clip"),
    trackId: keys.id,
    type: "midi",
    name: "스케치 코드",
    startBeat: 8,
    lengthBeats: 8,
    color: "#a78bfa",
    notes: [
      { id: makeId("note"), pitch: 60, startBeat: 0, durationBeats: 1.5, velocity: 0.78 },
      { id: makeId("note"), pitch: 64, startBeat: 0, durationBeats: 1.5, velocity: 0.72 },
      { id: makeId("note"), pitch: 67, startBeat: 0, durationBeats: 1.5, velocity: 0.7 },
      { id: makeId("note"), pitch: 62, startBeat: 2, durationBeats: 1.5, velocity: 0.76 },
      { id: makeId("note"), pitch: 65, startBeat: 2, durationBeats: 1.5, velocity: 0.72 },
      { id: makeId("note"), pitch: 69, startBeat: 2, durationBeats: 1.5, velocity: 0.68 },
      { id: makeId("note"), pitch: 59, startBeat: 4, durationBeats: 1.5, velocity: 0.76 },
      { id: makeId("note"), pitch: 62, startBeat: 4, durationBeats: 1.5, velocity: 0.7 },
      { id: makeId("note"), pitch: 67, startBeat: 4, durationBeats: 1.5, velocity: 0.68 }
    ]
  });

  return {
    id: makeId("project"),
    version: CURRENT_PROJECT_VERSION,
    name: "새 프로젝트",
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [drums, bass, keys],
    cycleStart: 0,
    cycleEnd: 8,
    cycleEnabled: false,
    key: "C",
    metronomeOn: false,
    countInBars: 0,
    masterVolume: 0.85,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function cloneProject(project: Project, name: string): Project {
  const trackIds = new Map<string, string>();
  const tracks = project.tracks.map((track) => {
    const id = makeId("track");
    trackIds.set(track.id, id);
    return {
      ...track,
      id,
      clips: track.clips.map((clip) => ({
        ...clip,
        id: makeId("clip"),
        trackId: trackIds.get(clip.trackId) ?? id,
        notes: clip.notes?.map((note) => ({ ...note, id: makeId("note") }))
      }))
    };
  });
  const timestamp = now();
  return normalizeProject({
    ...project,
    id: makeId("project"),
    name,
    tracks,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function updateClip(project: Project, clipId: string, updater: (clip: Clip) => Clip): Project {
  return touch({
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? updater(clip) : clip))
    }))
  });
}

function findClip(project: Project, clipId?: string) {
  if (!clipId) return undefined;
  return project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
}

function getValidClipIds(project: Project, clipIds: string[]) {
  const existingClipIds = new Set(project.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));
  return clipIds.filter((clipId, index) => existingClipIds.has(clipId) && clipIds.indexOf(clipId) === index);
}

function snapWithOptions(beat: number, snapBeats: SnapBeats, options?: EditOptions) {
  return options?.snap === false ? Math.max(0, beat) : snapBeat(beat, snapBeats);
}

function getValidSelection(project: Project, selectedTrackId?: string, selectedClipId?: string, selectedClipIds: string[] = []) {
  const validClipIds = getValidClipIds(project, selectedClipIds);
  const selectedClip = findClip(project, selectedClipId) ?? findClip(project, validClipIds[0]);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  const nextSelectedClipIds = selectedClip
    ? validClipIds.includes(selectedClip.id)
      ? validClipIds
      : [selectedClip.id, ...validClipIds]
    : validClipIds;
  return {
    selectedTrackId: selectedTrack?.id ?? selectedClip?.trackId ?? project.tracks[0]?.id,
    selectedClipId: selectedClip?.id,
    selectedClipIds: nextSelectedClipIds
  };
}

function commitProjectChange(
  state: DawState,
  project: Project,
  extra: Partial<DawState> = {},
  options: EditOptions = {}
): Partial<DawState> {
  if (options.recordHistory === false || state.pendingHistory) {
    return { project, ...extra };
  }
  return {
    project,
    undoStack: pushHistory(state.undoStack, state.project),
    redoStack: [],
    ...extra
  };
}

function clipsOverlap(startA: number, lengthA: number, startB: number, lengthB: number) {
  const endA = startA + lengthA;
  const endB = startB + lengthB;
  return startA < endB - 0.0001 && startB < endA - 0.0001;
}

function hasClipOverlap(clips: Clip[], clipId: string | undefined, startBeat: number, lengthBeats: number) {
  return clips.some((clip) => clip.id !== clipId && clipsOverlap(startBeat, lengthBeats, clip.startBeat, clip.lengthBeats));
}

function resolveNonOverlappingStart(
  clips: Clip[],
  clipId: string | undefined,
  desiredStartBeat: number,
  lengthBeats: number,
  snapBeats: number
) {
  const snappedStart = snapBeat(desiredStartBeat, snapBeats);
  if (!hasClipOverlap(clips, clipId, snappedStart, lengthBeats)) return snappedStart;

  const candidates = new Set<number>([snappedStart]);
  clips
    .filter((clip) => clip.id !== clipId)
    .forEach((clip) => {
      candidates.add(snapBeat(clip.startBeat - lengthBeats, snapBeats));
      candidates.add(snapBeat(clip.startBeat + clip.lengthBeats, snapBeats));
    });

  return (
    [...candidates]
      .filter((candidate) => candidate >= 0 && !hasClipOverlap(clips, clipId, candidate, lengthBeats))
      .sort((left, right) => Math.abs(left - snappedStart) - Math.abs(right - snappedStart) || left - right)[0] ??
    snappedStart
  );
}

function resolveNonOverlappingLength(track: Track, clip: Clip, desiredLengthBeats: number, snapBeats: number) {
  const snappedLength = Math.max(0.25, snapBeat(desiredLengthBeats, snapBeats));
  const nextClipStart = track.clips
    .filter((item) => item.id !== clip.id && item.startBeat >= clip.startBeat)
    .reduce<number | undefined>((nearest, item) => {
      return nearest === undefined ? item.startBeat : Math.min(nearest, item.startBeat);
    }, undefined);

  if (nextClipStart === undefined) return snappedLength;
  return clamp(snappedLength, 0.25, Math.max(0.25, snapBeat(nextClipStart - clip.startBeat, snapBeats)));
}

export const useDawStore = create<DawState>((set, get) => ({
  project: createInitialProject(),
  mode: "studio",
  isPlaying: false,
  currentBeat: 0,
  lcdMode: "beats",
  isRecording: false,
  masterLevel: 0,
  tunerReading: undefined,
  selectedTrackId: undefined,
  selectedClipId: undefined,
  selectedClipIds: [],
  hydrated: false,
  undoStack: [],
  redoStack: [],
  pendingHistory: undefined,
  snapBeats: SNAP_BEAT,
  timelineZoom: 1,
  preventClipOverlap: true,
  tapTempoTimes: [],

  createProject: (name = "새 프로젝트") => {
    const project = createInitialProject();
    set({
      project: { ...project, id: makeId("project"), name },
      mode: "studio",
      isPlaying: false,
      currentBeat: 0,
      lcdMode: "beats",
      isRecording: false,
      masterLevel: 0,
      tunerReading: undefined,
      tapTempoTimes: [],
      selectedTrackId: undefined,
      selectedClipId: undefined,
      selectedClipIds: [],
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  loadProject: (project) => {
    const migratedProject = normalizeProject(project);
    set({
      project: migratedProject,
      mode: migratedProject.lessonId ? "lesson" : "studio",
      isPlaying: false,
      currentBeat: 0,
      lcdMode: "beats",
      isRecording: false,
      masterLevel: 0,
      tunerReading: undefined,
      tapTempoTimes: [],
      selectedTrackId: migratedProject.tracks[0]?.id,
      selectedClipId: migratedProject.tracks[0]?.clips[0]?.id,
      selectedClipIds: migratedProject.tracks[0]?.clips[0]?.id ? [migratedProject.tracks[0].clips[0].id] : [],
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  renameProject: (name) => {
    set((state) => {
      const nextName = name.trim() || "새 프로젝트";
      if (nextName === state.project.name) return state;
      return commitProjectChange(state, touch({ ...state.project, name: nextName }));
    });
  },

  duplicateProject: () => {
    const source = get().project;
    const project = cloneProject(source, `${source.name} 복사본`);
    set({
      project,
      mode: project.lessonId ? "lesson" : "studio",
      isPlaying: false,
      currentBeat: 0,
      lcdMode: "beats",
      isRecording: false,
      masterLevel: 0,
      tunerReading: undefined,
      tapTempoTimes: [],
      selectedTrackId: project.tracks[0]?.id,
      selectedClipId: project.tracks[0]?.clips[0]?.id,
      selectedClipIds: project.tracks[0]?.clips[0]?.id ? [project.tracks[0].clips[0].id] : [],
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  startLesson: (lessonId) => {
    const project = createLessonProject(lessonId);
    if (!project) return;
    set({
      project,
      mode: "lesson",
      isPlaying: false,
      currentBeat: 0,
      lcdMode: "beats",
      isRecording: false,
      masterLevel: 0,
      tunerReading: undefined,
      tapTempoTimes: [],
      selectedTrackId: project.tracks[0]?.id,
      selectedClipId: project.tracks[0]?.clips[0]?.id,
      selectedClipIds: project.tracks[0]?.clips[0]?.id ? [project.tracks[0].clips[0].id] : [],
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  startAssignment: (assignment) => {
    const lessonProject = assignment.lessonId ? createLessonProject(assignment.lessonId) : undefined;
    const project = lessonProject ?? createInitialProject();
    const nextProject = normalizeProject({
      ...project,
      id: makeId("project"),
      name: assignment.title,
      assignmentId: assignment.id,
      classId: assignment.classId,
      lessonId: assignment.lessonId,
      createdAt: now(),
      updatedAt: now()
    });
    set({
      project: nextProject,
      mode: assignment.lessonId ? "lesson" : "studio",
      isPlaying: false,
      currentBeat: 0,
      lcdMode: "beats",
      isRecording: false,
      masterLevel: 0,
      tunerReading: undefined,
      tapTempoTimes: [],
      selectedTrackId: nextProject.tracks[0]?.id,
      selectedClipId: nextProject.tracks[0]?.clips[0]?.id,
      selectedClipIds: nextProject.tracks[0]?.clips[0]?.id ? [nextProject.tracks[0].clips[0].id] : [],
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  refreshLessonProgress: () => {
    const state = get();
    const lesson = getLessonById(state.project.lessonId);
    if (!lesson) return;

    const { results } = summarizeLesson(state.project, lesson);
    const previous = state.project.lessonProgress ?? {};
    const next = results.reduce<Project["lessonProgress"]>((progress, result) => {
      if (!progress) return progress;
      const old = previous[result.missionId];
      progress[result.missionId] = {
        completed: result.completed,
        progress: result.progress,
        target: result.target,
        completedAt: result.completed ? old?.completedAt ?? now() : undefined
      };
      return progress;
    }, {});

    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    set({ project: touch({ ...state.project, lessonProgress: next }) });
  },

  setMode: (mode) => set({ mode }),

  setHydrated: (hydrated) => set({ hydrated }),

  undo: () => {
    set((state) => {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) return state;
      const project = snapshotProject(previous);
      return {
        project,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: pushHistory(state.redoStack, state.project),
        pendingHistory: undefined,
        ...getValidSelection(project, state.selectedTrackId, state.selectedClipId, state.selectedClipIds)
      };
    });
  },

  redo: () => {
    set((state) => {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) return state;
      const project = snapshotProject(next);
      return {
        project,
        undoStack: pushHistory(state.undoStack, state.project),
        redoStack: state.redoStack.slice(0, -1),
        pendingHistory: undefined,
        ...getValidSelection(project, state.selectedTrackId, state.selectedClipId, state.selectedClipIds)
      };
    });
  },

  beginHistorySnapshot: () => {
    set((state) => {
      if (state.pendingHistory) return state;
      return { pendingHistory: snapshotProject(state.project) };
    });
  },

  commitHistorySnapshot: () => {
    set((state) => {
      if (!state.pendingHistory) return state;
      if (sameProject(state.pendingHistory, state.project)) {
        return { pendingHistory: undefined };
      }
      return {
        undoStack: pushHistory(state.undoStack, state.pendingHistory),
        redoStack: [],
        pendingHistory: undefined
      };
    });
  },

  setSnapBeats: (snapBeats) => set({ snapBeats }),

  setTimelineZoom: (timelineZoom) => set({ timelineZoom: clamp(timelineZoom, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM) }),

  setPreventClipOverlap: (preventClipOverlap) => set({ preventClipOverlap }),

  setCycleRange: (startBeat, endBeat, options) => {
    set((state) => {
      const range =
        options?.snap === false
          ? {
              start: Math.max(0, Math.min(startBeat, endBeat)),
              end: Math.max(Math.max(startBeat, endBeat), Math.max(0, Math.min(startBeat, endBeat)) + 0.25)
            }
          : normalizeCycleRange(startBeat, endBeat, state.snapBeats);
      if (
        state.project.cycleStart === range.start &&
        state.project.cycleEnd === range.end &&
        state.project.cycleEnabled === true
      ) {
        return state;
      }
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          cycleStart: range.start,
          cycleEnd: range.end,
          cycleEnabled: true
        }),
        undefined,
        options
      );
    });
  },

  toggleCycle: (enabled) => {
    set((state) => {
      const nextEnabled = enabled ?? !state.project.cycleEnabled;
      if (state.project.cycleEnabled === nextEnabled) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          cycleStart: state.project.cycleStart ?? 0,
          cycleEnd: Math.max((state.project.cycleStart ?? 0) + 0.25, state.project.cycleEnd ?? 8),
          cycleEnabled: nextEnabled
        })
      );
    });
  },

  cycleLcdMode: () => set((state) => ({ lcdMode: nextLcdMode(state.lcdMode) })),

  setRecording: (isRecording) => set({ isRecording }),

  toggleMetronome: (metronomeOn) => {
    set((state) => {
      const nextMetronomeOn = metronomeOn ?? !state.project.metronomeOn;
      if (state.project.metronomeOn === nextMetronomeOn) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          metronomeOn: nextMetronomeOn
        })
      );
    });
  },

  setCountInBars: (countInBars) => {
    set((state) => {
      const nextCountInBars = normalizeCountInBars(countInBars);
      if (state.project.countInBars === nextCountInBars) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          countInBars: nextCountInBars
        })
      );
    });
  },

  setProjectKey: (key) => {
    set((state) => {
      const nextKey = normalizeProjectKey(key);
      if (state.project.key === nextKey) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          key: nextKey
        })
      );
    });
  },

  setTimeSignature: (timeSignature) => {
    set((state) => {
      const nextTimeSignature = normalizeTimeSignature(timeSignature);
      if (state.project.timeSignature[0] === nextTimeSignature[0] && state.project.timeSignature[1] === nextTimeSignature[1]) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          timeSignature: nextTimeSignature
        })
      );
    });
  },

  setMasterVolume: (masterVolume) => {
    set((state) => {
      const nextMasterVolume = normalizeMasterVolume(masterVolume);
      if (state.project.masterVolume === nextMasterVolume) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          masterVolume: nextMasterVolume
        })
      );
    });
  },

  setMasterLevel: (masterLevel) => set({ masterLevel: clamp(masterLevel, 0, 1) }),

  setTunerReading: (tunerReading) => set({ tunerReading }),

  tapTempo: (timestampMs = Date.now()) => {
    set((state) => {
      const recentTaps = [...state.tapTempoTimes, timestampMs]
        .filter((timestamp) => timestampMs - timestamp <= 3000)
        .slice(-5);
      const bpm = estimateTapTempo(recentTaps);
      if (!bpm || bpm === state.project.bpm) {
        return { tapTempoTimes: recentTaps };
      }
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          bpm
        }),
        { tapTempoTimes: recentTaps }
      );
    });
  },

  addTrack: (type = "instrument", name) => {
    const state = get();
    const track = createTrack(type, state.project.tracks.length, name);
    set(
      commitProjectChange(state, touch({ ...state.project, tracks: [...state.project.tracks, track] }), {
        selectedTrackId: track.id,
        selectedClipId: undefined,
        selectedClipIds: []
      })
    );
    return track.id;
  },

  renameTrack: (trackId, name) => {
    set((state) => {
      const track = state.project.tracks.find((item) => item.id === trackId);
      if (!track || track.name === name) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) => (item.id === trackId ? { ...item, name } : item))
        })
      );
    });
  },

  duplicateTrack: (trackId) => {
    let duplicatedTrackId: string | undefined;
    set((state) => {
      const track = state.project.tracks.find((item) => item.id === trackId);
      if (!track) return state;

      duplicatedTrackId = makeId("track");
      const duplicatedTrack: Track = {
        ...track,
        id: duplicatedTrackId,
        name: `${track.name} 복사`,
        clips: track.clips.map((clip) => ({
          ...clip,
          id: makeId("clip"),
          trackId: duplicatedTrackId!,
          locked: false,
          notes: clip.notes?.map((note) => ({ ...note, id: makeId("note") }))
        }))
      };

      return commitProjectChange(
        state,
        touch({ ...state.project, tracks: [...state.project.tracks, duplicatedTrack] }),
        {
          selectedTrackId: duplicatedTrack.id,
          selectedClipId: duplicatedTrack.clips[0]?.id,
          selectedClipIds: duplicatedTrack.clips[0]?.id ? [duplicatedTrack.clips[0].id] : []
        }
      );
    });
    return duplicatedTrackId;
  },

  removeTrack: (trackId) => {
    set((state) => {
      if (state.project.tracks.length <= 1) return state;
      const tracks = state.project.tracks.filter((track) => track.id !== trackId);
      if (tracks.length === state.project.tracks.length) return state;
      return commitProjectChange(state, touch({ ...state.project, tracks }), {
        selectedTrackId: state.selectedTrackId === trackId ? tracks[0]?.id : state.selectedTrackId,
        selectedClipId: findClip({ ...state.project, tracks }, state.selectedClipId)?.id,
        selectedClipIds: getValidClipIds({ ...state.project, tracks }, state.selectedClipIds)
      });
    });
  },

  addClip: (trackId, clipDraft) => {
    const id = clipDraft.id ?? makeId("clip");
    set((state) => {
      const targetTrack = state.project.tracks.find((track) => track.id === trackId);
      if (!targetTrack) return state;
      const lengthBeats = Math.max(0.25, snapBeat(clipDraft.lengthBeats, state.snapBeats));
      const startBeat = state.preventClipOverlap
        ? resolveNonOverlappingStart(targetTrack.clips, undefined, clipDraft.startBeat, lengthBeats, state.snapBeats)
        : snapBeat(clipDraft.startBeat, state.snapBeats);
      const clip: Clip = {
        ...clipDraft,
        id,
        trackId,
        startBeat,
        lengthBeats
      };
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((track) =>
            track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track
          )
        }),
        {
          selectedTrackId: trackId,
          selectedClipId: clip.id,
          selectedClipIds: [clip.id]
        }
      );
    });
    return id;
  },

  addLoopClip: (loopId, trackId, startBeat = 0) => {
    const loop = getLoopById(loopId) ?? LOOP_LIBRARY[0];
    const state = get();
    const match = loopMatchSummary(loop, state.project);
    const targetTrackId =
      trackId ??
      state.selectedTrackId ??
      state.project.tracks.find((track) => track.type === loop.trackType)?.id ??
      get().addTrack(loop.trackType, loopCategoryLabel(loop.category));

    return get().addClip(targetTrackId, {
      type: "loop",
      name: loop.name,
      startBeat,
      lengthBeats: loop.lengthBeats * 2,
      color: loop.color,
      loopId,
      loopEnabled: true,
      instructions: [match.needsTempoMatch ? match.tempoLabel : undefined, match.needsKeyMatch ? match.keyLabel : undefined]
        .filter(Boolean)
        .join(" | ") || undefined
    });
  },

  addMidiClip: (trackId, startBeat = 0) => {
    const state = get();
    const targetTrackId =
      trackId ??
      state.selectedTrackId ??
      state.project.tracks.find((track) => track.type === "instrument")?.id ??
      get().addTrack("instrument", "건반");

    return get().addClip(targetTrackId, {
      type: "midi",
      name: "미디 클립",
      startBeat,
      lengthBeats: 16,
      color: "#a78bfa",
      notes: []
    });
  },

  addAudioClip: (trackId, startBeat, name, audioUrl, durationSeconds, audioAssetId) => {
    const state = get();
    const selectedTrack = state.project.tracks.find((track) => track.id === state.selectedTrackId);
    const targetTrackId =
      trackId ??
      (selectedTrack?.type === "audio" || selectedTrack?.role === "recording" ? selectedTrack.id : undefined) ??
      state.project.tracks.find((track) => track.type === "audio" || track.role === "recording")?.id ??
      get().addTrack("audio", "녹음");
    const lengthBeats = Math.max(1, snapBeat(durationSeconds / (60 / state.project.bpm), state.snapBeats));

    return get().addClip(targetTrackId, {
      type: "audio",
      name,
      startBeat,
      lengthBeats,
      color: "#4ade80",
      audioUrl,
      audioAssetId,
      trimStartSeconds: 0,
      trimEndSeconds: 0,
      gain: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0
    });
  },

  updateClipAudioSettings: (clipId, settings) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip || clip.type !== "audio" || clip.locked) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          trimStartSeconds:
            settings.trimStartSeconds === undefined
              ? item.trimStartSeconds
              : nonNegativeNumber(settings.trimStartSeconds, item.trimStartSeconds ?? 0),
          trimEndSeconds:
            settings.trimEndSeconds === undefined
              ? item.trimEndSeconds
              : nonNegativeNumber(settings.trimEndSeconds, item.trimEndSeconds ?? 0),
          gain: settings.gain === undefined ? item.gain : clampedNumber(settings.gain, 0, 8, item.gain ?? 1),
          fadeInSeconds:
            settings.fadeInSeconds === undefined
              ? item.fadeInSeconds
              : nonNegativeNumber(settings.fadeInSeconds, item.fadeInSeconds ?? 0),
          fadeOutSeconds:
            settings.fadeOutSeconds === undefined
              ? item.fadeOutSeconds
              : nonNegativeNumber(settings.fadeOutSeconds, item.fadeOutSeconds ?? 0),
          fadeInBeats:
            settings.fadeInBeats === undefined ? item.fadeInBeats : nonNegativeNumber(settings.fadeInBeats, item.fadeInBeats ?? 0),
          fadeOutBeats:
            settings.fadeOutBeats === undefined ? item.fadeOutBeats : nonNegativeNumber(settings.fadeOutBeats, item.fadeOutBeats ?? 0)
        }))
      );
    });
  },

  splitSelectedAudioClip: () => {
    set((state) => {
      const selectedClipId = state.selectedClipId;
      const track = state.project.tracks.find((item) => item.clips.some((clip) => clip.id === selectedClipId));
      const clip = track?.clips.find((item) => item.id === selectedClipId);
      if (!track || !clip || clip.type !== "audio" || clip.locked) return state;

      const snappedBeat = snapBeat(state.currentBeat, state.snapBeats);
      const rawBeat = state.currentBeat;
      const splitBeat =
        snappedBeat > clip.startBeat && snappedBeat < clip.startBeat + clip.lengthBeats ? snappedBeat : rawBeat;
      const leftBeats = splitBeat - clip.startBeat;
      const rightBeats = clip.startBeat + clip.lengthBeats - splitBeat;
      if (leftBeats < 0.25 || rightBeats < 0.25) return state;

      const rightClip: Clip = {
        ...clip,
        id: makeId("clip"),
        name: `${clip.name} 분할`,
        startBeat: splitBeat,
        lengthBeats: rightBeats,
        trimStartSeconds: (clip.trimStartSeconds ?? 0) + leftBeats * (60 / state.project.bpm)
      };
      const leftClip: Clip = {
        ...clip,
        lengthBeats: leftBeats
      };

      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) =>
            item.id === track.id
              ? {
                  ...item,
                  clips: item.clips.flatMap((current) => (current.id === clip.id ? [leftClip, rightClip] : [current]))
                }
              : item
          )
        }),
        {
          selectedTrackId: track.id,
          selectedClipId: rightClip.id,
          selectedClipIds: [rightClip.id]
        }
      );
    });
  },

  moveClip: (clipId, startBeat, targetTrackId, options) => {
    set((state) => {
      const sourceTrack = state.project.tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
      const clip = sourceTrack?.clips.find((item) => item.id === clipId);
      if (!sourceTrack || !clip) return state;
      if (clip.locked) return state;
      const nextTrackId = targetTrackId ?? sourceTrack.id;
      const targetTrack = state.project.tracks.find((track) => track.id === nextTrackId);
      if (!targetTrack) return state;
      const nextStartBeat = state.preventClipOverlap
        ? options?.snap === false
          ? hasClipOverlap(targetTrack.clips, clipId, Math.max(0, startBeat), clip.lengthBeats)
            ? resolveNonOverlappingStart(targetTrack.clips, clipId, startBeat, clip.lengthBeats, state.snapBeats)
            : Math.max(0, startBeat)
          : resolveNonOverlappingStart(targetTrack.clips, clipId, startBeat, clip.lengthBeats, state.snapBeats)
        : snapWithOptions(startBeat, state.snapBeats, options);
      if (nextTrackId === sourceTrack.id && nextStartBeat === clip.startBeat) return state;

      if (nextTrackId !== sourceTrack.id) {
        const movedClip = { ...clip, trackId: nextTrackId, startBeat: nextStartBeat };
        return commitProjectChange(
          state,
          touch({
            ...state.project,
            tracks: state.project.tracks.map((track) => {
              if (track.id === sourceTrack.id) {
                return { ...track, clips: track.clips.filter((item) => item.id !== clipId) };
              }
              if (track.id === nextTrackId) {
                return { ...track, clips: [...track.clips, movedClip] };
              }
              return track;
            })
          }),
          {
            selectedTrackId: nextTrackId,
            selectedClipId: clipId,
            selectedClipIds: [clipId]
          },
          options
        );
      }

      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({ ...item, startBeat: nextStartBeat })),
        undefined,
        options
      );
    });
  },

  moveSelectedClips: (deltaBeats, options) => {
    set((state) => {
      const selectedIds = getValidClipIds(state.project, state.selectedClipIds);
      if (selectedIds.length === 0 || deltaBeats === 0) return state;
      const selectedSet = new Set(selectedIds);
      let changed = false;
      const tracks = state.project.tracks.map((track) => {
        const obstacles = track.clips.filter((clip) => !selectedSet.has(clip.id));
        let trackChanged = false;
        const clips = track.clips.map((clip) => {
          if (!selectedSet.has(clip.id) || clip.locked) return clip;
          const desiredStart = clip.startBeat + deltaBeats;
          const nextStart = state.preventClipOverlap
            ? options?.snap === false
              ? hasClipOverlap(obstacles, clip.id, Math.max(0, desiredStart), clip.lengthBeats)
                ? resolveNonOverlappingStart([...obstacles, clip], clip.id, desiredStart, clip.lengthBeats, state.snapBeats)
                : Math.max(0, desiredStart)
              : resolveNonOverlappingStart([...obstacles, clip], clip.id, desiredStart, clip.lengthBeats, state.snapBeats)
            : snapWithOptions(desiredStart, state.snapBeats, options);
          if (nextStart === clip.startBeat) return clip;
          changed = true;
          trackChanged = true;
          return { ...clip, startBeat: nextStart };
        });
        return trackChanged ? { ...track, clips } : track;
      });
      if (!changed) return state;
      return commitProjectChange(
        state,
        touch({ ...state.project, tracks }),
        {
          selectedClipIds: selectedIds,
          selectedClipId: selectedIds[selectedIds.length - 1]
        },
        options
      );
    });
  },

  resizeClip: (clipId, lengthBeats, options) => {
    set((state) => {
      const track = state.project.tracks.find((item) => item.clips.some((clip) => clip.id === clipId));
      const clip = track?.clips.find((item) => item.id === clipId);
      if (!track || !clip || clip.locked) return state;
      const nextLength = state.preventClipOverlap
        ? options?.snap === false
          ? clamp(
              Math.max(0.25, lengthBeats),
              0.25,
              Math.max(
                0.25,
                track.clips
                  .filter((item) => item.id !== clip.id && item.startBeat >= clip.startBeat)
                  .reduce<number | undefined>(
                    (nearest, item) => (nearest === undefined ? item.startBeat : Math.min(nearest, item.startBeat)),
                    undefined
                  ) ?? Number.POSITIVE_INFINITY
              ) - clip.startBeat
            )
          : resolveNonOverlappingLength(track, clip, lengthBeats, state.snapBeats)
        : Math.max(0.25, snapWithOptions(lengthBeats, state.snapBeats, options));
      if (nextLength === clip.lengthBeats) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          lengthBeats: nextLength
        })),
        undefined,
        options
      );
    });
  },

  resizeClipStart: (clipId, startBeat, options) => {
    set((state) => {
      const track = state.project.tracks.find((item) => item.clips.some((clip) => clip.id === clipId));
      const clip = track?.clips.find((item) => item.id === clipId);
      if (!track || !clip || clip.locked) return state;
      const clipEnd = clip.startBeat + clip.lengthBeats;
      let nextStart = clamp(snapWithOptions(startBeat, state.snapBeats, options), 0, clipEnd - 0.25);

      if (state.preventClipOverlap) {
        const previousEnd = track.clips
          .filter((item) => item.id !== clip.id && item.startBeat < clipEnd)
          .reduce((max, item) => Math.max(max, item.startBeat + item.lengthBeats), 0);
        nextStart = clamp(Math.max(nextStart, previousEnd), 0, clipEnd - 0.25);
      }

      const nextLength = Math.max(0.25, clipEnd - nextStart);
      if (nextStart === clip.startBeat && nextLength === clip.lengthBeats) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          startBeat: nextStart,
          lengthBeats: nextLength
        })),
        undefined,
        options
      );
    });
  },

  setClipLoopEnabled: (clipId, loopEnabled, options) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip || clip.locked || clip.loopEnabled === loopEnabled) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({ ...item, loopEnabled })),
        undefined,
        options
      );
    });
  },

  duplicateClip: (clipId) => {
    let duplicatedId: string | undefined;
    set((state) => {
      const track = state.project.tracks.find((item) => item.clips.some((clip) => clip.id === clipId));
      const clip = track?.clips.find((item) => item.id === clipId);
      if (!track || !clip) return state;

      duplicatedId = makeId("clip");
      const startBeat = state.preventClipOverlap
        ? resolveNonOverlappingStart(track.clips, undefined, clip.startBeat + clip.lengthBeats, clip.lengthBeats, state.snapBeats)
        : snapBeat(clip.startBeat + clip.lengthBeats, state.snapBeats);
      const duplicatedClip: Clip = {
        ...clip,
        id: duplicatedId,
        trackId: track.id,
        name: `${clip.name} 복사`,
        startBeat,
        locked: false,
        notes: clip.notes?.map((note) => ({ ...note, id: makeId("note") }))
      };

      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) =>
            item.id === track.id ? { ...item, clips: [...item.clips, duplicatedClip] } : item
          )
        }),
        {
          selectedTrackId: track.id,
          selectedClipId: duplicatedId,
          selectedClipIds: duplicatedId ? [duplicatedId] : []
        }
      );
    });
    return duplicatedId;
  },

  removeClip: (clipId) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (clip?.locked) return state;
      if (!clip) return state;
      return commitProjectChange(state, touch({
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((item) => item.id !== clipId)
          }))
        }), {
        selectedClipId: state.selectedClipId === clipId ? undefined : state.selectedClipId,
        selectedClipIds: state.selectedClipIds.filter((id) => id !== clipId)
      });
    });
  },

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  selectClip: (clipId, additive = false) => {
    set((state) => {
      if (!clipId) {
        return { selectedClipId: undefined, selectedClipIds: [] };
      }
      const clip = findClip(state.project, clipId);
      if (!clip) return state;
      if (!additive) {
        return {
          selectedTrackId: clip.trackId,
          selectedClipId: clip.id,
          selectedClipIds: [clip.id]
        };
      }

      const baseSelection = state.selectedClipIds.length
        ? state.selectedClipIds
        : state.selectedClipId
          ? [state.selectedClipId]
          : [];
      const nextSelectedClipIds = baseSelection.includes(clip.id)
        ? baseSelection.filter((id) => id !== clip.id)
        : [...baseSelection, clip.id];
      const nextActiveClipId = nextSelectedClipIds[nextSelectedClipIds.length - 1];
      const nextActiveClip = findClip(state.project, nextActiveClipId);
      return {
        selectedTrackId: nextActiveClip?.trackId ?? clip.trackId,
        selectedClipId: nextActiveClipId,
        selectedClipIds: nextSelectedClipIds
      };
    });
  },
  selectClips: (clipIds) => {
    set((state) => {
      const selectedClipIds = getValidClipIds(state.project, clipIds);
      const selectedClipId = selectedClipIds[selectedClipIds.length - 1];
      const selectedClip = findClip(state.project, selectedClipId);
      return {
        selectedTrackId: selectedClip?.trackId ?? state.selectedTrackId,
        selectedClipId,
        selectedClipIds
      };
    });
  },

  setBpm: (bpm) => {
    set((state) => {
      const nextBpm = Math.round(Math.max(40, Math.min(220, bpm)));
      if (nextBpm === state.project.bpm) return state;
      return commitProjectChange(state, touch({ ...state.project, bpm: nextBpm }));
    });
  },

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentBeat: (beat) => set({ currentBeat: Math.max(0, beat) }),

  toggleMute: (trackId) => {
    set((state) => {
      if (!state.project.tracks.some((track) => track.id === trackId)) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((track) =>
            track.id === trackId ? { ...track, muted: !track.muted } : track
          )
        })
      );
    });
  },

  toggleSolo: (trackId) => {
    set((state) => {
      if (!state.project.tracks.some((track) => track.id === trackId)) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((track) => (track.id === trackId ? { ...track, solo: !track.solo } : track))
        })
      );
    });
  },

  setTrackVolume: (trackId, volume) => {
    set((state) => {
      const nextVolume = Math.max(0, Math.min(1, volume));
      const track = state.project.tracks.find((item) => item.id === trackId);
      if (!track || track.volume === nextVolume) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) =>
            item.id === trackId ? { ...item, volume: nextVolume } : item
          )
        })
      );
    });
  },

  setTrackPan: (trackId, pan) => {
    set((state) => {
      const nextPan = Math.max(-1, Math.min(1, pan));
      const track = state.project.tracks.find((item) => item.id === trackId);
      if (!track || track.pan === nextPan) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) =>
            item.id === trackId ? { ...item, pan: nextPan } : item
          )
        })
      );
    });
  },

  setTrackInstrument: (trackId, instrumentId) => {
    set((state) => {
      const track = state.project.tracks.find((item) => item.id === trackId);
      if (!track || track.type === "audio") return state;
      const nextInstrumentId = normalizeInstrumentId(instrumentId, track);
      if (track.instrumentId === nextInstrumentId) return state;
      return commitProjectChange(
        state,
        touch({
          ...state.project,
          tracks: state.project.tracks.map((item) =>
            item.id === trackId ? { ...item, instrumentId: nextInstrumentId } : item
          )
        })
      );
    });
  },

  addNote: (clipId, note) => {
    const id = makeId("note");
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip || clip.type !== "midi" || clip.locked) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => {
          const nextStart = clamp(snapBeat(note.startBeat, state.snapBeats), 0, 256);
          const nextDuration = Math.max(0.25, snapBeat(note.durationBeats, state.snapBeats));
          const nextLength = Math.max(item.lengthBeats, nextStart + nextDuration);
          return {
            ...item,
            lengthBeats: nextLength,
            notes: [
              ...(item.notes ?? []),
              {
                ...note,
                id,
                startBeat: nextStart,
                durationBeats: nextDuration
              }
            ]
          };
        })
      );
    });
    return id;
  },

  addNotes: (clipId, notes, options) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip || clip.type !== "midi" || clip.locked || notes.length === 0) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          lengthBeats: Math.max(
            item.lengthBeats,
            ...notes.map((note) =>
              options?.snap === false
                ? Math.max(0.25, note.startBeat + note.durationBeats)
                : snapBeat(note.startBeat + note.durationBeats, state.snapBeats)
            )
          ),
          notes: [
            ...(item.notes ?? []),
            ...notes.map((note) => ({
              ...note,
              id: makeId("note"),
              startBeat: clamp(options?.snap === false ? note.startBeat : snapBeat(note.startBeat, state.snapBeats), 0, 256),
              durationBeats: Math.max(
                options?.snap === false ? 0.0625 : 0.25,
                options?.snap === false ? note.durationBeats : snapBeat(note.durationBeats, state.snapBeats)
              ),
              velocity: clamp(note.velocity, 0, 1)
            }))
          ]
        })),
        undefined,
        options
      );
    });
  },

  moveNote: (clipId, noteId, startBeat, pitch, options) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      const note = clip?.notes?.find((item) => item.id === noteId);
      if (!clip || clip.locked || !note) return state;
      const nextStart = clamp(snapBeat(startBeat, state.snapBeats), 0, 256);
      const nextPitch = Math.max(24, Math.min(96, pitch));
      const nextLength = Math.max(clip.lengthBeats, nextStart + note.durationBeats);
      if (nextStart === note.startBeat && nextPitch === note.pitch && nextLength === clip.lengthBeats) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          lengthBeats: nextLength,
          notes: (item.notes ?? []).map((currentNote) =>
            currentNote.id === noteId ? { ...currentNote, startBeat: nextStart, pitch: nextPitch } : currentNote
          )
        })),
        undefined,
        options
      );
    });
  },

  resizeNote: (clipId, noteId, durationBeats, options) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      const note = clip?.notes?.find((item) => item.id === noteId);
      if (!clip || clip.locked || !note) return state;
      const nextDuration = clamp(
        Math.max(0.25, snapBeat(durationBeats, state.snapBeats)),
        0.25,
        Math.max(0.25, 256 - note.startBeat)
      );
      const nextLength = Math.max(clip.lengthBeats, note.startBeat + nextDuration);
      if (nextDuration === note.durationBeats && nextLength === clip.lengthBeats) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          lengthBeats: nextLength,
          notes: (item.notes ?? []).map((currentNote) =>
            currentNote.id === noteId ? { ...currentNote, durationBeats: nextDuration } : currentNote
          )
        })),
        undefined,
        options
      );
    });
  },

  removeNote: (clipId, noteId) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip?.notes?.some((note) => note.id === noteId)) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
          notes: (item.notes ?? []).filter((note) => note.id !== noteId)
        }))
      );
    });
  }
}));
