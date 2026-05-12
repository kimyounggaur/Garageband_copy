import type { Assignment, ClassRoom, Enrollment, Lesson, StudentProfile, Submission, TeacherProfile } from "../education/types";
import type { AudioAsset, Project } from "../types/project";

export type ProjectRepository = {
  saveProject: (project: Project) => Promise<void>;
  loadProject: (projectId: string) => Promise<Project | undefined>;
  loadLastProject: () => Promise<Project | undefined>;
  listProjects: () => Promise<Project[]>;
  deleteProject: (projectId: string) => Promise<void>;
};

export type AssignmentRepository = {
  saveAssignment: (assignment: Assignment) => Promise<Assignment>;
  loadAssignment: (assignmentId: string) => Promise<Assignment | undefined>;
  listAssignments: () => Promise<Assignment[]>;
  deleteAssignment: (assignmentId: string) => Promise<void>;
};

export type SubmissionRepository = {
  saveSubmission: (submission: Submission) => Promise<Submission>;
  updateSubmissionFeedback: (submissionId: string, feedback: string, status?: Submission["status"]) => Promise<Submission | undefined>;
  listSubmissions: () => Promise<Submission[]>;
  listSubmissionsForAssignment: (assignmentId: string) => Promise<Submission[]>;
};

export type ClassRoomRepository = {
  saveClassRoom: (classRoom: ClassRoom) => Promise<ClassRoom>;
  loadClassRoom: (classRoomId: string) => Promise<ClassRoom | undefined>;
  listClassRooms: () => Promise<ClassRoom[]>;
  deleteClassRoom: (classRoomId: string) => Promise<void>;
};

export type StudentProfileRepository = {
  saveStudent: (student: StudentProfile) => Promise<StudentProfile>;
  loadStudent: (studentId: string) => Promise<StudentProfile | undefined>;
  listStudents: () => Promise<StudentProfile[]>;
  deleteStudent: (studentId: string) => Promise<void>;
};

export type TeacherProfileRepository = {
  saveTeacher: (teacher: TeacherProfile) => Promise<TeacherProfile>;
  loadTeacher: (teacherId: string) => Promise<TeacherProfile | undefined>;
  listTeachers: () => Promise<TeacherProfile[]>;
  deleteTeacher: (teacherId: string) => Promise<void>;
};

export type EnrollmentRepository = {
  saveEnrollment: (enrollment: Enrollment) => Promise<Enrollment>;
  listEnrollments: () => Promise<Enrollment[]>;
  listEnrollmentsForClass: (classRoomId: string) => Promise<Enrollment[]>;
  deleteEnrollment: (enrollmentId: string) => Promise<void>;
};

export type LessonRepository = {
  saveLesson: (lesson: Lesson) => Promise<Lesson>;
  loadLesson: (lessonId: string) => Promise<Lesson | undefined>;
  listLessons: () => Promise<Lesson[]>;
  deleteLesson: (lessonId: string) => Promise<void>;
};

export type AudioAssetRepository = {
  saveAudioAsset: (asset: AudioAsset) => Promise<AudioAsset>;
  loadAudioAsset: (assetId: string) => Promise<AudioAsset | undefined>;
  listAudioAssets: (projectId: string) => Promise<AudioAsset[]>;
  renameAudioAsset: (assetId: string, name: string) => Promise<void>;
  deleteAudioAsset: (assetId: string) => Promise<void>;
  deleteUnusedAudioAssets: (projectId: string, usedAssetIds: string[]) => Promise<number>;
};

export type StudioRepositories = {
  projects: ProjectRepository;
  assignments: AssignmentRepository;
  submissions: SubmissionRepository;
  audioAssets: AudioAssetRepository;
  classRooms: ClassRoomRepository;
  students: StudentProfileRepository;
  teachers: TeacherProfileRepository;
  enrollments: EnrollmentRepository;
  lessons: LessonRepository;
};
