import type { Assignment, ClassRoom, Enrollment, Lesson, StudentProfile, Submission, TeacherProfile } from "../education/types";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";
import type {
  AssignmentRepository,
  AudioAssetRepository,
  ClassRoomRepository,
  EnrollmentRepository,
  LessonRepository,
  ProjectRepository,
  StudioRepositories,
  StudentProfileRepository,
  SubmissionRepository,
  TeacherProfileRepository
} from "../db/repositories";
import {
  getSupabaseConfig,
  readCloudIdentity,
  supabaseDeleteObject,
  supabaseDownload,
  supabaseJson,
  supabaseUpload
} from "./supabaseClient";

const LAST_PROJECT_KEY = "webband.supabase.lastProjectId";

function iso(value?: number) {
  return value ? new Date(value).toISOString() : undefined;
}

function ms(value?: string | null) {
  return value ? new Date(value).getTime() : undefined;
}

function one<T>(items: T[]) {
  return items[0];
}

async function upsert<T>(table: string, row: Record<string, unknown>, fromRow: (row: any) => T) {
  const rows = await supabaseJson<any[]>(`${table}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row)
  });
  return fromRow(one(rows));
}

async function deleteRow(table: string, id: string) {
  await supabaseJson(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

function projectRow(project: Project) {
  const normalized = normalizeProject(project);
  const identity = readCloudIdentity();
  return {
    id: normalized.id,
    owner_id: identity?.id,
    class_id: normalized.classId,
    student_id: normalized.studentId,
    assignment_id: normalized.assignmentId,
    lesson_id: normalized.lessonId,
    name: normalized.name,
    payload: normalized,
    created_at: iso(normalized.createdAt),
    updated_at: iso(normalized.updatedAt)
  };
}

function projectFromRow(row: any): Project {
  return normalizeProject({
    ...row.payload,
    id: row.id,
    name: row.name ?? row.payload?.name,
    classId: row.class_id ?? row.payload?.classId,
    studentId: row.student_id ?? row.payload?.studentId,
    assignmentId: row.assignment_id ?? row.payload?.assignmentId,
    lessonId: row.lesson_id ?? row.payload?.lessonId,
    createdAt: ms(row.created_at) ?? row.payload?.createdAt,
    updatedAt: ms(row.updated_at) ?? row.payload?.updatedAt
  });
}

function classRow(classRoom: ClassRoom) {
  return {
    id: classRoom.id,
    title: classRoom.title,
    code: classRoom.code,
    description: classRoom.description,
    teacher_id: classRoom.teacherId,
    created_at: iso(classRoom.createdAt),
    updated_at: iso(classRoom.updatedAt)
  };
}

function classFromRow(row: any): ClassRoom {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    description: row.description ?? undefined,
    teacherId: row.teacher_id ?? undefined,
    createdAt: ms(row.created_at) ?? Date.now(),
    updatedAt: ms(row.updated_at) ?? Date.now()
  };
}

function studentRow(student: StudentProfile) {
  return {
    id: student.id,
    name: student.name,
    student_code: student.studentCode,
    email: student.email,
    created_at: iso(student.createdAt),
    updated_at: iso(student.updatedAt)
  };
}

function studentFromRow(row: any): StudentProfile {
  return {
    id: row.id,
    name: row.name,
    studentCode: row.student_code ?? undefined,
    email: row.email ?? undefined,
    createdAt: ms(row.created_at) ?? Date.now(),
    updatedAt: ms(row.updated_at) ?? Date.now()
  };
}

function teacherRow(teacher: TeacherProfile) {
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    created_at: iso(teacher.createdAt),
    updated_at: iso(teacher.updatedAt)
  };
}

function teacherFromRow(row: any): TeacherProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    createdAt: ms(row.created_at) ?? Date.now(),
    updatedAt: ms(row.updated_at) ?? Date.now()
  };
}

function enrollmentRow(enrollment: Enrollment) {
  return {
    id: enrollment.id,
    class_id: enrollment.classId,
    student_id: enrollment.studentId,
    joined_at: iso(enrollment.joinedAt)
  };
}

function enrollmentFromRow(row: any): Enrollment {
  return {
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    joinedAt: ms(row.joined_at) ?? Date.now()
  };
}

function lessonRow(lesson: Lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    goal: lesson.goal,
    difficulty: lesson.difficulty,
    estimated_minutes: lesson.estimatedMinutes,
    template_project: lesson.templateProject,
    missions: lesson.missions,
    rubric: lesson.rubric,
    custom: lesson.custom ?? true,
    author_id: lesson.authorId,
    created_at: iso(lesson.createdAt),
    updated_at: iso(lesson.updatedAt)
  };
}

function lessonFromRow(row: any): Lesson {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal ?? "",
    difficulty: row.difficulty ?? "starter",
    estimatedMinutes: row.estimated_minutes ?? 20,
    templateProject: normalizeProject(row.template_project),
    missions: row.missions ?? [],
    rubric: row.rubric ?? { criteria: [] },
    custom: row.custom ?? true,
    authorId: row.author_id ?? undefined,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at)
  };
}

function assignmentRow(assignment: Assignment) {
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    lesson_id: assignment.lessonId,
    class_id: assignment.classId,
    teacher_id: assignment.teacherId,
    assigned_student_ids: assignment.assignedStudentIds ?? [],
    due_date: iso(assignment.dueDate),
    rubric: assignment.rubric,
    created_at: iso(assignment.createdAt),
    updated_at: iso(assignment.updatedAt)
  };
}

function assignmentFromRow(row: any): Assignment {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    lessonId: row.lesson_id ?? undefined,
    classId: row.class_id ?? undefined,
    teacherId: row.teacher_id ?? undefined,
    assignedStudentIds: row.assigned_student_ids ?? [],
    dueDate: ms(row.due_date),
    rubric: row.rubric ?? { criteria: [] },
    createdAt: ms(row.created_at) ?? Date.now(),
    updatedAt: ms(row.updated_at)
  };
}

function submissionRow(submission: Submission) {
  return {
    id: submission.id,
    assignment_id: submission.assignmentId,
    class_id: submission.classId,
    student_id: submission.studentId,
    student_name: submission.studentName,
    project_id: submission.projectId,
    status: submission.status,
    attempt_number: submission.attemptNumber,
    review_snapshot: submission.reviewSnapshot,
    package_file_names: submission.packageFileNames ?? [],
    wav_export_name: submission.wavExportName,
    teacher_feedback: submission.teacherFeedback,
    teacher_feedback_updated_at: iso(submission.teacherFeedbackUpdatedAt),
    submitted_at: iso(submission.submittedAt)
  };
}

function submissionFromRow(row: any): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    classId: row.class_id ?? undefined,
    studentId: row.student_id ?? undefined,
    studentName: row.student_name ?? undefined,
    projectId: row.project_id,
    status: row.status ?? undefined,
    attemptNumber: row.attempt_number ?? undefined,
    reviewSnapshot: row.review_snapshot,
    packageFileNames: row.package_file_names ?? [],
    wavExportName: row.wav_export_name ?? undefined,
    teacherFeedback: row.teacher_feedback ?? undefined,
    teacherFeedbackUpdatedAt: ms(row.teacher_feedback_updated_at),
    submittedAt: ms(row.submitted_at) ?? Date.now()
  };
}

export class SupabaseProjectRepository implements ProjectRepository {
  async saveProject(project: Project) {
    const normalized = normalizeProject(project);
    await upsert("projects", projectRow(normalized), projectFromRow);
    globalThis.localStorage?.setItem(LAST_PROJECT_KEY, normalized.id);
  }

  async loadProject(projectId: string) {
    const rows = await supabaseJson<any[]>(`projects?id=eq.${encodeURIComponent(projectId)}&select=*`);
    return rows[0] ? projectFromRow(rows[0]) : undefined;
  }

  async loadLastProject() {
    const id = globalThis.localStorage?.getItem(LAST_PROJECT_KEY);
    if (!id) return undefined;
    return this.loadProject(id);
  }

  async listProjects() {
    const rows = await supabaseJson<any[]>("projects?select=*&order=updated_at.desc");
    return rows.map(projectFromRow);
  }

  async deleteProject(projectId: string) {
    await deleteRow("projects", projectId);
    if (globalThis.localStorage?.getItem(LAST_PROJECT_KEY) === projectId) {
      globalThis.localStorage.removeItem(LAST_PROJECT_KEY);
    }
  }
}

export class SupabaseClassRoomRepository implements ClassRoomRepository {
  saveClassRoom(classRoom: ClassRoom) {
    return upsert("classes", classRow(classRoom), classFromRow);
  }
  async loadClassRoom(classRoomId: string) {
    return one((await supabaseJson<any[]>(`classes?id=eq.${encodeURIComponent(classRoomId)}&select=*`)).map(classFromRow));
  }
  async listClassRooms() {
    return (await supabaseJson<any[]>("classes?select=*&order=updated_at.desc")).map(classFromRow);
  }
  async deleteClassRoom(classRoomId: string) {
    await deleteRow("classes", classRoomId);
  }
}

export class SupabaseStudentProfileRepository implements StudentProfileRepository {
  saveStudent(student: StudentProfile) {
    return upsert("students", studentRow(student), studentFromRow);
  }
  async loadStudent(studentId: string) {
    return one((await supabaseJson<any[]>(`students?id=eq.${encodeURIComponent(studentId)}&select=*`)).map(studentFromRow));
  }
  async listStudents() {
    return (await supabaseJson<any[]>("students?select=*&order=updated_at.desc")).map(studentFromRow);
  }
  async deleteStudent(studentId: string) {
    await deleteRow("students", studentId);
  }
}

export class SupabaseTeacherProfileRepository implements TeacherProfileRepository {
  saveTeacher(teacher: TeacherProfile) {
    return upsert("teachers", teacherRow(teacher), teacherFromRow);
  }
  async loadTeacher(teacherId: string) {
    return one((await supabaseJson<any[]>(`teachers?id=eq.${encodeURIComponent(teacherId)}&select=*`)).map(teacherFromRow));
  }
  async listTeachers() {
    return (await supabaseJson<any[]>("teachers?select=*&order=updated_at.desc")).map(teacherFromRow);
  }
  async deleteTeacher(teacherId: string) {
    await deleteRow("teachers", teacherId);
  }
}

export class SupabaseEnrollmentRepository implements EnrollmentRepository {
  saveEnrollment(enrollment: Enrollment) {
    return upsert("enrollments", enrollmentRow(enrollment), enrollmentFromRow);
  }
  async listEnrollments() {
    return (await supabaseJson<any[]>("enrollments?select=*&order=joined_at.desc")).map(enrollmentFromRow);
  }
  async listEnrollmentsForClass(classRoomId: string) {
    return (await supabaseJson<any[]>(`enrollments?class_id=eq.${encodeURIComponent(classRoomId)}&select=*&order=joined_at.desc`)).map(
      enrollmentFromRow
    );
  }
  async deleteEnrollment(enrollmentId: string) {
    await deleteRow("enrollments", enrollmentId);
  }
}

export class SupabaseLessonRepository implements LessonRepository {
  saveLesson(lesson: Lesson) {
    return upsert("lessons", lessonRow(lesson), lessonFromRow);
  }
  async loadLesson(lessonId: string) {
    return one((await supabaseJson<any[]>(`lessons?id=eq.${encodeURIComponent(lessonId)}&select=*`)).map(lessonFromRow));
  }
  async listLessons() {
    return (await supabaseJson<any[]>("lessons?select=*&order=updated_at.desc")).map(lessonFromRow);
  }
  async deleteLesson(lessonId: string) {
    await deleteRow("lessons", lessonId);
  }
}

export class SupabaseAssignmentRepository implements AssignmentRepository {
  saveAssignment(assignment: Assignment) {
    return upsert("assignments", assignmentRow(assignment), assignmentFromRow);
  }
  async loadAssignment(assignmentId: string) {
    return one((await supabaseJson<any[]>(`assignments?id=eq.${encodeURIComponent(assignmentId)}&select=*`)).map(assignmentFromRow));
  }
  async listAssignments() {
    return (await supabaseJson<any[]>("assignments?select=*&order=created_at.desc")).map(assignmentFromRow);
  }
  async deleteAssignment(assignmentId: string) {
    await deleteRow("assignments", assignmentId);
  }
}

export class SupabaseSubmissionRepository implements SubmissionRepository {
  saveSubmission(submission: Submission) {
    return upsert("submissions", submissionRow(submission), submissionFromRow);
  }
  async updateSubmissionFeedback(submissionId: string, feedback: string, status: Submission["status"] = "reviewed") {
    const rows = await supabaseJson<any[]>(`submissions?id=eq.${encodeURIComponent(submissionId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        teacher_feedback: feedback,
        teacher_feedback_updated_at: new Date().toISOString(),
        status
      })
    });
    return rows[0] ? submissionFromRow(rows[0]) : undefined;
  }
  async listSubmissions() {
    return (await supabaseJson<any[]>("submissions?select=*&order=submitted_at.desc")).map(submissionFromRow);
  }
  async listSubmissionsForAssignment(assignmentId: string) {
    return (await supabaseJson<any[]>(`submissions?assignment_id=eq.${encodeURIComponent(assignmentId)}&select=*&order=submitted_at.desc`)).map(
      submissionFromRow
    );
  }
}

