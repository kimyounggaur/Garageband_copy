import Dexie, { type Table } from "dexie";
import type { Assignment, ClassRoom, Enrollment, Lesson, StudentProfile, Submission, TeacherProfile } from "../education/types";
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
  classRooms!: Table<ClassRoom, string>;
  students!: Table<StudentProfile, string>;
  teachers!: Table<TeacherProfile, string>;
  enrollments!: Table<Enrollment, string>;
  lessons!: Table<Lesson, string>;
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
    this.version(4).stores({
      projects: "id, name, updatedAt, assignmentId, classId, studentId",
      audioAssets: "id, projectId, createdAt",
      assignments: "id, lessonId, classId, teacherId, dueDate, createdAt",
      submissions: "id, assignmentId, classId, studentId, projectId, submittedAt, status",
      classRooms: "id, code, teacherId, createdAt, updatedAt",
      students: "id, studentCode, name, createdAt, updatedAt",
      teachers: "id, email, name, createdAt, updatedAt",
      enrollments: "id, classId, studentId, joinedAt",
      lessons: "id, difficulty, custom, updatedAt",
      metadata: "key"
    });
  }
}

export const db = new StudioDatabase();
