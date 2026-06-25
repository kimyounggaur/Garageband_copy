import { type PointerEvent, useMemo, useRef, useState } from "react";
import { DRUM_LANES, generateSmartDrumPattern } from "../../utils/touchInstruments";
import { Play, Plus, RefreshCcw } from "../icons";
import type { TouchInstrumentContext } from "./TouchInstruments";

export function SmartDrums({ context }: { context: TouchInstrumentContext }) {
  const [complexity, setComplexity] = useState(0.62);
  const [loudness, setLoudness] = useState(0.72);
  const [seed, setSeed] = useState(7);
  const padRef = useRef<HTMLDivElement | null>(null);

  const notes = useMemo(
    () => generateSmartDrumPattern({ complexity, loudness, lengthBeats: 4, seed }),
    [complexity, loudness, seed]
  );

  const laneCounts = useMemo(() => {
    return DRUM_LANES.map((lane) => ({
      ...lane,
      count: notes.filter((note) => note.pitch === lane.pitch).length
    }));
  }, [notes]);

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setComplexity(Number(x.toFixed(2)));
    setLoudness(Number((1 - y).toFixed(2)));
  }

  function writePattern() {
    context.previewDrumNotes(notes);
    context.writeDrumNotes(notes, { preserveTiming: true });
  }

  return (
    <div className="grid min-h-full gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="panel-title">Smart Drums</span>
          <span className="text-xs font-black text-slate-300">{notes.length} hits</span>
        </div>

        <div
          ref={padRef}
          className="relative h-52 overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(to_right,rgba(122,215,255,.12),rgba(250,204,21,.12)),linear-gradient(to_top,rgba(15,18,23,.85),rgba(255,255,255,.08))]"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons) updateFromPointer(event);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 border-t border-white/10" />
          <div className="absolute inset-y-0 left-1/2 border-l border-white/10" />
          <div
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-play shadow-[0_0_18px_rgba(94,194,107,0.5)]"
            style={{ left: `${complexity * 100}%`, top: `${(1 - loudness) * 100}%` }}
          />
          <span className="absolute left-3 top-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Quiet</span>
          <span className="absolute bottom-8 left-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">Loud</span>
          <span className="absolute bottom-3 left-3 right-3 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            <span>Simple</span>
            <span>Complex</span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {laneCounts.map((lane) => (
            <div key={lane.id} className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-center">
              <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ backgroundColor: lane.color }} />
              <div className="truncate text-[10px] font-black uppercase text-slate-400">{lane.label}</div>
              <div className="text-sm font-black text-slate-100">{lane.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
        <label className="block text-xs font-bold text-slate-400">
          Complexity
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={complexity}
            onChange={(event) => setComplexity(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-bold text-slate-400">
          Loudness
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={loudness}
            onChange={(event) => setLoudness(Number(event.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className="studio-button" onClick={() => context.previewDrumNotes(notes)}>
            <Play size={14} />
            Play
          </button>
          <button className="studio-button" onClick={writePattern}>
            <Plus size={14} />
            Write
          </button>
        </div>
        <button className="studio-button w-full" onClick={() => setSeed((value) => value + 1)}>
          <RefreshCcw size={14} />
          Random
        </button>
      </div>
    </div>
  );
}
