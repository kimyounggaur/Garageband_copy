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

export type Assignment = {
  id: string;
  title: string;
  description: string;
  lessonId?: string;
  dueDate?: number;
  rubric: Rubric;
  createdAt: number;
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
  detail?: string;
  category?: "length" | "tracks" | "clips" | "balance" | "structure" | "midi" | "audio" | "lesson";
  autoCheck?: boolean;
};

export type ReviewRubricCheck = {
  id: string;
  label: string;
  completed: boolean;
  detail: string;
};

export type ReviewRubricStatus = {
  criterionId: string;
  title: string;
  autoChecks: ReviewRubricCheck[];
  manualChecks: ReviewRubricCheck[];
  suggestedLevel: string;
  score: number;
  maxScore: number;
  percent: number;
  completed: boolean;
};

export type ReviewScore = {
  earned: number;
  possible: number;
  percent: number;
  levelLabel: string;
};

export type ReviewNextAction = {
  title: string;
  message: string;
  category?: ReviewItem["category"];
  itemId?: string;
};

export type ReviewSummary = {
  projectId: string;
  projectName: string;
  assignmentId?: string;
  assignmentTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  ready: boolean;
  statusLabel: string;
  studentMessage: string;
  teacherSummary: string;
  rubricScore: ReviewScore;
  nextAction: ReviewNextAction;
  items: ReviewItem[];
  missionResults: MissionEvaluation[];
  rubric: ReviewRubricStatus[];
};

export type Submission = {
  id: string;
  assignmentId: string;
  projectId: string;
  submittedAt: number;
  reviewSnapshot: ReviewSummary;
  wavExportName?: string;
};
