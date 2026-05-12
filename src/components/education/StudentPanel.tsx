import { CheckCircle2, Download, FileArchive, History, PlayCircle, RefreshCcw, UserPlus } from "../icons";
import { useEffect, useMemo, useState } from "react";
import { downloadBlob, exportProjectToWav } from "../../audio/exportProject";
import {
  assignmentRepository,
  classRoomRepository,
  enrollmentRepository,
  lessonRepository,
  projectRepository,
  studentRepository,
  submissionRepository
} from "../../db/studioRepository";
import { cloneLessonProject, getLessonById, registerCustomLessons } from "../../education/lessons";
import { createReviewSummary } from "../../education/reviewProject";
import type { Assignment, ClassRoom, Enrollment, Lesson, StudentProfile, Submission } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { makeId } from "../../utils/id";
import { statusLabel } from "../../utils/labels";
import { normalizeProject } from "../../utils/projectMigration";
import { AssistPanel } from "../assist/AssistPanel";

type SubmitStatus = "idle" | "working" | "done" | "error";

const STUDENT_KEY = "webband.studentPanel.studentId";

function formatDate(value?: number) {
  if (!value) return "마감 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "웹밴드-세션";
}

function exportJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, fileName);
}

function assignmentStatus(assignment: Assignment, projectAssignmentId?: string, latest?: Submission) {
  if (assignment.id === projectAssignmentId) return "진행 중";
  if (!latest) return "시작 전";
  if (latest.status === "needsWork" || !latest.reviewSnapshot.ready) return "보완 필요";
  if (latest.status === "reviewed") return "검토 완료";
  return "제출 완료";
}

