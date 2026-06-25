import { buildSmartControlPatch, normalizeTrackFx, normalizeTrackSends, resolveSmartControlMacros } from "../../audio/fx";
import { useDawStore } from "../../store/useDawStore";
import { Knob } from "../ui";

export function SmartControls() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const applyTrackSmartControl = useDawStore((state) => state.applyTrackSmartControl);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId) ?? project.tracks[0];

  if (!selectedTrack) {
    return (
      <section className="rounded-md border border-graphite-700 bg-graphite-800/70 p-3 text-xs font-bold text-graphite-500">
        Select a track for Smart Controls.
      </section>
    );
  }

  const macros = resolveSmartControlMacros(selectedTrack);
  const sends = normalizeTrackSends(selectedTrack.sends);
  const fx = normalizeTrackFx(selectedTrack.fx);
  const preview = {
    brightness: buildSmartControlPatch("brightness", macros.brightness).fx?.eq,
    space: buildSmartControlPatch("space", macros.space).sends,
    punch: buildSmartControlPatch("punch", macros.punch).fx?.comp
  };

  return (
    <section className="rounded-md border border-graphite-700 bg-graphite-800/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="panel-title truncate">Smart Controls</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold text-graphite-500">{selectedTrack.name}</div>
        </div>
        <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
          FX
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Knob
          label="Bright"
          value={macros.brightness}
          step={0.02}
          onChange={(value) => applyTrackSmartControl(selectedTrack.id, "brightness", value)}
        />
        <Knob label="Space" value={macros.space} step={0.02} onChange={(value) => applyTrackSmartControl(selectedTrack.id, "space", value)} />
        <Knob label="Punch" value={macros.punch} step={0.02} onChange={(value) => applyTrackSmartControl(selectedTrack.id, "punch", value)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-graphite-500">
        <div className="rounded bg-black/20 p-2">
          <div className="text-slate-300">EQ</div>
          <div>Low {fx.eq.low.toFixed(1)} dB</div>
          <div>Mid {fx.eq.mid.toFixed(1)} dB</div>
          <div>High {fx.eq.high.toFixed(1)} dB</div>
        </div>
        <div className="rounded bg-black/20 p-2">
          <div className="text-slate-300">Bus</div>
          <div>Rev {(sends.reverb * 100).toFixed(0)}%</div>
          <div>Delay {(sends.delay * 100).toFixed(0)}%</div>
          <div>Ratio {fx.comp.ratio.toFixed(1)}:1</div>
        </div>
      </div>

      <div className="mt-2 hidden text-[10px] text-graphite-600 xl:block">
        Bright maps to {preview.brightness?.high.toFixed(1)} dB high EQ, Space to {((preview.space?.reverb ?? 0) * 100).toFixed(0)}%
        reverb, Punch to {preview.punch?.ratio.toFixed(1)}:1 compression.
      </div>
    </section>
  );
}
