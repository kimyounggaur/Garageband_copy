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
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);
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

  async updateSubmissionFeedback(submissionId: string, feedback: string, status: Submission["status"] = "reviewed") {
    return apiJson<Submission | undefined>(this.options, `/submissions/${submissionId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback, status })
    });
  }

  async listSubmissions() {
    return apiJson<Submission[]>(this.options, "/submissions");
  }

  async listSubmissionsForAssignment(assignmentId: string) {
    return apiJson<Submission[]>(this.options, `/assignments/${assignmentId}/submissions`);
  }
}

export class ApiClassRoomRepository implements ClassRoomRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveClassRoom(classRoom: ClassRoom) {
    return apiJson<ClassRoom>(this.options, "/classes", {
      method: "PUT",
      body: JSON.stringify(classRoom)
    });
  }

  async loadClassRoom(classRoomId: string) {
    return apiJson<ClassRoom | undefined>(this.options, `/classes/${classRoomId}`);
  }

  async listClassRooms() {
    return apiJson<ClassRoom[]>(this.options, "/classes");
  }

  async deleteClassRoom(classRoomId: string) {
    await apiJson(this.options, `/classes/${classRoomId}`, { method: "DELETE" });
  }
}

export class ApiStudentProfileRepository implements StudentProfileRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveStudent(student: StudentProfile) {
    return apiJson<StudentProfile>(this.options, "/students", {
      method: "PUT",
      body: JSON.stringify(student)
    });
  }

  async loadStudent(studentId: string) {
    return apiJson<StudentProfile | undefined>(this.options, `/students/${studentId}`);
  }

  async listStudents() {
    return apiJson<StudentProfile[]>(this.options, "/students");
  }

  async deleteStudent(studentId: string) {
    await apiJson(this.options, `/students/${studentId}`, { method: "DELETE" });
  }
}

export class ApiTeacherProfileRepository implements TeacherProfileRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveTeacher(teacher: TeacherProfile) {
    return apiJson<TeacherProfile>(this.options, "/teachers", {
      method: "PUT",
      body: JSON.stringify(teacher)
    });
  }

  async loadTeacher(teacherId: string) {
    return apiJson<TeacherProfile | undefined>(this.options, `/teachers/${teacherId}`);
  }

  async listTeachers() {
    return apiJson<TeacherProfile[]>(this.options, "/teachers");
  }

  async deleteTeacher(teacherId: string) {
    await apiJson(this.options, `/teachers/${teacherId}`, { method: "DELETE" });
  }
}

export class ApiEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveEnrollment(enrollment: Enrollment) {
    return apiJson<Enrollment>(this.options, "/enrollments", {
      method: "PUT",
      body: JSON.stringify(enrollment)
    });
  }

  async listEnrollments() {
    return apiJson<Enrollment[]>(this.options, "/enrollments");
  }

  async listEnrollmentsForClass(classRoomId: string) {
    return apiJson<Enrollment[]>(this.options, `/classes/${classRoomId}/enrollments`);
  }

  async deleteEnrollment(enrollmentId: string) {
    await apiJson(this.options, `/enrollments/${enrollmentId}`, { method: "DELETE" });
  }
}

export class ApiLessonRepository implements LessonRepository {
  constructor(private readonly options: ApiRepositoryOptions) {}

  async saveLesson(lesson: Lesson) {
    return apiJson<Lesson>(this.options, "/lessons", {
      method: "PUT",
      body: JSON.stringify(lesson)
    });
  }

  async loadLesson(lessonId: string) {
    return apiJson<Lesson | undefined>(this.options, `/lessons/${lessonId}`);
  }

  async listLessons() {
    return apiJson<Lesson[]>(this.options, "/lessons");
  }

  async deleteLesson(lessonId: string) {
    await apiJson(this.options, `/lessons/${lessonId}`, { method: "DELETE" });
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
    if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);
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

export function createApiRepositories(options: ApiRepositoryOptions): StudioRepositories {
  return {
    projects: new ApiProjectRepository(options),
    assignments: new ApiAssignmentRepository(options),
    submissions: new ApiSubmissionRepository(options),
    audioAssets: new ApiAudioAssetRepository(options),
    classRooms: new ApiClassRoomRepository(options),
    students: new ApiStudentProfileRepository(options),
    teachers: new ApiTeacherProfileRepository(options),
    enrollments: new ApiEnrollmentRepository(options),
    lessons: new ApiLessonRepository(options)
  };
}
