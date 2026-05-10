import { Drum, Keyboard, Plus, RefreshCcw, Trash2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { projectRepository } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import type { Project, TrackType } from "../../types/project";

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
    addTrack(type, type === "drum" ? "Drums" : type === "audio" ? "Audio" : "Instrument");
  }

  return (
    <aside className="panel grid h-full min-h-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg sm:grid-rows-[44px_minmax(0,1fr)_190px]">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">Mixer</span>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button" onClick={() => add("drum")} title="Add drum track" aria-label="Add drum track">
            <Drum size={14} />
          </button>
          <button
            className="studio-icon-button"
            onClick={() => add("instrument")}
            title="Add instrument track"
            aria-label="Add instrument track"
          >
            <Keyboard size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("audio")} title="Add audio track" aria-label="Add audio track">
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
                  ? "border-meter-cyan bg-meter-cyan/10"
                  : "border-white/10 bg-white/[0.045] hover:bg-white/[0.065]"
              }`}
              onClick={() => selectTrack(track.id)}
            >
              <div className="flex items-center gap-2">
                <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
                <input
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-bold text-slate-100 outline-none focus:border-white/20 focus:bg-black/20"
                  value={track.name}
                  onChange={(event) => renameTrack(track.id, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`${track.name} track name`}
                />
                <button
                  className="studio-icon-button h-7 w-7"
                  title="Delete track"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTrack(track.id);
                  }}
                  aria-label="Delete track"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-[34px_1fr_34px] items-center gap-2">
                <Volume2 size={14} className="text-slate-500" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(event) => setTrackVolume(track.id, Number(event.target.value))}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`${track.name} volume`}
                />
                <span className="text-right text-[11px] font-bold text-slate-400">{Math.round(track.volume * 100)}</span>
              </div>

              <div className="mt-2 grid grid-cols-[34px_1fr_34px] items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Pan</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={track.pan}
                  onChange={(event) => setTrackPan(track.id, Number(event.target.value))}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`${track.name} pan`}
                />
                <span className="text-right text-[11px] font-bold text-slate-400">{track.pan.toFixed(1)}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className={`h-7 rounded-md text-[11px] font-black ${
                    track.muted ? "bg-meter-rose text-studio-950" : "bg-white/[0.075] text-slate-300"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleMute(track.id);
                  }}
                  title={`Mute ${track.name}`}
                  aria-label={`Mute ${track.name}`}
                >
                  Mute
                </button>
                <button
                  className={`h-7 rounded-md text-[11px] font-black ${
                    track.solo ? "bg-meter-amber text-studio-950" : "bg-white/[0.075] text-slate-300"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSolo(track.id);
                  }}
                  title={`Solo ${track.name}`}
                  aria-label={`Solo ${track.name}`}
                >
                  Solo
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden border-t border-white/10 p-2 sm:block">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-title">Sessions</span>
          <button className="studio-icon-button h-7 w-7" onClick={refreshProjects} title="Refresh sessions" aria-label="Refresh sessions">
            <RefreshCcw size={13} />
          </button>
        </div>
        <div className="max-h-[138px] space-y-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="rounded-md border border-white/10 bg-black/20 px-2 py-3 text-xs text-slate-500">No saved sessions</div>
          ) : (
            projects.map((savedProject) => (
              <div key={savedProject.id} className="flex items-center gap-1 rounded-md bg-white/[0.045] p-1">
                <button
                  className="min-w-0 flex-1 rounded px-2 py-1 text-left hover:bg-white/[0.07]"
                  onClick={() => handleLoad(savedProject.id)}
                >
                  <span className="block truncate text-xs font-bold text-slate-200">{savedProject.name}</span>
                  <span className="block text-[10px] text-slate-500">{formatDate(savedProject.updatedAt)}</span>
                </button>
                <button
                  className="studio-icon-button h-7 w-7"
                  title="Delete session"
                  onClick={() => handleDelete(savedProject.id)}
                  aria-label="Delete session"
                >
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
