import { useEffect, useMemo, useState } from "react";
import { buildKeyboardNote, keyboardKeyToMidi } from "../../utils/touchInstruments";
import type { TouchInstrumentContext } from "./TouchInstruments";

const WHITE_KEYS = [
  { key: "a", name: "C" },
  { key: "s", name: "D" },
  { key: "d", name: "E" },
  { key: "f", name: "F" },
  { key: "g", name: "G" },
  { key: "h", name: "A" },
  { key: "j", name: "B" },
  { key: "k", name: "C" },
  { key: "l", name: "D" }
];

const BLACK_KEYS = [
  { key: "w", name: "C#" },
  { key: "e", name: "D#" },
  { key: "t", name: "F#" },
  { key: "y", name: "G#" },
  { key: "u", name: "A#" },
  { key: "o", name: "C#" }
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function pitchName(pitch?: number) {
  if (pitch === undefined) return "--";
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function KeyboardInstrument({ context }: { context: TouchInstrumentContext }) {
  const [octave, setOctave] = useState(4);
  const [duration, setDuration] = useState(0.5);
  const [velocity, setVelocity] = useState(0.82);
  const [writeArmed, setWriteArmed] = useState(true);
  const [lastPitch, setLastPitch] = useState<number | undefined>();

  const whiteKeys = useMemo(
    () => WHITE_KEYS.map((key) => ({ ...key, pitch: keyboardKeyToMidi(key.key, octave) })),
    [octave]
  );
  const blackKeys = useMemo(
    () => BLACK_KEYS.map((key) => ({ ...key, pitch: keyboardKeyToMidi(key.key, octave) })),
    [octave]
  );

  function triggerKey(key: string) {
    const pitch = keyboardKeyToMidi(key, octave);
    if (pitch === undefined) return;
    const note = buildKeyboardNote({
      pitch,
      startBeat: 0,
      snapBeats: context.snapBeats,
      durationBeats: duration,
      velocity
    });
    setLastPitch(pitch);
    context.previewMelodicNotes([note]);
    if (writeArmed || context.isRecording) context.writeMelodicNotes([note]);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (keyboardKeyToMidi(key, octave) === undefined) return;
      event.preventDefault();
      triggerKey(key);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="grid min-h-full gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="panel-title">Keyboard</span>
          <span className="text-xs font-black text-slate-300">{pitchName(lastPitch)}</span>
        </div>

        <div className="mb-2 grid grid-cols-6 gap-1 pl-[5.5%] pr-[16%]">
          {blackKeys.map((key) => (
            <button
              key={key.key}
              className="h-14 rounded-b-md border border-white/10 bg-graphite-950 text-[11px] font-black text-slate-300 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] transition hover:border-accent-sel hover:text-white active:translate-y-0.5"
              onPointerDown={() => triggerKey(key.key)}
              title={`${key.key.toUpperCase()} ${pitchName(key.pitch)}`}
              aria-label={`${key.key.toUpperCase()} ${pitchName(key.pitch)}`}
            >
              <span className="block">{key.name}</span>
              <span className="text-[10px] uppercase text-graphite-500">{key.key}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-9 gap-1">
          {whiteKeys.map((key) => (
            <button
              key={key.key}
              className="flex h-28 min-w-0 flex-col items-center justify-end rounded-md border border-white/10 bg-slate-100 px-1 pb-2 text-graphite-900 shadow-[inset_0_-6px_0_rgba(15,18,23,0.12)] transition hover:border-accent-sel hover:bg-white active:translate-y-0.5"
              onPointerDown={() => triggerKey(key.key)}
              title={`${key.key.toUpperCase()} ${pitchName(key.pitch)}`}
              aria-label={`${key.key.toUpperCase()} ${pitchName(key.pitch)}`}
            >
              <span className="text-sm font-black">{key.name}</span>
              <span className="text-[10px] font-black uppercase text-graphite-500">{key.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
        <div className="grid grid-cols-3 gap-1">
          {[3, 4, 5].map((item) => (
            <button
              key={item}
              className={`studio-button h-8 px-2 ${octave === item ? "border-accent-sel bg-accent-sel/15 text-accent-sel" : ""}`}
              onClick={() => setOctave(item)}
            >
              O{item}
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
          Length
          <input
            className="mt-2 w-full"
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
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
