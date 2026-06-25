import { getLoopById } from "../data/loops";
import { normalizeInstrumentId } from "../data/instruments";
import { normalizeTrackAutomation } from "../audio/automation";
import { normalizeDrummerSettings } from "../audio/drummer";
import { normalizeMasterFx, normalizeTrackFx, normalizeTrackSends } from "../audio/fx";
import { normalizeLiveLoops } from "../audio/liveLoops";
import { CURRENT_PROJECT_VERSION, type Clip, type ClipType, type Project, type Track, type TrackRole, type TrackType } from "../types/project";
import { makeId } from "./id";
import { clipTypeLabel, trackRoleLabel, trackTypeLabel } from "./labels";
import { normalizePianoRollScale } from "./pianoRoll";
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

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item, index): item is string => typeof item === "string" && item.length > 0 && value.indexOf(item) === index)
    : undefined;
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
  if (lower.includes("drummer") || name.includes("드러머")) return "drummer";
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
  const playbackRate = Number(clip.playbackRate);
  const pitchSemitones = Number(clip.pitchSemitones);
  const fallbackName = defaultClipName(type, clip.loopId);
  const instructions = repairBrokenText(clip.instructions, "");
  const takeIds = stringList(clip.takeIds);
  const activeTakeId = typeof clip.activeTakeId === "string" && clip.activeTakeId.length > 0 ? clip.activeTakeId : clip.audioAssetId ?? takeIds?.[0];
  const takeSections = Array.isArray(clip.takeSections)
    ? clip.takeSections.map((section, sectionIndex) => ({
        id: section.id || makeId("take-section"),
        takeId: typeof section.takeId === "string" && section.takeId.length > 0 ? section.takeId : activeTakeId ?? "",
        startBeat: Math.max(0, Number(section.startBeat ?? 0)),
        lengthBeats: Math.max(0.25, Number(section.lengthBeats ?? 0.25))
      }))
    : undefined;
  const hasDrummerSettings =
    clip.drummerPreset !== undefined ||
    clip.drummerComplexity !== undefined ||
    clip.drummerLoudness !== undefined ||
    clip.drummerSwing !== undefined ||
    clip.drummerFills !== undefined;
  const drummerSettings = normalizeDrummerSettings({
    preset: clip.drummerPreset,
    complexity: clip.drummerComplexity,
    loudness: clip.drummerLoudness,
    swing: clip.drummerSwing,
    fills: clip.drummerFills,
    lengthBeats: clip.lengthBeats
  });

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
    playbackRate: Number.isFinite(playbackRate) ? Math.max(0.25, Math.min(4, playbackRate)) : undefined,
    pitchSemitones: Number.isFinite(pitchSemitones) ? Math.max(-24, Math.min(24, pitchSemitones)) : undefined,
    fadeInSeconds: nonNegative(clip.fadeInSeconds),
    fadeOutSeconds: nonNegative(clip.fadeOutSeconds),
    fadeInBeats: nonNegative(clip.fadeInBeats),
    fadeOutBeats: nonNegative(clip.fadeOutBeats),
    takeIds,
    activeTakeId,
    takeSections,
    loopId: clip.loopId,
    loopEnabled: booleanValue(clip.loopEnabled),
    locked: clip.locked ?? false,
    instructions: instructions || undefined,
    drummerPreset: hasDrummerSettings ? drummerSettings.preset : undefined,
    drummerComplexity: hasDrummerSettings ? drummerSettings.complexity : undefined,
    drummerLoudness: hasDrummerSettings ? drummerSettings.loudness : undefined,
    drummerSwing: hasDrummerSettings ? drummerSettings.swing : undefined,
    drummerFills: hasDrummerSettings ? drummerSettings.fills : undefined
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
    instrumentId: normalizeInstrumentId(track.instrumentId, { type, role }),
    volume: Math.max(0, Math.min(1, Number(track.volume ?? 0.82))),
    pan: Math.max(-1, Math.min(1, Number(track.pan ?? 0))),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    recordEnabled: type === "audio" ? Boolean(track.recordEnabled) : false,
    sends: normalizeTrackSends(track.sends),
    fx: normalizeTrackFx(track.fx),
    automation: normalizeTrackAutomation(track.automation),
    color: track.color ?? TRACK_COLORS[index % TRACK_COLORS.length],
    clips: (track.clips ?? []).map((clip, clipIndex) => normalizeClip(clip, id, clipIndex + index))
  };
}

export function normalizeProject(project: Project): Project {
  const loose = project as LooseProject;
  const timestamp = now();
  const { cycleStart, cycleEnd } = normalizeCycle(loose.cycleStart, loose.cycleEnd);
  const key = normalizeProjectKey(loose.key);
  const masterVolume = normalizeMasterVolume(loose.masterVolume);
  const master = normalizeMasterFx(loose.master, masterVolume);
  const tracks = (loose.tracks ?? []).map(normalizeTrack);
  return {
    id: loose.id ?? makeId("project"),
    version: CURRENT_PROJECT_VERSION,
    name: repairBrokenText(loose.name, "새 프로젝트"),
    bpm: Math.round(Math.max(40, Math.min(220, Number(loose.bpm ?? 120)))),
    timeSignature: normalizeTimeSignature(loose.timeSignature),
    tracks,
    cycleStart,
    cycleEnd,
    cycleEnabled: booleanValue(loose.cycleEnabled),
    key,
    scale: normalizePianoRollScale(loose.scale, key),
    metronomeOn: booleanValue(loose.metronomeOn),
    countInBars: normalizeCountInBars(loose.countInBars),
    masterVolume: master.volume,
    master,
    liveLoops: normalizeLiveLoops(loose.liveLoops, tracks),
    lessonId: loose.lessonId,
    assignmentId: loose.assignmentId,
    classId: loose.classId,
    studentId: loose.studentId,
    lessonProgress: loose.lessonProgress ?? {},
    createdAt: Number(loose.createdAt ?? timestamp),
    updatedAt: Number(loose.updatedAt ?? timestamp)
  };
}
