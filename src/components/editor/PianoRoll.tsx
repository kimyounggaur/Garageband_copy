import * as Tone from "tone";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInstrumentSynth } from "../../audio/instrumentSynth";
import { useDawStore } from "../../store/useDawStore";
import type { Clip, MidiNote, ProjectScale } from "../../types/project";
import {
  cloneNotesForPaste,
  isPitchInScale,
  normalizePianoRollScale,
  quantizeMidiNotes,
  scalePitchClasses
} from "../../utils/pianoRoll";
import { clamp, snapBeat } from "../../utils/timeline";
import { Copy, Eraser, MousePointer2, Pencil, Play, Trash2, Wand2 } from "../icons";

type PianoRollProps = {
  clip: Clip;
};

type PianoRollTool = "pointer" | "pencil" | "eraser";
type SelectionBox = { left: number; top: number; width: number; height: number };

const MAX_PITCH = 96;
const MIN_PITCH = 36;
const ROW_HEIGHT = 18;
const NOTE_BEAT_WIDTH = 54;
const MIN_EDITABLE_BEATS = 32;
const KEYBOARD_WIDTH = 88;

const QUANTIZE_OPTIONS = [
  { label: "1/4", beats: 1 },
  { label: "1/8", beats: 0.5 },
  { label: "1/16", beats: 0.25 },
  { label: "1/8T", beats: 1 / 3 },
  { label: "1/16T", beats: 1 / 6 }
];

