import { Drum, Keyboard, Lock, Mic, Plus, Volume2 } from "../icons";
import { normalizeMasterFx } from "../../audio/fx";
import { useDawStore } from "../../store/useDawStore";
import type { TrackType } from "../../types/project";
import { Fader, Knob, Meter } from "../ui";
import { ChannelStrip } from "./ChannelStrip";
import { SmartControls } from "./SmartControls";

export function MixerPanel() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const masterLevel = useDawStore((state) => state.masterLevel);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const addTrack = useDawStore((state) => state.addTrack);
  const renameTrack = useDawStore((state) => state.renameTrack);
  const removeTrack = useDawStore((state) => state.removeTrack);
  const toggleMute = useDawStore((state) => state.toggleMute);
  const toggleSolo = useDawStore((state) => state.toggleSolo);
  const setTrackRecordEnabled = useDawStore((state) => state.setTrackRecordEnabled);
  const setTrackVolume = useDawStore((state) => state.setTrackVolume);
  const setTrackPan = useDawStore((state) => state.setTrackPan);
  const setTrackSends = useDawStore((state) => state.setTrackSends);
  const setTrackFx = useDawStore((state) => state.setTrackFx);
  const setMasterFx = useDawStore((state) => state.setMasterFx);
  const master = normalizeMasterFx(project.master, project.masterVolume);

  function add(type: TrackType) {
    addTrack(type, type === "drum" ? "Drum" : type === "audio" ? "Audio" : "Instrument");
  }

  return (
    <aside className="panel grid h-full min-h-0 grid-rows-[44px_auto_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-graphite-700 px-3">
        <span className="panel-title">Mixer</span>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button" onClick={() => add("drum")} title="Add drum track" aria-label="Add drum track">
            <Drum size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("instrument")} title="Add instrument track" aria-label="Add instrument track">
            <Keyboard size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("audio")} title="Add audio track" aria-label="Add audio track">
            <Mic size={14} />
          </button>
        </div>
      </div>

      <div className="border-b border-graphite-700 p-2">
        <SmartControls />
      </div>

      <div className="min-h-0 overflow-auto p-2">
        <div className="flex h-full min-h-[460px] gap-2">
          {project.tracks.map((track) => (
            <ChannelStrip
              key={track.id}
              track={track}
              selected={selectedTrackId === track.id}
              onSelect={() => selectTrack(track.id)}
              onRename={(name) => renameTrack(track.id, name)}
              onRemove={() => removeTrack(track.id)}
              onVolume={(value) => setTrackVolume(track.id, value)}
              onPan={(value) => setTrackPan(track.id, value)}
              onMute={() => toggleMute(track.id)}
              onSolo={() => toggleSolo(track.id)}
              onRecord={() => setTrackRecordEnabled(track.id)}
              onSends={(sends) => setTrackSends(track.id, sends)}
              onFx={(fx) => setTrackFx(track.id, fx)}
            />
          ))}

          <div className="grid h-full min-h-[420px] w-36 shrink-0 grid-rows-[auto_1fr_auto] rounded-md border border-accent-sel/40 bg-accent-sel/10 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-slate-100">Master</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">Bus</div>
              </div>
              <Volume2 size={15} className="text-accent-sel" />
            </div>

            <div className="mt-3 grid min-h-0 grid-cols-[1fr_14px] justify-items-center gap-2">
              <Fader label="Master volume" value={master.volume} orientation="vertical" onChange={(value) => setMasterFx({ volume: value })} />
              <Meter label="Master level" value={masterLevel || master.volume} orientation="vertical" className="h-28 w-2" />
            </div>

            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Knob label="Rev" value={master.reverb ?? 0} step={0.02} onChange={(value) => setMasterFx({ reverb: value })} />
                <Knob label="Delay" value={master.delay ?? 0} step={0.02} onChange={(value) => setMasterFx({ delay: value })} />
              </div>
              <button
                className={`studio-button h-8 w-full text-[11px] ${master.limiterOn === false ? "" : "border-accent-cycle bg-accent-cycle/15 text-white"}`}
                onClick={() => setMasterFx({ limiterOn: master.limiterOn === false })}
                aria-label="Toggle master limiter"
              >
                <Lock size={13} />
                Limiter
              </button>
              <button className="studio-button h-8 w-full text-[11px]" onClick={() => add("audio")}>
                <Plus size={13} />
                Track
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
