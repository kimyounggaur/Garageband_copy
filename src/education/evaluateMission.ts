import type { Clip, Project, Track, TrackRole } from "../types/project";
import type { Lesson, Mission, MissionEvaluation } from "./types";

function trackRole(track: Track): TrackRole {
  if (track.role) return track.role;
  const name = track.name.toLowerCase();
  if (track.type === "drum" || name.includes("beat") || name.includes("drum")) return "beat";
  if (track.type === "audio" || name.includes("record")) return "recording";
  if (name.includes("bass")) return "bass";
  if (name.includes("chord") || name.includes("key") || name.includes("pad")) return "harmony";
  return "melody";
}

function clipsForRole(project: Project, role?: TrackRole): Clip[] {
  return project.tracks
    .filter((track) => !role || trackRole(track) === role)
    .flatMap((track) => track.clips);
}

export function getProjectEndBeat(project: Project) {
  return project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats);
  }, 0);
}

function totalClipBeats(project: Project, role: TrackRole) {
  return clipsForRole(project, role).reduce((sum, clip) => sum + clip.lengthBeats, 0);
}

function midiNoteCount(project: Project, role?: TrackRole) {
  return clipsForRole(project, role)
    .filter((clip) => clip.type === "midi")
    .reduce((sum, clip) => sum + (clip.notes?.length ?? 0), 0);
}

function distinctSections(project: Project, minGapBeats = 24) {
  const starts = project.tracks
    .flatMap((track) => track.clips.map((clip) => clip.startBeat))
    .sort((a, b) => a - b);
  if (starts.length === 0) return 0;

  let sections = 1;
  let sectionStart = starts[0];
  starts.forEach((start) => {
    if (start - sectionStart >= minGapBeats) {
      sections += 1;
      sectionStart = start;
    }
  });
  return sections;
}

function tracksWithClips(project: Project, roles: TrackRole[]) {
  return roles.filter((role) => project.tracks.some((track) => trackRole(track) === role && track.clips.length > 0)).length;
}

export function evaluateMission(project: Project, mission: Mission): MissionEvaluation {
  const check = mission.check;
  if (check.type === "minTrackClipBeats") {
    const progress = totalClipBeats(project, check.role);
    return {
      missionId: mission.id,
      completed: progress >= check.beats,
      progress,
      target: check.beats,
      summary: `${Math.min(progress, check.beats)} / ${check.beats} beats`
    };
  }

  if (check.type === "minMidiNotes") {
    const progress = midiNoteCount(project, check.role);
    return {
      missionId: mission.id,
      completed: progress >= check.count,
      progress,
      target: check.count,
      summary: `${Math.min(progress, check.count)} / ${check.count} notes`
    };
  }

  if (check.type === "minProjectLength") {
    const progress = getProjectEndBeat(project);
    return {
      missionId: mission.id,
      completed: progress >= check.beats,
      progress,
      target: check.beats,
      summary: `${Math.min(progress, check.beats)} / ${check.beats} beats`
    };
  }

  if (check.type === "minDistinctSections") {
    const progress = distinctSections(project, check.minGapBeats);
    return {
      missionId: mission.id,
      completed: progress >= check.sections,
      progress,
      target: check.sections,
      summary: `${Math.min(progress, check.sections)} / ${check.sections} sections`
    };
  }

  if (check.type === "minAudioClips") {
    const progress = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.type === "audio").length;
    return {
      missionId: mission.id,
      completed: progress >= check.count,
      progress,
      target: check.count,
      summary: `${Math.min(progress, check.count)} / ${check.count} audio clips`
    };
  }

  const progress = tracksWithClips(project, check.roles);
  return {
    missionId: mission.id,
    completed: progress >= check.roles.length,
    progress,
    target: check.roles.length,
    summary: `${progress} / ${check.roles.length} roles`
  };
}

export function evaluateLesson(project: Project, lesson?: Lesson) {
  if (!lesson) return [];
  return lesson.missions.map((mission) => evaluateMission(project, mission));
}

export function summarizeLesson(project: Project, lesson?: Lesson) {
  const results = evaluateLesson(project, lesson);
  const completed = results.filter((result) => result.completed).length;
  return {
    completed,
    total: results.length,
    percent: results.length === 0 ? 0 : Math.round((completed / results.length) * 100),
    results
  };
}
