import { getLoopById } from "../data/loops";
import type { Clip, LiveLoopCell, LiveLoopScene, LiveLoops, Project, Track } from "../types/project";

export const DEFAULT_LIVE_LOOP_SCENE_COUNT = 4;
export const DEFAULT_LIVE_LOOP_QUANTIZE_BEATS = 4;

type TrackRef = Pick<Track, "id">;

function finiteNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function cleanId(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function cleanName(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeScene(scene: Partial<LiveLoopScene>, index: number): LiveLoopScene {
  const fallbackId = `scene-${index + 1}`;
  return {
    id: cleanId(scene.id, fallbackId),
    name: cleanName(scene.name, `Scene ${index + 1}`)
  };
}

function isLiveLoopCellType(value: unknown): value is LiveLoopCell["type"] {
  return value === "loop" || value === "midi" || value === "audio";
}

export function createDefaultLiveLoops(sceneCount = DEFAULT_LIVE_LOOP_SCENE_COUNT): LiveLoops {
  return {
    scenes: Array.from({ length: Math.max(1, sceneCount) }, (_, index) => normalizeScene({}, index)),
    cells: [],
    quantizeBeats: DEFAULT_LIVE_LOOP_QUANTIZE_BEATS
  };
}

export function createLiveLoopCellFromLoop(loopId: string, trackId: string, sceneId: string): LiveLoopCell {
  const loop = getLoopById(loopId) ?? getLoopById("drums-grid");
  return {
    id: `cell-${trackId}-${sceneId}`,
    trackId,
    sceneId,
    type: "loop",
    name: loop?.name ?? "Loop Cell",
    color: loop?.color ?? "#7d8cff",
    lengthBeats: loop?.lengthBeats ?? 4,
    loopId: loop?.id ?? loopId
  };
}

function normalizeLiveLoopCell(
  cell: Partial<LiveLoopCell>,
  validTrackIds: Set<string>,
  validSceneIds: Set<string>
): LiveLoopCell | undefined {
  const trackId = typeof cell.trackId === "string" ? cell.trackId : "";
  const sceneId = typeof cell.sceneId === "string" ? cell.sceneId : "";
  if (!validTrackIds.has(trackId) || !validSceneIds.has(sceneId)) return undefined;

  const type = isLiveLoopCellType(cell.type) ? cell.type : cell.loopId ? "loop" : "midi";
  const loop = type === "loop" ? getLoopById(cell.loopId) : undefined;
  if (type === "loop" && !loop) return undefined;

  return {
    id: cleanId(cell.id, `cell-${trackId}-${sceneId}`),
    trackId,
    sceneId,
    type,
    name: cleanName(cell.name, loop?.name ?? "Live Loop Cell"),
    color: cleanName(cell.color, loop?.color ?? "#7d8cff"),
    lengthBeats: Math.max(0.25, finiteNumber(cell.lengthBeats, loop?.lengthBeats ?? 4)),
    loopId: type === "loop" ? loop?.id : undefined,
    notes: type === "midi" ? cell.notes?.map((note) => ({ ...note })) ?? [] : undefined,
    audioUrl: type === "audio" ? cell.audioUrl : undefined,
    audioAssetId: type === "audio" ? cell.audioAssetId : undefined
  };
}

export function normalizeLiveLoops(liveLoops: unknown, tracks: TrackRef[]): LiveLoops {
  const loose = liveLoops && typeof liveLoops === "object" ? (liveLoops as Partial<LiveLoops>) : {};
  const sceneInput = Array.isArray(loose.scenes) && loose.scenes.length > 0 ? loose.scenes : createDefaultLiveLoops().scenes;
  const scenes = sceneInput.reduce<LiveLoopScene[]>((nextScenes, scene, index) => {
    const normalized = normalizeScene(scene ?? {}, index);
    if (nextScenes.some((item) => item.id === normalized.id)) return nextScenes;
    return [...nextScenes, normalized];
  }, []);
  const safeScenes = scenes.length > 0 ? scenes : createDefaultLiveLoops().scenes;
  const validSceneIds = new Set(safeScenes.map((scene) => scene.id));
  const validTrackIds = new Set(tracks.map((track) => track.id));
  const cellsBySlot = new Map<string, LiveLoopCell>();
  const cellInput = Array.isArray(loose.cells) ? loose.cells : [];

  cellInput.forEach((cell) => {
    const normalized = normalizeLiveLoopCell(cell ?? {}, validTrackIds, validSceneIds);
    if (!normalized) return;
    cellsBySlot.set(`${normalized.trackId}:${normalized.sceneId}`, normalized);
  });

  const sceneOrder = new Map(safeScenes.map((scene, index) => [scene.id, index]));
  const trackOrder = new Map(tracks.map((track, index) => [track.id, index]));
  const quantizeBeats = Math.max(0.25, finiteNumber(loose.quantizeBeats, DEFAULT_LIVE_LOOP_QUANTIZE_BEATS));

  return {
    scenes: safeScenes,
    cells: [...cellsBySlot.values()].sort(
      (left, right) =>
        (sceneOrder.get(left.sceneId) ?? 0) - (sceneOrder.get(right.sceneId) ?? 0) ||
        (trackOrder.get(left.trackId) ?? 0) - (trackOrder.get(right.trackId) ?? 0)
    ),
    quantizeBeats: Number.isFinite(Number(loose.quantizeBeats)) && Number(loose.quantizeBeats) > 0 ? quantizeBeats : DEFAULT_LIVE_LOOP_QUANTIZE_BEATS
  };
}

export function resolveProjectLiveLoops(project: Pick<Project, "liveLoops" | "tracks">) {
  return normalizeLiveLoops(project.liveLoops, project.tracks);
}

export function liveLoopCellsForScene(liveLoops: Pick<LiveLoops, "cells">, sceneId: string) {
  return liveLoops.cells.filter((cell) => cell.sceneId === sceneId);
}

export function liveLoopCellForTrackScene(liveLoops: Pick<LiveLoops, "cells">, trackId: string, sceneId: string) {
  return liveLoops.cells.find((cell) => cell.trackId === trackId && cell.sceneId === sceneId);
}

export function liveLoopTriggerBeat(
  currentBeat: number,
  timeSignature: [number, number] = [4, 4],
  quantizeBeats?: number
) {
  const quantize = Math.max(0.25, finiteNumber(quantizeBeats, Math.max(1, timeSignature[0] || DEFAULT_LIVE_LOOP_QUANTIZE_BEATS)));
  const beat = Math.max(0, finiteNumber(currentBeat, 0));
  const grid = beat / quantize;
  const rounded = Math.round(grid);
  if (Math.abs(grid - rounded) < 0.0001) return Number((rounded * quantize).toFixed(4));
  return Number((Math.ceil(grid) * quantize).toFixed(4));
}

export function liveLoopCellToClip(cell: LiveLoopCell, startBeat: number): Clip {
  return {
    id: `${cell.id}-${Number(startBeat.toFixed(4))}`,
    trackId: cell.trackId,
    type: cell.type,
    name: cell.name,
    startBeat,
    lengthBeats: cell.lengthBeats,
    color: cell.color,
    loopId: cell.loopId,
    loopEnabled: cell.type === "loop",
    notes: cell.notes?.map((note) => ({ ...note })),
    audioUrl: cell.audioUrl,
    audioAssetId: cell.audioAssetId,
    trimStartSeconds: cell.type === "audio" ? 0 : undefined,
    trimEndSeconds: cell.type === "audio" ? 0 : undefined,
    gain: cell.type === "audio" ? 1 : undefined
  };
}
