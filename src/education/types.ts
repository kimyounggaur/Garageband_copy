import type { Project, TrackRole } from "../types/project";

export type StudioMode = "studio" | "lesson" | "review";
export type LessonDifficulty = "starter" | "builder" | "challenge";
export type SubmissionStatus = "draft" | "submitted" | "resubmitted" | "needsWork" | "reviewed";

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
  classId?: string;
  teacherId?: string;
  assignedStudentIds?: string[];
  dueDate?: number;
  rubric: Rubric;
  createdAt: number;
  updatedAt?: number;
};

export type AssignmentDraft = {
  title: string;
  description: string;
  lessonId?: string;
  classId?: string;
  teacherId?: string;
  assignedStudentIds?: string[];
  dueDate?: number;
  rubric?: Rubric;
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
  custom?: boolean;
  createdAt?: number;
  updatedAt?: number;
  authorId?: string;
};

export type LessonDraft = {
  title: string;
  goal: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  templateProject: Project;
  missions: Mission[];
  rubric: Rubric;
  authorId?: string;
};

export type TeacherProfile = {
  id: string;
  name: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
};

export type StudentProfile = {
  id: string;
  name: string;
  studentCode?: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
};

export type ClassRoom = {
  id: string;
  title: string;
  code: string;
  description?: string;
  teacherId?: string;
  createdAt: number;
  updatedAt: number;
};

export type Enrollment = {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: number;
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
  classId?: string;
  studentId?: string;
  studentName?: string;
  projectId: string;
  submittedAt: number;
  status?: SubmissionStatus;
  attemptNumber?: number;
  reviewSnapshot: ReviewSummary;
  wavExportName?: string;
  packageFileNames?: string[];
  teacherFeedback?: string;
  teacherFeedbackUpdatedAt?: number;
};
