import { Drum, Lightbulb, Music2, Play, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ruleBasedAssistAdapter } from "../../assist/aiAdapter";
import { playAssistPreview, stopAssistPreview } from "../../assist/assistPreview";
import {
  type ChordSuggestion,
  type DrumSuggestion,
  type MelodySuggestion
} from "../../assist/creativeAssist";
import { useDawStore } from "../../store/useDawStore";
import type { MidiNote } from "../../types/project";
import { makeId } from "../../utils/id";

type AssistTab = "chords" | "drums" | "melody" | "why";

function firstTrackIdFor(project: ReturnType<typeof useDawStore.getState>["project"], role: "beat" | "harmony" | "melody") {
  if (role === "beat") {
    return project.tracks.find((track) => track.type === "drum" || track.role === "beat")?.id;
  }
  return project.tracks.find((track) => track.role === role || track.type === "instrument")?.id;
}

export function AssistPanel() {
  const [tab, setTab] = useState<AssistTab>("chords");
  const [lastApplied, setLastApplied] = useState<string>();
  const [previewingId, setPreviewingId] = useState<string>();
  const project = useDawStore((state) => state.project);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const addTrack = useDawStore((state) => state.addTrack);
  const addClip = useDawStore((state) => state.addClip);
  const addNotes = useDawStore((state) => state.addNotes);
  const selectClip = useDawStore((state) => state.selectClip);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const undo = useDawStore((state) => state.undo);
  const adapter = ruleBasedAssistAdapter;
  const chordSuggestions = useMemo(() => adapter.suggestChords(project) as ChordSuggestion[], [adapter, project]);
  const drumSuggestions = useMemo(() => adapter.suggestDrums(project) as DrumSuggestion[], [adapter, project]);
  const melodySuggestions = useMemo(
    () => adapter.continueMelody(project, selectedClipId) as MelodySuggestion[],
    [adapter, project, selectedClipId]
  );
  const feedback = useMemo(() => adapter.explain(project, selectedClipId), [adapter, project, selectedClipId]);

  useEffect(() => {
    return () => stopAssistPreview();
  }, []);

  async function preview(id: string, notes: Array<Omit<MidiNote, "id">>, drum = false) {
    setPreviewingId(id);
    try {
      await playAssistPreview({ bpm: project.bpm, notes, drum });
    } finally {
      window.setTimeout(() => setPreviewingId((current) => (current === id ? undefined : current)), 650);
    }
  }

  function markApplied(label: string) {
    setLastApplied(label);
    stopAssistPreview();
  }

  function undoLastApplied() {
    undo();
    setLastApplied(undefined);
  }

  function applyChord(suggestion: ChordSuggestion) {
    const trackId = firstTrackIdFor(project, "harmony") ?? addTrack("instrument", "Chords");
    const clipId = addClip(trackId, {
      type: "midi",
      name: suggestion.title,
      startBeat: Math.max(0, currentBeat),
      lengthBeats: 16,
      color: "#a78bfa",
      notes: suggestion.notes.map((note) => ({ ...note, id: makeId("note") }))
    });
    selectTrack(trackId);
    selectClip(clipId);
    markApplied(suggestion.title);
  }

  function applyDrum(suggestion: DrumSuggestion) {
    const trackId = firstTrackIdFor(project, "beat") ?? addTrack("drum", "Drums");
    const clipId = addClip(trackId, {
      type: "midi",
      name: `${suggestion.title} Beat`,
      startBeat: Math.max(0, currentBeat),
      lengthBeats: 16,
      color: "#38bdf8",
      notes: suggestion.notes.map((note) => ({ ...note, id: makeId("note") }))
    });
    selectTrack(trackId);
    selectClip(clipId);
    markApplied(`${suggestion.title} Beat`);
  }

  function applyMelody(suggestion: MelodySuggestion) {
    if (suggestion.sourceClipId) {
      addNotes(suggestion.sourceClipId, suggestion.notes);
      selectClip(suggestion.sourceClipId);
      markApplied(suggestion.title);
      return;
    }
    const trackId = firstTrackIdFor(project, "melody") ?? addTrack("instrument", "Melody");
    const clipId = addClip(trackId, {
      type: "midi",
      name: suggestion.title,
      startBeat: Math.max(0, currentBeat),
      lengthBeats: 16,
      color: "#a78bfa",
      notes: suggestion.notes.map((note) => ({ ...note, id: makeId("note") }))
    });
    selectTrack(trackId);
    selectClip(clipId);
    markApplied(suggestion.title);
  }

  const tabs: Array<{ id: AssistTab; label: string }> = [
    { id: "chords", label: "Chords" },
    { id: "drums", label: "Drums" },
    { id: "melody", label: "Melody" },
    { id: "why", label: "Why" }
  ];

  return (
    <div className="rounded-md border border-white/10 bg-black/20">
      <div className="flex items-center justify-between border-b border-white/10 p-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          <Sparkles size={14} />
          Assist
        </div>
        <span className="rounded border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-bold text-slate-500">
          {adapter.label}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 border-b border-white/10 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={`h-7 rounded text-[11px] font-black transition ${
              tab === item.id ? "bg-meter-cyan text-studio-950" : "text-slate-400 hover:bg-white/[0.08]"
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {lastApplied ? (
          <div className="mb-2 rounded-md border border-meter-green/30 bg-meter-green/10 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-100/75">Applied</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-xs font-black text-green-100">{lastApplied}</div>
              <button className="studio-icon-button h-7 w-7" title="Undo assist apply" onClick={undoLastApplied}>
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        ) : null}

        {tab === "chords" ? (
          <div className="space-y-2">
            {chordSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-100">{suggestion.title}</div>
                    <div className="mt-1 text-[11px] font-bold text-meter-cyan">{suggestion.mood}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="studio-icon-button h-7 w-7"
                      title="Preview chord progression"
                      onClick={() => void preview(`chord:${suggestion.id}`, suggestion.notes)}
                    >
                      <Play size={13} className={previewingId === `chord:${suggestion.id}` ? "text-meter-cyan" : undefined} />
                    </button>
                    <button className="studio-icon-button h-7 w-7" title="Apply chord progression" onClick={() => applyChord(suggestion)}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">설명</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{suggestion.reason}</div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "drums" ? (
          <div className="space-y-2">
            {drumSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Drum size={15} className="mt-0.5 shrink-0 text-meter-cyan" />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-100">{suggestion.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{suggestion.description}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="studio-icon-button h-7 w-7"
                      title="Preview drum pattern"
                      onClick={() => void preview(`drum:${suggestion.id}`, suggestion.notes, true)}
                    >
                      <Play size={13} className={previewingId === `drum:${suggestion.id}` ? "text-meter-cyan" : undefined} />
                    </button>
                    <button className="studio-icon-button h-7 w-7" title="Apply drum pattern" onClick={() => applyDrum(suggestion)}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "melody" ? (
          <div className="space-y-2">
            {melodySuggestions.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-500">
                MIDI clip을 하나 만들면 이어쓰기 후보가 나옵니다.
              </div>
            ) : (
              melodySuggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Music2 size={15} className="mt-0.5 shrink-0 text-meter-amber" />
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-100">{suggestion.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">{suggestion.explanation}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="studio-icon-button h-7 w-7"
                        title="Preview melody continuation"
                        onClick={() => void preview(`melody:${suggestion.id}`, suggestion.notes)}
                      >
                        <Play size={13} className={previewingId === `melody:${suggestion.id}` ? "text-meter-cyan" : undefined} />
                      </button>
                      <button className="studio-icon-button h-7 w-7" title="Apply melody continuation" onClick={() => applyMelody(suggestion)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "why" ? (
          <div className="space-y-2">
            {Object.entries(feedback).map(([key, value]) => (
              <div key={key} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-meter-amber" />
                  <div className="text-xs leading-5 text-slate-300">{value}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
