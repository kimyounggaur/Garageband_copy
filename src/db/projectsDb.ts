import Dexie, { type Table } from "dexie";
import type { Project } from "../types/project";

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
  await db.projects.put(project);
  await db.metadata.put({ key: "lastProjectId", value: project.id });
}

export async function loadProject(projectId: string) {
  return db.projects.get(projectId);
}

export async function loadLastProject() {
  const metadata = await db.metadata.get("lastProjectId");
  if (!metadata?.value) return undefined;
  return loadProject(metadata.value);
}

export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProject(projectId: string) {
  await db.projects.delete(projectId);
  const metadata = await db.metadata.get("lastProjectId");
  if (metadata?.value === projectId) {
    await db.metadata.delete("lastProjectId");
  }
}
