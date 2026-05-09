import type { Assignment, Submission } from "../education/types";
import type { AudioAsset, Project } from "../types/project";

export type ProjectRepository = {
  saveProject: (project: Project) => Promise<void>;
  loadProject: (projectId: string) => Promise<Project | undefined>;
  listProjects: () => Promise<Project[]>;
  deleteProject: (projectId: string) => Promise<void>;
};

export type AssignmentRepository = {
  saveAssignment: (assignment: Assignment) => Promise<Assignment>;
  loadAssignment: (assignmentId: string) => Promise<Assignment | undefined>;
  listAssignments: () => Promise<Assignment[]>;
  deleteAssignment: (assignmentId: string) => Promise<void>;
};

export type SubmissionRepository = {
  saveSubmission: (submission: Submission) => Promise<Submission>;
  listSubmissions: () => Promise<Submission[]>;
  listSubmissionsForAssignment: (assignmentId: string) => Promise<Submission[]>;
};

export type AudioAssetRepository = {
  saveAudioAsset: (asset: AudioAsset) => Promise<AudioAsset>;
  loadAudioAsset: (assetId: string) => Promise<AudioAsset | undefined>;
  listAudioAssets: (projectId: string) => Promise<AudioAsset[]>;
};

export type StudioRepositories = {
  projects: ProjectRepository;
  assignments: AssignmentRepository;
  submissions: SubmissionRepository;
  audioAssets: AudioAssetRepository;
};
