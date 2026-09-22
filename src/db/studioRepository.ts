import {
  LocalAssignmentRepository,
  LocalAudioAssetRepository,
  LocalClassRoomRepository,
  LocalEnrollmentRepository,
  LocalLessonRepository,
  LocalProjectRepository,
  LocalStudentProfileRepository,
  LocalSubmissionRepository,
  LocalTeacherProfileRepository
} from "./localRepositories";
import type { StudioRepositories } from "./repositories";
import type { RepositoryMode } from "../repositories/cloudTypes";
import { createMockCloudRepositories } from "../repositories/mockCloudRepositories";
import { createSupabaseRepositories } from "../repositories/supabaseRepositories";

const localProjectRepository = new LocalProjectRepository();
const localRepositories: StudioRepositories & { projects: LocalProjectRepository } = {
  projects: localProjectRepository,
  assignments: new LocalAssignmentRepository(),
  submissions: new LocalSubmissionRepository(),
  audioAssets: new LocalAudioAssetRepository(),
  classRooms: new LocalClassRoomRepository(),
  students: new LocalStudentProfileRepository(),
  teachers: new LocalTeacherProfileRepository(),
  enrollments: new LocalEnrollmentRepository(),
  lessons: new LocalLessonRepository()
};
const mockCloudRepositories = createMockCloudRepositories();
const supabaseRepositories = createSupabaseRepositories();
const listeners = new Set<(mode: RepositoryMode) => void>();

function readRepositoryMode(): RepositoryMode {
  const mode = globalThis.localStorage?.getItem("webband.repositoryMode");
  if (mode === "mockCloud" || mode === "supabase") return mode;
  return "local";
}

let repositoryMode: RepositoryMode = readRepositoryMode();

function activeRepositories() {
  if (repositoryMode === "mockCloud") return mockCloudRepositories;
  if (repositoryMode === "supabase") return supabaseRepositories;
  return localRepositories;
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
  audioAssets: routedRepository("audioAssets"),
  classRooms: routedRepository("classRooms"),
  students: routedRepository("students"),
  teachers: routedRepository("teachers"),
  enrollments: routedRepository("enrollments"),
  lessons: routedRepository("lessons")
};

export const projectRepository = studioRepositories.projects;
export const assignmentRepository = studioRepositories.assignments;
export const submissionRepository = studioRepositories.submissions;
export const audioAssetRepository = studioRepositories.audioAssets;
export const classRoomRepository = studioRepositories.classRooms;
export const studentRepository = studioRepositories.students;
export const teacherRepository = studioRepositories.teachers;
export const enrollmentRepository = studioRepositories.enrollments;
export const lessonRepository = studioRepositories.lessons;

export function getRepositoryMode() {
  return repositoryMode;
}

export function projectRepositoryForMode(mode: RepositoryMode) {
  if (mode === "mockCloud") return mockCloudRepositories.projects;
  if (mode === "supabase") return supabaseRepositories.projects;
  return localRepositories.projects;
}

export function audioAssetRepositoryForMode(mode: RepositoryMode) {
  if (mode === "mockCloud") return mockCloudRepositories.audioAssets;
  if (mode === "supabase") return supabaseRepositories.audioAssets;
  return localRepositories.audioAssets;
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

function currentProjectKey(mode: RepositoryMode) {
  return `webband.currentProject.${mode}`;
}

/** The open-project pointer follows navigation, not completion order of background saves. */
export function markCurrentProject(projectId: string, mode: RepositoryMode = getRepositoryMode()) {
  globalThis.localStorage?.setItem(currentProjectKey(mode), projectId);
}

export async function loadLastProject() {
  const repositories = activeRepositories();
  const currentId = globalThis.localStorage?.getItem(currentProjectKey(repositoryMode));
  if (currentId) {
    const current = await repositories.projects.loadProject(currentId);
    if (current) return current;
  }
  return repositories.projects.loadLastProject();
}
