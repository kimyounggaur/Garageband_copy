import * as Tone from "tone";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInstrumentSynth } from "../../audio/instrumentSynth";
import { useDawStore } from "../../store/useDawStore";
import type { Clip, Track } from "../../types/project";
import { timelineBeatToClipBeat, type TouchNote } from "../../utils/touchInstruments";
import { Drum, Keyboard, Music2, Sparkles } from "../icons";
import { BeatSequencer } from "./BeatSequencer";
import { ChordStrips } from "./ChordStrips";
import { KeyboardInstrument } from "./Keyboard";
import { SmartDrums } from "./SmartDrums";

type TouchTab = "keyboard" | "beats" | "smart" | "chords";

export type TouchWriteOptions = {
  preserveTiming?: boolean;
};

export type TouchInstrumentContext = {
  bpm: number;
  currentBeat: number;
  snapBeats: number;
  isRecording: boolean;
  projectKey: string;
  metronomeOn: boolean;
  countInBars: number;
  writeMelodicNotes: (notes: TouchNote[], options?: TouchWriteOptions) => void;
  writeDrumNotes: (notes: TouchNote[], options?: TouchWriteOptions) => void;
  previewMelodicNotes: (notes: TouchNote[]) => void;
  previewDrumNotes: (notes: TouchNote[]) => void;
};

const TABS: Array<{ id: TouchTab; label: string; icon: typeof Keyboard }> = [
  { id: "keyboard", label: "Keys", icon: Keyboard },
  { id: "beats", label: "Beat", icon: Drum },
  { id: "smart", label: "Smart", icon: Sparkles },
  { id: "chords", label: "Chords", icon: Music2 }
];

function findClip(projectTracks: Track[], clipId?: string) {
  if (!clipId) return undefined;
  return projectTracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
}

function findClipTrack(projectTracks: Track[], clip?: Clip) {
  return projectTracks.find((track) => track.id === clip?.trackId);
}

