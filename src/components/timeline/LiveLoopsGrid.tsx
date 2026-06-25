import type { DragEvent } from "react";
import { liveLoopCellForTrackScene, resolveProjectLiveLoops } from "../../audio/liveLoops";
import { useDawStore } from "../../store/useDawStore";
import { Music2, Play, Plus, Square, Trash2 } from "../icons";

export const LIVE_LOOP_ROW_HEIGHT = 76;
const SCENE_WIDTH = 154;

function cellToneClass(color: string) {
  if (color === "#38bdf8") return "border-sky-400/45 bg-sky-400/12";
  if (color === "#f59e0b") return "border-amber-400/45 bg-amber-400/12";
  if (color === "#a78bfa") return "border-violet-400/45 bg-violet-400/12";
  if (color === "#4ade80") return "border-green-400/45 bg-green-400/12";
  return "border-indigo-400/45 bg-indigo-400/12";
}

export function LiveLoopsGrid() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const liveLoopPlayback = useDawStore((state) => state.liveLoopPlayback);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const setLiveLoopCellLoop = useDawStore((state) => state.setLiveLoopCellLoop);
  const clearLiveLoopCell = useDawStore((state) => state.clearLiveLoopCell);
  const triggerLiveLoopCell = useDawStore((state) => state.triggerLiveLoopCell);
  const triggerLiveLoopScene = useDawStore((state) => state.triggerLiveLoopScene);
  const stopLiveLoops = useDawStore((state) => state.stopLiveLoops);
  const addLiveLoopScene = useDawStore((state) => state.addLiveLoopScene);
  const liveLoops = resolveProjectLiveLoops(project);
  const minWidth = Math.max(680, liveLoops.scenes.length * SCENE_WIDTH + 84);
  const queued = new Set(liveLoopPlayback.queuedCellIds);
  const active = new Set(liveLoopPlayback.activeCellIds);

  function handleDrop(event: DragEvent<HTMLElement>, trackId: string, sceneId: string) {
    event.preventDefault();
    event.stopPropagation();
    const loopId = event.dataTransfer.getData("application/webband-loop");
    if (loopId) setLiveLoopCellLoop(trackId, sceneId, loopId);
  }

  return (
    <div className="min-h-full overflow-auto bg-studio-950/80">
      <div className="min-w-full" style={{ width: minWidth }}>
        <div className="sticky top-0 z-20 grid h-12 border-b border-white/10 bg-studio-900/95" style={{ gridTemplateColumns: `repeat(${liveLoops.scenes.length}, ${SCENE_WIDTH}px) 84px` }}>
          {liveLoops.scenes.map((scene) => {
            const sceneCellIds = liveLoops.cells.filter((cell) => cell.sceneId === scene.id).map((cell) => cell.id);
            const sceneQueued = sceneCellIds.some((id) => queued.has(id));
            return (
              <button
                key={scene.id}
                className={`flex min-w-0 items-center justify-between border-r border-white/10 px-3 text-left transition ${
                  sceneQueued ? "bg-accent-play/15 text-white" : "hover:bg-white/[0.045]"
                }`}
                onClick={() => triggerLiveLoopScene(scene.id)}
                title={scene.name}
              >
                <span className="truncate text-xs font-black uppercase tracking-[0.08em] text-slate-200">{scene.name}</span>
                <Play size={13} fill="currentColor" />
              </button>
            );
          })}
          <div className="flex items-center justify-center gap-1">
            <button className="studio-icon-button h-8 w-8" onClick={() => addLiveLoopScene()} title="Add scene" aria-label="Add live loop scene">
              <Plus size={14} />
            </button>
            <button className="studio-icon-button h-8 w-8" onClick={() => stopLiveLoops()} title="Stop live loops" aria-label="Stop live loops">
              <Square size={13} />
            </button>
          </div>
        </div>

        {project.tracks.map((track) => (
          <div
            key={track.id}
            className={`grid border-b border-white/10 ${selectedTrackId === track.id ? "bg-meter-cyan/5" : ""}`}
            style={{ gridTemplateColumns: `repeat(${liveLoops.scenes.length}, ${SCENE_WIDTH}px) 84px`, height: LIVE_LOOP_ROW_HEIGHT }}
          >
            {liveLoops.scenes.map((scene) => {
              const cell = liveLoopCellForTrackScene(liveLoops, track.id, scene.id);
              const isQueued = Boolean(cell && queued.has(cell.id));
              const isActive = Boolean(cell && active.has(cell.id));
              return (
                <div
                  key={`${track.id}-${scene.id}`}
                  role="button"
                  tabIndex={0}
                  className={`group relative m-2 flex min-w-0 flex-col justify-between rounded-md border p-2 text-left transition ${
                    cell
                      ? `${cellToneClass(cell.color)} hover:border-meter-green/55`
                      : "border-dashed border-white/10 bg-black/18 text-slate-500 hover:border-white/25 hover:bg-white/[0.045]"
                  } ${isQueued ? "ring-2 ring-accent-play/70" : ""} ${isActive ? "shadow-[inset_0_0_0_1px_rgba(94,194,107,0.85)]" : ""}`}
                  onClick={() => {
                    selectTrack(track.id);
                    if (cell) triggerLiveLoopCell(track.id, scene.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    selectTrack(track.id);
                    if (cell) triggerLiveLoopCell(track.id, scene.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, track.id, scene.id)}
                  aria-label={cell ? `${cell.name} live loop cell` : `${track.name} empty live loop cell`}
                  title={cell ? cell.name : "Drop loop"}
                >
                  {cell ? (
                    <>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cell.color }} />
                        <span className="truncate text-xs font-black text-slate-100">{cell.name}</span>
                      </span>
                      <span className="flex items-end justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        <span>{cell.lengthBeats} beats</span>
                        <span>{isQueued ? "Queued" : isActive ? "Playing" : cell.type}</span>
                      </span>
                      <button
                        className="absolute right-1 top-1 rounded bg-black/35 p-1 text-slate-300 opacity-0 transition hover:text-white group-hover:opacity-100"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          clearLiveLoopCell(track.id, scene.id);
                        }}
                        aria-label={`Clear ${cell.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Music2 size={18} />
                    </span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-center px-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
