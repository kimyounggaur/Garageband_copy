import { Download, FileInput, Plus } from "../icons";
import { useState } from "react";
import { downloadBlob } from "../../audio/exportProject";
import { lessonRepository } from "../../db/studioRepository";
import type { Lesson, LessonDifficulty, Mission, MissionCheck, Rubric } from "../../education/types";
import { useDawStore } from "../../store/useDawStore";
import { makeId } from "../../utils/id";
import { normalizeProject } from "../../utils/projectMigration";

type MissionPreset = "length" | "midi" | "audio" | "roles";

const DEFAULT_RUBRIC: Rubric = {
  criteria: [
    {
      id: "idea",
      title: "아이디어",
      levels: [
        { label: "시작", description: "기본 재료가 있습니다." },
        { label: "성장", description: "음악적 선택이 드러납니다." },
        { label: "완성", description: "분명한 의도와 마무리가 있습니다." }
      ]
    },
    {
      id: "balance",
      title: "균형",
      levels: [
        { label: "시작", description: "일부 파트가 비어 있습니다." },
        { label: "성장", description: "주요 파트가 서로 어울립니다." },
        { label: "완성", description: "리듬, 선율, 구조가 균형을 이룹니다." }
      ]
    }
  ]
};

function missionFromPreset(preset: MissionPreset, target: number): Mission {
  const safeTarget = Math.max(1, Math.round(target));
  const check: MissionCheck =
    preset === "midi"
      ? { type: "minMidiNotes", count: safeTarget }
      : preset === "audio"
        ? { type: "minAudioClips", count: safeTarget }
        : preset === "roles"
          ? { type: "minTracksWithClips", roles: ["beat", "melody"] }
          : { type: "minProjectLength", beats: safeTarget };

  const labels: Record<MissionPreset, string> = {
    length: `${safeTarget}박 이상 만들기`,
    midi: `미디 노트 ${safeTarget}개 이상 입력`,
    audio: `오디오 클립 ${safeTarget}개 이상 사용`,
    roles: "비트와 멜로디 파트 채우기"
  };

  return {
    id: makeId("mission"),
    title: labels[preset],
    description: "레슨 빌더에서 만든 자동 검사 미션입니다.",
    hint: "편집기에서 클립을 추가하거나 길이를 늘려 조건을 만족해보세요.",
    check
  };
}

function exportLesson(lesson: Lesson) {
  const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${lesson.title.replace(/[^\w.-]+/g, "-") || "lesson"}.lesson.json`);
}

type Props = {
  lessons: Lesson[];
  onRefresh: () => Promise<void> | void;
};

export function LessonBuilderPanel({ lessons, onRefresh }: Props) {
  const project = useDawStore((state) => state.project);
  const [title, setTitle] = useState("나만의 레슨");
  const [goal, setGoal] = useState("학생이 직접 만든 템플릿을 바탕으로 짧은 곡을 완성합니다.");
  const [difficulty, setDifficulty] = useState<LessonDifficulty>("builder");
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);
  const [missionPreset, setMissionPreset] = useState<MissionPreset>("length");
  const [missionTarget, setMissionTarget] = useState(32);

  async function createLesson() {
    const now = Date.now();
    const templateProject = normalizeProject({
      ...project,
      id: makeId("project"),
      name: `${title.trim() || "커스텀 레슨"} 템플릿`,
      assignmentId: undefined,
      classId: undefined,
      studentId: undefined,
      lessonId: undefined,
      createdAt: now,
      updatedAt: now
    });
    const lesson: Lesson = {
      id: makeId("lesson"),
      title: title.trim() || "커스텀 레슨",
      goal: goal.trim() || "학생이 프로젝트를 완성합니다.",
      difficulty,
      estimatedMinutes: Math.max(5, Math.round(estimatedMinutes)),
      templateProject,
      missions: [missionFromPreset(missionPreset, missionTarget)],
      rubric: DEFAULT_RUBRIC,
      custom: true,
      createdAt: now,
      updatedAt: now
    };
    await lessonRepository.saveLesson(lesson);
    await onRefresh();
  }

  async function importLesson(file?: File) {
    if (!file) return;
    const raw = await file.text();
    const parsed = JSON.parse(raw) as Lesson;
    const now = Date.now();
    await lessonRepository.saveLesson({
      ...parsed,
      id: parsed.id || makeId("lesson"),
      custom: true,
      createdAt: parsed.createdAt ?? now,
      updatedAt: now
    });
    await onRefresh();
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">레슨 빌더</div>
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-400">
          레슨 제목
          <input className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block text-xs font-bold text-slate-400">
          목표
          <textarea className="mt-1 min-h-16 w-full resize-none rounded border border-white/10 bg-studio-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold text-slate-400">
            난이도
            <select className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={difficulty} onChange={(event) => setDifficulty(event.target.value as LessonDifficulty)}>
              <option value="starter">시작</option>
              <option value="builder">확장</option>
              <option value="challenge">도전</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-400">
            예상 시간
            <input className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" type="number" min={5} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value))} />
          </label>
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <label className="block text-xs font-bold text-slate-400">
            미션 조건
            <select className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" value={missionPreset} onChange={(event) => setMissionPreset(event.target.value as MissionPreset)}>
              <option value="length">곡 길이</option>
              <option value="midi">미디 노트</option>
              <option value="audio">오디오 클립</option>
              <option value="roles">파트 구성</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-400">
            목표값
            <input className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan" type="number" min={1} value={missionTarget} onChange={(event) => setMissionTarget(Number(event.target.value))} />
          </label>
        </div>
        <button className="studio-button w-full" onClick={() => void createLesson()}>
          <Plus size={14} />
          현재 프로젝트로 레슨 만들기
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="studio-button flex-1 cursor-pointer">
          <FileInput size={14} />
          레슨 가져오기
          <input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void importLesson(event.target.files?.[0])} />
        </label>
      </div>

      <div className="mt-3 space-y-1">
        {lessons.length === 0 ? (
          <div className="rounded border border-white/10 bg-white/[0.045] p-2 text-xs text-slate-500">저장한 커스텀 레슨이 없습니다.</div>
        ) : (
          lessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.045] p-1">
              <div className="min-w-0 flex-1 px-1">
                <div className="truncate text-xs font-black text-slate-100">{lesson.title}</div>
                <div className="text-[10px] font-semibold text-slate-500">{lesson.estimatedMinutes}분 · 미션 {lesson.missions.length}개</div>
              </div>
              <button className="studio-icon-button h-7 w-7" title="레슨 내보내기" aria-label="레슨 내보내기" onClick={() => exportLesson(lesson)}>
                <Download size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
