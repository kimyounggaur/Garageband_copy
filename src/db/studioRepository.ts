import { LocalAssignmentRepository, LocalAudioAssetRepository, LocalProjectRepository, LocalSubmissionRepository } from "./localRepositories";
import type { StudioRepositories } from "./repositories";

const localProjectRepository = new LocalProjectRepository();

export const studioRepositories: StudioRepositories = {
  projects: localProjectRepository,
  assignments: new LocalAssignmentRepository(),
  submissions: new LocalSubmissionRepository(),
  audioAssets: new LocalAudioAssetRepository()
};

export const projectRepository = studioRepositories.projects;
export const assignmentRepository = studioRepositories.assignments;
export const submissionRepository = studioRepositories.submissions;
export const audioAssetRepository = studioRepositories.audioAssets;

export async function loadLastProject() {
  return localProjectRepository.loadLastProject();
}