function pitchName(pitch: number) {
  const names = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

function midiToNoteName(pitch: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isBlackKey(pitch: number) {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

function getPointInElement(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function rectsIntersect(a: SelectionBox, b: SelectionBox) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

export function PianoRoll({ clip }: PianoRollProps) {
  const project = useDawStore((state) => state.project);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const addNote = useDawStore((state) => state.addNote);
  const addNotes = useDawStore((state) => state.addNotes);
  const updateNote = useDawStore((state) => state.updateNote);
  const updateNotes = useDawStore((state) => state.updateNotes);
  const removeNotes = useDawStore((state) => state.removeNotes);
  const setProjectScale = useDawStore((state) => state.setProjectScale);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const [tool, setTool] = useState<PianoRollTool>("pointer");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [clipboardNotes, setClipboardNotes] = useState<MidiNote[]>([]);
  const [gridBeats, setGridBeats] = useState(0.25);
  const [quantizeStrength, setQuantizeStrength] = useState(1);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | undefined>();
  const synthRef = useRef<ReturnType<typeof createInstrumentSynth> | null>(null);

  const track = project.tracks.find((item) => item.id === clip.trackId);
  const scale = normalizePianoRollScale(project.scale, project.key);
  const scaleLocked = scale !== "chromatic";
  const scaleClasses = useMemo(() => scalePitchClasses(project.key, scale), [project.key, scale]);
  const notes = clip.notes ?? [];
  const pitches = useMemo(() => {
    return Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, index) => MAX_PITCH - index);
  }, []);
  const height = pitches.length * ROW_HEIGHT;
  const editableBeats = Math.max(clip.lengthBeats, MIN_EDITABLE_BEATS);
  const gridWidth = editableBeats * NOTE_BEAT_WIDTH;
  const pasteBeat =
    currentBeat > clip.startBeat
      ? clamp(snapBeat(currentBeat - clip.startBeat, gridBeats), 0, Math.max(0, editableBeats - 0.25))
      : clamp(snapBeat((notes[0]?.startBeat ?? 0) + 1, gridBeats), 0, Math.max(0, editableBeats - 0.25));

  const selectedNotes = useMemo(() => {
    const selectedSet = new Set(selectedNoteIds);
    return notes.filter((note) => selectedSet.has(note.id));
  }, [notes, selectedNoteIds]);

  useEffect(() => {
    const validIds = new Set(notes.map((note) => note.id));
    setSelectedNoteIds((ids) => ids.filter((id) => validIds.has(id)));
  }, [notes]);

  useEffect(() => {
    return () => {
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, [track?.instrumentId]);

  const previewPitch = useCallback(
    (pitch: number, velocity = 0.72) => {
      void Tone.start().then(() => {
        synthRef.current ??= createInstrumentSynth(track?.instrumentId).toDestination();
        synthRef.current.triggerAttackRelease(midiToNoteName(pitch), "8n", Tone.now(), velocity);
      });
    },
    [track?.instrumentId]
  );

  function noteRect(note: MidiNote): SelectionBox {
    return {
      left: note.startBeat * NOTE_BEAT_WIDTH,
      top: (MAX_PITCH - note.pitch) * ROW_HEIGHT + 2,
      width: Math.max(14, note.durationBeats * NOTE_BEAT_WIDTH),
      height: ROW_HEIGHT - 4
    };
  }

  function pitchIsEnabled(pitch: number) {
    return !scaleLocked || isPitchInScale(pitch, project.key, scale);
  }

  function nearestScalePitch(pitch: number) {
    if (pitchIsEnabled(pitch)) return pitch;
    for (let distance = 1; distance <= 12; distance += 1) {
      const up = clamp(pitch + distance, MIN_PITCH, MAX_PITCH);
      if (pitchIsEnabled(up)) return up;
      const down = clamp(pitch - distance, MIN_PITCH, MAX_PITCH);
      if (pitchIsEnabled(down)) return down;
    }
    return pitch;
  }

  function gridPointToNote(point: { x: number; y: number }) {
    const rawPitch = clamp(MAX_PITCH - Math.floor(point.y / ROW_HEIGHT), MIN_PITCH, MAX_PITCH);
    const pitch = scaleLocked ? nearestScalePitch(rawPitch) : rawPitch;
    const startBeat = clamp(snapBeat(point.x / NOTE_BEAT_WIDTH, gridBeats), 0, Math.max(0, editableBeats - 0.25));
    return { pitch, startBeat };
  }

  function addNoteAtPoint(point: { x: number; y: number }) {
    const { pitch, startBeat } = gridPointToNote(point);
    if (!pitchIsEnabled(pitch)) return;
    const id = addNote(clip.id, {
      pitch,
      startBeat,
      durationBeats: Math.min(gridBeats === 1 / 6 ? 1 / 3 : Math.max(0.25, gridBeats), editableBeats - startBeat),
      velocity: 0.8
    });
    setSelectedNoteIds([id]);
    previewPitch(pitch);
  }

  function handleGridPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-note-id]")) return;
    const grid = event.currentTarget;
    const start = getPointInElement(event, grid);

    if (tool === "pencil") {
      addNoteAtPoint(start);
      return;
    }
    if (tool === "eraser") return;

    const origin = { x: start.x, y: start.y };
    beginHistorySnapshot();

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const rect = grid.getBoundingClientRect();
      const current = {
        x: moveEvent.clientX - rect.left,
        y: moveEvent.clientY - rect.top
      };
      const box = {
        left: Math.min(origin.x, current.x),
        top: Math.min(origin.y, current.y),
        width: Math.abs(current.x - origin.x),
        height: Math.abs(current.y - origin.y)
      };
      setSelectionBox(box);
      const nextIds = notes.filter((note) => rectsIntersect(box, noteRect(note))).map((note) => note.id);
      setSelectedNoteIds(nextIds);
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      setSelectionBox(undefined);
      commitHistorySnapshot();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function beginMove(note: MidiNote, event: PointerEvent<HTMLDivElement>) {
    if (tool === "eraser") {
      removeNotes(clip.id, [note.id]);
      setSelectedNoteIds((ids) => ids.filter((id) => id !== note.id));
      return;
    }
    if (tool === "pencil") return;

    event.stopPropagation();
    const nextSelection = event.shiftKey
      ? selectedNoteIds.includes(note.id)
        ? selectedNoteIds.filter((id) => id !== note.id)
        : [...selectedNoteIds, note.id]
      : selectedNoteIds.includes(note.id)
        ? selectedNoteIds
        : [note.id];
    setSelectedNoteIds(nextSelection);
    const movingNotes = notes.filter((item) => nextSelection.includes(item.id));
    beginHistorySnapshot();
    const startX = event.clientX;
    const startY = event.clientY;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const deltaBeat = snapBeat((moveEvent.clientX - startX) / NOTE_BEAT_WIDTH, gridBeats);
      const deltaPitch = Math.round((moveEvent.clientY - startY) / ROW_HEIGHT);
      updateNotes(
        clip.id,
        movingNotes.map((item) => {
          const nextPitch = nearestScalePitch(clamp(item.pitch - deltaPitch, MIN_PITCH, MAX_PITCH));
          return {
            id: item.id,
            startBeat: clamp(item.startBeat + deltaBeat, 0, Math.max(0, editableBeats - item.durationBeats)),
            pitch: nextPitch
          };
        }),
        { recordHistory: false, snap: false }
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
    const resizeIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
    const resizingNotes = notes.filter((item) => resizeIds.includes(item.id));
    setSelectedNoteIds(resizeIds);
    beginHistorySnapshot();
    const startX = event.clientX;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const deltaBeat = (moveEvent.clientX - startX) / NOTE_BEAT_WIDTH;
      updateNotes(
        clip.id,
        resizingNotes.map((item) => ({
          id: item.id,
          durationBeats: clamp(
            snapBeat(item.durationBeats + deltaBeat, gridBeats),
            0.0625,
            Math.max(0.0625, editableBeats - item.startBeat)
          )
        })),
        { recordHistory: false, snap: false }
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

  function beginVelocityEdit(note: MidiNote, event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const targetIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
    setSelectedNoteIds(targetIds);
    beginHistorySnapshot();

    function velocityFromY(clientY: number) {
      return clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    }

    function apply(clientY: number, recordHistory = false) {
      updateNotes(
        clip.id,
        targetIds.map((id) => ({ id, velocity: velocityFromY(clientY) })),
        { recordHistory, snap: false }
      );
    }

    apply(event.clientY, false);

    function handleMove(moveEvent: globalThis.PointerEvent) {
      apply(moveEvent.clientY, false);
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

  function applyQuantize() {
    const ids = selectedNoteIds.length ? selectedNoteIds : notes.map((note) => note.id);
    const quantized = quantizeMidiNotes(notes, ids, { gridBeats, strength: quantizeStrength });
    updateNotes(
      clip.id,
      quantized
        .filter((note) => ids.includes(note.id))
        .map((note) => ({
          id: note.id,
          startBeat: note.startBeat,
          durationBeats: note.durationBeats
        })),
      { snap: false }
    );
  }

  function copySelection() {
    if (selectedNotes.length === 0) return;
    setClipboardNotes(selectedNotes);
  }

  function pasteClipboard() {
    if (clipboardNotes.length === 0) return;
    const pasted = cloneNotesForPaste(clipboardNotes, { startBeat: pasteBeat });
    addNotes(clip.id, pasted, { snap: false });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (command && key === "a") {
        event.preventDefault();
        setSelectedNoteIds(notes.map((note) => note.id));
        return;
      }
      if (command && key === "c") {
        event.preventDefault();
        copySelection();
        return;
      }
      if (command && key === "v") {
        event.preventDefault();
        pasteClipboard();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteIds.length > 0) {
        event.preventDefault();
        removeNotes(clip.id, selectedNoteIds);
        setSelectedNoteIds([]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clipboardNotes, clip.id, notes, pasteBeat, selectedNoteIds]);

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_88px] overflow-hidden bg-studio-950">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "pointer" as const, label: "Move", icon: MousePointer2 },
            { id: "pencil" as const, label: "Draw", icon: Pencil },
            { id: "eraser" as const, label: "Erase", icon: Eraser }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`studio-button h-8 px-2 ${tool === item.id ? "border-accent-sel bg-accent-sel/15 text-accent-sel" : ""}`}
                onClick={() => setTool(item.id)}
                title={item.label}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border border-graphite-700 bg-graphite-950 px-2 text-xs font-bold text-slate-100 outline-none focus:border-accent-sel"
            value={gridBeats}
            onChange={(event) => setGridBeats(Number(event.target.value))}
            aria-label="Piano roll grid"
          >
            {QUANTIZE_OPTIONS.map((option) => (
              <option key={option.label} value={option.beats}>
                Grid {option.label}
              </option>
            ))}
          </select>
          <button
            className={`studio-button h-8 px-2 ${scaleLocked ? "border-accent-play bg-accent-play/15 text-accent-play" : ""}`}
            onClick={() => setProjectScale(scaleLocked ? "chromatic" : normalizePianoRollScale(undefined, project.key))}
          >
            <Play size={13} />
            {scaleLocked ? `${project.key ?? "C"} ${scale}` : "Chromatic"}
          </button>
          <select
            className="h-8 rounded-md border border-graphite-700 bg-graphite-950 px-2 text-xs font-bold text-slate-100 outline-none focus:border-accent-sel"
            value={scaleLocked ? scale : "chromatic"}
            onChange={(event) => setProjectScale(event.target.value as ProjectScale)}
            aria-label="Project scale"
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="chromatic">Chromatic</option>
          </select>
          <label className="flex h-8 items-center gap-2 rounded-md border border-graphite-700 bg-graphite-950 px-2 text-xs font-bold text-slate-300">
            Strength
            <input
              className="w-20"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={quantizeStrength}
              onChange={(event) => setQuantizeStrength(Number(event.target.value))}
            />
          </label>
          <button className="studio-button h-8 px-2" onClick={applyQuantize} disabled={notes.length === 0}>
            <Wand2 size={14} />
            Quantize
          </button>
          <button className="studio-button h-8 px-2" onClick={copySelection} disabled={selectedNotes.length === 0}>
            <Copy size={14} />
            Copy
          </button>
          <button className="studio-button h-8 px-2" onClick={() => removeNotes(clip.id, selectedNoteIds)} disabled={selectedNoteIds.length === 0}>
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: `${KEYBOARD_WIDTH}px ${gridWidth}px`, width: KEYBOARD_WIDTH + gridWidth }}>
          <div className="sticky left-0 z-10 border-r border-white/10 bg-black/30" style={{ height }}>
            {pitches.map((pitch) => {
              const enabled = pitchIsEnabled(pitch);
              return (
                <button
                  key={pitch}
                  className={`flex w-full items-center justify-between border-b border-white/[0.06] px-2 text-left text-[10px] font-bold ${
                    enabled
                      ? isBlackKey(pitch)
                        ? "bg-graphite-900 text-slate-400 hover:text-white"
                        : "bg-white/[0.055] text-slate-200 hover:text-white"
                      : "bg-black/25 text-graphite-700"
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  disabled={!enabled}
                  onPointerDown={() => previewPitch(pitch)}
                  title={pitchName(pitch)}
                >
                  <span>{pitch % 12 === 0 || enabled ? pitchName(pitch) : ""}</span>
                  {scaleLocked && scaleClasses.includes(pitch % 12) ? <span className="h-1.5 w-1.5 rounded-full bg-accent-play" /> : null}
                </button>
              );
            })}
          </div>

          <div
            className="relative"
            style={{
              width: gridWidth,
              height,
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: `${NOTE_BEAT_WIDTH * Math.max(1, project.timeSignature[0] || 4)}px 100%, ${NOTE_BEAT_WIDTH * gridBeats}px 100%, 100% ${ROW_HEIGHT}px`
            }}
            onPointerDown={handleGridPointerDown}
            onDoubleClick={(event) => addNoteAtPoint(getPointInElement(event, event.currentTarget))}
          >
            {pitches.map((pitch) =>
              pitchIsEnabled(pitch) ? null : (
                <div
                  key={`disabled-${pitch}`}
                  className="pointer-events-none absolute left-0 right-0 bg-black/25"
                  style={{ top: (MAX_PITCH - pitch) * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              )
            )}
            {notes.map((note) => {
              const selected = selectedNoteIds.includes(note.id);
              const enabled = pitchIsEnabled(note.pitch);
              const rect = noteRect(note);
              return (
                <div
                  key={note.id}
                  data-note-id={note.id}
                  className={`absolute rounded border text-[10px] font-black leading-4 shadow-lg ${
                    selected
                      ? "border-white bg-meter-cyan text-studio-950"
                      : enabled
                        ? "border-black/40 bg-meter-amber text-studio-950"
                        : "border-white/10 bg-graphite-600 text-slate-200"
                  }`}
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    opacity: enabled ? 1 : 0.55
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
            {selectionBox ? (
              <div
                className="pointer-events-none absolute border border-accent-sel bg-accent-sel/15"
                style={{
                  left: selectionBox.left,
                  top: selectionBox.top,
                  width: selectionBox.width,
                  height: selectionBox.height
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid border-t border-white/10 bg-black/25" style={{ gridTemplateColumns: `${KEYBOARD_WIDTH}px minmax(0,1fr)` }}>
        <div className="flex items-center justify-center border-r border-white/10 px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          Velocity
        </div>
        <div className="overflow-x-auto overflow-y-hidden">
          <div className="relative h-[87px]" style={{ width: gridWidth }}>
            {notes.map((note) => {
              const selected = selectedNoteIds.includes(note.id);
              return (
                <button
                  key={`velocity-${note.id}`}
                  className={`absolute bottom-2 w-3 rounded-t border ${
                    selected ? "border-white bg-meter-cyan" : "border-black/30 bg-accent-play"
                  }`}
                  style={{
                    left: note.startBeat * NOTE_BEAT_WIDTH + Math.max(0, note.durationBeats * NOTE_BEAT_WIDTH) / 2 - 6,
                    height: Math.max(6, note.velocity * 66)
                  }}
                  title={`${pitchName(note.pitch)} velocity ${Math.round(note.velocity * 100)}`}
                  aria-label={`${pitchName(note.pitch)} velocity`}
                  onPointerDown={(event) => beginVelocityEdit(note, event)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
