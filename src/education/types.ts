import type { Project, TrackRole } from "../types/project";

export type StudioMode = "studio" | "lesson" | "review";
export type LessonDifficulty = "starter" | "builder" | "challenge";

export type MissionCheck =
  | { type: "minTrackClipBeats"; role: TrackRole; beats: number }
  | { type: "minMidiNotes"; role?: TrackRole; count: number }
  | { type: "minProjectLength"; beats: number }
  | { type: "minDistinctSections"; sections: number; minGapBeats?: number }
  | { type: "minAudioClips"; count: number }
  | { type: "minTracksWithClips"; roles: TrackRole[] };

export type Mission = {
  id: string;
  title: string;
  description: string;
  hint: string;
  check: MissionCheck;
};

export type RubricLevel = {
  label: string;
  description: string;
};

export type RubricCriterion = {
  id: string;
  title: string;
  levels: RubricLevel[];
};

export type Rubric = {
  criteria: RubricCriterion[];
};

export type Lesson = {
  id: string;
  title: string;
  goal: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  templateProject: Project;
  missions: Mission[];
  rubric: Rubric;
};

export type MissionEvaluation = {
  missionId: string;
  completed: boolean;
  progress: number;
  target: number;
  summary: string;
};

export type ReviewSeverity = "good" | "info" | "warning";

export type ReviewItem = {
  id: string;
  title: string;
  message: string;
  severity: ReviewSeverity;
};
