import { LocalAssignmentRepository, LocalAudioAssetRepository, LocalProjectRepository, LocalSubmissionRepository } from "./localRepositories";
import type { StudioRepositories } from "./repositories";
import type { RepositoryMode } from "../repositories/cloudTypes";
import { createMockCloudRepositories } from "../repositories/mockCloudRepositories";

const localProjectRepository = new LocalProjectRepository();
const localRepositories: StudioRepositories & { projects: LocalProjectRepository } = {
  projects: localProjectRepository,
  assignments: new LocalAssignmentRepository(),
  submissions: new LocalSubmissionRepository(),
  audioAssets: new LocalAudioAssetRepository()
};
const mockCloudRepositories = createMockCloudRepositories();
const listeners = new Set<(mode: RepositoryMode) => void>();

function readRepositoryMode(): RepositoryMode {
  const mode = globalThis.localStorage?.getItem("webband.repositoryMode");
  return mode === "mockCloud" ? "mockCloud" : "local";
}

let repositoryMode: RepositoryMode = readRepositoryMode();

function activeRepositories() {
  return repositoryMode === "mockCloud" ? mockCloudRepositories : localRepositories;
}

function routedRepository<TKey extends keyof StudioRepositories>(key: TKey): StudioRepositories[TKey] {
  return new Proxy(
    {},
    {
      get(_, property) {
        const target = activeRepositories()[key] as Record<string | symbol, unknown>;
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      }
    }
  ) as StudioRepositories[TKey];
}

export const studioRepositories: StudioRepositories = {
  projects: routedRepository("projects"),
  assignments: routedRepository("assignments"),
  submissions: routedRepository("submissions"),
  audioAssets: routedRepository("audioAssets")
};

export const projectRepository = studioRepositories.projects;
export const assignmentRepository = studioRepositories.assignments;
export const submissionRepository = studioRepositories.submissions;
export const audioAssetRepository = studioRepositories.audioAssets;

export function getRepositoryMode() {
  return repositoryMode;
}

export function setRepositoryMode(mode: RepositoryMode) {
  if (repositoryMode === mode) return;
  repositoryMode = mode;
  globalThis.localStorage?.setItem("webband.repositoryMode", mode);
  listeners.forEach((listener) => listener(mode));
}

export function subscribeRepositoryMode(listener: (mode: RepositoryMode) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadLastProject() {
  return activeRepositories().projects.loadLastProject();
}
