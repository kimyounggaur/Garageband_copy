import { ClipboardList, Download, Eye, MessageSquare, Plus, RefreshCcw, Trash2, UserPlus, Users } from "../icons";
import { useEffect, useMemo, useState } from "react";
import { downloadBlob } from "../../audio/exportProject";
import {
  assignmentRepository,
  classRoomRepository,
  enrollmentRepository,
  lessonRepository,
  studentRepository,
  submissionRepository
} from "../../db/studioRepository";
import { rubricForLesson } from "../../education/assignments";
import { LESSONS, getLessonById, registerCustomLessons } from "../../education/lessons";
import type { Assignment, ClassRoom, Enrollment, Lesson, ReviewSummary, StudentProfile, Submission } from "../../education/types";
import { makeId } from "../../utils/id";
import { LessonBuilderPanel } from "./LessonBuilderPanel";

function formatDate(value?: number) {
  if (!value) return "마감 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function scorePercent(summary: ReviewSummary) {
  return summary.rubricScore?.percent ?? 0;
}

function scoreLabel(summary: ReviewSummary) {
  return summary.rubricScore ? `${summary.rubricScore.earned}/${summary.rubricScore.possible}` : "0/0";
}

function warningCount(summary: ReviewSummary) {
  return summary.items.filter((item) => item.severity === "warning").length;
}

function completedMissionCount(summary: ReviewSummary) {
  return summary.missionResults.filter((mission) => mission.completed).length;
}

function submissionAttempts(submission: Submission, submissions: Submission[]) {
  return submissions.filter((item) => item.assignmentId === submission.assignmentId && item.projectId === submission.projectId).length;
}

