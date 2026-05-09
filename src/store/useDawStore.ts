import { create } from "zustand";
import { summarizeLesson } from "../education/evaluateMission";
import { createLessonProject, getLessonById } from "../education/lessons";
import type { StudioMode } from "../education/types";
import { LOOP_LIBRARY, getLoopById } from "../data/loops";
import { CURRENT_PROJECT_VERSION, type Clip, type MidiNote, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "../utils/id";
import { normalizeProject } from "../utils/projectMigration";
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, SNAP_BEAT, clamp, snapBeat, type SnapBeats } from "../utils/timeline";

type ClipDraft = Omit<Clip, "id" | "trackId"> & Partial<Pick<Clip, "id" | "trackId">>;
type EditOptions = { recordHistory?: boolean };
type ClipAudioSettings = Partial<
  Pick<Clip, "trimStartSeconds" | "trimEndSeconds" | "gain" | "fadeInSeconds" | "fadeOutSeconds">
>;

const HISTORY_LIMIT = 80;

type DawState = {
  project: Project;
  mode: StudioMode;
  isPlaying: boolean;
  currentBeat: number;
  selectedTrackId?: string;
  selectedClipId?: string;
  hydrated: boolean;
  undoStack: Project[];
  redoStack: Project[];
  pendingHistory?: Project;
  snapBeats: SnapBeats;
  timelineZoom: number;
  preventClipOverlap: boolean;
  createProject: (name?: string) => void;
  loadProject: (project: Project) => void;
  renameProject: (name: string) => void;
  duplicateProject: () => void;
  startLesson: (lessonId: string) => void;
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
  addTrack: (type?: TrackType, name?: string) => string;
  renameTrack: (trackId: string, name: string) => void;
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
  resizeClip: (clipId: string, lengthBeats: number, options?: EditOptions) => void;
  removeClip: (clipId: string) => void;
  selectTrack: (trackId?: string) => void;
  selectClip: (clipId?: string) => void;
  setBpm: (bpm: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentBeat: (beat: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  addNote: (clipId: string, note: Omit<MidiNote, "id">) => string;
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
  if (type === "drum" || lower.includes("beat") || lower.includes("drum")) return "beat";
  if (type === "audio" || lower.includes("record")) return "recording";
  if (lower.includes("bass")) return "bass";
  if (lower.includes("key") || lower.includes("chord") || lower.includes("pad")) return "harmony";
  return "melody";
}

function createTrack(type: TrackType, index: number, name?: string, role?: TrackRole): Track {
  const label = type === "drum" ? "Drums" : type === "audio" ? "Audio" : "Instrument";
  const trackName = name ?? `${label} ${index + 1}`;
  return {
    id: makeId("track"),
    name: trackName,
    type,
    role: role ?? inferTrackRole(type, trackName),
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
  const drums = createTrack("drum", 0, "Beat");
  const bass = createTrack("instrument", 1, "Bass");
  const keys = createTrack("instrument", 2, "Keys");

  drums.clips.push({
    id: makeId("clip"),
    trackId: drums.id,
    type: "loop",
    name: "Grid Room Kit",
    startBeat: 0,
    lengthBeats: 8,
    color: "#38bdf8",
    loopId: "drums-grid"
  });

  bass.clips.push({
    id: makeId("clip"),
    trackId: bass.id,
    type: "loop",
    name: "Midnight Bass",
    startBeat: 0,
    lengthBeats: 8,
    color: "#f59e0b",
    loopId: "bass-midnight"
  });

  keys.clips.push({
    id: makeId("clip"),
    trackId: keys.id,
    type: "midi",
    name: "Sketch Chords",
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
    name: "Untitled Session",
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [drums, bass, keys],
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

function getValidSelection(project: Project, selectedTrackId?: string, selectedClipId?: string) {
  const selectedClip = findClip(project, selectedClipId);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  return {
    selectedTrackId: selectedTrack?.id ?? selectedClip?.trackId ?? project.tracks[0]?.id,
    selectedClipId: selectedClip?.id
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
  selectedTrackId: undefined,
  selectedClipId: undefined,
  hydrated: false,
  undoStack: [],
  redoStack: [],
  pendingHistory: undefined,
  snapBeats: SNAP_BEAT,
  timelineZoom: 1,
  preventClipOverlap: true,

  createProject: (name = "Untitled Session") => {
    const project = createInitialProject();
    set({
      project: { ...project, id: makeId("project"), name },
      mode: "studio",
      isPlaying: false,
      currentBeat: 0,
      selectedTrackId: undefined,
      selectedClipId: undefined,
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
      selectedTrackId: migratedProject.tracks[0]?.id,
      selectedClipId: migratedProject.tracks[0]?.clips[0]?.id,
      undoStack: [],
      redoStack: [],
      pendingHistory: undefined
    });
  },

  renameProject: (name) => {
    set((state) => {
      const nextName = name.trim() || "Untitled Session";
      if (nextName === state.project.name) return state;
      return commitProjectChange(state, touch({ ...state.project, name: nextName }));
    });
  },

  duplicateProject: () => {
    const source = get().project;
    const project = cloneProject(source, `${source.name} Copy`);
    set({
      project,
      mode: project.lessonId ? "lesson" : "studio",
      isPlaying: false,
      currentBeat: 0,
      selectedTrackId: project.tracks[0]?.id,
      selectedClipId: project.tracks[0]?.clips[0]?.id,
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
      selectedTrackId: project.tracks[0]?.id,
      selectedClipId: project.tracks[0]?.clips[0]?.id,
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
        ...getValidSelection(project, state.selectedTrackId, state.selectedClipId)
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
        ...getValidSelection(project, state.selectedTrackId, state.selectedClipId)
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

  addTrack: (type = "instrument", name) => {
    const state = get();
    const track = createTrack(type, state.project.tracks.length, name);
    set(
      commitProjectChange(state, touch({ ...state.project, tracks: [...state.project.tracks, track] }), {
        selectedTrackId: track.id,
        selectedClipId: undefined
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

  removeTrack: (trackId) => {
    set((state) => {
      const tracks = state.project.tracks.filter((track) => track.id !== trackId);
      if (tracks.length === state.project.tracks.length) return state;
      return commitProjectChange(state, touch({ ...state.project, tracks }), {
        selectedTrackId: state.selectedTrackId === trackId ? tracks[0]?.id : state.selectedTrackId,
        selectedClipId: findClip({ ...state.project, tracks }, state.selectedClipId)?.id
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
          selectedClipId: clip.id
        }
      );
    });
    return id;
  },

  addLoopClip: (loopId, trackId, startBeat = 0) => {
    const loop = getLoopById(loopId) ?? LOOP_LIBRARY[0];
    const state = get();
    const targetTrackId =
      trackId ??
      state.selectedTrackId ??
      state.project.tracks.find((track) => track.type === loop.trackType)?.id ??
      get().addTrack(loop.trackType, loop.category);

    return get().addClip(targetTrackId, {
      type: "loop",
      name: loop.name,
      startBeat,
      lengthBeats: loop.lengthBeats * 2,
      color: loop.color,
      loopId
    });
  },

  addMidiClip: (trackId, startBeat = 0) => {
    const state = get();
    const targetTrackId =
      trackId ??
      state.selectedTrackId ??
      state.project.tracks.find((track) => track.type === "instrument")?.id ??
      get().addTrack("instrument", "Keys");

    return get().addClip(targetTrackId, {
      type: "midi",
      name: "MIDI Clip",
      startBeat,
      lengthBeats: 4,
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
      get().addTrack("audio", "Recording");
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
              : nonNegativeNumber(settings.fadeOutSeconds, item.fadeOutSeconds ?? 0)
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
        name: `${clip.name} Split`,
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
          selectedClipId: rightClip.id
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
        ? resolveNonOverlappingStart(targetTrack.clips, clipId, startBeat, clip.lengthBeats, state.snapBeats)
        : snapBeat(startBeat, state.snapBeats);
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
            selectedClipId: clipId
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

  resizeClip: (clipId, lengthBeats, options) => {
    set((state) => {
      const track = state.project.tracks.find((item) => item.clips.some((clip) => clip.id === clipId));
      const clip = track?.clips.find((item) => item.id === clipId);
      if (!track || !clip || clip.locked) return state;
      const nextLength = state.preventClipOverlap
        ? resolveNonOverlappingLength(track, clip, lengthBeats, state.snapBeats)
        : Math.max(0.25, snapBeat(lengthBeats, state.snapBeats));
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
        selectedClipId: state.selectedClipId === clipId ? undefined : state.selectedClipId
      });
    });
  },

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  selectClip: (clipId) => set({ selectedClipId: clipId }),

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

  addNote: (clipId, note) => {
    const id = makeId("note");
    set((state) => {
      const clip = findClip(state.project, clipId);
      if (!clip) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => {
          const nextStart = clamp(snapBeat(note.startBeat, state.snapBeats), 0, Math.max(0, item.lengthBeats - 0.25));
          return {
            ...item,
            notes: [
              ...(item.notes ?? []),
              {
                ...note,
                id,
                startBeat: nextStart,
                durationBeats: clamp(
                  Math.max(0.25, snapBeat(note.durationBeats, state.snapBeats)),
                  0.25,
                  Math.max(0.25, item.lengthBeats - nextStart)
                )
              }
            ]
          };
        })
      );
    });
    return id;
  },

  moveNote: (clipId, noteId, startBeat, pitch, options) => {
    set((state) => {
      const clip = findClip(state.project, clipId);
      const note = clip?.notes?.find((item) => item.id === noteId);
      if (!clip || !note) return state;
      const nextStart = clamp(snapBeat(startBeat, state.snapBeats), 0, Math.max(0, clip.lengthBeats - note.durationBeats));
      const nextPitch = Math.max(24, Math.min(96, pitch));
      if (nextStart === note.startBeat && nextPitch === note.pitch) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
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
      if (!clip || !note) return state;
      const nextDuration = clamp(
        Math.max(0.25, snapBeat(durationBeats, state.snapBeats)),
        0.25,
        Math.max(0.25, clip.lengthBeats - note.startBeat)
      );
      if (nextDuration === note.durationBeats) return state;
      return commitProjectChange(
        state,
        updateClip(state.project, clipId, (item) => ({
          ...item,
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
