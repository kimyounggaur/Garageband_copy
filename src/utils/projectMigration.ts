import { CURRENT_PROJECT_VERSION, type Clip, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "./id";

type LooseProject = Partial<Project> & {
  tracks?: Partial<Track>[];
};

const TRACK_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#4ade80", "#fb7185", "#eab308"];

function now() {
  return Date.now();
}

function inferRole(type: TrackType, name = ""): TrackRole {
  const lower = name.toLowerCase();
  if (type === "drum" || lower.includes("beat") || lower.includes("drum")) return "beat";
  if (type === "audio" || lower.includes("record")) return "recording";
  if (lower.includes("bass")) return "bass";
  if (lower.includes("chord") || lower.includes("key") || lower.includes("pad") || lower.includes("harmony")) return "harmony";
  return "melody";
}

function normalizeTrackType(value?: string): TrackType {
  if (value === "drum" || value === "audio" || value === "instrument") return value;
  return "instrument";
}

function normalizeClip(clip: Partial<Clip>, trackId: string, fallbackIndex: number): Clip {
  const type = clip.type === "audio" || clip.type === "loop" || clip.type === "midi" ? clip.type : "midi";
  return {
    id: clip.id ?? makeId("clip"),
    trackId,
    type,
    name: clip.name ?? (type === "midi" ? "MIDI Clip" : type === "loop" ? "Loop Clip" : "Audio Clip"),
    startBeat: Math.max(0, Number(clip.startBeat ?? 0)),
    lengthBeats: Math.max(0.25, Number(clip.lengthBeats ?? 4)),
    color: clip.color ?? TRACK_COLORS[fallbackIndex % TRACK_COLORS.length],
    notes: clip.notes?.map((note) => ({
      id: note.id ?? makeId("note"),
      pitch: Math.max(0, Math.min(127, Number(note.pitch ?? 60))),
      startBeat: Math.max(0, Number(note.startBeat ?? 0)),
      durationBeats: Math.max(0.25, Number(note.durationBeats ?? 0.25)),
      velocity: Math.max(0, Math.min(1, Number(note.velocity ?? 0.75)))
    })),
    audioUrl: clip.audioUrl,
    audioAssetId: clip.audioAssetId,
    loopId: clip.loopId,
    locked: clip.locked ?? false,
    instructions: clip.instructions
  };
}

function normalizeTrack(track: Partial<Track>, index: number): Track {
  const type = normalizeTrackType(track.type);
  const id = track.id ?? makeId("track");
  const name = track.name ?? (type === "drum" ? "Drums" : type === "audio" ? "Audio" : "Instrument");
  return {
    id,
    name,
    type,
    role: track.role ?? inferRole(type, name),
    volume: Math.max(0, Math.min(1, Number(track.volume ?? 0.82))),
    pan: Math.max(-1, Math.min(1, Number(track.pan ?? 0))),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    color: track.color ?? TRACK_COLORS[index % TRACK_COLORS.length],
    clips: (track.clips ?? []).map((clip, clipIndex) => normalizeClip(clip, id, clipIndex + index))
  };
}

export function normalizeProject(project: Project): Project {
  const loose = project as LooseProject;
  const timestamp = now();
  return {
    id: loose.id ?? makeId("project"),
    version: CURRENT_PROJECT_VERSION,
    name: loose.name?.trim() || "Untitled Session",
    bpm: Math.round(Math.max(40, Math.min(220, Number(loose.bpm ?? 120)))),
    timeSignature: Array.isArray(loose.timeSignature) ? loose.timeSignature : [4, 4],
    tracks: (loose.tracks ?? []).map(normalizeTrack),
    lessonId: loose.lessonId,
    assignmentId: loose.assignmentId,
    lessonProgress: loose.lessonProgress ?? {},
    createdAt: Number(loose.createdAt ?? timestamp),
    updatedAt: Number(loose.updatedAt ?? timestamp)
  };
}
