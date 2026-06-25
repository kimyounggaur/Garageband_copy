import type { AudioTakeSection, Clip } from "../types/project";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function finiteBeat(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, next) : fallback;
}

export function clipTakeIds(clip: Pick<Clip, "takeIds" | "activeTakeId" | "audioAssetId">) {
  const ids = [clip.audioAssetId, ...(clip.takeIds ?? []), clip.activeTakeId]
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

export function activeTakeId(clip: Pick<Clip, "takeIds" | "activeTakeId" | "audioAssetId">) {
  const ids = clipTakeIds(clip);
  return ids.includes(clip.activeTakeId ?? "") ? clip.activeTakeId : ids[0];
}

export function buildDefaultTakeSections(
  clip: Pick<Clip, "takeIds" | "activeTakeId" | "audioAssetId" | "lengthBeats">
): AudioTakeSection[] {
  const takeId = activeTakeId(clip);
  return takeId
    ? [
        {
          id: "take-section-1",
          takeId,
          startBeat: 0,
          lengthBeats: Math.max(0.25, finiteBeat(clip.lengthBeats, 4))
        }
      ]
    : [];
}

export function normalizeTakeSections(
  clip: Pick<Clip, "takeIds" | "activeTakeId" | "audioAssetId" | "lengthBeats" | "takeSections">
): AudioTakeSection[] {
  const ids = clipTakeIds(clip);
  const fallbackTakeId = activeTakeId(clip);
  if (!fallbackTakeId) return [];
  const sourceSections = clip.takeSections?.length ? clip.takeSections : buildDefaultTakeSections(clip);
  const clipLength = Math.max(0.25, finiteBeat(clip.lengthBeats, 4));

  return sourceSections
    .map((section, index) => {
      const startBeat = clamp(finiteBeat(section.startBeat), 0, Math.max(0, clipLength - 0.25));
      const maxLength = Math.max(0.25, clipLength - startBeat);
      return {
        id: section.id || `take-section-${index + 1}`,
        takeId: ids.includes(section.takeId) ? section.takeId : fallbackTakeId,
        startBeat,
        lengthBeats: clamp(finiteBeat(section.lengthBeats, maxLength), 0.25, maxLength)
      };
    })
    .sort((left, right) => left.startBeat - right.startBeat || left.id.localeCompare(right.id));
}

export function buildCompedAudioClip(
  clip: Clip,
  overrides: Partial<Pick<Clip, "id" | "name" | "startBeat">> = {}
): Clip {
  const takeSections = normalizeTakeSections(clip);
  const firstTakeId = takeSections[0]?.takeId ?? activeTakeId(clip);
  return {
    ...clip,
    id: overrides.id ?? clip.id,
    name: overrides.name ?? `${clip.name} Comp`,
    startBeat: overrides.startBeat ?? clip.startBeat,
    audioAssetId: firstTakeId ?? clip.audioAssetId,
    activeTakeId: firstTakeId,
    takeIds: clipTakeIds(clip),
    takeSections,
    locked: false
  };
}
