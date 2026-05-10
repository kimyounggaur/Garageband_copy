import { ClipboardList, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { rubricForLesson } from "../../education/assignments";
import { LESSONS, getLessonById } from "../../education/lessons";
import type { Assignment, ReviewSummary, Submission } from "../../education/types";
import { assignmentRepository, submissionRepository } from "../../db/studioRepository";
import { makeId } from "../../utils/id";

function formatDate(value?: number) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function scorePercent(summary: ReviewSummary) {
  if (summary.rubricScore) return summary.rubricScore.percent;
  const possible = summary.rubric.reduce((sum, criterion) => sum + (criterion.maxScore ?? criterion.autoChecks.length), 0);
  const earned = summary.rubric.reduce(
    (sum, criterion) => sum + (criterion.score ?? criterion.autoChecks.filter((check) => check.completed).length),
    0
  );
  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

function scoreLabel(summary: ReviewSummary) {
  if (summary.rubricScore) return `${summary.rubricScore.earned}/${summary.rubricScore.possible}`;
  const possible = summary.rubric.reduce((sum, criterion) => sum + (criterion.maxScore ?? criterion.autoChecks.length), 0);
  const earned = summary.rubric.reduce(
    (sum, criterion) => sum + (criterion.score ?? criterion.autoChecks.filter((check) => check.completed).length),
    0
  );
  return `${earned}/${possible}`;
}

function warningCount(summary: ReviewSummary) {
  return summary.items.filter((item) => item.severity === "warning").length;
}

function completedMissionCount(summary: ReviewSummary) {
  return summary.missionResults.filter((mission) => mission.completed).length;
}

function submissionDiff(submission: Submission, submissions: Submission[]) {
  const previous = submissions
    .filter(
      (item) =>
        item.id !== submission.id &&
        item.assignmentId === submission.assignmentId &&
        item.projectId === submission.projectId &&
        item.submittedAt < submission.submittedAt
    )
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];

  if (!previous) return undefined;

  return {
    scoreDelta: scorePercent(submission.reviewSnapshot) - scorePercent(previous.reviewSnapshot),
    warningDelta: warningCount(submission.reviewSnapshot) - warningCount(previous.reviewSnapshot),
    missionDelta: completedMissionCount(submission.reviewSnapshot) - completedMissionCount(previous.reviewSnapshot)
  };
}

function signed(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function TeacherPanel() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [title, setTitle] = useState("8마디 수업 과제");
  const [description, setDescription] = useState("오늘 만든 프로젝트를 제출 패키지로 저장하세요.");
  const [lessonId, setLessonId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const submissionCounts = useMemo(() => {
    return submissions.reduce<Record<string, number>>((counts, submission) => {
      counts[submission.assignmentId] = (counts[submission.assignmentId] ?? 0) + 1;
      return counts;
    }, {});
  }, [submissions]);
  const dashboard = useMemo(() => {
    const total = submissions.length;
    const ready = submissions.filter((submission) => submission.reviewSnapshot.ready).length;
    const needsWork = total - ready;
    const averageScore =
      total > 0
        ? Math.round(submissions.reduce((sum, submission) => sum + scorePercent(submission.reviewSnapshot), 0) / total)
        : 0;
    const openWarnings = submissions.reduce((sum, submission) => sum + warningCount(submission.reviewSnapshot), 0);

    return { total, ready, needsWork, averageScore, openWarnings };
  }, [submissions]);

  async function refresh() {
    const [nextAssignments, nextSubmissions] = await Promise.all([
      assignmentRepository.listAssignments(),
      submissionRepository.listSubmissions()
    ]);
    setAssignments(nextAssignments);
    setSubmissions(nextSubmissions);
  }

  async function handleCreateAssignment() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const assignment: Assignment = {
      id: makeId("assignment"),
      title: trimmedTitle,
      description: description.trim() || "제출 전 Review를 확인하세요.",
      lessonId: lessonId || undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      rubric: rubricForLesson(lessonId || undefined),
      createdAt: Date.now()
    };
    await assignmentRepository.saveAssignment(assignment);
    setTitle("");
    setDescription("");
    setLessonId("");
    setDueDate("");
    await refresh();
  }

  async function handleDeleteAssignment(id: string) {
    await assignmentRepository.deleteAssignment(id);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <aside className="panel grid min-h-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">Teacher View</span>
        <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="Refresh class data" aria-label="Refresh class data">
          <RefreshCcw size={13} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Submissions</div>
            <div className="mt-1 text-xl font-black text-slate-100">{dashboard.total}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Avg Score</div>
            <div className="mt-1 text-xl font-black text-slate-100">{dashboard.averageScore}%</div>
          </div>
          <div className="rounded-md border border-meter-green/25 bg-meter-green/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-100/75">Ready</div>
            <div className="mt-1 text-xl font-black text-green-100">{dashboard.ready}</div>
          </div>
          <div className="rounded-md border border-meter-amber/25 bg-meter-amber/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/75">Needs Work</div>
            <div className="mt-1 text-xl font-black text-amber-100">{dashboard.needsWork}</div>
            <div className="text-[10px] font-bold text-amber-100/65">{dashboard.openWarnings} warnings</div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <ClipboardList size={14} />
            Create Assignment
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400">
              Title
              <input
                className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="block text-xs font-bold text-slate-400">
              Description
              <textarea
                className="mt-1 min-h-16 w-full resize-none rounded border border-white/10 bg-studio-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block text-xs font-bold text-slate-400">
              Lesson
              <select
                className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                value={lessonId}
                onChange={(event) => setLessonId(event.target.value)}
              >
                <option value="">Free project</option>
                {LESSONS.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-400">
              Due
              <input
                className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <button className="studio-button w-full" onClick={() => void handleCreateAssignment()}>
              <Plus size={14} />
              Create
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Assignments</div>
          <div className="space-y-2">
            {assignments.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
                만든 과제가 아직 없습니다.
              </div>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">{assignment.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {getLessonById(assignment.lessonId)?.title ?? "Free project"} · {formatDate(assignment.dueDate)}
                      </div>
                    </div>
                    <button
                      className="studio-icon-button h-7 w-7"
                      title="Delete assignment"
                      aria-label="Delete assignment"
                      onClick={() => void handleDeleteAssignment(assignment.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{assignment.description}</div>
                  <div className="mt-2 text-[11px] font-bold text-slate-500">
                    {assignment.rubric.criteria.length} rubric criteria · {submissionCounts[assignment.id] ?? 0} submissions
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Submissions</div>
          <div className="space-y-2">
            {submissions.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
                제출된 작업이 아직 없습니다.
              </div>
            ) : (
              submissions.map((submission) => {
                const diff = submissionDiff(submission, submissions);
                const nextAction = submission.reviewSnapshot.nextAction;
                return (
                  <div key={submission.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-100">
                          {submission.reviewSnapshot.projectName}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {submission.reviewSnapshot.assignmentTitle ?? submission.assignmentId} · {formatDate(submission.submittedAt)}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${
                          submission.reviewSnapshot.ready
                            ? "bg-meter-green/15 text-green-100"
                            : "bg-meter-amber/15 text-amber-100"
                        }`}
                      >
                        {submission.reviewSnapshot.statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Score</div>
                        <div className="mt-1 text-sm font-black text-slate-100">{scoreLabel(submission.reviewSnapshot)}</div>
                      </div>
                      <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Warnings</div>
                        <div className="mt-1 text-sm font-black text-slate-100">{warningCount(submission.reviewSnapshot)}</div>
                      </div>
                      <div className="rounded border border-white/10 bg-white/[0.045] p-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Mission</div>
                        <div className="mt-1 text-sm font-black text-slate-100">
                          {completedMissionCount(submission.reviewSnapshot)}/{submission.reviewSnapshot.missionResults.length || 0}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      {submission.reviewSnapshot.teacherSummary}
                    </div>
                    <div className="mt-2 rounded border border-white/10 bg-white/[0.035] p-2 text-[11px] leading-5 text-slate-400">
                      {diff ? (
                        <>
                          Review diff · Score {signed(diff.scoreDelta)}% · Warnings {signed(diff.warningDelta)} · Missions {signed(diff.missionDelta)}
                        </>
                      ) : (
                        "Review diff · 첫 제출이라 비교할 이전 제출이 없습니다."
                      )}
                    </div>
                    {nextAction ? (
                      <div className="mt-2 text-[11px] leading-5 text-slate-500">
                        다음 추천: <span className="font-bold text-slate-300">{nextAction.title}</span>
                      </div>
                    ) : null}
                    {submission.wavExportName ? (
                      <div className="mt-2 text-[11px] font-bold text-slate-500">{submission.wavExportName}</div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
