import type { Assignment, Submission } from "../education/types";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";
import type { AssignmentRepository, AudioAssetRepository, ProjectRepository, SubmissionRepository } from "../db/repositories";

type ApiRepositoryOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function apiJson<T>(options: ApiRepositoryOptions, path: string, init?: RequestInit): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(joinUrl(options.baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export class ApiProjectRepository implements ProjectRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveProject(project: Project) {
    await apiJson(this.options, "/projects", {
      method: "PUT",
      body: JSON.stringify(normalizeProject(project))
    });
  }

  async loadProject(projectId: string) {
    const project = await apiJson<Project | undefined>(this.options, `/projects/${projectId}`);
    return project ? normalizeProject(project) : undefined;
  }

  async listProjects() {
    const projects = await apiJson<Project[]>(this.options, "/projects");
    return projects.map(normalizeProject);
  }

  async deleteProject(projectId: string) {
    await apiJson(this.options, `/projects/${projectId}`, { method: "DELETE" });
  }
}

export class ApiAssignmentRepository implements AssignmentRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveAssignment(assignment: Assignment) {
    return apiJson<Assignment>(this.options, "/assignments", {
      method: "PUT",
      body: JSON.stringify(assignment)
    });
  }

  async loadAssignment(assignmentId: string) {
    return apiJson<Assignment | undefined>(this.options, `/assignments/${assignmentId}`);
  }

  async listAssignments() {
    return apiJson<Assignment[]>(this.options, "/assignments");
  }

  async deleteAssignment(assignmentId: string) {
    await apiJson(this.options, `/assignments/${assignmentId}`, { method: "DELETE" });
  }
}

export class ApiSubmissionRepository implements SubmissionRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveSubmission(submission: Submission) {
    return apiJson<Submission>(this.options, "/submissions", {
      method: "PUT",
      body: JSON.stringify(submission)
    });
  }

  async listSubmissions() {
    return apiJson<Submission[]>(this.options, "/submissions");
  }

  async listSubmissionsForAssignment(assignmentId: string) {
    return apiJson<Submission[]>(this.options, `/assignments/${assignmentId}/submissions`);
  }
}

export class ApiAudioAssetRepository implements AudioAssetRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveAudioAsset(asset: AudioAsset) {
    const formData = new FormData();
    formData.set("id", asset.id);
    formData.set("projectId", asset.projectId);
    formData.set("name", asset.name);
    formData.set("mimeType", asset.mimeType);
    formData.set("durationSeconds", String(asset.durationSeconds));
    formData.set("createdAt", String(asset.createdAt));
    formData.set("blob", asset.blob);
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(joinUrl(this.options.baseUrl, "/audio-assets"), {
      method: "PUT",
      body: formData
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return asset;
  }

  async loadAudioAsset(assetId: string) {
    return apiJson<AudioAsset | undefined>(this.options, `/audio-assets/${assetId}`);
  }

  async listAudioAssets(projectId: string) {
    return apiJson<AudioAsset[]>(this.options, `/projects/${projectId}/audio-assets`);
  }

  async renameAudioAsset(assetId: string, name: string) {
    await apiJson(this.options, `/audio-assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
  }

  async deleteAudioAsset(assetId: string) {
    await apiJson(this.options, `/audio-assets/${assetId}`, { method: "DELETE" });
  }

  async deleteUnusedAudioAssets(projectId: string, usedAssetIds: string[]) {
    const result = await apiJson<{ deleted: number }>(this.options, `/projects/${projectId}/audio-assets/cleanup`, {
      method: "POST",
      body: JSON.stringify({ usedAssetIds })
    });
    return result.deleted;
  }
}
