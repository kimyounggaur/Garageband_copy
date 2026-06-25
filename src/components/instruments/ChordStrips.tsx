import { useMemo, useState } from "react";
import { buildChordNotes, buildDiatonicChordStrips, type ChordStrip, type TouchNote } from "../../utils/touchInstruments";
import { Play, Plus } from "../icons";
import type { TouchInstrumentContext } from "./TouchInstruments";

type ChordMode = "strum" | "pulse" | "arp";

function chordPattern(chord: ChordStrip, mode: ChordMode, duration: number, strum: number, velocity: number): TouchNote[] {
  if (mode === "pulse") {
    return [0, 0.5, 1, 1.5].flatMap((startBeat) =>
      buildChordNotes(chord, { startBeat, durationBeats: 0.38, strumBeats: 0, velocity })
    );
  }
  if (mode === "arp") {
    return Array.from({ length: 8 }, (_, index) => ({
      pitch: chord.notes[index % chord.notes.length],
      startBeat: index * 0.25,
      durationBeats: 0.25,
      velocity
    }));
  }
  return buildChordNotes(chord, { startBeat: 0, durationBeats: duration, strumBeats: strum, velocity });
}

export function ChordStrips({ context }: { context: TouchInstrumentContext }) {
  const [mode, setMode] = useState<ChordMode>("strum");
  const [duration, setDuration] = useState(1.5);
  const [strum, setStrum] = useState(0.05);
  const [velocity, setVelocity] = useState(0.76);
  const [writeArmed, setWriteArmed] = useState(true);
  const chords = useMemo(() => buildDiatonicChordStrips(context.projectKey), [context.projectKey]);

  function playChord(chord: ChordStrip, write = writeArmed || context.isRecording) {
    const notes = chordPattern(chord, mode, duration, strum, velocity);
    context.previewMelodicNotes(notes);
    if (write) context.writeMelodicNotes(notes, { preserveTiming: true });
  }

  return (
    <div className="grid min-h-full gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="panel-title">Chord Strips</span>
          <span className="text-xs font-black text-slate-300">{context.projectKey}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {chords.map((chord) => (
            <button
              key={chord.id}
              className="flex h-32 min-w-0 flex-col justify-between rounded-md border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.035] p-2 text-left transition hover:border-accent-sel hover:bg-accent-sel/10 active:translate-y-0.5"
              onPointerDown={() => playChord(chord)}
              title={chord.name}
              aria-label={chord.name}
            >
              <span className="text-lg font-black text-slate-100">{chord.roman}</span>
              <span className="truncate text-xs font-bold text-slate-400">{chord.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-graphite-500">
                {chord.notes.join(" ")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
        <div className="grid grid-cols-3 gap-1">
          {(["strum", "pulse", "arp"] as const).map((item) => (
            <button
              key={item}
              className={`studio-button h-8 px-2 text-[11px] ${mode === item ? "border-accent-sel bg-accent-sel/15 text-accent-sel" : ""}`}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="block text-xs font-bold text-slate-400">
          Velocity
          <input
            className="mt-2 w-full"
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={velocity}
            onChange={(event) => setVelocity(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-bold text-slate-400">
          Strum
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={0.12}
            step={0.01}
            value={strum}
            onChange={(event) => setStrum(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-bold text-slate-400">
          Length
          <input
            className="mt-2 w-full"
            type="range"
            min={0.5}
            max={4}
            step={0.25}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className="studio-button" onClick={() => playChord(chords[0], false)}>
            <Play size={14} />
            Play I
          </button>
          <button className="studio-button" onClick={() => playChord(chords[0], true)}>
            <Plus size={14} />
            Write I
          </button>
        </div>
        <button
          className={`studio-button w-full ${writeArmed ? "border-meter-rose bg-meter-rose/15 text-white" : ""}`}
          onClick={() => setWriteArmed((value) => !value)}
        >
          {writeArmed || context.isRecording ? "Write On" : "Write Off"}
        </button>
      </div>
    </div>
  );
}
