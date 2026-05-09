import Dexie, { type Table } from "dexie";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";

type MetadataRecord = {
  key: string;
  value: string;
};

class StudioDatabase extends Dexie {
  projects!: Table<Project, string>;
  audioAssets!: Table<AudioAsset, string>;
  metadata!: Table<MetadataRecord, string>;

  constructor() {
    super("webband-studio");
    this.version(1).stores({
      projects: "id, name, updatedAt",
      metadata: "key"
    });
    this.version(2).stores({
      projects: "id, name, updatedAt",
      audioAssets: "id, projectId, createdAt",
      metadata: "key"
    });
  }
}

export const db = new StudioDatabase();

export async function saveProject(project: Project) {
  const normalized = normalizeProject(project);
  await db.projects.put(normalized);
  await db.metadata.put({ key: "lastProjectId", value: normalized.id });
}

export async function loadProject(projectId: string) {
  const project = await db.projects.get(projectId);
  return project ? normalizeProject(project) : undefined;
}

export async function loadLastProject() {
  const metadata = await db.metadata.get("lastProjectId");
  if (!metadata?.value) return undefined;
  return loadProject(metadata.value);
}

export async function saveAudioAsset(asset: AudioAsset) {
  await db.audioAssets.put(asset);
  return asset;
}

export async function loadAudioAsset(assetId: string) {
  return db.audioAssets.get(assetId);
}

export async function listAudioAssets(projectId: string) {
  return db.audioAssets.where("projectId").equals(projectId).toArray();
}

export async function listProjects() {
  const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
  return projects.map(normalizeProject);
}

export async function deleteProject(projectId: string) {
  await db.transaction("rw", db.projects, db.audioAssets, db.metadata, async () => {
    await db.projects.delete(projectId);
    await db.audioAssets.where("projectId").equals(projectId).delete();
  });
  const metadata = await db.metadata.get("lastProjectId");
  if (metadata?.value === projectId) {
    await db.metadata.delete("lastProjectId");
  }
}
