import { CheckCircle2, Download, Info, TriangleAlert } from "lucide-react";
import { downloadBlob } from "../../audio/exportProject";
import { reviewProject } from "../../education/reviewProject";
import { useDawStore } from "../../store/useDawStore";
import type { ReviewSeverity } from "../../education/types";

function iconFor(severity: ReviewSeverity) {
  if (severity === "good") return <CheckCircle2 size={16} className="text-meter-green" />;
  if (severity === "warning") return <TriangleAlert size={16} className="text-meter-amber" />;
  return <Info size={16} className="text-meter-cyan" />;
}

function fileSafeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "webband-session";
}

export function ReviewPanel() {
  const project = useDawStore((state) => state.project);
  const items = reviewProject(project);
  const readyCount = items.filter((item) => item.severity === "good").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;

  function handleJsonExport() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${fileSafeName(project.name)}.webband.json`);
  }

  return (
    <aside className="panel flex min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">Review</span>
        <span className="text-xs font-bold text-slate-400">
          {readyCount}/{items.length} ready
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Submit Check</div>
          <div className="mt-2 text-sm font-semibold leading-5 text-slate-200">
            {warningCount === 0 ? "제출 가능한 상태입니다. WAV와 프로젝트 파일을 함께 내보낼 수 있어요." : `${warningCount}개 항목을 조금 더 다듬으면 제출 품질이 좋아집니다.`}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{iconFor(item.severity)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-100">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{item.message}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Export</div>
          <button className="studio-button mt-3 w-full" onClick={handleJsonExport}>
            <Download size={15} />
            .webband.json
          </button>
        </div>
      </div>
    </aside>
  );
}
