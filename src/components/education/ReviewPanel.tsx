import { CheckCircle2, Circle, Download, FileArchive, Info, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadBlob, exportProjectToWav } from "../../audio/exportProject";
import { assignmentRepository } from "../../db/studioRepository";
import { createReviewSummary } from "../../education/reviewProject";
import { getLessonById } from "../../education/lessons";
import { useDawStore } from "../../store/useDawStore";
import { statusLabel } from "../../utils/labels";
import type { Assignment, ReviewNextAction, ReviewRubricStatus, ReviewScore, ReviewSeverity } from "../../education/types";
import { AssistPanel } from "../assist/AssistPanel";

type ExportStatus = "idle" | "working" | "done" | "error";

function iconFor(severity: ReviewSeverity) {
  if (severity === "good") return <CheckCircle2 size={16} className="text-meter-green" />;
  if (severity === "warning") return <TriangleAlert size={16} className="text-meter-amber" />;
  return <Info size={16} className="text-meter-cyan" />;
}

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "웹밴드-세션";
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

function fallbackScore(rubric: ReviewRubricStatus[]): ReviewScore {
  const possible = rubric.reduce((sum, criterion) => sum + (criterion.maxScore ?? criterion.autoChecks.length), 0);
  const earned = rubric.reduce(
    (sum, criterion) => sum + (criterion.score ?? criterion.autoChecks.filter((check) => check.completed).length),
    0
  );
  const percent = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { earned, possible, percent, levelLabel: percent >= 85 ? "완성" : percent >= 55 ? "성장" : "시작" };
}

function fallbackNextAction(ready: boolean): ReviewNextAction {
  return ready
    ? { title: "제출 패키지 만들기", message: "지금 상태라면 제출해도 좋아요." }
    : { title: "보완할 점 하나 고르기", message: "아래 경고 항목 중 하나부터 고쳐보세요." };
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
  const score = summary.rubricScore ?? fallbackScore(summary.rubric);
  const nextAction = summary.nextAction ?? fallbackNextAction(summary.ready);
  const name = fileSafeName(project.name);

  useEffect(() => {
    let cancelled = false;
    if (!project.assignmentId) {
      setAssignment(undefined);
      return;
    }
    assignmentRepository.loadAssignment(project.assignmentId).then((nextAssignment) => {
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
        <span className="panel-title">검토</span>
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

        <div className="mt-3 rounded-md border border-meter-cyan/30 bg-meter-cyan/10 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100/80">다음 한 가지</div>
          <div className="mt-1 text-sm font-black text-slate-100">{nextAction.title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-300">{nextAction.message}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">점수</div>
            <div className="mt-1 text-lg font-black text-slate-100">{score.earned}/{score.possible}</div>
            <div className="text-[10px] font-bold text-slate-500">{score.percent}% · {score.levelLabel}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">자동 점검</div>
            <div className="mt-1 text-lg font-black text-slate-100">{summary.items.length - warningItems.length}/{summary.items.length}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">미션</div>
            <div className="mt-1 text-lg font-black text-slate-100">
              {summary.missionResults.length > 0
                ? `${summary.missionResults.filter((item) => item.completed).length}/${summary.missionResults.length}`
                : "기본"}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">수동 확인</div>
            <div className="mt-1 text-lg font-black text-slate-100">{manualDone}/{manualTotal}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">보완 항목</div>
          <div className="space-y-2">
            {warningItems.length === 0 ? (
              <div className="rounded-md border border-meter-green/30 bg-meter-green/10 p-3 text-sm font-semibold text-green-100">
                자동 점검 항목이 모두 좋습니다.
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
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">레슨 미션</div>
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
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">평가 기준</span>
            <span className="text-[11px] font-semibold text-slate-500">
              {summary.lessonTitle ?? "기본 기준"}
            </span>
          </div>
          <div className="space-y-2">
            {summary.rubric.map((criterion) => (
              <div key={criterion.criterionId} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-slate-100">{criterion.title}</div>
                  <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
                    {criterion.score ?? 0}/{criterion.maxScore ?? criterion.autoChecks.length} · {criterion.suggestedLevel}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-meter-cyan"
                    style={{ width: `${criterion.percent ?? 0}%` }}
                  />
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">자동</div>
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
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">수동</div>
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
            제출 패키지
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-400">
            프로젝트, WAV, 리뷰 요약 JSON을 함께 내보냅니다.
          </div>
          <button className="studio-button mt-3 w-full" onClick={() => void handlePackageExport()} disabled={exportStatus === "working"}>
            <Download size={15} />
            {statusLabel(exportStatus, "패키지 내보내기")}
          </button>
        </div>

        <div className="mt-3">
          <AssistPanel />
        </div>
      </div>
    </aside>
  );
}
