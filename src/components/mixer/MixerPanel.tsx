import { Drum, Keyboard, Plus, RefreshCcw, Trash2, Volume2 } from "../icons";
import { useEffect, useState } from "react";
import { projectRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { Project, TrackType } from "../../types/project";
import { Fader, Knob, Meter } from "../ui";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function MixerPanel() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const addTrack = useDawStore((state) => state.addTrack);
  const renameTrack = useDawStore((state) => state.renameTrack);
  const removeTrack = useDawStore((state) => state.removeTrack);
  const toggleMute = useDawStore((state) => state.toggleMute);
  const toggleSolo = useDawStore((state) => state.toggleSolo);
  const setTrackVolume = useDawStore((state) => state.setTrackVolume);
  const setTrackPan = useDawStore((state) => state.setTrackPan);
  const loadProjectIntoStore = useDawStore((state) => state.loadProject);
  const [projects, setProjects] = useState<Project[]>([]);

  async function refreshProjects() {
    setProjects(await projectRepository.listProjects());
  }

  async function handleLoad(projectId: string) {
    const saved = await projectRepository.loadProject(projectId);
    if (saved) loadProjectIntoStore(saved);
  }

  async function handleDelete(projectId: string) {
    await projectRepository.deleteProject(projectId);
    await refreshProjects();
  }

  useEffect(() => {
    refreshProjects();
  }, [project.id, project.updatedAt]);

  function add(type: TrackType) {
    addTrack(type, type === "drum" ? "드럼" : type === "audio" ? "오디오" : "악기");
  }

  return (
    <aside className="panel grid h-full min-h-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg sm:grid-rows-[44px_minmax(0,1fr)_190px]">
      <div className="flex items-center justify-between border-b border-graphite-700 px-3">
        <span className="panel-title">믹서</span>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button" onClick={() => add("drum")} title="드럼 트랙 추가" aria-label="드럼 트랙 추가">
            <Drum size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("instrument")} title="악기 트랙 추가" aria-label="악기 트랙 추가">
            <Keyboard size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("audio")} title="오디오 트랙 추가" aria-label="오디오 트랙 추가">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-2">
        <div className="space-y-2">
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className={`rounded-md border p-2 transition ${
                selectedTrackId === track.id
                  ? "border-accent-sel bg-accent-sel/10"
                  : "border-graphite-700 bg-graphite-800/70 hover:bg-graphite-750/80"
              }`}
              onClick={() => selectTrack(track.id)}
            >
              <div className="flex items-center gap-2">
                <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
                <input
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none focus:border-graphite-700 focus:bg-black/20"
                  value={track.name}
                  onChange={(event) => renameTrack(track.id, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`${track.name} 트랙 이름`}
                />
                <button
                  className="studio-icon-button h-7 w-7"
                  title="트랙 삭제"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTrack(track.id);
                  }}
                  aria-label="트랙 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[20px_minmax(0,1fr)_52px_10px] items-center gap-2">
                <Volume2 size={14} className="text-graphite-600" />
                <Fader label={`${track.name} 볼륨`} value={track.volume} orientation="horizontal" onChange={(value) => setTrackVolume(track.id, value)} />
                <Knob label="Pan" value={track.pan} min={-1} max={1} step={0.02} onChange={(value) => setTrackPan(track.id, value)} />
                <Meter label={`${track.name} 레벨`} value={track.muted ? 0 : track.volume} orientation="vertical" />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className={`h-7 rounded-md text-[11px] font-black transition ${
                    track.muted ? "bg-accent-record text-graphite-975" : "bg-white/[0.075] text-slate-300 hover:bg-white/[0.11]"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleMute(track.id);
                  }}
                  title={`${track.name} 뮤트`}
                  aria-label={`${track.name} 뮤트`}
                >
                  뮤트
                </button>
                <button
                  className={`h-7 rounded-md text-[11px] font-black transition ${
                    track.solo ? "bg-accent-cycle text-graphite-975" : "bg-white/[0.075] text-slate-300 hover:bg-white/[0.11]"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSolo(track.id);
                  }}
                  title={`${track.name} 솔로`}
                  aria-label={`${track.name} 솔로`}
                >
                  솔로
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden border-t border-graphite-700 p-2 sm:block">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-title">세션</span>
          <button className="studio-icon-button h-7 w-7" onClick={refreshProjects} title="세션 새로고침" aria-label="세션 새로고침">
            <RefreshCcw size={13} />
          </button>
        </div>
        <div className="max-h-[138px] space-y-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="rounded-md border border-graphite-700 bg-black/20 px-2 py-3 text-xs text-graphite-600">저장된 세션이 없습니다</div>
          ) : (
            projects.map((savedProject) => (
              <div key={savedProject.id} className="flex items-center gap-1 rounded-md bg-white/[0.045] p-1">
                <button className="min-w-0 flex-1 rounded px-2 py-1 text-left hover:bg-white/[0.07]" onClick={() => handleLoad(savedProject.id)}>
                  <span className="block truncate text-xs font-bold text-slate-200">{savedProject.name}</span>
                  <span className="block text-[10px] text-graphite-600">{formatDate(savedProject.updatedAt)}</span>
                </button>
                <button className="studio-icon-button h-7 w-7" title="세션 삭제" onClick={() => handleDelete(savedProject.id)} aria-label="세션 삭제">
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
