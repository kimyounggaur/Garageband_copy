import type { PointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useDawStore } from "../../store/useDawStore";
import type { Clip, MidiNote } from "../../types/project";
import { clamp, snapBeat } from "../../utils/timeline";

type PianoRollProps = {
  clip: Clip;
};

const MAX_PITCH = 84;
const MIN_PITCH = 48;
const ROW_HEIGHT = 18;
const NOTE_BEAT_WIDTH = 52;

function pitchName(pitch: number) {
  const names = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function PianoRoll({ clip }: PianoRollProps) {
  const addNote = useDawStore((state) => state.addNote);
  const moveNote = useDawStore((state) => state.moveNote);
  const resizeNote = useDawStore((state) => state.resizeNote);
  const removeNote = useDawStore((state) => state.removeNote);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const pitches = useMemo(() => {
    return Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, index) => MAX_PITCH - index);
  }, []);
  const height = pitches.length * ROW_HEIGHT;
  const width = `max(100%, ${Math.max(clip.lengthBeats * NOTE_BEAT_WIDTH, 640)}px)`;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteId) {
        removeNote(clip.id, selectedNoteId);
        setSelectedNoteId(undefined);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clip.id, removeNote, selectedNoteId]);

  function handleGridClick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pitch = clamp(MAX_PITCH - Math.floor(y / ROW_HEIGHT), MIN_PITCH, MAX_PITCH);
    const startBeat = clamp(snapBeat(x / NOTE_BEAT_WIDTH, snapBeats), 0, Math.max(0, clip.lengthBeats - 0.25));
    const id = addNote(clip.id, {
      pitch,
      startBeat,
      durationBeats: Math.min(1, clip.lengthBeats - startBeat),
      velocity: 0.8
    });
    setSelectedNoteId(id);
  }

  function beginMove(note: MidiNote, event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setSelectedNoteId(note.id);
    beginHistorySnapshot();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalBeat = note.startBeat;
    const originalPitch = note.pitch;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const deltaBeat = (moveEvent.clientX - startX) / NOTE_BEAT_WIDTH;
      const deltaPitch = Math.round((moveEvent.clientY - startY) / ROW_HEIGHT);
      moveNote(
        clip.id,
        note.id,
        clamp(snapBeat(originalBeat + deltaBeat, snapBeats), 0, Math.max(0, clip.lengthBeats - note.durationBeats)),
        clamp(originalPitch - deltaPitch, MIN_PITCH, MAX_PITCH),
        { recordHistory: false }
      );
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      commitHistorySnapshot();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function beginResize(note: MidiNote, event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setSelectedNoteId(note.id);
    beginHistorySnapshot();
    const startX = event.clientX;
    const originalDuration = note.durationBeats;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const deltaBeat = (moveEvent.clientX - startX) / NOTE_BEAT_WIDTH;
      resizeNote(
        clip.id,
        note.id,
        clamp(snapBeat(originalDuration + deltaBeat, snapBeats), 0.25, Math.max(0.25, clip.lengthBeats - note.startBeat)),
        { recordHistory: false }
      );
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      commitHistorySnapshot();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  return (
    <div className="grid min-h-0 grid-cols-[78px_minmax(0,1fr)] overflow-hidden">
      <div className="min-h-0 overflow-hidden border-r border-white/10 bg-black/20">
        <div style={{ height }}>
          {pitches.map((pitch) => (
            <div
              key={pitch}
              className={`flex items-center border-b border-white/[0.06] px-2 text-[10px] font-bold ${
                pitch % 12 === 0 ? "bg-white/[0.055] text-slate-300" : "text-slate-600"
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              {pitch % 12 === 0 ? pitchName(pitch) : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 overflow-auto bg-studio-950">
        <div
          className="relative"
          style={{
            width,
            height,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.13) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: `${NOTE_BEAT_WIDTH}px 100%, ${NOTE_BEAT_WIDTH / 4}px 100%, 100% ${ROW_HEIGHT}px`
          }}
          onPointerDown={handleGridClick}
        >
          {(clip.notes ?? []).map((note) => {
            const selected = selectedNoteId === note.id;
            return (
              <div
                key={note.id}
                className={`absolute rounded border text-[10px] font-black leading-4 shadow-lg ${
                  selected ? "border-white bg-meter-cyan text-studio-950" : "border-black/40 bg-meter-amber text-studio-950"
                }`}
                style={{
                  left: note.startBeat * NOTE_BEAT_WIDTH,
                  top: (MAX_PITCH - note.pitch) * ROW_HEIGHT + 2,
                  width: Math.max(14, note.durationBeats * NOTE_BEAT_WIDTH),
                  height: ROW_HEIGHT - 4
                }}
                onPointerDown={(event) => beginMove(note, event)}
              >
                <span className="pointer-events-none px-1">{pitchName(note.pitch)}</span>
                <button
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/20 hover:bg-black/35"
                  title="노트 길이 조절"
                  aria-label="노트 길이 조절"
                  onPointerDown={(event) => beginResize(note, event)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
