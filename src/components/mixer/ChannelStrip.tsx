import { Circle, Trash2 } from "../icons";
import type { Track, TrackFx, TrackSends } from "../../types/project";
import { normalizeTrackFx, normalizeTrackSends } from "../../audio/fx";
import { Fader, Knob, Meter } from "../ui";

type ChannelStripProps = {
  track: Track;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onVolume: (value: number) => void;
  onPan: (value: number) => void;
  onMute: () => void;
  onSolo: () => void;
  onRecord: () => void;
  onSends: (sends: TrackSends) => void;
  onFx: (fx: TrackFx) => void;
};

export function ChannelStrip({
  track,
  selected,
  onSelect,
  onRename,
  onRemove,
  onVolume,
  onPan,
  onMute,
  onSolo,
  onRecord,
  onSends,
  onFx
}: ChannelStripProps) {
  const sends = normalizeTrackSends(track.sends);
  const fx = normalizeTrackFx(track.fx);
  const meterValue = track.muted ? 0 : track.volume;

  return (
    <div
      className={`grid h-full min-h-[420px] w-36 shrink-0 grid-rows-[auto_auto_1fr_auto] rounded-md border p-2 transition ${
        selected ? "border-accent-sel bg-accent-sel/10" : "border-graphite-700 bg-graphite-800/70 hover:bg-graphite-750/80"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs font-black text-slate-100 outline-none focus:border-graphite-700 focus:bg-black/20"
          value={track.name}
          onChange={(event) => onRename(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`${track.name} track name`}
        />
        <button
          className="studio-icon-button h-7 w-7"
          title="Delete track"
          aria-label={`Delete ${track.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {track.type === "audio" ? (
          <button
            className={`h-7 rounded-md text-[11px] font-black transition ${
              track.recordEnabled ? "bg-accent-record text-graphite-975" : "bg-white/[0.075] text-slate-300 hover:bg-white/[0.11]"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onRecord();
            }}
            title={`${track.name} record enable`}
            aria-label={`${track.name} record enable`}
          >
            <Circle size={10} className="mr-1 inline" fill={track.recordEnabled ? "currentColor" : "none"} />
            R
          </button>
        ) : (
          <span />
        )}
        <button
          className={`h-7 rounded-md text-[11px] font-black transition ${
            track.muted ? "bg-accent-record text-graphite-975" : "bg-white/[0.075] text-slate-300 hover:bg-white/[0.11]"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onMute();
          }}
          aria-label={`${track.name} mute`}
        >
          M
        </button>
        <button
          className={`h-7 rounded-md text-[11px] font-black transition ${
            track.solo ? "bg-accent-cycle text-graphite-975" : "bg-white/[0.075] text-slate-300 hover:bg-white/[0.11]"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onSolo();
          }}
          aria-label={`${track.name} solo`}
        >
          S
        </button>
      </div>

      <div className="mt-3 grid min-h-0 grid-cols-[1fr_14px] justify-items-center gap-2">
        <Fader label={`${track.name} volume`} value={track.volume} orientation="vertical" onChange={onVolume} />
        <Meter label={`${track.name} level`} value={meterValue} orientation="vertical" className="h-28 w-2" />
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Knob label="Pan" value={track.pan} min={-1} max={1} step={0.02} onChange={onPan} />
          <Knob label="Rev" value={sends.reverb} step={0.02} onChange={(value) => onSends({ reverb: value })} />
          <Knob label="Delay" value={sends.delay} step={0.02} onChange={(value) => onSends({ delay: value })} />
          <Knob label="Low" value={fx.eq.low} min={-24} max={24} step={0.4} onChange={(value) => onFx({ eq: { ...fx.eq, low: value } })} />
          <Knob label="Mid" value={fx.eq.mid} min={-24} max={24} step={0.4} onChange={(value) => onFx({ eq: { ...fx.eq, mid: value } })} />
          <Knob label="High" value={fx.eq.high} min={-24} max={24} step={0.4} onChange={(value) => onFx({ eq: { ...fx.eq, high: value } })} />
          <Knob label="Thresh" value={fx.comp.threshold} min={-60} max={0} step={0.6} onChange={(value) => onFx({ comp: { ...fx.comp, threshold: value } })} />
          <Knob label="Ratio" value={fx.comp.ratio} min={1} max={20} step={0.2} onChange={(value) => onFx({ comp: { ...fx.comp, ratio: value } })} />
        </div>
      </div>
    </div>
  );
}
