import { Scissors, Trash2, Wand2 } from "../icons";
import { useEffect, useMemo, useState } from "react";
import { measureClipPeak } from "../../audio/clipAudio";
import { clipTakeIds, normalizeTakeSections } from "../../audio/audioComping";
import { useDawStore } from "../../store/useDawStore";
import type { AudioTakeSection, Clip } from "../../types/project";
import { clipTypeLabel, statusLabel } from "../../utils/labels";
import { uiText } from "../../utils/uiText";
import { AudioWaveform } from "../audio/AudioWaveform";
import { Drummer } from "../instruments/Drummer";
import { TouchInstruments } from "../instruments/TouchInstruments";
import { PianoRoll } from "./PianoRoll";

function findSelectedClip(clips: Clip[], clipId?: string) {
  return clips.find((clip) => clip.id === clipId);
}

function audioValue(value: number | undefined, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function updateTakeSection(sections: AudioTakeSection[], sectionId: string, edit: Partial<AudioTakeSection>) {
  return sections.map((section) => (section.id === sectionId ? { ...section, ...edit } : section));
}

export function ClipEditor() {
  const [normalizeStatus, setNormalizeStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [midiEditorMode, setMidiEditorMode] = useState<"roll" | "touch" | "drummer">("roll");
  const project = useDawStore((state) => state.project);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const moveClip = useDawStore((state) => state.moveClip);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const removeClip = useDawStore((state) => state.removeClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const updateClipAudioSettings = useDawStore((state) => state.updateClipAudioSettings);
  const setClipActiveTake = useDawStore((state) => state.setClipActiveTake);
  const setClipTakeSections = useDawStore((state) => state.setClipTakeSections);
  const createCompedAudioClip = useDawStore((state) => state.createCompedAudioClip);
  const splitSelectedAudioClip = useDawStore((state) => state.splitSelectedAudioClip);
  const clips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project.tracks]);
  const selectedClip = findSelectedClip(clips, selectedClipId);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  const selectedClipTrack = project.tracks.find((track) => track.id === selectedClip?.trackId);
  const isDrummerClip = Boolean(selectedClip?.drummerPreset || selectedClipTrack?.role === "drummer");

  useEffect(() => {
    setNormalizeStatus("idle");
  }, [selectedClipId]);

  useEffect(() => {
    setMidiEditorMode((mode) => (isDrummerClip ? "drummer" : mode === "drummer" ? "roll" : mode));
  }, [isDrummerClip, selectedClipId]);

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
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-line px-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">
              {midiEditorMode === "drummer" ? uiText.common.drummer : midiEditorMode === "roll" ? uiText.common.pianoRoll : "터치 악기"}
            </span>
            <span className="truncate text-sm font-bold text-ink-high">{selectedClip.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              className={`studio-button h-7 px-2 text-[11px] ${midiEditorMode === "roll" ? "border-accent-sel bg-accent-sel/15 text-ink-accent" : ""}`}
              onClick={() => setMidiEditorMode("roll")}
            >
              {uiText.common.pianoRoll}
            </button>
            {isDrummerClip ? (
              <button
                className={`studio-button h-7 px-2 text-[11px] ${midiEditorMode === "drummer" ? "border-accent-sel bg-accent-sel/15 text-ink-accent" : ""}`}
                onClick={() => setMidiEditorMode("drummer")}
              >
                {uiText.common.drummer}
              </button>
            ) : null}
            <button
              className={`studio-button h-7 px-2 text-[11px] ${midiEditorMode === "touch" ? "border-accent-sel bg-accent-sel/15 text-ink-accent" : ""}`}
              onClick={() => setMidiEditorMode("touch")}
            >
              터치 악기
            </button>
            <button className="studio-button h-7" onClick={() => removeClip(selectedClip.id)} disabled={selectedClip.locked}>
              <Trash2 size={14} />
              {selectedClip.locked ? "잠김" : "삭제"}
            </button>
          </div>
        </div>
        {midiEditorMode === "drummer" ? (
          <Drummer clip={selectedClip} />
        ) : midiEditorMode === "roll" ? (
          <PianoRoll clip={selectedClip} />
        ) : (
          <TouchInstruments clip={selectedClip} />
        )}
      </section>
    );
  }

  return (
    <section className="panel grid min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_minmax(150px,auto)] border-x-0 border-b-0 lg:grid-cols-[minmax(0,1fr)_clamp(280px,20vw,420px)] lg:grid-rows-none">
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-line px-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-title">클립 편집기</span>
            <span className="truncate text-sm font-bold text-ink-high">
              {selectedClip ? selectedClip.name : selectedTrack ? selectedTrack.name : "선택 없음"}
            </span>
          </div>
          <button className="studio-button" onClick={() => addMidiClip(selectedTrackId)}>
            미디 클립
          </button>
        </div>

        <div className="flex h-[calc(100%-42px)] min-h-0 items-center justify-center overflow-auto bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[length:28px_28px]">
          {selectedClip ? (
            <div className="mx-4 w-full max-w-[920px] rounded-md border border-line bg-black/25 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-8 w-2 rounded-full" style={{ backgroundColor: selectedClip.color }} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-ink-high">{selectedClip.name}</div>
                  <div className="text-xs uppercase tracking-[0.12em] text-ink-body">{clipTypeLabel(selectedClip.type)}</div>
                </div>
              </div>
              {selectedClip.type === "audio" ? (
                <div className="mb-3 h-24 overflow-hidden rounded border border-line bg-surface-base/80">
                  <AudioWaveform
                    clip={selectedClip}
                    color="#4ade80"
                    showTrim
                    editable={!selectedClip.locked}
                    bpm={project.bpm}
                    playheadBeat={currentBeat}
                    className="h-full w-full"
                    onEdit={(settings) => updateClipAudioSettings(selectedClip.id, settings)}
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-ink-body">
                  시작
                  <input
                    className="mt-1 h-9 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                    type="number"
                    min={0}
                    step={snapBeats}
                    value={selectedClip.startBeat}
                    disabled={selectedClip.locked}
                    onChange={(event) => moveClip(selectedClip.id, Number(event.target.value))}
                  />
                </label>
                <label className="text-xs font-bold text-ink-body">
                  길이
                  <input
                    className="mt-1 h-9 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
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
            <div className="text-sm font-semibold text-ink-body">클립을 선택하세요</div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto border-t border-line p-3 lg:border-l lg:border-t-0">
        <span className="panel-title">속성</span>
        {selectedClip ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-md border border-line bg-surface-raised/50 p-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-body">클립</div>
              <div className="mt-1 font-bold text-ink-high">{selectedClip.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-body">
                <span>시작 {selectedClip.startBeat}</span>
                <span>길이 {selectedClip.lengthBeats}</span>
                <span>종류 {clipTypeLabel(selectedClip.type)}</span>
                <span>노트 {selectedClip.notes?.length ?? 0}개</span>
                {selectedClip.locked ? <span>잠김</span> : null}
              </div>
              {selectedClip.instructions ? (
                <div className="mt-3 rounded-md bg-meter-amber/10 p-2 text-xs leading-5 text-ink-body">
                  {selectedClip.instructions}
                </div>
              ) : null}
            </div>
            {selectedClip.type === "audio" ? (
              <div className="rounded-md border border-line bg-surface-raised/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-body">오디오</div>
                  <div className="text-[11px] font-semibold text-ink-body">
                    {selectedClip.audioAssetId ? "저장된 오디오" : selectedClip.audioUrl ? "이전 형식 오디오" : "소스 없음"}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-ink-body">
                    앞부분 자르기
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
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
                  <label className="text-xs font-bold text-ink-body">
                    뒷부분 자르기
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
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
                  <label className="text-xs font-bold text-ink-body">
                    음량 보정
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                      type="number"
                      min={0}
                      max={8}
                      step={0.01}
                      value={audioValue(selectedClip.gain, 1)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { gain: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-bold text-ink-body">
                    페이드 인
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
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
                  <label className="text-xs font-bold text-ink-body">
                    페이드 아웃
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
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
                  <label className="text-xs font-bold text-ink-body">
                    재생 속도
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                      type="number"
                      min={0.25}
                      max={4}
                      step={0.01}
                      value={audioValue(selectedClip.playbackRate, 1)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { playbackRate: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-bold text-ink-body">
                    음높이 (반음)
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                      type="number"
                      min={-24}
                      max={24}
                      step={1}
                      value={audioValue(selectedClip.pitchSemitones, 0)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { pitchSemitones: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-bold text-ink-body">
                    페이드 인 (박)
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                      type="number"
                      min={0}
                      step={snapBeats}
                      value={audioValue(selectedClip.fadeInBeats)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { fadeInBeats: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-bold text-ink-body">
                    페이드 아웃 (박)
                    <input
                      className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-sm text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                      type="number"
                      min={0}
                      step={snapBeats}
                      value={audioValue(selectedClip.fadeOutBeats)}
                      disabled={selectedClip.locked}
                      onChange={(event) => updateClipAudioSettings(selectedClip.id, { fadeOutBeats: Number(event.target.value) })}
                    />
                  </label>
                </div>
                {clipTakeIds(selectedClip).length > 0 ? (
                  <div className="mt-3 rounded-md border border-line bg-black/20 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-body">테이크</span>
                      <button className="studio-button h-7 px-2 text-[11px]" onClick={() => createCompedAudioClip(selectedClip.id)} disabled={selectedClip.locked}>
                        테이크 합성
                      </button>
                    </div>
                    <label className="block text-xs font-bold text-ink-body">
                      활성 테이크
                      <select
                        className="mt-1 h-8 w-full rounded border border-line bg-surface-base px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                        value={selectedClip.activeTakeId ?? selectedClip.audioAssetId ?? clipTakeIds(selectedClip)[0]}
                        disabled={selectedClip.locked}
                        onChange={(event) => setClipActiveTake(selectedClip.id, event.target.value)}
                      >
                        {clipTakeIds(selectedClip).map((takeId, index) => (
                          <option key={takeId} value={takeId}>
                            {uiText.common.take} {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-2 space-y-2">
                      {normalizeTakeSections(selectedClip).map((section, index, sections) => (
                        <div key={section.id} className="grid grid-cols-[1fr_64px_64px] gap-2">
                          <select
                            className="h-8 rounded border border-line bg-surface-base px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                            value={section.takeId}
                            disabled={selectedClip.locked}
                            onChange={(event) => setClipTakeSections(selectedClip.id, updateTakeSection(sections, section.id, { takeId: event.target.value }))}
                            aria-label={`테이크 구간 ${index + 1}`}
                          >
                            {clipTakeIds(selectedClip).map((takeId, takeIndex) => (
                              <option key={takeId} value={takeId}>
                                {uiText.common.take} {takeIndex + 1}
                              </option>
                            ))}
                          </select>
                          <input
                            className="h-8 rounded border border-line bg-surface-base px-2 text-xs text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                            type="number"
                            min={0}
                            step={snapBeats}
                            value={section.startBeat}
                            disabled={selectedClip.locked}
                            onChange={(event) => setClipTakeSections(selectedClip.id, updateTakeSection(sections, section.id, { startBeat: Number(event.target.value) }))}
                            aria-label={`구간 ${index + 1} 시작 위치`}
                          />
                          <input
                            className="h-8 rounded border border-line bg-surface-base px-2 text-xs text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
                            type="number"
                            min={0.25}
                            step={snapBeats}
                            value={section.lengthBeats}
                            disabled={selectedClip.locked}
                            onChange={(event) => setClipTakeSections(selectedClip.id, updateTakeSection(sections, section.id, { lengthBeats: Number(event.target.value) }))}
                            aria-label={`구간 ${index + 1} 길이`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
          <div className="mt-3 rounded-md border border-line bg-surface-raised/50 p-3 text-sm text-ink-body">
            {selectedTrack ? `${selectedTrack.name} 선택됨` : "선택된 항목 없음"}
          </div>
        )}
      </div>
    </section>
  );
}
