import type { DragEvent } from "react";
import { liveLoopCellForTrackScene, resolveProjectLiveLoops } from "../../audio/liveLoops";
import { useDawStore } from "../../store/useDawStore";
import { clipTypeLabel } from "../../utils/labels";
import { uiText } from "../../utils/uiText";
import { Music2, Play, Plus, Square, Trash2 } from "../icons";

export const LIVE_LOOP_ROW_HEIGHT = 76;
const SCENE_WIDTH = 154;

function sceneDisplayName(name: string) {
  return name.replace(/^Scene (\d+)$/, "장면 $1");
}

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
  const minWidth = Math.max(680, liveLoops.scenes.length * SCENE_WIDTH + 96);
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
        <div className="sticky top-0 z-20 grid h-12 border-b border-line bg-surface-raised/95" style={{ gridTemplateColumns: `repeat(${liveLoops.scenes.length}, ${SCENE_WIDTH}px) 96px` }}>
          {liveLoops.scenes.map((scene) => {
            const sceneCellIds = liveLoops.cells.filter((cell) => cell.sceneId === scene.id).map((cell) => cell.id);
            const sceneQueued = sceneCellIds.some((id) => queued.has(id));
            return (
              <button
                key={scene.id}
                className={`flex min-w-0 items-center justify-between border-r border-line px-3 text-left transition ${
                  sceneQueued ? "bg-accent-play/15 text-ink-high" : "hover:bg-surface-raised"
                }`}
                onClick={() => triggerLiveLoopScene(scene.id)}
                title={`${sceneDisplayName(scene.name)} 재생`}
                aria-pressed={sceneQueued}
              >
                <span className="truncate text-xs font-black uppercase tracking-[0.08em] text-ink-high">{sceneDisplayName(scene.name)}</span>
                <Play size={13} fill="currentColor" />
              </button>
            );
          })}
          <div className="flex items-center justify-center gap-1">
            <button className="studio-icon-button !h-11 !w-11" onClick={() => addLiveLoopScene()} title="장면 추가" aria-label="라이브 루프 장면 추가">
              <Plus size={14} />
            </button>
            <button className="studio-icon-button !h-11 !w-11" onClick={() => stopLiveLoops()} title="라이브 루프 정지" aria-label="라이브 루프 정지">
              <Square size={13} />
            </button>
          </div>
        </div>

        {project.tracks.map((track) => (
          <div
            key={track.id}
            className={`grid border-b border-line ${selectedTrackId === track.id ? "bg-meter-cyan/5" : ""}`}
            style={{ gridTemplateColumns: `repeat(${liveLoops.scenes.length}, ${SCENE_WIDTH}px) 96px`, height: LIVE_LOOP_ROW_HEIGHT }}
          >
            {liveLoops.scenes.map((scene) => {
              const cell = liveLoopCellForTrackScene(liveLoops, track.id, scene.id);
              const isQueued = Boolean(cell && queued.has(cell.id));
              const isActive = Boolean(cell && active.has(cell.id));
              return (
                <div
                  key={`${track.id}-${scene.id}`}
                  role="group"
                  tabIndex={0}
                  className={`group relative m-2 flex min-w-0 flex-col justify-between rounded-md border p-2 text-left transition ${
                    cell
                      ? `${cellToneClass(cell.color)} hover:border-meter-green/55`
                      : "border-dashed border-line bg-surface-base/20 text-ink-body hover:border-line-strong hover:bg-surface-raised"
                  } ${isQueued ? "ring-2 ring-accent-play/70" : ""} ${isActive ? "shadow-[inset_0_0_0_1px_rgba(94,194,107,0.85)]" : ""}`}
                  onClick={() => {
                    selectTrack(track.id);
                    if (cell) triggerLiveLoopCell(track.id, scene.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    selectTrack(track.id);
                    if (cell) triggerLiveLoopCell(track.id, scene.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, track.id, scene.id)}
                  aria-label={cell ? `${cell.name} 라이브 루프 셀, ${isQueued ? "대기 중" : isActive ? "재생 중" : "정지됨"}. Enter로 재생` : `${track.name} 빈 라이브 루프 셀`}
                  title={cell ? cell.name : `${uiText.common.loop}를 끌어 놓으세요`}
                >
                  {cell ? (
                    <>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cell.color }} />
                        <span className="truncate text-xs font-black text-ink-high">{cell.name}</span>
                      </span>
                      <span className="flex items-end justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-body">
                        <span>{cell.lengthBeats}박</span>
                        <span>{isQueued ? "대기 중" : isActive ? "재생 중" : clipTypeLabel(cell.type)}</span>
                      </span>
                      <button
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-surface-base/80 text-ink-high opacity-0 transition hover:bg-surface-raised group-focus-within:opacity-100 group-hover:opacity-100"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          clearLiveLoopCell(track.id, scene.id);
                        }}
                        aria-label={`${cell.name} 셀 비우기`}
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
