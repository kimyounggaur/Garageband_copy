import type { Assignment, Submission } from "../education/types";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";
import { db } from "./projectsDb";
import type { AssignmentRepository, AudioAssetRepository, ProjectRepository, SubmissionRepository } from "./repositories";

export class LocalProjectRepository implements ProjectRepository {
  async saveProject(project: Project) {
    const normalized = normalizeProject(project);
    await db.projects.put(normalized);
    await db.metadata.put({ key: "lastProjectId", value: normalized.id });
  }

  async loadProject(projectId: string) {
    const project = await db.projects.get(projectId);
    return project ? normalizeProject(project) : undefined;
  }

  async loadLastProject() {
    const metadata = await db.metadata.get("lastProjectId");
    if (!metadata?.value) return undefined;
    return this.loadProject(metadata.value);
  }

  async listProjects() {
    const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
    return projects.map(normalizeProject);
  }

  async deleteProject(projectId: string) {
    await db.transaction("rw", db.projects, db.audioAssets, db.metadata, async () => {
      await db.projects.delete(projectId);
      await db.audioAssets.where("projectId").equals(projectId).delete();
    });
    const metadata = await db.metadata.get("lastProjectId");
    if (metadata?.value === projectId) {
      await db.metadata.delete("lastProjectId");
    }
  }
}

export class LocalAudioAssetRepository implements AudioAssetRepository {
  async saveAudioAsset(asset: AudioAsset) {
    await db.audioAssets.put(asset);
    return asset;
  }

  async loadAudioAsset(assetId: string) {
    return db.audioAssets.get(assetId);
  }

  async listAudioAssets(projectId: string) {
    return db.audioAssets.where("projectId").equals(projectId).toArray();
  }

  async renameAudioAsset(assetId: string, name: string) {
    await db.audioAssets.update(assetId, { name });
  }

  async deleteAudioAsset(assetId: string) {
    await db.audioAssets.delete(assetId);
  }

  async deleteUnusedAudioAssets(projectId: string, usedAssetIds: string[]) {
    const used = new Set(usedAssetIds);
    const assets = await this.listAudioAssets(projectId);
    const unusedIds = assets.filter((asset) => !used.has(asset.id)).map((asset) => asset.id);
    if (unusedIds.length === 0) return 0;
    await db.audioAssets.bulkDelete(unusedIds);
    return unusedIds.length;
  }
}

export class LocalAssignmentRepository implements AssignmentRepository {
  async saveAssignment(assignment: Assignment) {
    await db.assignments.put(assignment);
    return assignment;
  }

  async loadAssignment(assignmentId: string) {
    return db.assignments.get(assignmentId);
  }

  async listAssignments() {
    return db.assignments.orderBy("createdAt").reverse().toArray();
  }

  async deleteAssignment(assignmentId: string) {
    await db.transaction("rw", db.assignments, db.submissions, async () => {
      await db.assignments.delete(assignmentId);
      await db.submissions.where("assignmentId").equals(assignmentId).delete();
    });
  }
}

export class LocalSubmissionRepository implements SubmissionRepository {
  async saveSubmission(submission: Submission) {
    await db.submissions.put(submission);
    return submission;
  }

  async listSubmissions() {
    return db.submissions.orderBy("submittedAt").reverse().toArray();
  }

  async listSubmissionsForAssignment(assignmentId: string) {
    const submissions = await db.submissions.where("assignmentId").equals(assignmentId).toArray();
    return submissions.sort((left, right) => right.submittedAt - left.submittedAt);
  }
}
