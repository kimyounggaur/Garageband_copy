import { Drum, Lightbulb, Music2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  continueMelody,
  explainProject,
  generateDrumSuggestions,
  suggestChordProgressions,
  type ChordSuggestion,
  type DrumSuggestion,
  type MelodySuggestion
} from "../../assist/creativeAssist";
import { useDawStore } from "../../store/useDawStore";
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
  const project = useDawStore((state) => state.project);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const addTrack = useDawStore((state) => state.addTrack);
  const addClip = useDawStore((state) => state.addClip);
  const addNotes = useDawStore((state) => state.addNotes);
  const selectClip = useDawStore((state) => state.selectClip);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const chordSuggestions = useMemo(() => suggestChordProgressions(project), [project]);
  const drumSuggestions = useMemo(() => generateDrumSuggestions(), []);
  const melodySuggestions = useMemo(() => continueMelody(project, selectedClipId), [project, selectedClipId]);
  const feedback = useMemo(() => explainProject(project, selectedClipId), [project, selectedClipId]);

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
  }

  function applyMelody(suggestion: MelodySuggestion) {
    if (suggestion.sourceClipId) {
      addNotes(suggestion.sourceClipId, suggestion.notes);
      selectClip(suggestion.sourceClipId);
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
        {tab === "chords" ? (
          <div className="space-y-2">
            {chordSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-100">{suggestion.title}</div>
                    <div className="mt-1 text-[11px] font-bold text-meter-cyan">{suggestion.mood}</div>
                  </div>
                  <button className="studio-icon-button h-7 w-7" title="Apply chord progression" onClick={() => applyChord(suggestion)}>
                    <Plus size={13} />
                  </button>
                </div>
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
                  <button className="studio-icon-button h-7 w-7" title="Apply drum pattern" onClick={() => applyDrum(suggestion)}>
                    <Plus size={13} />
                  </button>
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
                    <button className="studio-icon-button h-7 w-7" title="Apply melody continuation" onClick={() => applyMelody(suggestion)}>
                      <Plus size={13} />
                    </button>
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
