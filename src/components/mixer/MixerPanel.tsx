import { Drum, Keyboard, Lock, Mic, Plus, Volume2 } from "../icons";
import { normalizeMasterFx } from "../../audio/fx";
import { useDawStore } from "../../store/useDawStore";
import type { TrackType } from "../../types/project";
import { uiText } from "../../utils/uiText";
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
    addTrack(type, type === "drum" ? "드럼" : type === "audio" ? "오디오" : "악기");
  }

  return (
    <aside className="panel grid h-full min-h-0 grid-rows-[44px_auto_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-graphite-700 px-3">
        <span className="panel-title">{uiText.common.mixer}</span>
        <div className="flex items-center gap-1">
          <button className="studio-icon-button" onClick={() => add("drum")} title="드럼 트랙 추가" aria-label="드럼 트랙 추가">
            <Drum size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("instrument")} title="악기 트랙 추가" aria-label="악기 트랙 추가">
            <Keyboard size={14} />
          </button>
          <button className="studio-icon-button" onClick={() => add("audio")} title="오디오 트랙 추가" aria-label="오디오 트랙 추가">
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
                <div className="truncate text-xs font-black text-ink-high">{uiText.common.master}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">{uiText.common.bus}</div>
              </div>
              <Volume2 size={15} className="text-ink-accent" />
            </div>

            <div className="mt-3 grid min-h-0 grid-cols-[1fr_14px] justify-items-center gap-2">
              <Fader label="마스터 음량" value={master.volume} orientation="vertical" onChange={(value) => setMasterFx({ volume: value })} />
              <Meter label="마스터 레벨" value={masterLevel} orientation="vertical" className="h-28 w-2" />
            </div>

            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Knob label="리버브" value={master.reverb ?? 0} step={0.02} onChange={(value) => setMasterFx({ reverb: value })} />
                <Knob label="딜레이" value={master.delay ?? 0} step={0.02} onChange={(value) => setMasterFx({ delay: value })} />
              </div>
              <button
                className={`studio-button h-8 w-full text-[11px] ${master.limiterOn === false ? "" : "border-accent-cycle bg-accent-cycle/15 text-ink-high"}`}
                onClick={() => setMasterFx({ limiterOn: master.limiterOn === false })}
                aria-label={master.limiterOn === false ? "마스터 리미터 켜기" : "마스터 리미터 끄기"}
                aria-pressed={master.limiterOn !== false}
              >
                <Lock size={13} />
                리미터
              </button>
              <button className="studio-button h-8 w-full text-[11px]" onClick={() => add("audio")}>
                <Plus size={13} />
                {uiText.common.track} 추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
