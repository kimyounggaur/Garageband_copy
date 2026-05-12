import type { Assignment, ClassRoom, Enrollment, Lesson, StudentProfile, Submission, TeacherProfile } from "../education/types";
import type { AudioAsset, Project } from "../types/project";
import { normalizeProject } from "../utils/projectMigration";
import { db } from "./projectsDb";
import type {
  AssignmentRepository,
  AudioAssetRepository,
  ClassRoomRepository,
  EnrollmentRepository,
  LessonRepository,
  ProjectRepository,
  StudentProfileRepository,
  SubmissionRepository,
  TeacherProfileRepository
} from "./repositories";

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

  async updateSubmissionFeedback(submissionId: string, feedback: string, status: Submission["status"] = "reviewed") {
    const submission = await db.submissions.get(submissionId);
    if (!submission) return undefined;
    const updated: Submission = {
      ...submission,
      status,
      teacherFeedback: feedback,
      teacherFeedbackUpdatedAt: Date.now()
    };
    await db.submissions.put(updated);
    return updated;
  }

  async listSubmissions() {
    return db.submissions.orderBy("submittedAt").reverse().toArray();
  }

  async listSubmissionsForAssignment(assignmentId: string) {
    const submissions = await db.submissions.where("assignmentId").equals(assignmentId).toArray();
    return submissions.sort((left, right) => right.submittedAt - left.submittedAt);
  }
}

export class LocalClassRoomRepository implements ClassRoomRepository {
  async saveClassRoom(classRoom: ClassRoom) {
    await db.classRooms.put(classRoom);
    return classRoom;
  }

  async loadClassRoom(classRoomId: string) {
    return db.classRooms.get(classRoomId);
  }

  async listClassRooms() {
    return db.classRooms.orderBy("updatedAt").reverse().toArray();
  }

  async deleteClassRoom(classRoomId: string) {
    await db.transaction("rw", db.classRooms, db.enrollments, db.assignments, async () => {
      await db.classRooms.delete(classRoomId);
      await db.enrollments.where("classId").equals(classRoomId).delete();
      const assignments = await db.assignments.where("classId").equals(classRoomId).toArray();
      await db.assignments.bulkPut(assignments.map((assignment) => ({ ...assignment, classId: undefined })));
    });
  }
}

export class LocalStudentProfileRepository implements StudentProfileRepository {
  async saveStudent(student: StudentProfile) {
    await db.students.put(student);
    return student;
  }

  async loadStudent(studentId: string) {
    return db.students.get(studentId);
  }

  async listStudents() {
    return db.students.orderBy("updatedAt").reverse().toArray();
  }

  async deleteStudent(studentId: string) {
    await db.transaction("rw", db.students, db.enrollments, async () => {
      await db.students.delete(studentId);
      await db.enrollments.where("studentId").equals(studentId).delete();
    });
  }
}

export class LocalTeacherProfileRepository implements TeacherProfileRepository {
  async saveTeacher(teacher: TeacherProfile) {
    await db.teachers.put(teacher);
    return teacher;
  }

  async loadTeacher(teacherId: string) {
    return db.teachers.get(teacherId);
  }

  async listTeachers() {
    return db.teachers.orderBy("updatedAt").reverse().toArray();
  }

  async deleteTeacher(teacherId: string) {
    await db.teachers.delete(teacherId);
  }
}

export class LocalEnrollmentRepository implements EnrollmentRepository {
  async saveEnrollment(enrollment: Enrollment) {
    await db.enrollments.put(enrollment);
    return enrollment;
  }

  async listEnrollments() {
    return db.enrollments.orderBy("joinedAt").reverse().toArray();
  }

  async listEnrollmentsForClass(classRoomId: string) {
    const enrollments = await db.enrollments.where("classId").equals(classRoomId).toArray();
    return enrollments.sort((left, right) => right.joinedAt - left.joinedAt);
  }

  async deleteEnrollment(enrollmentId: string) {
    await db.enrollments.delete(enrollmentId);
  }
}

export class LocalLessonRepository implements LessonRepository {
  async saveLesson(lesson: Lesson) {
    await db.lessons.put(lesson);
    return lesson;
  }

  async loadLesson(lessonId: string) {
    return db.lessons.get(lessonId);
  }

  async listLessons() {
    return db.lessons.orderBy("updatedAt").reverse().toArray();
  }

  async deleteLesson(lessonId: string) {
    await db.lessons.delete(lessonId);
  }
}
