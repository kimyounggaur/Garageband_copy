import type { Assignment, Submission } from "../education/types";
import type { Project } from "../types/project";

export type RepositoryMode = "local" | "mockCloud" | "supabase";

export type CloudRole = "student" | "teacher";

export type CloudIdentity = {
  id: string;
  email?: string;
  displayName: string;
  role: CloudRole;
  accessToken?: string;
  expiresAt?: number;
};

export type ClassRoom = {
  id: string;
  code: string;
  title: string;
  teacherId: string;
  createdAt: number;
};

export type ClassEnrollment = {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: number;
};

export type SharedAssignment = Assignment & {
  classId?: string;
  ownerId?: string;
};

export type SharedSubmission = Submission & {
  classId?: string;
  studentId?: string;
};

export type CloudProjectRecord = Project & {
  ownerId?: string;
  classId?: string;
  sharedAt?: number;
};
