import { CheckCircle2, Download, FileArchive, PlayCircle, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadBlob, exportProjectToWav } from "../../audio/exportProject";
import { listAssignments, listSubmissions, saveProject, saveSubmission } from "../../db/studioRepository";
import { createReviewSummary } from "../../education/reviewProject";
import { getLessonById } from "../../education/lessons";
import type { Assignment, Submission } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { makeId } from "../../utils/id";
import { AssistPanel } from "../assist/AssistPanel";

type SubmitStatus = "idle" | "working" | "done" | "error";

function formatDate(value?: number) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "webband-session";
}

function exportJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, fileName);
}

export function StudentPanel() {
  const project = useDawStore((state) => state.project);
  const startAssignment = useDawStore((state) => state.startAssignment);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const currentAssignment = assignments.find((assignment) => assignment.id === project.assignmentId);
  const summary = useMemo(() => createReviewSummary(project, currentAssignment), [currentAssignment, project]);
  const submittedAssignmentIds = useMemo(() => new Set(submissions.map((submission) => submission.assignmentId)), [submissions]);

  async function refresh() {
    const [nextAssignments, nextSubmissions] = await Promise.all([listAssignments(), listSubmissions()]);
    setAssignments(nextAssignments);
    setSubmissions(nextSubmissions);
  }

  async function handleStartAssignment(assignment: Assignment) {
    startAssignment(assignment);
    await saveProject(useDawStore.getState().project);
  }

  async function handleSubmit() {
    if (!currentAssignment) return;
    setSubmitStatus("working");
    try {
      const currentProject = useDawStore.getState().project;
      const snapshot = createReviewSummary(currentProject, currentAssignment);
      const safeName = fileSafeName(currentProject.name);
      const wavExportName = `${safeName}.wav`;
      await saveProject(currentProject);
      exportJson(currentProject, `${safeName}.webband.json`);
      exportJson({ ...snapshot, exportedAt: new Date().toISOString() }, `${safeName}.review-summary.json`);
      const wav = await exportProjectToWav(currentProject);
      downloadBlob(wav, wavExportName);
      await saveSubmission({
        id: makeId("submission"),
        assignmentId: currentAssignment.id,
        projectId: currentProject.id,
        submittedAt: Date.now(),
        reviewSnapshot: snapshot,
        wavExportName
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
        <span className="panel-title">Student View</span>
        <button className="studio-icon-button h-7 w-7" onClick={() => void refresh()} title="Refresh assignments" aria-label="Refresh assignments">
          <RefreshCcw size={13} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        {currentAssignment ? (
          <div className="rounded-md border border-meter-cyan/30 bg-meter-cyan/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100/80">Current Assignment</div>
            <div className="mt-1 text-sm font-black text-slate-100">{currentAssignment.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">{currentAssignment.description}</div>
            <div className="mt-2 text-[11px] font-bold text-slate-400">
              {getLessonById(currentAssignment.lessonId)?.title ?? "Free project"} · {formatDate(currentAssignment.dueDate)}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
            과제를 선택하면 템플릿이 열립니다.
          </div>
        )}

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Assignments</div>
          <div className="space-y-2">
            {assignments.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
                아직 과제가 없습니다. Teacher View에서 만들 수 있어요.
              </div>
            ) : (
              assignments.map((assignment) => {
                const isCurrent = assignment.id === project.assignmentId;
                const submitted = submittedAssignmentIds.has(assignment.id);
                return (
                  <div
                    key={assignment.id}
                    className={`rounded-md border p-3 ${
                      isCurrent ? "border-meter-cyan bg-meter-cyan/10" : "border-white/10 bg-white/[0.045]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-100">{assignment.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {getLessonById(assignment.lessonId)?.title ?? "Free project"} · {formatDate(assignment.dueDate)}
                        </div>
                      </div>
                      {submitted ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-meter-green" /> : null}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">{assignment.description}</div>
                    <button className="studio-button mt-3 w-full" onClick={() => void handleStartAssignment(assignment)}>
                      <PlayCircle size={14} />
                      {isCurrent ? "Restart" : "Start"}
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
            Submit
          </div>
          <div className="mt-2 rounded-md border border-white/10 bg-white/[0.045] p-2">
            <div className={`text-sm font-black ${summary.ready ? "text-green-100" : "text-amber-100"}`}>
              {summary.statusLabel}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-400">{summary.studentMessage}</div>
          </div>
          <button
            className="studio-button mt-3 w-full"
            onClick={() => void handleSubmit()}
            disabled={!currentAssignment || submitStatus === "working"}
          >
            <Download size={15} />
            {submitStatus === "working" ? "Submitting" : submitStatus === "done" ? "Submitted" : submitStatus === "error" ? "Retry Submit" : "Create Package"}
          </button>
        </div>

        <div className="mt-3">
          <AssistPanel />
        </div>
      </div>
    </aside>
  );
}