function makeClassCode(title: string) {
  const prefix = title
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return `${prefix || "CLASS"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function TeacherPanel() {
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [customLessons, setCustomLessons] = useState<Lesson[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>();
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [classTitle, setClassTitle] = useState("1학년 음악 A반");
  const [classDescription, setClassDescription] = useState("웹밴드 스튜디오 수업");
  const [studentName, setStudentName] = useState("새 학생");
  const [title, setTitle] = useState("8마디 창작 과제");
  const [description, setDescription] = useState("오늘 만든 프로젝트를 검토한 뒤 제출하세요.");
  const [lessonId, setLessonId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const allLessons = useMemo(() => [...LESSONS, ...customLessons], [customLessons]);
  const selectedClass = classRooms.find((classRoom) => classRoom.id === selectedClassId);
  const selectedEnrollments = enrollments.filter((enrollment) => !selectedClassId || enrollment.classId === selectedClassId);
  const selectedStudentIds = new Set(selectedEnrollments.map((enrollment) => enrollment.studentId));
  const selectedStudents = students.filter((student) => selectedStudentIds.has(student.id));
  const selectedAssignments = assignments.filter((assignment) => !selectedClassId || assignment.classId === selectedClassId);
  const selectedSubmissions = submissions.filter((submission) => !selectedClassId || submission.classId === selectedClassId);
  const selectedSubmission = selectedSubmissions.find((submission) => submission.id === selectedSubmissionId) ?? selectedSubmissions[0];

  const dashboard = useMemo(() => {
    const total = selectedSubmissions.length;
    const ready = selectedSubmissions.filter((submission) => submission.reviewSnapshot.ready).length;
    const needsWork = total - ready;
    const averageScore =
      total > 0 ? Math.round(selectedSubmissions.reduce((sum, submission) => sum + scorePercent(submission.reviewSnapshot), 0) / total) : 0;
    const openWarnings = selectedSubmissions.reduce((sum, submission) => sum + warningCount(submission.reviewSnapshot), 0);
    return { total, ready, needsWork, averageScore, openWarnings };
  }, [selectedSubmissions]);

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
    setSelectedClassId((current) => current || nextClasses[0]?.id || "");
  }

  async function createClassRoom() {
    const now = Date.now();
    const classRoom: ClassRoom = {
      id: makeId("class"),
      title: classTitle.trim() || "새 수업",
      code: makeClassCode(classTitle),
      description: classDescription.trim(),
      teacherId: "local-teacher",
      createdAt: now,
      updatedAt: now
    };
    await classRoomRepository.saveClassRoom(classRoom);
    setSelectedClassId(classRoom.id);
    await refresh();
  }

  async function addStudent() {
    const now = Date.now();
    const student: StudentProfile = {
      id: makeId("student"),
      name: studentName.trim() || "이름 없는 학생",
      studentCode: `S-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      createdAt: now,
      updatedAt: now
    };
    await studentRepository.saveStudent(student);
    if (selectedClassId) {
      await enrollmentRepository.saveEnrollment({
        id: makeId("enrollment"),
        classId: selectedClassId,
        studentId: student.id,
        joinedAt: now
      });
    }
    setStudentName("");
    await refresh();
  }

  async function createAssignment() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const assignment: Assignment = {
      id: makeId("assignment"),
      title: trimmedTitle,
      description: description.trim() || "제출 전 검토를 확인하세요.",
      lessonId: lessonId || undefined,
      classId: selectedClassId || undefined,
      teacherId: "local-teacher",
      assignedStudentIds: selectedStudents.map((student) => student.id),
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      rubric: rubricForLesson(lessonId || undefined),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await assignmentRepository.saveAssignment(assignment);
    setTitle("");
    setDescription("");
    setDueDate("");
    await refresh();
  }

  async function deleteAssignment(id: string) {
    await assignmentRepository.deleteAssignment(id);
    await refresh();
  }

  async function saveFeedback(submission: Submission) {
    const feedback = feedbackDrafts[submission.id] ?? submission.teacherFeedback ?? "";
    await submissionRepository.updateSubmissionFeedback(submission.id, feedback, feedback.trim() ? "reviewed" : submission.status);
    await refresh();
  }

  function exportCsv() {
    const header = ["반", "학생", "과제", "상태", "점수", "경고", "미션", "제출일", "교사 피드백"];
    const rows = selectedSubmissions.map((submission) => [
      selectedClass?.title ?? submission.classId ?? "",
      submission.studentName ?? submission.studentId ?? "학생",
      submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId,
      submission.reviewSnapshot.statusLabel,
      scoreLabel(submission.reviewSnapshot),
      warningCount(submission.reviewSnapshot),
      `${completedMissionCount(submission.reviewSnapshot)}/${submission.reviewSnapshot.missionResults.length || 0}`,
      formatDate(submission.submittedAt),
      submission.teacherFeedback ?? ""
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `${selectedClass?.title ?? "수업"}-제출현황.csv`);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <aside className="panel grid min-h-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">교사 보기</span>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button h-7 w-7" onClick={exportCsv} title="CSV 내보내기" aria-label="CSV 내보내기">
            <Download size={13} />
          </button>
          <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="수업 데이터 새로고침" aria-label="수업 데이터 새로고침">
            <RefreshCcw size={13} />
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">제출물</div>
            <div className="mt-1 text-xl font-black text-slate-100">{dashboard.total}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">평균 점수</div>
            <div className="mt-1 text-xl font-black text-slate-100">{dashboard.averageScore}%</div>
          </div>
          <div className="rounded-md border border-meter-green/25 bg-meter-green/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-100/75">제출 가능</div>
            <div className="mt-1 text-xl font-black text-green-100">{dashboard.ready}</div>
          </div>
          <div className="rounded-md border border-meter-amber/25 bg-meter-amber/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/75">보완 필요</div>
            <div className="mt-1 text-xl font-black text-amber-100">{dashboard.needsWork}</div>
            <div className="text-[10px] font-bold text-amber-100/65">경고 {dashboard.openWarnings}개</div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <Users size={14} />
            반과 학생
          </div>
          <div className="space-y-2">
            <select className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
              <option value="">전체 수업</option>
              {classRooms.map((classRoom) => (
                <option key={classRoom.id} value={classRoom.id}>
                  {classRoom.title} · {classRoom.code}
                </option>
              ))}
            </select>
            <input className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={classTitle} onChange={(event) => setClassTitle(event.target.value)} placeholder="반 이름" />
            <input className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={classDescription} onChange={(event) => setClassDescription(event.target.value)} placeholder="수업 설명" />
            <button className="studio-button w-full" onClick={() => void createClassRoom()}>
              <Plus size={14} />
              반 만들기
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className="h-8 rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="학생 이름" />
              <button className="studio-button" onClick={() => void addStudent()}>
                <UserPlus size={14} />
                추가
              </button>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.045] p-2 text-xs leading-5 text-slate-400">
              {selectedClass ? `${selectedClass.title} 학생 ${selectedStudents.length}명` : `전체 학생 ${students.length}명`}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <ClipboardList size={14} />
            과제 만들기
          </div>
          <div className="space-y-2">
            <input className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="과제 제목" />
            <textarea className="min-h-16 w-full resize-none rounded border border-white/10 bg-studio-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="과제 설명" />
            <select className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              <option value="">자유 프로젝트</option>
              {allLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.custom ? "내 레슨 · " : ""}{lesson.title}
                </option>
              ))}
            </select>
            <input className="h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <button className="studio-button w-full" onClick={() => void createAssignment()}>
              <Plus size={14} />
              선택한 반에 과제 배정
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">과제</div>
          <div className="space-y-2">
            {selectedAssignments.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">아직 배정된 과제가 없습니다.</div>
            ) : (
              selectedAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">{assignment.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {getLessonById(assignment.lessonId)?.title ?? "자유 프로젝트"} · {formatDate(assignment.dueDate)}
                      </div>
                    </div>
                    <button className="studio-icon-button h-7 w-7" title="과제 삭제" aria-label="과제 삭제" onClick={() => void deleteAssignment(assignment.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{assignment.description}</div>
                  <div className="mt-2 text-[11px] font-bold text-slate-500">
                    대상 {assignment.assignedStudentIds?.length ?? selectedStudents.length}명 · 제출 {submissions.filter((submission) => submission.assignmentId === assignment.id).length}개
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">제출 현황</div>
          <div className="space-y-2">
            {selectedSubmissions.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">아직 제출된 작업이 없습니다.</div>
            ) : (
              selectedSubmissions.map((submission) => (
                <button
                  key={submission.id}
                  className={`w-full rounded-md border p-3 text-left ${selectedSubmission?.id === submission.id ? "border-meter-cyan bg-meter-cyan/10" : "border-white/10 bg-black/20"}`}
                  onClick={() => setSelectedSubmissionId(submission.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">{submission.studentName ?? "학생"} · {submission.reviewSnapshot.projectName}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId} · {formatDate(submission.submittedAt)}</div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${submission.reviewSnapshot.ready ? "bg-meter-green/15 text-green-100" : "bg-meter-amber/15 text-amber-100"}`}>
                      {submission.reviewSnapshot.statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">점수</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{scoreLabel(submission.reviewSnapshot)}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">경고</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{warningCount(submission.reviewSnapshot)}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">미션</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{completedMissionCount(submission.reviewSnapshot)}/{submission.reviewSnapshot.missionResults.length || 0}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">시도</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{submission.attemptNumber ?? submissionAttempts(submission, submissions)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedSubmission ? (
          <div className="mt-3 rounded-md border border-meter-cyan/30 bg-meter-cyan/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100/80">
              <Eye size={14} />
              제출 상세
            </div>
            <div className="text-sm font-black text-slate-100">{selectedSubmission.reviewSnapshot.projectName}</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">{selectedSubmission.reviewSnapshot.teacherSummary}</div>
            <div className="mt-2 text-[11px] leading-5 text-slate-400">
              다음 추천: <span className="font-bold text-slate-200">{selectedSubmission.reviewSnapshot.nextAction.title}</span>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-300">
              교사 피드백
              <textarea
                className="mt-1 min-h-20 w-full resize-none rounded border border-white/10 bg-studio-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                value={feedbackDrafts[selectedSubmission.id] ?? selectedSubmission.teacherFeedback ?? ""}
                onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [selectedSubmission.id]: event.target.value }))}
              />
            </label>
            <button className="studio-button mt-2 w-full" onClick={() => void saveFeedback(selectedSubmission)}>
              <MessageSquare size={14} />
              피드백 저장
            </button>
          </div>
        ) : null}

        <div className="mt-3">
          <LessonBuilderPanel lessons={customLessons} onRefresh={refresh} />
        </div>
      </div>
    </aside>
  );
}
