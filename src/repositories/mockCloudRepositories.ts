import type { Assignment, Submission } from "../education/types";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";
import { db } from "../db/projectsDb";
import type { AssignmentRepository, AudioAssetRepository, ProjectRepository, StudioRepositories, SubmissionRepository } from "../db/repositories";

const PROJECTS_KEY = "webband.mockCloud.projects";
const ASSIGNMENTS_KEY = "webband.mockCloud.assignments";
const SUBMISSIONS_KEY = "webband.mockCloud.submissions";
const LAST_PROJECT_KEY = "webband.mockCloud.lastProjectId";
const AUDIO_PROJECT_PREFIX = "mock-cloud:";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  globalThis.localStorage?.setItem(key, JSON.stringify(value));
}

function cloudProjectId(projectId: string) {
  return `${AUDIO_PROJECT_PREFIX}${projectId}`;
}

function uncloudAssetProjectId(projectId: string) {
  return projectId.startsWith(AUDIO_PROJECT_PREFIX) ? projectId.slice(AUDIO_PROJECT_PREFIX.length) : projectId;
}

async function mockLatency() {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
}

export class MockCloudProjectRepository implements ProjectRepository {
  async saveProject(project: Project) {
    await mockLatency();
    const normalized = normalizeProject(project);
    const projects = readJson<Project[]>(PROJECTS_KEY, []);
    const nextProjects = [normalized, ...projects.filter((item) => item.id !== normalized.id)];
    writeJson(PROJECTS_KEY, nextProjects);
    globalThis.localStorage?.setItem(LAST_PROJECT_KEY, normalized.id);
  }

  async loadProject(projectId: string) {
    await mockLatency();
    const project = readJson<Project[]>(PROJECTS_KEY, []).find((item) => item.id === projectId);
    return project ? normalizeProject(project) : undefined;
  }

  async loadLastProject() {
    const projectId = globalThis.localStorage?.getItem(LAST_PROJECT_KEY);
    return projectId ? this.loadProject(projectId) : undefined;
  }

  async listProjects() {
    await mockLatency();
    return readJson<Project[]>(PROJECTS_KEY, []).map(normalizeProject).sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async deleteProject(projectId: string) {
    await mockLatency();
    writeJson(
      PROJECTS_KEY,
      readJson<Project[]>(PROJECTS_KEY, []).filter((project) => project.id !== projectId)
    );
    await db.audioAssets.where("projectId").equals(cloudProjectId(projectId)).delete();
    if (globalThis.localStorage?.getItem(LAST_PROJECT_KEY) === projectId) {
      globalThis.localStorage.removeItem(LAST_PROJECT_KEY);
    }
  }
}

export class MockCloudAssignmentRepository implements AssignmentRepository {
  async saveAssignment(assignment: Assignment) {
    await mockLatency();
    const assignments = readJson<Assignment[]>(ASSIGNMENTS_KEY, []);
    writeJson(ASSIGNMENTS_KEY, [assignment, ...assignments.filter((item) => item.id !== assignment.id)]);
    return assignment;
  }

  async loadAssignment(assignmentId: string) {
    await mockLatency();
    return readJson<Assignment[]>(ASSIGNMENTS_KEY, []).find((assignment) => assignment.id === assignmentId);
  }

  async listAssignments() {
    await mockLatency();
    return readJson<Assignment[]>(ASSIGNMENTS_KEY, []).sort((left, right) => right.createdAt - left.createdAt);
  }

  async deleteAssignment(assignmentId: string) {
    await mockLatency();
    writeJson(
      ASSIGNMENTS_KEY,
      readJson<Assignment[]>(ASSIGNMENTS_KEY, []).filter((assignment) => assignment.id !== assignmentId)
    );
    writeJson(
      SUBMISSIONS_KEY,
      readJson<Submission[]>(SUBMISSIONS_KEY, []).filter((submission) => submission.assignmentId !== assignmentId)
    );
  }
}

export class MockCloudSubmissionRepository implements SubmissionRepository {
  async saveSubmission(submission: Submission) {
    await mockLatency();
    const submissions = readJson<Submission[]>(SUBMISSIONS_KEY, []);
    writeJson(SUBMISSIONS_KEY, [submission, ...submissions.filter((item) => item.id !== submission.id)]);
    return submission;
  }

  async listSubmissions() {
    await mockLatency();
    return readJson<Submission[]>(SUBMISSIONS_KEY, []).sort((left, right) => right.submittedAt - left.submittedAt);
  }

  async listSubmissionsForAssignment(assignmentId: string) {
    await mockLatency();
    return readJson<Submission[]>(SUBMISSIONS_KEY, [])
      .filter((submission) => submission.assignmentId === assignmentId)
      .sort((left, right) => right.submittedAt - left.submittedAt);
  }
}

export class MockCloudAudioAssetRepository implements AudioAssetRepository {
  async saveAudioAsset(asset: AudioAsset) {
    await mockLatency();
    const cloudAsset = { ...asset, projectId: cloudProjectId(asset.projectId) };
    await db.audioAssets.put(cloudAsset);
    return asset;
  }

  async loadAudioAsset(assetId: string) {
    await mockLatency();
    const asset = await db.audioAssets.get(assetId);
    return asset ? { ...asset, projectId: uncloudAssetProjectId(asset.projectId) } : undefined;
  }

  async listAudioAssets(projectId: string) {
    await mockLatency();
    const assets = await db.audioAssets.where("projectId").equals(cloudProjectId(projectId)).toArray();
    return assets.map((asset) => ({ ...asset, projectId }));
  }

  async renameAudioAsset(assetId: string, name: string) {
    await mockLatency();
    await db.audioAssets.update(assetId, { name });
  }

  async deleteAudioAsset(assetId: string) {
    await mockLatency();
    await db.audioAssets.delete(assetId);
  }

  async deleteUnusedAudioAssets(projectId: string, usedAssetIds: string[]) {
    await mockLatency();
    const used = new Set(usedAssetIds);
    const assets = await db.audioAssets.where("projectId").equals(cloudProjectId(projectId)).toArray();
    const unusedIds = assets.filter((asset) => !used.has(asset.id)).map((asset) => asset.id);
    if (unusedIds.length === 0) return 0;
    await db.audioAssets.bulkDelete(unusedIds);
    return unusedIds.length;
  }
}

export function createMockCloudRepositories(): StudioRepositories & { projects: MockCloudProjectRepository } {
  return {
    projects: new MockCloudProjectRepository(),
    assignments: new MockCloudAssignmentRepository(),
    submissions: new MockCloudSubmissionRepository(),
    audioAssets: new MockCloudAudioAssetRepository()
  };
}
