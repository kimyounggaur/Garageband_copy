import Dexie, { type Table } from "dexie";
import type { Assignment, Submission } from "../education/types";
import type { AudioAsset, Project } from "../types/project";

type MetadataRecord = {
  key: string;
  value: string;
};

class StudioDatabase extends Dexie {
  projects!: Table<Project, string>;
  audioAssets!: Table<AudioAsset, string>;
  assignments!: Table<Assignment, string>;
  submissions!: Table<Submission, string>;
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
    this.version(3).stores({
      projects: "id, name, updatedAt, assignmentId",
      audioAssets: "id, projectId, createdAt",
      assignments: "id, lessonId, dueDate, createdAt",
      submissions: "id, assignmentId, projectId, submittedAt",
      metadata: "key"
    });
  }
}

export const db = new StudioDatabase();
