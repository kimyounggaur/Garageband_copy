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
import { effectiveDecision, effectiveStatusLabel, withTeacherDecision, type TeacherDecision } from "../../education/teacherReview";
import type { Assignment, ClassRoom, Enrollment, Lesson, ReviewSummary, StudentProfile, Submission } from "../../education/types";
import { makeId } from "../../utils/id";
import { logError } from "../../utils/logger";
import { setAppBusy, setUnsavedDraft, whileAppBusy } from "../../utils/unsavedDrafts";
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
  const [decisionSavingId, setDecisionSavingId] = useState<string>();
  const [decisionError, setDecisionError] = useState("");
  const feedbackDirty = Object.entries(feedbackDrafts).some(([id, text]) =>
    text !== (submissions.find((submission) => submission.id === id)?.teacherFeedback ?? ""));
  useEffect(() => {
    setUnsavedDraft("teacher-feedback", feedbackDirty);
    return () => setUnsavedDraft("teacher-feedback", false);
  }, [feedbackDirty]);
  useEffect(() => {
    setAppBusy("teacher-decision", Boolean(decisionSavingId));
    return () => setAppBusy("teacher-decision", false);
  }, [decisionSavingId]);
  useEffect(() => () => {
    setUnsavedDraft("teacher-class", false);
    setUnsavedDraft("teacher-student", false);
    setUnsavedDraft("teacher-assignment", false);
  }, []);
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
    const ready = selectedSubmissions.filter((submission) => effectiveDecision(submission.reviewSnapshot) === "ready").length;
    const needsWork = selectedSubmissions.filter((submission) => effectiveDecision(submission.reviewSnapshot) === "needsWork").length;
    const ignored = total - ready - needsWork;
    const averageScore =
      total > 0 ? Math.round(selectedSubmissions.reduce((sum, submission) => sum + scorePercent(submission.reviewSnapshot), 0) / total) : 0;
    const openWarnings = selectedSubmissions.reduce((sum, submission) => sum + warningCount(submission.reviewSnapshot), 0);
    return { total, ready, needsWork, ignored, averageScore, openWarnings };
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
    setUnsavedDraft("teacher-class", false);
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
    setUnsavedDraft("teacher-student", false);
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
    setUnsavedDraft("teacher-assignment", false);
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

  async function saveTeacherDecision(submission: Submission, decision: TeacherDecision) {
    setDecisionSavingId(submission.id);
    setDecisionError("");
    try {
      await submissionRepository.saveSubmission({
        ...submission,
        reviewSnapshot: withTeacherDecision(submission.reviewSnapshot, decision),
        status: decision === "auto" ? submission.status : "reviewed"
      });
      await refresh();
    } catch (error) {
      logError("TeacherPanel.saveTeacherDecision", error);
      setDecisionError("교사 판단을 저장하지 못했습니다. 다시 선택해 주세요.");
    } finally {
      setDecisionSavingId(undefined);
    }
  }

  function exportCsv() {
    const header = ["반", "학생", "과제", "상태", "점수", "경고", "미션", "제출일", "교사 피드백"];
    const rows = selectedSubmissions.map((submission) => [
      selectedClass?.title ?? submission.classId ?? "",
      submission.studentName ?? submission.studentId ?? "학생",
      submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId,
      effectiveStatusLabel(submission.reviewSnapshot),
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
      <div className="flex items-center justify-between border-b border-line px-3">
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
          <div className="rounded-md border border-line bg-surface-raised/50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">제출물</div>
            <div className="mt-1 text-xl font-black text-ink-high">{dashboard.total}</div>
          </div>
          <div className="rounded-md border border-line bg-surface-raised/50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">자동 평균 점수</div>
            <div className="mt-1 text-xl font-black text-ink-high">{dashboard.averageScore}%</div>
          </div>
          <div className="rounded-md border border-meter-green/25 bg-meter-green/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">제출 가능</div>
            <div className="mt-1 text-xl font-black text-ink-high">{dashboard.ready}</div>
          </div>
          <div className="rounded-md border border-meter-amber/25 bg-meter-amber/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">보완 필요</div>
            <div className="mt-1 text-xl font-black text-ink-high">{dashboard.needsWork}</div>
            <div className="text-[10px] font-bold text-ink-body">자동 경고 {dashboard.openWarnings}개</div>
          </div>
        </div>
        {dashboard.ignored > 0 ? (
          <div className="mt-2 text-xs text-ink-body">자동 판단 제외 {dashboard.ignored}개 · 교사 확인을 기다립니다.</div>
        ) : null}

        <div className="mt-3 rounded-md border border-line bg-surface-raised/40 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">
            <Users size={14} />
            반과 학생
          </div>
          <div className="space-y-2">
            <select className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
              <option value="">전체 수업</option>
              {classRooms.map((classRoom) => (
                <option key={classRoom.id} value={classRoom.id}>
                  {classRoom.title} · {classRoom.code}
                </option>
              ))}
            </select>
            <input className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={classTitle} onChange={(event) => { setClassTitle(event.target.value); setUnsavedDraft("teacher-class", true); }} placeholder="반 이름" />
            <input className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={classDescription} onChange={(event) => { setClassDescription(event.target.value); setUnsavedDraft("teacher-class", true); }} placeholder="수업 설명" />
            <button className="studio-button w-full" onClick={() => void whileAppBusy(createClassRoom)}>
              <Plus size={14} />
              반 만들기
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className="h-8 rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={studentName} onChange={(event) => { setStudentName(event.target.value); setUnsavedDraft("teacher-student", true); }} placeholder="학생 이름" />
              <button className="studio-button" onClick={() => void whileAppBusy(addStudent)}>
                <UserPlus size={14} />
                추가
              </button>
            </div>
            <div className="rounded border border-line bg-surface-panel p-2 text-xs leading-5 text-ink-body">
              {selectedClass ? `${selectedClass.title} 학생 ${selectedStudents.length}명` : `전체 학생 ${students.length}명`}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-line bg-surface-raised/40 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">
            <ClipboardList size={14} />
            과제 만들기
          </div>
          <div className="space-y-2">
            <input className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={title} onChange={(event) => { setTitle(event.target.value); setUnsavedDraft("teacher-assignment", true); }} placeholder="과제 제목" />
            <textarea className="min-h-16 w-full resize-none rounded border border-line bg-surface-base px-2 py-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={description} onChange={(event) => { setDescription(event.target.value); setUnsavedDraft("teacher-assignment", true); }} placeholder="과제 설명" />
            <select className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" value={lessonId} onChange={(event) => { setLessonId(event.target.value); setUnsavedDraft("teacher-assignment", true); }}>
              <option value="">자유 프로젝트</option>
              {allLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.custom ? "내 레슨 · " : ""}{lesson.title}
                </option>
              ))}
            </select>
            <input className="h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus:border-ink-accent" type="datetime-local" value={dueDate} onChange={(event) => { setDueDate(event.target.value); setUnsavedDraft("teacher-assignment", true); }} />
            <button className="studio-button w-full" onClick={() => void whileAppBusy(createAssignment)}>
              <Plus size={14} />
              선택한 반에 과제 배정
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">과제</div>
          <div className="space-y-2">
            {selectedAssignments.length === 0 ? (
              <div className="rounded-md border border-line bg-surface-raised/40 p-3 text-sm text-ink-body">아직 배정된 과제가 없습니다.</div>
            ) : (
              selectedAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-md border border-line bg-surface-raised/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink-high">{assignment.title}</div>
                      <div className="mt-1 text-[11px] text-ink-body">
                        {getLessonById(assignment.lessonId)?.title ?? "자유 프로젝트"} · {formatDate(assignment.dueDate)}
                      </div>
                    </div>
                    <button className="studio-icon-button h-7 w-7" title="과제 삭제" aria-label="과제 삭제" onClick={() => void whileAppBusy(() => deleteAssignment(assignment.id))}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-ink-body">{assignment.description}</div>
                  <div className="mt-2 text-[11px] font-bold text-ink-body">
                    대상 {assignment.assignedStudentIds?.length ?? selectedStudents.length}명 · 제출 {submissions.filter((submission) => submission.assignmentId === assignment.id).length}개
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">제출 현황</div>
          <div className="space-y-2">
            {selectedSubmissions.length === 0 ? (
              <div className="rounded-md border border-line bg-surface-raised/40 p-3 text-sm text-ink-body">아직 제출된 작업이 없습니다.</div>
            ) : (
              selectedSubmissions.map((submission) => (
                <button
                  key={submission.id}
                  className={`w-full rounded-md border p-3 text-left ${selectedSubmission?.id === submission.id ? "border-ink-accent bg-surface-raised" : "border-line bg-surface-raised/40"}`}
                  onClick={() => setSelectedSubmissionId(submission.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink-high">{submission.studentName ?? "학생"} · {submission.reviewSnapshot.projectName}</div>
                      <div className="mt-1 text-[11px] text-ink-body">{submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId} · {formatDate(submission.submittedAt)}</div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${effectiveDecision(submission.reviewSnapshot) === "ready" ? "bg-meter-green/15 text-ink-high" : effectiveDecision(submission.reviewSnapshot) === "ignore" ? "bg-surface-raised text-ink-high" : "bg-meter-amber/15 text-ink-high"}`}>
                      {effectiveStatusLabel(submission.reviewSnapshot)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    <div className="rounded border border-line bg-surface-panel p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">자동 점수</div>
                      <div className="mt-1 text-sm font-black text-ink-high">{scoreLabel(submission.reviewSnapshot)}</div>
                    </div>
                    <div className="rounded border border-line bg-surface-panel p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">경고</div>
                      <div className="mt-1 text-sm font-black text-ink-high">{warningCount(submission.reviewSnapshot)}</div>
                    </div>
                    <div className="rounded border border-line bg-surface-panel p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">미션</div>
                      <div className="mt-1 text-sm font-black text-ink-high">{completedMissionCount(submission.reviewSnapshot)}/{submission.reviewSnapshot.missionResults.length || 0}</div>
                    </div>
                    <div className="rounded border border-line bg-surface-panel p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-body">시도</div>
                      <div className="mt-1 text-sm font-black text-ink-high">{submission.attemptNumber ?? submissionAttempts(submission, submissions)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedSubmission ? (
          <div className="mt-3 rounded-md border border-meter-cyan/30 bg-meter-cyan/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">
              <Eye size={14} />
              제출 상세
            </div>
            <div className="text-sm font-black text-ink-high">{selectedSubmission.reviewSnapshot.projectName}</div>
            <div className="mt-1 text-xs leading-5 text-ink-body">자동 참고: {selectedSubmission.reviewSnapshot.teacherSummary}</div>
            <div className="mt-2 text-[11px] leading-5 text-ink-body">
              자동 추천: <span className="font-bold text-ink-high">{selectedSubmission.reviewSnapshot.nextAction.title}</span>
            </div>
            <label className="mt-3 block text-xs font-bold text-ink-body">
              교사 판단
              <select
                className="mt-1 h-9 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high focus-visible:ring-2 focus-visible:ring-ink-accent"
                value={selectedSubmission.reviewSnapshot.teacherDecision?.decision ?? "auto"}
                disabled={decisionSavingId === selectedSubmission.id}
                onChange={(event) => void whileAppBusy(() => saveTeacherDecision(selectedSubmission, event.target.value as TeacherDecision))}
              >
                <option value="auto">자동 평가를 참고</option>
                <option value="ready">교사 확인: 제출 가능</option>
                <option value="needsWork">교사 확인: 보완 필요</option>
                <option value="ignore">자동 판단 제외 · 교사 검토 중</option>
              </select>
            </label>
            {decisionError ? <div role="alert" className="mt-2 text-xs text-ink-high">{decisionError}</div> : null}
            <label className="mt-3 block text-xs font-bold text-ink-body">
              교사 피드백
              <textarea
                className="mt-1 min-h-20 w-full resize-none rounded border border-line bg-surface-base px-2 py-2 text-sm text-ink-high outline-none focus:border-ink-accent"
                value={feedbackDrafts[selectedSubmission.id] ?? selectedSubmission.teacherFeedback ?? ""}
                onChange={(event) => {
                  setFeedbackDrafts((current) => ({ ...current, [selectedSubmission.id]: event.target.value }));
                  setUnsavedDraft("teacher-feedback", true);
                }}
              />
            </label>
            <button className="studio-button mt-2 w-full" onClick={() => void whileAppBusy(() => saveFeedback(selectedSubmission))}>
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
