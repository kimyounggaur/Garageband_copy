import * as Tone from "tone";
import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOOP_CATEGORIES,
  LOOP_GENRE_LABELS,
  LOOP_MOOD_LABELS,
  filterLoops,
  loopGenres,
  loopMatchSummary,
  loopMoods,
  resolveLoopPattern
} from "../../data/loops";
import type { LoopCategory, LoopDefinition } from "../../types/project";
import { useDawStore } from "../../store/useDawStore";
import { loopCategoryLabel } from "../../utils/labels";
import { uiText } from "../../utils/uiText";
import { Music2, Play, Plus, Square } from "../icons";

type CategoryFilter = LoopCategory | "All";

const CATEGORY_FILTERS: CategoryFilter[] = ["All", ...LOOP_CATEGORIES];
function loopTypeDot(loop: LoopDefinition) {
  return loop.type === "audio" ? "bg-region-audio" : loop.category === "Drums" ? "bg-region-drummer" : "bg-region-midi";
}

export function LoopBrowser() {
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [query, setQuery] = useState("");
  const [previewingId, setPreviewingId] = useState<string | undefined>();
  const previewNodesRef = useRef<Tone.ToneAudioNode[]>([]);
  const previewTimeoutsRef = useRef<number[]>([]);
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const addLoopClip = useDawStore((state) => state.addLoopClip);
  const loops = useMemo(() => {
    const matches = filterLoops({ category, genre, mood });
    const search = query.trim().toLowerCase();
    return search
      ? matches.filter((loop) => [
          loop.name, loop.description, loop.category, loopCategoryLabel(loop.category),
          loop.genre, LOOP_GENRE_LABELS[loop.genre], ...(loop.mood ?? []).flatMap((item) => [item, LOOP_MOOD_LABELS[item]])
        ].filter(Boolean).join(" ").toLowerCase().includes(search))
      : matches;
  }, [category, genre, mood, query]);
  const genres = useMemo(loopGenres, []);
  const moods = useMemo(loopMoods, []);

  useEffect(() => () => stopPreview(false), []);

  function stopPreview(resetState = true) {
    previewTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    previewTimeoutsRef.current = [];
    previewNodesRef.current.forEach((node) => node.dispose());
    previewNodesRef.current = [];
    if (resetState) setPreviewingId(undefined);
  }

  async function previewLoop(loop: LoopDefinition) {
    if (previewingId === loop.id) {
      stopPreview();
      return;
    }

    stopPreview();
    await Tone.start();
    setPreviewingId(loop.id);
    const secondsPerBeat = 60 / Math.max(1, project.bpm);
    const melody = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: loop.category === "Bass" ? "square" : "triangle" },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.48, release: 0.28 }
    }).toDestination();
    const kick = new Tone.MembraneSynth().toDestination();
    const snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 } }).toDestination();
    const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.04, release: 0.02 } }).toDestination();
    previewNodesRef.current = [melody, kick, snare, hat];

    resolveLoopPattern(loop, project.key).forEach((step) => {
        const timeoutId = window.setTimeout(() => {
          const velocity = step.velocity ?? 0.7;
          const time = Tone.now();
          if (step.note) {
            melody.triggerAttackRelease(
              step.note,
              (step.durationBeats ?? 0.25) * secondsPerBeat,
              time,
              velocity
            );
          }
          if (step.drum === "kick") kick.triggerAttackRelease("C1", "8n", time, velocity);
          if (step.drum === "snare" || step.drum === "clap") snare.triggerAttackRelease("16n", time, velocity);
          if (step.drum === "hat" || step.drum === "tom") hat.triggerAttackRelease("32n", time, velocity * 0.55);
        }, step.beat * secondsPerBeat * 1000);
        previewTimeoutsRef.current.push(timeoutId);
    });

    const stopId = window.setTimeout(stopPreview, loop.lengthBeats * secondsPerBeat * 1000 + 120);
    previewTimeoutsRef.current.push(stopId);
  }

  function addLoop(loop: LoopDefinition) {
    addLoopClip(loop.id, selectedTrackId, useDawStore.getState().currentBeat);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, loop: LoopDefinition) {
    event.dataTransfer.setData("application/webband-loop", loop.id);
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <aside className="panel flex h-full min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="panel-title">루프 브라우저</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">루프 {loops.length}개</span>
      </div>

      <div className="space-y-2 border-b border-line p-2">
        <input
          className="h-8 w-full rounded-md border border-line bg-surface-base px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="루프 검색"
          aria-label="루프 검색"
        />
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map((item) => (
            <button
              key={item}
              className={`h-7 rounded-md px-2 text-[11px] font-black transition ${
                category === item ? "bg-state-selected text-ink-selected" : "bg-white/[0.06] text-ink-body hover:bg-white/[0.1]"
              }`}
              onClick={() => setCategory(item)}
            >
              {item === "All" ? "전체" : loopCategoryLabel(item)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="h-8 rounded-md border border-line bg-surface-base px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            aria-label="장르 필터"
          >
            <option value="">모든 장르</option>
            {genres.map((item) => (
              <option key={item} value={item}>
                {LOOP_GENRE_LABELS[item] ?? item}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-line bg-surface-base px-2 text-xs font-bold text-ink-high outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            aria-label="분위기 필터"
          >
            <option value="">모든 분위기</option>
            {moods.map((item) => (
              <option key={item} value={item}>
                {LOOP_MOOD_LABELS[item] ?? item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {loops.map((loop) => {
            const match = loopMatchSummary(loop, project);
            return (
              <article
                key={loop.id}
                className="rounded-md border border-line bg-graphite-800/70 p-2 transition hover:border-graphite-600 hover:bg-graphite-750"
                draggable
                onDragStart={(event) => handleDragStart(event, loop)}
              >
                <div className="flex items-start gap-2">
                  <button
                    className={`studio-icon-button h-8 w-8 ${previewingId === loop.id ? "border-accent-play bg-accent-play/15 text-accent-play" : ""}`}
                    onClick={() => previewLoop(loop)}
                    title={previewingId === loop.id ? "미리 듣기 정지" : `${loop.name} ${uiText.common.preview}`}
                    aria-label={previewingId === loop.id ? "미리 듣기 정지" : `${loop.name} ${uiText.common.preview}`}
                  >
                    {previewingId === loop.id ? <Square size={13} /> : <Play size={13} fill="currentColor" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${loopTypeDot(loop)}`} />
                      <span className="truncate text-sm font-black text-ink-high">{loop.name}</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-graphite-500">{loop.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-[0.08em]">
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-body">{loop.bpm} BPM</span>
                      {loop.key ? <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-body">{loop.key}</span> : null}
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-body">{loop.timeSignature.join("/")}</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-body">{loop.lengthBeats}박</span>
                      {match.needsTempoMatch ? <span className="rounded bg-accent-cycle/15 px-1.5 py-0.5 text-accent-cycle">{match.tempoLabel}</span> : null}
                      {match.needsKeyMatch ? <span className="rounded bg-accent-sel/15 px-1.5 py-0.5 text-ink-accent">{match.keyLabel}</span> : null}
                      {match.needsMeterMatch ? <span className="rounded bg-meter-rose/15 px-1.5 py-0.5 text-rose-200">{match.meterLabel}</span> : null}
                    </div>
                  </div>
                  <button className="studio-icon-button h-8 w-8" onClick={() => addLoop(loop)} title={`${loop.name} 추가`} aria-label={`${loop.name} 추가`}>
                    <Plus size={14} />
                  </button>
                </div>
              </article>
            );
          })}
          {loops.length === 0 ? (
            <div className="rounded-md border border-dashed border-line p-5 text-center text-xs font-bold text-graphite-500">
              현재 필터에 맞는 루프가 없습니다. 검색어나 필터를 바꿔 주세요.
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line px-3 py-2 text-[11px] text-graphite-500">
        <Music2 size={12} className="mr-1 inline" />
        루프를 트랙에 끌어 놓거나 +를 눌러 현재 재생 위치에 추가하세요.
      </div>
    </aside>
  );
}
