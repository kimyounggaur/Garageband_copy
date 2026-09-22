import { normalizeTakeSections } from "./audioComping";
import type { Project } from "../types/project";

/** Every take is a live project reference, including takes that are not active. */
export function referencedAudioAssetIds(project: Project): Set<string> {
  return new Set(project.tracks
    .flatMap((track) => track.clips)
    .flatMap((clip) => [clip.audioAssetId, ...(clip.takeIds ?? [])])
    .filter((id): id is string => typeof id === "string" && id.length > 0));
}

/**
 * Remove only an audio attachment whose project save failed. Other edits made
 * while the save was in flight stay in the project.
 */
export function withoutUnpersistedAudioAsset(project: Project, assetId: string): Project {
  let changed = false;
  const tracks = project.tracks.map((track) => {
    let trackChanged = false;
    const clips = track.clips.flatMap((clip) => {
      if (clip.type !== "audio") return [clip];
      const ids = [clip.audioAssetId, ...(clip.takeIds ?? [])].filter(
        (id, index, list): id is string => typeof id === "string" && id.length > 0 && list.indexOf(id) === index
      );
      if (!ids.includes(assetId)) return [clip];
      changed = true;
      trackChanged = true;
      const remaining = ids.filter((id) => id !== assetId);
      if (remaining.length === 0) return [];
      const activeTakeId = clip.activeTakeId && remaining.includes(clip.activeTakeId)
        ? clip.activeTakeId
        : remaining[0];
      const restored = {
        ...clip,
        audioAssetId: activeTakeId,
        activeTakeId,
        takeIds: remaining
      };
      return [{ ...restored, takeSections: normalizeTakeSections(restored) }];
    });
    return trackChanged ? { ...track, clips } : track;
  });
  return changed ? { ...project, tracks } : project;
}
