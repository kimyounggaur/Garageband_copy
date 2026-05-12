import { Music2, Plus } from "../icons";
import { useState } from "react";
import { LOOP_CATEGORIES, LOOP_LIBRARY } from "../../data/loops";
import { AudioAssetsPanel } from "../recording/AudioAssetsPanel";
import { RecorderPanel } from "../recording/RecorderPanel";
import { useDawStore } from "../../store/useDawStore";
import type { LoopCategory } from "../../types/project";
import { loopCategoryLabel } from "../../utils/labels";
import { snapBeat } from "../../utils/timeline";

export function SoundLibrary() {
  const [category, setCategory] = useState<LoopCategory>("Drums");
  const addLoopClip = useDawStore((state) => state.addLoopClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const loops = LOOP_LIBRARY.filter((loop) => loop.category === category);

  return (
    <aside className="panel flex min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">사운드</span>
        <button
          className="studio-icon-button"
          title="미디 클립 추가"
          onClick={() => addMidiClip(selectedTrackId, snapBeat(currentBeat, snapBeats))}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/webband-midi", "midi")}
          aria-label="미디 클립 추가"
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
              onClick={() => addLoopClip(loop.id, selectedTrackId, snapBeat(currentBeat, snapBeats))}
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
          onClick={() => addMidiClip(selectedTrackId, snapBeat(currentBeat, snapBeats))}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/webband-midi", "midi")}
        >
          <Plus size={15} />
          미디 클립
        </button>
      </div>
    </aside>
  );
}
