import { create } from "zustand";
import { LOOP_LIBRARY, getLoopById } from "../data/loops";
import type { Clip, MidiNote, Project, Track, TrackType } from "../types/project";
import { snapBeat } from "../utils/timeline";

type ClipDraft = Omit<Clip, "id" | "trackId"> & Partial<Pick<Clip, "id" | "trackId">>;

type DawState = {
  project: Project;
  isPlaying: boolean;
  currentBeat: number;
  selectedTrackId?: string;
  selectedClipId?: string;
  hydrated: boolean;
  createProject: (name?: string) => void;
  loadProject: (project: Project) => void;
  setHydrated: (hydrated: boolean) => void;
  addTrack: (type?: TrackType, name?: string) => string;
  renameTrack: (trackId: string, name: string) => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: ClipDraft) => string;
  addLoopClip: (loopId: string, trackId?: string, startBeat?: number) => string;
  addMidiClip: (trackId?: string, startBeat?: number) => string;
  moveClip: (clipId: string, startBeat: number, targetTrackId?: string) => void;
  resizeClip: (clipId: string, lengthBeats: number) => void;
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
  moveNote: (clipId: string, noteId: string, startBeat: number, pitch: number) => void;
  resizeNote: (clipId: string, noteId: string, durationBeats: number) => void;
  removeNote: (clipId: string, noteId: string) => void;
};

const TRACK_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#4ade80", "#fb7185", "#eab308"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return Date.now();
}

function touch(project: Project): Project {
  return { ...project, updatedAt: now() };
}

