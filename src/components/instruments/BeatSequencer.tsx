import { useMemo, useState } from "react";
import { DRUM_LANES, buildStepSequencerNotes, type DrumLaneId, type SequencerStep } from "../../utils/touchInstruments";
import { Play, Plus, Trash2 } from "../icons";
import type { TouchInstrumentContext } from "./TouchInstruments";

const STEP_COUNT = 16;
const STEP_BEATS = 0.25;

type StepGrid = Record<DrumLaneId, Record<number, number>>;

function createDefaultGrid(): StepGrid {
  return {
    kick: { 0: 0.9, 4: 0.72, 8: 0.86, 12: 0.72 },
    snare: { 4: 0.76, 12: 0.78 },
    hat: { 0: 0.45, 2: 0.38, 4: 0.46, 6: 0.38, 8: 0.45, 10: 0.38, 12: 0.46, 14: 0.38 },
    clap: {},
    tom: {}
  };
}

function gridToSteps(grid: StepGrid): SequencerStep[] {
  return DRUM_LANES.flatMap((lane) =>
    Object.entries(grid[lane.id]).map(([step, velocity]) => ({
      lane: lane.id,
      step: Number(step),
      velocity
    }))
  );
}

export function BeatSequencer({ context }: { context: TouchInstrumentContext }) {
  const [grid, setGrid] = useState<StepGrid>(() => createDefaultGrid());
  const [paintVelocity, setPaintVelocity] = useState(0.72);
  const [swing, setSwing] = useState(0.18);

  const notes = useMemo(
    () =>
      buildStepSequencerNotes(gridToSteps(grid), {
        startBeat: 0,
        stepBeats: STEP_BEATS,
        swing,
        lengthSteps: STEP_COUNT
      }),
    [grid, swing]
  );

  function toggleStep(lane: DrumLaneId, step: number) {
    setGrid((current) => {
      const laneSteps = { ...current[lane] };
      if (laneSteps[step] !== undefined) delete laneSteps[step];
      else laneSteps[step] = paintVelocity;
      return { ...current, [lane]: laneSteps };
    });
  }

  function clearGrid() {
    setGrid({ kick: {}, snare: {}, hat: {}, clap: {}, tom: {} });
  }

  function writePattern() {
    context.previewDrumNotes(notes);
    context.writeDrumNotes(notes, { preserveTiming: true });
  }

  return (
    <div className="grid min-h-full gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="panel-title">Beat Sequencer</span>
          <span className="text-xs font-black text-slate-300">{notes.length} hits</span>
        </div>

        <div className="space-y-1">
          {DRUM_LANES.map((lane) => (
            <div key={lane.id} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
              <div className="truncate text-xs font-black uppercase tracking-[0.08em] text-slate-400">{lane.label}</div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${STEP_COUNT}, minmax(20px, 1fr))` }}>
                {Array.from({ length: STEP_COUNT }, (_, step) => {
                  const activeVelocity = grid[lane.id][step];
                  const isBarStart = step % 4 === 0;
                  return (
                    <button
                      key={step}
                      className={`h-7 rounded border text-[10px] font-black transition ${
                        activeVelocity !== undefined
                          ? "border-accent-play bg-accent-play/25 text-white"
                          : isBarStart
                            ? "border-white/10 bg-white/[0.08] text-graphite-500"
                            : "border-white/5 bg-white/[0.035] text-graphite-600"
                      }`}
                      style={activeVelocity !== undefined ? { opacity: 0.45 + activeVelocity * 0.55 } : undefined}
                      onClick={() => toggleStep(lane.id, step)}
                      title={`${lane.label} ${step + 1}`}
                      aria-label={`${lane.label} step ${step + 1}`}
                    >
                      {activeVelocity !== undefined ? Math.round(activeVelocity * 10) : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
        <label className="block text-xs font-bold text-slate-400">
          Step Velocity
          <input
            className="mt-2 w-full"
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={paintVelocity}
            onChange={(event) => setPaintVelocity(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-bold text-slate-400">
          Swing
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={0.75}
            step={0.01}
            value={swing}
            onChange={(event) => setSwing(Number(event.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className="studio-button" onClick={() => context.previewDrumNotes(notes)} disabled={notes.length === 0}>
            <Play size={14} />
            Play
          </button>
          <button className="studio-button" onClick={writePattern} disabled={notes.length === 0}>
            <Plus size={14} />
            Write
          </button>
        </div>
        <button className="studio-button w-full" onClick={clearGrid}>
          <Trash2 size={14} />
          Clear
        </button>
      </div>
    </div>
  );
}
