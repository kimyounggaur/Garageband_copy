import { getLoopById } from "../data/loops";
import { CURRENT_PROJECT_VERSION, type Clip, type ClipType, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "./id";
import { clipTypeLabel, trackRoleLabel, trackTypeLabel } from "./labels";
import { repairBrokenText } from "./textRepair";
import { normalizeCountInBars, normalizeMasterVolume, normalizeProjectKey, normalizeTimeSignature } from "./transport";

type LooseProject = Partial<Project> & {
  tracks?: Partial<Track>[];
};

const TRACK_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#4ade80", "#fb7185", "#eab308"];

function now() {
  return Date.now();
}

function nonNegative(value: unknown, fallback = 0) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCycle(start: unknown, end: unknown) {
  const cycleStart = nonNegative(start, 0);
  const cycleEnd = Math.max(cycleStart + 0.25, nonNegative(end, 8));
  return { cycleStart, cycleEnd };
}

function defaultClipName(type: ClipType, loopId?: string) {
  if (loopId) return getLoopById(loopId)?.name ?? "루프 클립";
  return `${clipTypeLabel(type)} 클립`;
}

function inferRole(type: TrackType, name = ""): TrackRole {
  const lower = name.toLowerCase();
  if (type === "drum" || lower.includes("beat") || lower.includes("drum") || name.includes("비트") || name.includes("드럼")) {
    return "beat";
  }
  if (type === "audio" || lower.includes("record") || name.includes("녹음") || name.includes("오디오")) return "recording";
  if (lower.includes("bass") || name.includes("베이스")) return "bass";
  if (
    lower.includes("chord") ||
    lower.includes("key") ||
    lower.includes("pad") ||
    lower.includes("harmony") ||
    name.includes("건반") ||
    name.includes("화성") ||
    name.includes("코드")
  ) {
    return "harmony";
  }
  return "melody";
}

function normalizeTrackType(value?: string): TrackType {
  if (value === "drum" || value === "audio" || value === "instrument") return value;
  return "instrument";
}

function normalizeClip(clip: Partial<Clip>, trackId: string, fallbackIndex: number): Clip {
  const type = clip.type === "audio" || clip.type === "loop" || clip.type === "midi" ? clip.type : "midi";
  const gain = Number(clip.gain);
  const fallbackName = defaultClipName(type, clip.loopId);
  const instructions = repairBrokenText(clip.instructions, "");

  return {
    id: clip.id ?? makeId("clip"),
    trackId,
    type,
    name: repairBrokenText(clip.name, fallbackName),
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
    trimStartSeconds: nonNegative(clip.trimStartSeconds),
    trimEndSeconds: nonNegative(clip.trimEndSeconds),
    gain: Number.isFinite(gain) ? Math.max(0, gain) : undefined,
    fadeInSeconds: nonNegative(clip.fadeInSeconds),
    fadeOutSeconds: nonNegative(clip.fadeOutSeconds),
    fadeInBeats: nonNegative(clip.fadeInBeats),
    fadeOutBeats: nonNegative(clip.fadeOutBeats),
    loopId: clip.loopId,
    loopEnabled: booleanValue(clip.loopEnabled),
    locked: clip.locked ?? false,
    instructions: instructions || undefined
  };
}

function normalizeTrack(track: Partial<Track>, index: number): Track {
  const type = normalizeTrackType(track.type);
  const id = track.id ?? makeId("track");
  const role = track.role ?? inferRole(type, typeof track.name === "string" ? track.name : "");
  const fallbackName = role ? trackRoleLabel(role) : trackTypeLabel(type);

  return {
    id,
    name: repairBrokenText(track.name, fallbackName),
    type,
    role,
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
  const { cycleStart, cycleEnd } = normalizeCycle(loose.cycleStart, loose.cycleEnd);
  return {
    id: loose.id ?? makeId("project"),
    version: CURRENT_PROJECT_VERSION,
    name: repairBrokenText(loose.name, "새 프로젝트"),
    bpm: Math.round(Math.max(40, Math.min(220, Number(loose.bpm ?? 120)))),
    timeSignature: normalizeTimeSignature(loose.timeSignature),
    tracks: (loose.tracks ?? []).map(normalizeTrack),
    cycleStart,
    cycleEnd,
    cycleEnabled: booleanValue(loose.cycleEnabled),
    key: normalizeProjectKey(loose.key),
    metronomeOn: booleanValue(loose.metronomeOn),
    countInBars: normalizeCountInBars(loose.countInBars),
    masterVolume: normalizeMasterVolume(loose.masterVolume),
    lessonId: loose.lessonId,
    assignmentId: loose.assignmentId,
    classId: loose.classId,
    studentId: loose.studentId,
    lessonProgress: loose.lessonProgress ?? {},
    createdAt: Number(loose.createdAt ?? timestamp),
    updatedAt: Number(loose.updatedAt ?? timestamp)
  };
}