function createTrack(type: TrackType, index: number, name?: string): Track {
  const label = type === "drum" ? "Drums" : type === "audio" ? "Audio" : "Instrument";
  return {
    id: makeId("track"),
    name: name ?? `${label} ${index + 1}`,
    type,
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
    name: "Untitled Session",
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [drums, bass, keys],
    createdAt: timestamp,
    updatedAt: timestamp
  };
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

export const useDawStore = create<DawState>((set, get) => ({
  project: createInitialProject(),
  isPlaying: false,
  currentBeat: 0,
  selectedTrackId: undefined,
  selectedClipId: undefined,
  hydrated: false,

  createProject: (name = "Untitled Session") => {
    const project = createInitialProject();
    set({
      project: { ...project, id: makeId("project"), name },
      isPlaying: false,
      currentBeat: 0,
      selectedTrackId: undefined,
      selectedClipId: undefined
    });
  },

  loadProject: (project) => {
    set({
      project,
      isPlaying: false,
      currentBeat: 0,
      selectedTrackId: project.tracks[0]?.id,
      selectedClipId: project.tracks[0]?.clips[0]?.id
    });
  },

  setHydrated: (hydrated) => set({ hydrated }),

  addTrack: (type = "instrument", name) => {
    const state = get();
    const track = createTrack(type, state.project.tracks.length, name);
    set({
      project: touch({ ...state.project, tracks: [...state.project.tracks, track] }),
      selectedTrackId: track.id,
      selectedClipId: undefined
    });
    return track.id;
  },

  renameTrack: (trackId, name) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) => (track.id === trackId ? { ...track, name } : track))
      })
    }));
  },

  removeTrack: (trackId) => {
    set((state) => {
      const tracks = state.project.tracks.filter((track) => track.id !== trackId);
      return {
        project: touch({ ...state.project, tracks }),
        selectedTrackId: state.selectedTrackId === trackId ? tracks[0]?.id : state.selectedTrackId,
        selectedClipId: findClip({ ...state.project, tracks }, state.selectedClipId)?.id
      };
    });
  },

  addClip: (trackId, clipDraft) => {
    const clip: Clip = {
      ...clipDraft,
      id: clipDraft.id ?? makeId("clip"),
      trackId,
      startBeat: snapBeat(clipDraft.startBeat),
      lengthBeats: Math.max(0.25, snapBeat(clipDraft.lengthBeats))
    };
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track
        )
      }),
      selectedTrackId: trackId,
      selectedClipId: clip.id
    }));
    return clip.id;
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

  moveClip: (clipId, startBeat, targetTrackId) => {
    set((state) => {
      const sourceTrack = state.project.tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
      const clip = sourceTrack?.clips.find((item) => item.id === clipId);
      if (!sourceTrack || !clip) return state;

      if (targetTrackId && targetTrackId !== sourceTrack.id) {
        const movedClip = { ...clip, trackId: targetTrackId, startBeat: snapBeat(startBeat) };
        return {
          project: touch({
            ...state.project,
            tracks: state.project.tracks.map((track) => {
              if (track.id === sourceTrack.id) {
                return { ...track, clips: track.clips.filter((item) => item.id !== clipId) };
              }
              if (track.id === targetTrackId) {
                return { ...track, clips: [...track.clips, movedClip] };
              }
              return track;
            })
          }),
          selectedTrackId: targetTrackId,
          selectedClipId: clipId
        };
      }

      return {
        project: updateClip(state.project, clipId, (item) => ({ ...item, startBeat: snapBeat(startBeat) }))
      };
    });
  },

  resizeClip: (clipId, lengthBeats) => {
    set((state) => ({
      project: updateClip(state.project, clipId, (clip) => ({
        ...clip,
        lengthBeats: Math.max(0.25, snapBeat(lengthBeats))
      }))
    }));
  },

  removeClip: (clipId) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => clip.id !== clipId)
        }))
      }),
      selectedClipId: state.selectedClipId === clipId ? undefined : state.selectedClipId
    }));
  },

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  selectClip: (clipId) => set({ selectedClipId: clipId }),

  setBpm: (bpm) => {
    set((state) => ({
      project: touch({ ...state.project, bpm: Math.round(Math.max(40, Math.min(220, bpm))) })
    }));
  },

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentBeat: (beat) => set({ currentBeat: Math.max(0, beat) }),

  toggleMute: (trackId) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId ? { ...track, muted: !track.muted } : track
        )
      })
    }));
  },

  toggleSolo: (trackId) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) => (track.id === trackId ? { ...track, solo: !track.solo } : track))
      })
    }));
  },

  setTrackVolume: (trackId, volume) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId ? { ...track, volume: Math.max(0, Math.min(1, volume)) } : track
        )
      })
    }));
  },

  setTrackPan: (trackId, pan) => {
    set((state) => ({
      project: touch({
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id === trackId ? { ...track, pan: Math.max(-1, Math.min(1, pan)) } : track
        )
      })
    }));
  },

  addNote: (clipId, note) => {
    const id = makeId("note");
    set((state) => ({
      project: updateClip(state.project, clipId, (clip) => ({
        ...clip,
        notes: [
          ...(clip.notes ?? []),
          {
            ...note,
            id,
            startBeat: snapBeat(note.startBeat),
            durationBeats: Math.max(0.25, snapBeat(note.durationBeats))
          }
        ]
      }))
    }));
    return id;
  },

  moveNote: (clipId, noteId, startBeat, pitch) => {
    set((state) => ({
      project: updateClip(state.project, clipId, (clip) => ({
        ...clip,
        notes: (clip.notes ?? []).map((note) =>
          note.id === noteId
            ? { ...note, startBeat: snapBeat(startBeat), pitch: Math.max(24, Math.min(96, pitch)) }
            : note
        )
      }))
    }));
  },

  resizeNote: (clipId, noteId, durationBeats) => {
    set((state) => ({
      project: updateClip(state.project, clipId, (clip) => ({
        ...clip,
        notes: (clip.notes ?? []).map((note) =>
          note.id === noteId ? { ...note, durationBeats: Math.max(0.25, snapBeat(durationBeats)) } : note
        )
      }))
    }));
  },

  removeNote: (clipId, noteId) => {
    set((state) => ({
      project: updateClip(state.project, clipId, (clip) => ({
        ...clip,
        notes: (clip.notes ?? []).filter((note) => note.id !== noteId)
      }))
    }));
  }
}));
