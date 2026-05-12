import { Drum, Keyboard, Mic, Music2, Plus } from "../icons";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { LOOP_CATEGORIES, LOOP_LIBRARY } from "../../data/loops";
import { AudioAssetsPanel } from "../recording/AudioAssetsPanel";
import { RecorderPanel } from "../recording/RecorderPanel";
import { useDawStore } from "../../store/useDawStore";
import type { LoopCategory } from "../../types/project";
import { loopCategoryLabel } from "../../utils/labels";
import { clamp, snapBeat } from "../../utils/timeline";

type SoundMenuState = {
  x: number;
  y: number;
  loopId?: string;
};

function menuPosition(clientX: number, clientY: number) {
  return {
    x: clamp(clientX, 8, Math.max(8, window.innerWidth - 244)),
    y: clamp(clientY, 8, Math.max(8, window.innerHeight - 344))
  };
}

export function SoundLibrary() {
  const [category, setCategory] = useState<LoopCategory>("Drums");
  const [menu, setMenu] = useState<SoundMenuState | undefined>();
  const addLoopClip = useDawStore((state) => state.addLoopClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const addTrack = useDawStore((state) => state.addTrack);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const loops = LOOP_LIBRARY.filter((loop) => loop.category === category);
  const menuLoop = LOOP_LIBRARY.find((loop) => loop.id === menu?.loopId);
  const snappedBeat = snapBeat(currentBeat, snapBeats);

  useEffect(() => {
    if (!menu) return;
    const closeMenu = () => setMenu(undefined);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  function openSoundMenu(event: MouseEvent<HTMLElement>, loopId?: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ ...menuPosition(event.clientX, event.clientY), loopId });
  }

  function runMenuAction(action: () => void) {
    setMenu(undefined);
    action();
  }

  return (
    <aside className="panel relative flex min-h-0 flex-col rounded-lg" onContextMenu={openSoundMenu}>
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">사운드</span>
        <button
          className="studio-icon-button"
          title="MIDI 클립 추가"
          onClick={() => addMidiClip(selectedTrackId, snappedBeat)}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/webband-midi", "midi")}
          aria-label="MIDI 클립 추가"
        >
          <Music2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 border-b border-white/10 p-2">
        {LOOP_CATEGORIES.map((item) => (
          <button
            key={item}
            className={`h-8 rounded-md text-[11px] font-bold ${
              category === item ? "bg-meter-cyan text-studio-950" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
            }`}
            onClick={() => setCategory(item)}
          >
            {loopCategoryLabel(item)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {loops.map((loop) => (
            <button
              key={loop.id}
              className="group w-full rounded-md border border-white/10 bg-white/[0.045] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.075]"
              onClick={() => addLoopClip(loop.id, selectedTrackId, snappedBeat)}
              onContextMenu={(event) => openSoundMenu(event, loop.id)}
              draggable
              onDragStart={(event) => event.dataTransfer.setData("application/webband-loop", loop.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-slate-100">{loop.name}</span>
                <span className="flex h-5 items-center rounded bg-white/10 px-1.5 text-[10px] font-bold text-slate-300">
                  {loop.lengthBeats}박
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{loop.description}</div>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: loop.color }} />
                {loop.bpm} 템포
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 p-2">
        <RecorderPanel />
        <AudioAssetsPanel />
        <button
          className="studio-button w-full"
          onClick={() => addMidiClip(selectedTrackId, snappedBeat)}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/webband-midi", "midi")}
        >
          <Plus size={15} />
          MIDI 클립
        </button>
      </div>

      {menu ? (
        <div
          className="fixed z-[90] w-60 overflow-hidden rounded-lg border border-white/10 bg-studio-900/98 p-1 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label="사운드 패널 메뉴"
        >
          <div className="border-b border-white/10 px-2 py-2">
            <div className="truncate text-xs font-black text-slate-100">{menuLoop ? menuLoop.name : "사운드 패널"}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <span>{menuLoop ? loopCategoryLabel(menuLoop.category) : loopCategoryLabel(category)}</span>
              <span>{snappedBeat.toFixed(2)}박</span>
            </div>
          </div>

          {menuLoop ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
              onClick={() => runMenuAction(() => addLoopClip(menuLoop.id, selectedTrackId, snappedBeat))}
              role="menuitem"
            >
              <Plus size={14} />이 루프를 현재 위치에 추가
            </button>
          ) : null}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() =>
              runMenuAction(() => {
                const loop = menuLoop ?? loops[0] ?? LOOP_LIBRARY[0];
                addLoopClip(loop.id, selectedTrackId, snappedBeat);
              })
            }
            role="menuitem"
          >
            <Music2 size={14} />
            {menuLoop ? "같은 루프 한 번 더 추가" : "현재 카테고리 루프 추가"}
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => addMidiClip(selectedTrackId, snappedBeat))}
            role="menuitem"
          >
            <Keyboard size={14} />
            현재 위치에 MIDI 클립
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => addTrack("drum", "드럼"))}
            role="menuitem"
          >
            <Drum size={14} />
            드럼 트랙 추가
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => addTrack("instrument", "악기"))}
            role="menuitem"
          >
            <Keyboard size={14} />
            악기 트랙 추가
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => addTrack("audio", "녹음"))}
            role="menuitem"
          >
            <Mic size={14} />
            녹음 트랙 추가
          </button>

          <div className="my-1 border-t border-white/10" />
          <div className="grid grid-cols-2 gap-1 p-1">
            {LOOP_CATEGORIES.map((item) => (
              <button
                key={item}
                className={`h-7 rounded-md text-[11px] font-bold ${
                  category === item ? "bg-meter-cyan text-studio-950" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                }`}
                onClick={() => runMenuAction(() => setCategory(item))}
                role="menuitem"
              >
                {loopCategoryLabel(item)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