export function StudentPanel() {
  const project = useDawStore((state) => state.project);
  const startAssignment = useDawStore((state) => state.startAssignment);
  const loadProject = useDawStore((state) => state.loadProject);
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [customLessons, setCustomLessons] = useState<Lesson[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(() => globalThis.localStorage?.getItem(STUDENT_KEY) ?? "");
  const [newStudentName, setNewStudentName] = useState("내 이름");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const currentAssignment = assignments.find((assignment) => assignment.id === project.assignmentId);
  const currentStudent = students.find((student) => student.id === selectedStudentId);
  const currentClassIds = new Set(enrollments.filter((enrollment) => enrollment.studentId === selectedStudentId).map((enrollment) => enrollment.classId));
  const visibleAssignments = assignments.filter((assignment) => !assignment.classId || currentClassIds.has(assignment.classId));
  const studentSubmissions = submissions.filter((submission) => !selectedStudentId || submission.studentId === selectedStudentId);
  const summary = useMemo(() => createReviewSummary(project, currentAssignment), [currentAssignment, project]);
  const latestByAssignment = useMemo(() => {
    const map = new Map<string, Submission>();
    studentSubmissions.forEach((submission) => {
      const old = map.get(submission.assignmentId);
      if (!old || old.submittedAt < submission.submittedAt) map.set(submission.assignmentId, submission);
    });
    return map;
  }, [studentSubmissions]);

  async function refresh() {
    const [nextClasses, nextStudents, nextEnrollments, nextAssignments, nextSubmissions, nextLessons] = await Promise.all([
      classRoomRepository.listClassRooms(),
      studentRepository.listStudents(),
      enrollmentRepository.listEnrollments(),
      assignmentRepository.listAssignments(),
      submissionRepository.listSubmissions(),
      lessonRepository.listLessons()
    ]);
    registerCustomLessons(nextLessons);
    setClassRooms(nextClasses);
    setStudents(nextStudents);
    setEnrollments(nextEnrollments);
    setAssignments(nextAssignments);
    setSubmissions(nextSubmissions);
    setCustomLessons(nextLessons);
    setSelectedStudentId((current) => current || nextStudents[0]?.id || "");
  }

  async function createStudent() {
    const now = Date.now();
    const student: StudentProfile = {
      id: makeId("student"),
      name: newStudentName.trim() || "학생",
      studentCode: `S-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      createdAt: now,
      updatedAt: now
    };
    await studentRepository.saveStudent(student);
    globalThis.localStorage?.setItem(STUDENT_KEY, student.id);
    setSelectedStudentId(student.id);
    await refresh();
  }

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    globalThis.localStorage?.setItem(STUDENT_KEY, studentId);
  }

  async function handleStartAssignment(assignment: Assignment) {
    const customLesson = assignment.lessonId ? customLessons.find((lesson) => lesson.id === assignment.lessonId) : undefined;
    if (customLesson) {
      const projectFromLesson = cloneLessonProject(customLesson, assignment.title);
      loadProject(
        normalizeProject({
          ...projectFromLesson,
          assignmentId: assignment.id,
          classId: assignment.classId,
          studentId: selectedStudentId || undefined,
          lessonId: assignment.lessonId,
          updatedAt: Date.now()
        })
      );
    } else {
      startAssignment(assignment);
      const nextProject = normalizeProject({
        ...useDawStore.getState().project,
        classId: assignment.classId,
        studentId: selectedStudentId || undefined,
        updatedAt: Date.now()
      });
      loadProject(nextProject);
    }
    await projectRepository.saveProject(useDawStore.getState().project);
  }

  async function handleSubmit() {
    if (!currentAssignment) return;
    setSubmitStatus("working");
    try {
      const currentProject = useDawStore.getState().project;
      const snapshot = createReviewSummary(currentProject, currentAssignment);
      const safeName = fileSafeName(currentProject.name);
      const wavExportName = `${safeName}.wav`;
      const packageFileNames = [`${safeName}.webband.json`, `${safeName}.review-summary.json`, wavExportName];
      const previousAttempts = studentSubmissions.filter(
        (submission) => submission.assignmentId === currentAssignment.id && submission.projectId === currentProject.id
      ).length;
      await projectRepository.saveProject(currentProject);
      exportJson(currentProject, packageFileNames[0]);
      exportJson({ ...snapshot, exportedAt: new Date().toISOString() }, packageFileNames[1]);
      const wav = await exportProjectToWav(currentProject);
      downloadBlob(wav, wavExportName);
      await submissionRepository.saveSubmission({
        id: makeId("submission"),
        assignmentId: currentAssignment.id,
        classId: currentAssignment.classId,
        studentId: selectedStudentId || undefined,
        studentName: currentStudent?.name,
        projectId: currentProject.id,
        submittedAt: Date.now(),
        status: previousAttempts > 0 ? "resubmitted" : "submitted",
        attemptNumber: previousAttempts + 1,
        reviewSnapshot: snapshot,
        wavExportName,
        packageFileNames
      });
      setSubmitStatus("done");
      await refresh();
    } catch {
      setSubmitStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <aside className="panel grid min-h-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">학생 보기</span>
        <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="과제 새로고침" aria-label="과제 새로고침">
          <RefreshCcw size={13} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">내 정보</div>
          <select className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={selectedStudentId} onChange={(event) => selectStudent(event.target.value)}>
            <option value="">학생 선택</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <input className="h-8 rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={newStudentName} onChange={(event) => setNewStudentName(event.target.value)} placeholder="학생 이름" />
            <button className="studio-button" onClick={() => void createStudent()}>
              <UserPlus size={14} />
              등록
            </button>
          </div>
          <div className="mt-2 text-[11px] leading-5 text-slate-500">
            {currentStudent ? `${currentStudent.name} · ${[...currentClassIds].map((id) => classRooms.find((classRoom) => classRoom.id === id)?.title).filter(Boolean).join(", ") || "소속 반 없음"}` : "학생을 선택하면 과제 제출 이력이 연결됩니다."}
          </div>
        </div>

        {currentAssignment ? (
          <div className="mt-3 rounded-md border border-meter-cyan/30 bg-meter-cyan/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100/80">현재 과제</div>
            <div className="mt-1 text-sm font-black text-slate-100">{currentAssignment.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">{currentAssignment.description}</div>
            <div className="mt-2 text-[11px] font-bold text-slate-400">
              {getLessonById(currentAssignment.lessonId)?.title ?? "자유 프로젝트"} · {formatDate(currentAssignment.dueDate)}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
            과제를 선택하면 템플릿 프로젝트가 열립니다.
          </div>
        )}

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">내 과제</div>
          <div className="space-y-2">
            {visibleAssignments.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">아직 배정된 과제가 없습니다.</div>
            ) : (
              visibleAssignments.map((assignment) => {
                const latest = latestByAssignment.get(assignment.id);
                const isCurrent = assignment.id === project.assignmentId;
                return (
                  <div key={assignment.id} className={`rounded-md border p-3 ${isCurrent ? "border-meter-cyan bg-meter-cyan/10" : "border-white/10 bg-white/[0.045]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-100">{assignment.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{getLessonById(assignment.lessonId)?.title ?? "자유 프로젝트"} · {formatDate(assignment.dueDate)}</div>
                      </div>
                      {latest?.reviewSnapshot.ready ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-meter-green" /> : null}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">{assignment.description}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                      <span>{assignmentStatus(assignment, project.assignmentId, latest)}</span>
                      <span>{latest ? `${latest.attemptNumber ?? 1}회 제출` : "미제출"}</span>
                    </div>
                    <button className="studio-button mt-3 w-full" onClick={() => void handleStartAssignment(assignment)}>
                      <PlayCircle size={14} />
                      {isCurrent ? "계속 작업" : latest ? "재제출 작업 시작" : "시작"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <FileArchive size={14} />
            제출 패키지
          </div>
          <div className="mt-2 rounded-md border border-white/10 bg-white/[0.045] p-2">
            <div className={`text-sm font-black ${summary.ready ? "text-green-100" : "text-amber-100"}`}>{summary.statusLabel}</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">{summary.studentMessage}</div>
            <div className="mt-2 rounded border border-meter-cyan/20 bg-meter-cyan/10 p-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100/70">다음 한 가지</div>
              <div className="mt-1 text-xs font-black text-slate-100">{summary.nextAction.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-400">{summary.nextAction.message}</div>
            </div>
          </div>
          <button className="studio-button mt-3 w-full" onClick={() => void handleSubmit()} disabled={!currentAssignment || submitStatus === "working"}>
            <Download size={15} />
            {statusLabel(submitStatus, "제출 파일 만들기")}
          </button>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <History size={14} />
            제출 이력
          </div>
          <div className="space-y-2">
            {studentSubmissions.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">제출 이력이 없습니다.</div>
            ) : (
              studentSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">{submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{formatDate(submission.submittedAt)} · {submission.attemptNumber ?? 1}회차</div>
                    </div>
                    <span className={`rounded px-2 py-1 text-[10px] font-black ${submission.reviewSnapshot.ready ? "bg-meter-green/15 text-green-100" : "bg-meter-amber/15 text-amber-100"}`}>
                      {submission.reviewSnapshot.statusLabel}
                    </span>
                  </div>
                  {submission.teacherFeedback ? <div className="mt-2 rounded border border-meter-cyan/20 bg-meter-cyan/10 p-2 text-xs leading-5 text-slate-300">교사 피드백: {submission.teacherFeedback}</div> : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3">
          <AssistPanel />
        </div>
      </div>
    </aside>
  );
}