export class SupabaseAudioAssetRepository implements AudioAssetRepository {
  private storagePath(asset: Pick<AudioAsset, "projectId" | "id">) {
    return `${getSupabaseConfig().audioBucket}/${asset.projectId}/${asset.id}`;
  }

  async saveAudioAsset(asset: AudioAsset) {
    const storagePath = this.storagePath(asset);
    await supabaseUpload(storagePath, asset.blob, asset.mimeType || "application/octet-stream");
    return upsert(
      "audio_assets",
      {
        id: asset.id,
        project_id: asset.projectId,
        name: asset.name,
        mime_type: asset.mimeType,
        duration_seconds: asset.durationSeconds,
        storage_path: storagePath,
        created_at: iso(asset.createdAt)
      },
      (row) => ({ ...asset, name: row.name ?? asset.name })
    );
  }

  async loadAudioAsset(assetId: string) {
    const row = one(await supabaseJson<any[]>(`audio_assets?id=eq.${encodeURIComponent(assetId)}&select=*`));
    if (!row) return undefined;
    const blob = await supabaseDownload(row.storage_path);
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      blob,
      mimeType: row.mime_type ?? blob.type,
      durationSeconds: Number(row.duration_seconds ?? 0),
      createdAt: ms(row.created_at) ?? Date.now()
    };
  }

  async listAudioAssets(projectId: string) {
    const rows = await supabaseJson<any[]>(`audio_assets?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.desc`);
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      blob: new Blob([], { type: row.mime_type ?? "application/octet-stream" }),
      mimeType: row.mime_type ?? "application/octet-stream",
      durationSeconds: Number(row.duration_seconds ?? 0),
      createdAt: ms(row.created_at) ?? Date.now()
    }));
  }

  async renameAudioAsset(assetId: string, name: string) {
    await supabaseJson(`audio_assets?id=eq.${encodeURIComponent(assetId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
  }

  async deleteAudioAsset(assetId: string) {
    const row = one(await supabaseJson<any[]>(`audio_assets?id=eq.${encodeURIComponent(assetId)}&select=storage_path`));
    if (row?.storage_path) await supabaseDeleteObject(row.storage_path);
    await deleteRow("audio_assets", assetId);
  }

  async deleteUnusedAudioAssets(projectId: string, usedAssetIds: string[]) {
    const assets = await supabaseJson<any[]>(`audio_assets?project_id=eq.${encodeURIComponent(projectId)}&select=id,storage_path`);
    const used = new Set(usedAssetIds);
    const unused = assets.filter((asset) => !used.has(asset.id));
    await Promise.all(unused.map((asset) => asset.storage_path && supabaseDeleteObject(asset.storage_path)));
    await Promise.all(unused.map((asset) => deleteRow("audio_assets", asset.id)));
    return unused.length;
  }
}

export function createSupabaseRepositories(): StudioRepositories & { projects: SupabaseProjectRepository } {
  return {
    projects: new SupabaseProjectRepository(),
    assignments: new SupabaseAssignmentRepository(),
    submissions: new SupabaseSubmissionRepository(),
    audioAssets: new SupabaseAudioAssetRepository(),
    classRooms: new SupabaseClassRoomRepository(),
    students: new SupabaseStudentProfileRepository(),
    teachers: new SupabaseTeacherProfileRepository(),
    enrollments: new SupabaseEnrollmentRepository(),
    lessons: new SupabaseLessonRepository()
  };
}