function midiToNoteName(pitch: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${notes[((pitch % 12) + 12) % 12]}${octave}`;
}

function secondsPerBeat(bpm: number) {
  return 60 / Math.max(1, bpm);
}

export function TouchInstruments({ clip }: { clip?: Clip }) {
  const [activeTab, setActiveTab] = useState<TouchTab>("keyboard");
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const isRecording = useDawStore((state) => state.isRecording);
  const addTrack = useDawStore((state) => state.addTrack);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const addNotes = useDawStore((state) => state.addNotes);
  const melodicSynthRef = useRef<ReturnType<typeof createInstrumentSynth> | null>(null);
  const drumNodesRef = useRef<{
    kick?: Tone.MembraneSynth;
    snare?: Tone.NoiseSynth;
    hat?: Tone.MetalSynth;
  }>({});

  const selectedClip = clip ?? findClip(project.tracks, selectedClipId);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  const selectedClipTrack = findClipTrack(project.tracks, selectedClip);
  const melodicPreviewTrack = selectedClipTrack?.type === "instrument" ? selectedClipTrack : selectedTrack;
  const melodicInstrumentId = melodicPreviewTrack?.instrumentId;

  useEffect(() => {
    const synth = melodicSynthRef.current;
    melodicSynthRef.current = null;
    synth?.dispose();
  }, [melodicInstrumentId]);

  useEffect(() => {
    return () => {
      melodicSynthRef.current?.dispose();
      Object.values(drumNodesRef.current).forEach((node) => node?.dispose());
      drumNodesRef.current = {};
    };
  }, []);

  const ensureMelodicClip = useCallback(() => {
    const state = useDawStore.getState();
    const activeClip = clip ?? findClip(state.project.tracks, state.selectedClipId);
    const activeTrack = findClipTrack(state.project.tracks, activeClip);
    if (activeClip?.type === "midi" && activeTrack?.type !== "drum" && activeTrack?.role !== "beat") {
      return activeClip;
    }

    const targetTrackId =
      (state.selectedTrackId &&
      state.project.tracks.some((track) => track.id === state.selectedTrackId && track.type === "instrument")
        ? state.selectedTrackId
        : undefined) ??
      state.project.tracks.find((track) => track.type === "instrument" && track.role !== "beat")?.id ??
      addTrack("instrument", "Touch Instrument");
    const clipId = addMidiClip(targetTrackId, state.currentBeat);
    return findClip(useDawStore.getState().project.tracks, clipId);
  }, [addMidiClip, addTrack, clip]);

  const ensureDrumClip = useCallback(() => {
    const state = useDawStore.getState();
    const activeClip = clip ?? findClip(state.project.tracks, state.selectedClipId);
    const activeTrack = findClipTrack(state.project.tracks, activeClip);
    if (activeClip?.type === "midi" && (activeTrack?.type === "drum" || activeTrack?.role === "beat")) {
      return activeClip;
    }

    const targetTrackId =
      (state.selectedTrackId && state.project.tracks.some((track) => track.id === state.selectedTrackId && track.type === "drum")
        ? state.selectedTrackId
        : undefined) ??
      state.project.tracks.find((track) => track.type === "drum" || track.role === "beat")?.id ??
      addTrack("drum", "Touch Drums");
    const clipId = addMidiClip(targetTrackId, state.currentBeat);
    return findClip(useDawStore.getState().project.tracks, clipId);
  }, [addMidiClip, addTrack, clip]);

  const writeNotes = useCallback(
    (kind: "melodic" | "drum", notes: TouchNote[], options?: TouchWriteOptions) => {
      if (notes.length === 0) return;
      const state = useDawStore.getState();
      const targetClip = kind === "drum" ? ensureDrumClip() : ensureMelodicClip();
      if (!targetClip) return;
      const relativeBeat = timelineBeatToClipBeat(state.currentBeat, targetClip.startBeat, state.snapBeats);
      const shiftedNotes = notes.map((note) => ({
        ...note,
        startBeat: Math.max(0, note.startBeat + relativeBeat)
      }));
      addNotes(targetClip.id, shiftedNotes, options?.preserveTiming ? { snap: false } : undefined);
    },
    [addNotes, ensureDrumClip, ensureMelodicClip]
  );

  const ensureMelodicSynth = useCallback(async () => {
    await Tone.start();
    melodicSynthRef.current ??= createInstrumentSynth(melodicInstrumentId).toDestination();
    return melodicSynthRef.current;
  }, [melodicInstrumentId]);

  const ensureDrumNodes = useCallback(async () => {
    await Tone.start();
    drumNodesRef.current.kick ??= new Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.2 }
    }).toDestination();
    drumNodesRef.current.snare ??= new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
    }).toDestination();
    drumNodesRef.current.hat ??= new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 2800,
      octaves: 1
    }).toDestination();
    return drumNodesRef.current;
  }, []);

  const previewMelodicNotes = useCallback(
    (notes: TouchNote[]) => {
      if (notes.length === 0) return;
      void ensureMelodicSynth().then((synth) => {
        const beatSeconds = secondsPerBeat(useDawStore.getState().project.bpm);
        const firstBeat = Math.min(...notes.map((note) => note.startBeat));
        const now = Tone.now();
        notes.forEach((note) => {
          synth.triggerAttackRelease(
            midiToNoteName(note.pitch),
            Math.max(0.04, note.durationBeats * beatSeconds),
            now + Math.max(0, note.startBeat - firstBeat) * beatSeconds,
            note.velocity
          );
        });
      });
    },
    [ensureMelodicSynth]
  );

  const previewDrumNotes = useCallback(
    (notes: TouchNote[]) => {
      if (notes.length === 0) return;
      void ensureDrumNodes().then((nodes) => {
        const beatSeconds = secondsPerBeat(useDawStore.getState().project.bpm);
        const firstBeat = Math.min(...notes.map((note) => note.startBeat));
        const now = Tone.now();
        notes.forEach((note) => {
          const time = now + Math.max(0, note.startBeat - firstBeat) * beatSeconds;
          if (note.pitch <= 36) nodes.kick?.triggerAttackRelease("C1", "8n", time, note.velocity);
          else if (note.pitch <= 40) nodes.snare?.triggerAttackRelease("16n", time, note.velocity);
          else nodes.hat?.triggerAttackRelease("32n", time, note.velocity * 0.55);
        });
      });
    },
    [ensureDrumNodes]
  );

  const context = useMemo<TouchInstrumentContext>(
    () => ({
      bpm: project.bpm,
      currentBeat,
      snapBeats,
      isRecording,
      projectKey: project.key ?? "C",
      metronomeOn: Boolean(project.metronomeOn),
      countInBars: project.countInBars ?? 0,
      writeMelodicNotes: (notes, options) => writeNotes("melodic", notes, options),
      writeDrumNotes: (notes, options) => writeNotes("drum", notes, options),
      previewMelodicNotes,
      previewDrumNotes
    }),
    [currentBeat, isRecording, previewDrumNotes, previewMelodicNotes, project.bpm, project.countInBars, project.key, project.metronomeOn, snapBeats, writeNotes]
  );

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-graphite-950/60">
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/10 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`studio-button h-7 px-2 text-[11px] ${activeTab === tab.id ? "border-accent-sel bg-accent-sel/15 text-accent-sel" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-graphite-500">
          <span className={isRecording ? "text-meter-rose" : "text-graphite-500"}>{isRecording ? "REC" : "Preview"}</span>
          {project.metronomeOn ? <span className="rounded bg-accent-cycle/15 px-1.5 py-0.5 text-accent-cycle">Metro</span> : null}
          {project.countInBars ? <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-300">{project.countInBars} bar</span> : null}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        {activeTab === "keyboard" ? <KeyboardInstrument context={context} /> : null}
        {activeTab === "beats" ? <BeatSequencer context={context} /> : null}
        {activeTab === "smart" ? <SmartDrums context={context} /> : null}
        {activeTab === "chords" ? <ChordStrips context={context} /> : null}
      </div>

      <div className="flex min-h-8 items-center justify-between border-t border-white/10 px-3 text-[11px] font-semibold text-graphite-500">
        <span>{project.key ?? "C"} / {project.bpm} BPM</span>
        <span>Beat {currentBeat.toFixed(2)}</span>
      </div>
    </section>
  );
}
