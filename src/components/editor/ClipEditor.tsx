import { Scissors, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { measureClipPeak } from "../../audio/clipAudio";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { clipTypeLabel, statusLabel } from "../../utils/labels";
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
      <section className="panel grid min-h-0 w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] border-x-0 border-b-0">
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/10 px-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">피아노롤</span>
            <span className="truncate text-sm font-bold text-slate-200">{selectedClip.name}</span>
          </div>
          <button className="studio-button" onClick={() => removeClip(selectedClip.id)} disabled={selectedClip.locked}>
            <Trash2 size={14} />
            {selectedClip.locked ? "잠김" : "삭제"}
          </button>
        </div>
        <PianoRoll clip={selectedClip} />
      </section>
    );
  }

  return (
    <section className="panel grid min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_minmax(150px,auto)] border-x-0 border-b-0 lg:grid-cols-[minmax(0,1fr)_clamp(280px,20vw,420px)] lg:grid-rows-none">
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/10 px-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">클립 편집기</span>
            <span className="truncate text-sm font-bold text-slate-200">
              {selectedClip ? selectedClip.name : selectedTrack ? selectedTrack.name : "선택 없음"}
            </span>
          </div>
          <button className="studio-button" onClick={() => addMidiClip(selectedTrackId)}>
            미디 클립
          </button>
        </div>

        <div className="flex h-[calc(100%-42px)] min-h-0 items-center justify-center overflow-auto bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[length:28px_28px]">
          {selectedClip ? (
            <div className="mx-4 w-full max-w-[920px] rounded-md border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-8 w-2 rounded-full" style={{ backgroundColor: selectedClip.color }} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-slate-100">{selectedClip.name}</div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{clipTypeLabel(selectedClip.type)}</div>
                </div>
              </div>
              {selectedClip.type === "audio" ? (
                <div className="mb-3 h-24 overflow-hidden rounded border border-white/10 bg-studio-950/80">
                  <AudioWaveform clip={selectedClip} color="#4ade80" showTrim className="h-full w-full" />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-400">
                  시작
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
                  길이
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
            <div className="text-sm font-semibold text-slate-500">클립을 선택하세요</div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto border-t border-white/10 p-3 lg:border-l lg:border-t-0">
        <span className="panel-title">속성</span>
        {selectedClip ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">클립</div>
              <div className="mt-1 font-bold text-slate-100">{selectedClip.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <span>시작 {selectedClip.startBeat}</span>
                <span>길이 {selectedClip.lengthBeats}</span>
                <span>종류 {clipTypeLabel(selectedClip.type)}</span>
                <span>노트 {selectedClip.notes?.length ?? 0}개</span>
                {selectedClip.locked ? <span>잠김</span> : null}
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
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">오디오</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {selectedClip.audioAssetId ? "저장된 오디오" : selectedClip.audioUrl ? "이전 형식 오디오" : "소스 없음"}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-slate-400">
                    앞부분 자르기
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
                    뒷부분 자르기
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
                    음량 보정
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
                    페이드 인
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
                    페이드 아웃
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
                    나누기
                  </button>
                  <button
                    className="studio-button w-full"
                    onClick={() => void normalizeSelectedClip()}
                    disabled={selectedClip.locked || normalizeStatus === "working"}
                  >
                    <Wand2 size={14} />
                    {statusLabel(normalizeStatus, "정규화")}
                  </button>
                </div>
              </div>
            ) : null}
            <button className="studio-button w-full" onClick={() => removeClip(selectedClip.id)} disabled={selectedClip.locked}>
              <Trash2 size={14} />
              {selectedClip.locked ? "잠긴 클립" : "클립 삭제"}
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
            {selectedTrack ? `${selectedTrack.name} 선택됨` : "선택된 항목 없음"}
          </div>
        )}
      </div>
    </section>
  );
}
