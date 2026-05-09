import { CheckCircle2, Circle, Download, FileArchive, Info, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadBlob, exportProjectToWav } from "../../audio/exportProject";
import { loadAssignment } from "../../db/studioRepository";
import { createReviewSummary } from "../../education/reviewProject";
import { getLessonById } from "../../education/lessons";
import { useDawStore } from "../../store/useDawStore";
import type { Assignment, ReviewSeverity } from "../../education/types";

type ExportStatus = "idle" | "working" | "done" | "error";

function iconFor(severity: ReviewSeverity) {
  if (severity === "good") return <CheckCircle2 size={16} className="text-meter-green" />;
  if (severity === "warning") return <TriangleAlert size={16} className="text-meter-amber" />;
  return <Info size={16} className="text-meter-cyan" />;
}

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "webband-session";
}

function exportJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, fileName);
}

function statusClasses(ready: boolean) {
  return ready
    ? "border-meter-green/40 bg-meter-green/10 text-green-100"
    : "border-meter-amber/40 bg-meter-amber/10 text-amber-100";
}

export function ReviewPanel() {
  const project = useDawStore((state) => state.project);
  const [assignment, setAssignment] = useState<Assignment | undefined>();
  const summary = useMemo(() => createReviewSummary(project, assignment), [assignment, project]);
  const lesson = getLessonById(summary.lessonId);
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({});
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const warningItems = summary.items.filter((item) => item.severity === "warning");
  const manualTotal = summary.rubric.reduce((sum, criterion) => sum + criterion.manualChecks.length, 0);
  const manualDone = Object.values(manualChecks).filter(Boolean).length;
  const name = fileSafeName(project.name);

  useEffect(() => {
    let cancelled = false;
    if (!project.assignmentId) {
      setAssignment(undefined);
      return;
    }
    loadAssignment(project.assignmentId).then((nextAssignment) => {
      if (!cancelled) setAssignment(nextAssignment);
    });
    return () => {
      cancelled = true;
    };
  }, [project.assignmentId]);

  function toggleManualCheck(id: string) {
    setManualChecks((current) => ({ ...current, [id]: !current[id] }));
  }

  function reviewSummaryForExport() {
    return {
      ...summary,
      exportedAt: new Date().toISOString(),
      manualChecks
    };
  }

  async function handlePackageExport() {
    setExportStatus("working");
    try {
      exportJson(project, `${name}.webband.json`);
      exportJson(reviewSummaryForExport(), `${name}.review-summary.json`);
      const wav = await exportProjectToWav(project);
      downloadBlob(wav, `${name}.wav`);
      setExportStatus("done");
    } catch {
      setExportStatus("error");
    }
  }

  return (
    <aside className="panel flex min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">Review</span>
        <span className={`rounded px-2 py-1 text-[11px] font-black ${statusClasses(summary.ready)}`}>
          {summary.statusLabel}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className={`rounded-md border p-3 ${statusClasses(summary.ready)}`}>
          <div className="flex items-start gap-2">
            {summary.ready ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <div className="text-sm font-black">{summary.studentMessage}</div>
              <div className="mt-1 text-xs leading-5 opacity-85">{summary.teacherSummary}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Auto</div>
            <div className="mt-1 text-lg font-black text-slate-100">{summary.items.length - warningItems.length}/{summary.items.length}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Mission</div>
            <div className="mt-1 text-lg font-black text-slate-100">
              {summary.missionResults.length > 0
                ? `${summary.missionResults.filter((item) => item.completed).length}/${summary.missionResults.length}`
                : "기본"}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Manual</div>
            <div className="mt-1 text-lg font-black text-slate-100">{manualDone}/{manualTotal}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">보완할 점</div>
          <div className="space-y-2">
            {warningItems.length === 0 ? (
              <div className="rounded-md border border-meter-green/30 bg-meter-green/10 p-3 text-sm font-semibold text-green-100">
                자동 체크는 모두 좋아요.
              </div>
            ) : (
              warningItems.map((item) => (
                <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{iconFor(item.severity)}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-100">{item.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{item.message}</div>
                      {item.detail ? <div className="mt-1 text-[11px] text-slate-500">{item.detail}</div> : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {summary.missionResults.length > 0 ? (
          <div className="mt-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Lesson Missions</div>
            <div className="space-y-2">
              {summary.missionResults.map((mission) => (
                <div key={mission.missionId} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-black text-slate-100">
                      {lesson?.missions.find((item) => item.id === mission.missionId)?.title ?? mission.missionId}
                    </div>
                    {mission.completed ? (
                      <CheckCircle2 size={15} className="shrink-0 text-meter-green" />
                    ) : (
                      <Circle size={15} className="shrink-0 text-slate-500" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{mission.summary}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Rubric</span>
            <span className="text-[11px] font-semibold text-slate-500">
              {summary.lessonTitle ?? "기본 리뷰"}
            </span>
          </div>
          <div className="space-y-2">
            {summary.rubric.map((criterion) => (
              <div key={criterion.criterionId} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-slate-100">{criterion.title}</div>
                  <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
                    {criterion.suggestedLevel}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Auto</div>
                  <div className="space-y-1">
                    {criterion.autoChecks.map((check) => (
                      <div key={check.id} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                        {check.completed ? (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-meter-green" />
                        ) : (
                          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-meter-amber" />
                        )}
                        <span>
                          <span className="font-bold text-slate-200">{check.label}</span> · {check.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Manual</div>
                  <div className="space-y-1">
                    {criterion.manualChecks.map((check) => {
                      const id = `${criterion.criterionId}:${check.id}`;
                      const checked = Boolean(manualChecks[id]);
                      return (
                        <label key={check.id} className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-400">
                          <input
                            className="mt-1 h-3.5 w-3.5"
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleManualCheck(id)}
                          />
                          <span>
                            <span className="font-bold text-slate-200">{check.label}</span> · {check.detail}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <FileArchive size={14} />
            Submission Package
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-400">
            프로젝트, WAV, 리뷰 요약 JSON을 함께 내보냅니다.
          </div>
          <button className="studio-button mt-3 w-full" onClick={() => void handlePackageExport()} disabled={exportStatus === "working"}>
            <Download size={15} />
            {exportStatus === "working" ? "Exporting" : exportStatus === "done" ? "Exported" : exportStatus === "error" ? "Retry Export" : "Export Package"}
          </button>
        </div>
      </div>
    </aside>
  );
}
