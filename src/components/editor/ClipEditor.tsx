import { Scissors, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { measureClipPeak } from "../../audio/clipAudio";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { AudioWaveform } from "../audio/AudioWaveform";
import { PianoRoll } from "./PianoRoll";

function findSelectedClip(clips: Clip[], clipId?: string) {
  return clips.find((clip) => clip.id === clipId);
}

function audioValue(value: number | undefined, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function ClipEditor() {
  const [normalizeStatus, setNormalizeStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const project = useDawStore((state) => state.project);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const moveClip = useDawStore((state) => state.moveClip);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const removeClip = useDawStore((state) => state.removeClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const updateClipAudioSettings = useDawStore((state) => state.updateClipAudioSettings);
  const splitSelectedAudioClip = useDawStore((state) => state.splitSelectedAudioClip);
  const clips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project.tracks]);
  const selectedClip = findSelectedClip(clips, selectedClipId);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);

  useEffect(() => {
    setNormalizeStatus("idle");
  }, [selectedClipId]);

  async function normalizeSelectedClip() {
    if (!selectedClip || selectedClip.type !== "audio" || selectedClip.locked) return;
    setNormalizeStatus("working");
    const result = await measureClipPeak(selectedClip, project.bpm);
    if (!result || result.peak <= 0.0001) {
      setNormalizeStatus("error");
      return;
    }
    updateClipAudioSettings(selectedClip.id, { gain: result.normalizedGain });
    setNormalizeStatus("done");
  }

  if (selectedClip?.type === "midi") {
    return (
      <section className="panel grid min-h-0 w-full min-w-0 grid-rows-[40px_minmax(0,1fr)] border-x-0 border-b-0">
        <div className="flex items-center justify-between border-b border-white/10 px-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">Piano Roll</span>
            <span className="truncate text-sm font-bold text-slate-200">{selectedClip.name}</span>
          </div>
          <button className="studio-button" onClick={() => removeClip(selectedClip.id)} disabled={selectedClip.locked}>
            <Trash2 size={14} />
            {selectedClip.locked ? "Locked" : "Delete"}
          </button>
        </div>
        <PianoRoll clip={selectedClip} />
      </section>
    );
  }

  return (
    <section className="panel grid min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_clamp(280px,20vw,420px)] border-x-0 border-b-0">
      <div className="min-h-0 overflow-hidden">
        <div className="flex h-10 items-center justify-between border-b border-white/10 px-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">Clip Editor</span>
            <span className="truncate text-sm font-bold text-slate-200">
              {selectedClip ? selectedClip.name : selectedTrack ? selectedTrack.name : "No selection"}
            </span>
          </div>
          <button className="studio-button" onClick={() => addMidiClip(selectedTrackId)}>
            MIDI Clip
          </button>
        </div>

        <div className="flex h-[calc(100%-40px)] items-center justify-center bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[length:28px_28px]">
          {selectedClip ? (
            <div className="mx-4 w-full max-w-[920px] rounded-md border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-8 w-2 rounded-full" style={{ backgroundColor: selectedClip.color }} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-slate-100">{selectedClip.name}</div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{selectedClip.type}</div>
                </div>
              </div>
              {selectedClip.type === "audio" ? (
                <div className="mb-3 h-24 overflow-hidden rounded border border-white/10 bg-studio-950/80">
                  <AudioWaveform clip={selectedClip} color="#4ade80" showTrim className="h-full w-full" />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-400">
                  Start
                  <input
                    className="mt-1 h-9 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                    type="number"
                    min={0}
                    step={snapBeats}
                    value={selectedClip.startBeat}
                    disabled={selectedClip.locked}
                    onChange={(event) => moveClip(selectedClip.id, Number(event.target.value))}
                  />
                </label>
                <label className="text-xs font-bold text-slate-400">
                  Length
                  <input
                    className="mt-1 h-9 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                    type="number"
                    min={0.25}
                    step={snapBeats}
                    value={selectedClip.lengthBeats}
                    disabled={selectedClip.locked}
                    onChange={(event) => resizeClip(selectedClip.id, Number(event.target.value))}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">Select a clip</div>
          )}
        </div>
      </div>

      <div className="border-l border-white/10 p-3">
        <span className="panel-title">Inspector</span>
        {selectedClip ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Clip</div>
              <div className="mt-1 font-bold text-slate-100">{selectedClip.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <span>Start {selectedClip.startBeat}</span>
                <span>Length {selectedClip.lengthBeats}</span>
                <span>Type {selectedClip.type}</span>
                <span>{selectedClip.notes?.length ?? 0} notes</span>
                {selectedClip.locked ? <span>Locked</span> : null}
              </div>
              {selectedClip.instructions ? (
                <div className="mt-3 rounded-md bg-meter-amber/10 p-2 text-xs leading-5 text-amber-100">
                  {selectedClip.instructions}
                </div>
              ) : null}
            </div>
            {selectedClip.type === "audio" ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Audio</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {selectedClip.audioAssetId ? "IndexedDB asset" : selectedClip.audioUrl ? "Legacy data URL" : "Missing source"}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    Trim Start
                    <input
                      className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                      type="number"
                      min={0}
                      step={0.01}
                      value={audioValue(selectedClip.trimStartSeconds)}
                      disabled={selectedClip.locked}
                      onChange={(event) =>
                        updateClipAudioSettings(selectedClip.id, { trimStartSeconds: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-400">
                    Trim End
                    <input
                      className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                      type="number"
                      min={0}
                      step={0.01}
                      value={audioValue(selectedClip.trimEndSeconds)}
                      disabled={selectedClip.locked}
                      onChange={(event) =>
                        updateClipAudioSettings(selectedClip.id, { trimEndSeconds: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-400">
                    Gain
                    <input
                      className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                      type="number"
                      min={0}
                      max={8}
                      step={0.01}
                      value={audioValue(selectedClip.gain, 1)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { gain: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-400">
                    Fade In
                    <input
                      className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                      type="number"
                      min={0}
                      step={0.01}
                      value={audioValue(selectedClip.fadeInSeconds)}
                      disabled={selectedClip.locked}
                      onChange={(event) =>
                        updateClipAudioSettings(selectedClip.id, { fadeInSeconds: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-400">
                    Fade Out
                    <input
                      className="mt-1 h-8 w-full rounded border border-white/10 bg-studio-950 px-2 text-sm text-slate-100 outline-none focus:border-meter-cyan"
                      type="number"
                      min={0}
                      step={0.01}
                      value={audioValue(selectedClip.fadeOutSeconds)}
                      disabled={selectedClip.locked}
                      onChange={(event) =>
                        updateClipAudioSettings(selectedClip.id, { fadeOutSeconds: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="studio-button w-full" onClick={splitSelectedAudioClip} disabled={selectedClip.locked}>
                    <Scissors size={14} />
                    Split
                  </button>
                  <button
                    className="studio-button w-full"
                    onClick={() => void normalizeSelectedClip()}
                    disabled={selectedClip.locked || normalizeStatus === "working"}
                  >
                    <Wand2 size={14} />
                    {normalizeStatus === "working" ? "Working" : normalizeStatus === "done" ? "Normalized" : "Normalize"}
                  </button>
                </div>
              </div>
            ) : null}
            <button className="studio-button w-full" onClick={() => removeClip(selectedClip.id)} disabled={selectedClip.locked}>
              <Trash2 size={14} />
              {selectedClip.locked ? "Locked Clip" : "Delete Clip"}
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
            {selectedTrack ? `${selectedTrack.name} selected` : "Nothing selected"}
          </div>
        )}
      </div>
    </section>
  );
}
