import * as Tone from "tone";
import { type PointerEvent, useEffect, useMemo, useRef } from "react";
import { DRUMMER_PRESETS, defaultDrummerSettings, normalizeDrummerSettings } from "../../audio/drummer";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { Drum, Play, RefreshCcw, SlidersHorizontal } from "../icons";

type DrumNodes = {
  kick?: Tone.MembraneSynth;
  snare?: Tone.NoiseSynth;
  hat?: Tone.MetalSynth;
};

const LANES = [
  { id: "kick", label: "Kick", color: "#5ec26b", match: (pitch: number) => pitch <= 36 },
  { id: "snare", label: "Snare", color: "#f07b7b", match: (pitch: number) => pitch > 36 && pitch <= 40 },
  { id: "hat", label: "Hat", color: "#7ad7ff", match: (pitch: number) => pitch === 42 || pitch === 46 },
  { id: "fill", label: "Fill", color: "#e0b341", match: (pitch: number) => pitch === 45 || pitch === 47 || pitch === 39 }
];

function secondsPerBeat(bpm: number) {
  return 60 / Math.max(1, bpm);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function Drummer({ clip }: { clip: Clip }) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const drumNodesRef = useRef<DrumNodes>({});
  const project = useDawStore((state) => state.project);
  const updateDrummerClip = useDawStore((state) => state.updateDrummerClip);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const settings = normalizeDrummerSettings({
    preset: clip.drummerPreset,
    complexity: clip.drummerComplexity,
    loudness: clip.drummerLoudness,
    swing: clip.drummerSwing,
    fills: clip.drummerFills,
    lengthBeats: clip.lengthBeats
  });

  const laneCounts = useMemo(() => {
    return LANES.map((lane) => ({
      ...lane,
      count: (clip.notes ?? []).filter((note) => lane.match(note.pitch)).length
    }));
  }, [clip.notes]);

  useEffect(() => {
    return () => {
      Object.values(drumNodesRef.current).forEach((node) => node?.dispose());
      drumNodesRef.current = {};
    };
  }, []);

  async function ensureDrumNodes() {
    await Tone.start();
    drumNodesRef.current.kick ??= new Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.2 }
    }).toDestination();
    drumNodesRef.current.snare ??= new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
    }).toDestination();
    drumNodesRef.current.hat ??= new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 2800,
      octaves: 1
    }).toDestination();
    return drumNodesRef.current;
  }

  function updatePadFromPointer(event: PointerEvent<HTMLDivElement>, recordHistory = false) {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const complexity = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const loudness = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    updateDrummerClip(
      clip.id,
      {
        drummerComplexity: Number(complexity.toFixed(2)),
        drummerLoudness: Number(loudness.toFixed(2))
      },
      recordHistory ? undefined : { recordHistory: false, snap: false }
    );
  }

  function preview() {
    const notes = clip.notes ?? [];
    if (notes.length === 0) return;
    void ensureDrumNodes().then((nodes) => {
      const beatSeconds = secondsPerBeat(project.bpm);
      const firstBeat = Math.min(...notes.map((note) => note.startBeat));
      const now = Tone.now();
      notes.forEach((note) => {
        const time = now + Math.max(0, note.startBeat - firstBeat) * beatSeconds;
        if (note.pitch <= 36) nodes.kick?.triggerAttackRelease("C1", "8n", time, note.velocity);
        else if (note.pitch <= 40) nodes.snare?.triggerAttackRelease("16n", time, note.velocity);
        else nodes.hat?.triggerAttackRelease("32n", time, note.velocity * 0.55);
      });
    });
  }

  function resetSettings() {
    const defaults = defaultDrummerSettings();
    updateDrummerClip(clip.id, {
      drummerPreset: defaults.preset,
      drummerComplexity: defaults.complexity,
      drummerLoudness: defaults.loudness,
      drummerSwing: defaults.swing,
      drummerFills: defaults.fills
    });
  }

  return (
    <section className="grid h-full min-h-0 gap-3 bg-graphite-950/60 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-white/10 bg-black/20">
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Drum size={16} className="shrink-0 text-meter-amber" />
            <span className="truncate text-sm font-black text-slate-100">{settings.preset}</span>
          </div>
          <span className="text-xs font-black text-slate-300">{clip.notes?.length ?? 0} hits</span>
        </div>

        <div
          ref={padRef}
          className="relative m-3 min-h-52 overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(to_right,rgba(94,194,107,.16),rgba(224,179,65,.18)),linear-gradient(to_top,rgba(15,18,23,.88),rgba(255,255,255,.08))]"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            beginHistorySnapshot();
            updatePadFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons) updatePadFromPointer(event);
          }}
          onPointerUp={() => commitHistorySnapshot()}
          onPointerCancel={() => commitHistorySnapshot()}
        >
          <div className="absolute inset-x-0 top-1/2 border-t border-white/10" />
          <div className="absolute inset-y-0 left-1/2 border-l border-white/10" />
          <div
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-meter-amber shadow-[0_0_18px_rgba(224,179,65,0.55)]"
            style={{ left: percent(settings.complexity), top: percent(1 - settings.loudness) }}
          />
          <span className="absolute left-3 top-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Quiet</span>
          <span className="absolute bottom-8 left-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">Loud</span>
          <span className="absolute bottom-3 left-3 right-3 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            <span>Simple</span>
            <span>Complex</span>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-3">
          {laneCounts.map((lane) => (
            <div key={lane.id} className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-center">
              <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ backgroundColor: lane.color }} />
              <div className="truncate text-[10px] font-black uppercase text-slate-400">{lane.label}</div>
              <div className="text-sm font-black text-slate-100">{lane.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 space-y-3 overflow-y-auto rounded-md border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-meter-cyan" />
          <span className="panel-title">Drummer</span>
        </div>

        <label className="block text-xs font-bold text-slate-400">
          Preset
          <select
            className="mt-2 h-9 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm font-bold text-slate-100 outline-none focus:border-meter-cyan"
            value={settings.preset}
            onChange={(event) => updateDrummerClip(clip.id, { drummerPreset: event.target.value })}
          >
            {DRUMMER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-bold text-slate-400">
          Complexity {percent(settings.complexity)}
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.complexity}
            onChange={(event) => updateDrummerClip(clip.id, { drummerComplexity: Number(event.target.value) })}
          />
        </label>

        <label className="block text-xs font-bold text-slate-400">
          Loudness {percent(settings.loudness)}
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.loudness}
            onChange={(event) => updateDrummerClip(clip.id, { drummerLoudness: Number(event.target.value) })}
          />
        </label>

        <label className="block text-xs font-bold text-slate-400">
          Swing {percent(settings.swing)}
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.swing}
            onChange={(event) => updateDrummerClip(clip.id, { drummerSwing: Number(event.target.value) })}
          />
        </label>

        <label className="block text-xs font-bold text-slate-400">
          Fills {percent(settings.fills)}
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.fills}
            onChange={(event) => updateDrummerClip(clip.id, { drummerFills: Number(event.target.value) })}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button className="studio-button" onClick={preview}>
            <Play size={14} />
            Play
          </button>
          <button className="studio-button" onClick={resetSettings}>
            <RefreshCcw size={14} />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
