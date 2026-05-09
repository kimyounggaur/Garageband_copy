import Dexie, { type Table } from "dexie";
import type { Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";

type MetadataRecord = {
  key: string;
  value: string;
};

class StudioDatabase extends Dexie {
  projects!: Table<Project, string>;
  metadata!: Table<MetadataRecord, string>;

  constructor() {
    super("webband-studio");
    this.version(1).stores({
      projects: "id, name, updatedAt",
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

export async function listProjects() {
  const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
  return projects.map(normalizeProject);
}

export async function deleteProject(projectId: string) {
  await db.projects.delete(projectId);
  const metadata = await db.metadata.get("lastProjectId");
  if (metadata?.value === projectId) {
    await db.metadata.delete("lastProjectId");
  }
}
