import { CheckCircle2, Circle, Lightbulb, PlayCircle } from "../icons";
import { summarizeLesson } from "../../education/evaluateMission";
import { LESSONS, getLessonById } from "../../education/lessons";
import { useDawStore } from "../../store/useDawStore";

function difficultyLabel(value: string) {
  if (value === "starter") return "입문";
  if (value === "builder") return "확장";
  return "도전";
}

export function LessonPanel() {
  const project = useDawStore((state) => state.project);
  const startLesson = useDawStore((state) => state.startLesson);
  const lesson = getLessonById(project.lessonId);
  const summary = summarizeLesson(project, lesson);

  return (
    <aside className="panel flex min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="panel-title">레슨</span>
        {lesson ? <span className="text-xs font-bold text-meter-green">{summary.percent}%</span> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">레슨 시작</div>
            <div className="space-y-2">
              {LESSONS.map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    project.lessonId === item.id
                      ? "border-ink-accent bg-surface-raised"
                      : "border-line bg-surface-raised/40 hover:bg-surface-raised"
                  }`}
                  onClick={() => startLesson(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink-high">{item.title}</div>
                      <div className="mt-1 text-[11px] text-ink-body">
                        {difficultyLabel(item.difficulty)} · {item.estimatedMinutes}분
                      </div>
                    </div>
                    <PlayCircle size={16} className="mt-0.5 shrink-0 text-ink-body" />
                  </div>
                  <div className="mt-2 text-xs leading-5 text-ink-body">{item.goal}</div>
                </button>
              ))}
            </div>
          </div>

          {lesson ? (
            <>
              <div className="rounded-md border border-line bg-surface-raised/40 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-body">현재 목표</div>
                <div className="mt-2 text-sm font-semibold leading-5 text-ink-high">{lesson.goal}</div>
              </div>

              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">미션</div>
                <div className="space-y-2">
                  {lesson.missions.map((mission) => {
                    const result = summary.results.find((item) => item.missionId === mission.id);
                    const complete = Boolean(result?.completed);
                    return (
                      <div key={mission.id} className="rounded-md border border-line bg-surface-raised/40 p-3">
                        <div className="flex items-start gap-2">
                          {complete ? (
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-meter-green" />
                          ) : (
                            <Circle size={16} className="mt-0.5 shrink-0 text-ink-body" />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-black text-ink-high">{mission.title}</div>
                            <div className="mt-1 text-xs leading-5 text-ink-body">{mission.description}</div>
                            <div className="mt-2 text-[11px] font-bold text-ink-body">{result?.summary}</div>
                          </div>
                        </div>
                        {!complete ? (
                          <div className="mt-3 flex gap-2 rounded-md bg-meter-amber/10 p-2 text-xs leading-5 text-ink-high">
                            <Lightbulb size={14} className="mt-0.5 shrink-0" />
                            {mission.hint}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-body">평가 기준</div>
                <div className="space-y-2">
                  {lesson.rubric.criteria.map((criterion) => (
                    <div key={criterion.id} className="rounded-md border border-line bg-surface-raised/40 p-3">
                      <div className="text-sm font-black text-ink-high">{criterion.title}</div>
                      <div className="mt-2 space-y-1 text-xs leading-5 text-ink-body">
                        {criterion.levels.map((level) => (
                          <div key={level.label}>
                            <span className="font-bold text-ink-high">{level.label}</span> · {level.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-line bg-surface-raised/40 p-3 text-sm leading-6 text-ink-body">
              레슨을 선택하면 템플릿 프로젝트가 열리고, 편집 내용에 따라 미션 완료 상태가 즉시 갱신됩니다.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
