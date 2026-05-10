import * as Tone from "tone";
import type { MidiNote } from "../types/project";

type PreviewOptions = {
  bpm: number;
  notes: Array<Omit<MidiNote, "id">>;
  drum?: boolean;
};

let activeCleanup: (() => void) | undefined;

function midiToNoteName(pitch: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${notes[pitch % 12]}${octave}`;
}

function normalizedNotes(notes: Array<Omit<MidiNote, "id">>) {
  const minStart = notes.reduce((min, note) => Math.min(min, note.startBeat), Number.POSITIVE_INFINITY);
  const offset = Number.isFinite(minStart) ? minStart : 0;
  return notes.map((note) => ({ ...note, startBeat: Math.max(0, note.startBeat - offset) }));
}

export function stopAssistPreview() {
  activeCleanup?.();
  activeCleanup = undefined;
}

export async function playAssistPreview({ bpm, notes, drum = false }: PreviewOptions) {
  stopAssistPreview();
  if (notes.length === 0) return;

  await Tone.start();
  const beatSeconds = 60 / Math.max(40, Math.min(220, bpm));
  const start = Tone.now() + 0.04;
  const previewNotes = normalizedNotes(notes).slice(0, 96);
  const gain = new Tone.Gain(0.72).toDestination();
  const disposables: Tone.ToneAudioNode[] = [gain];

  if (drum) {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.2 }
    }).connect(gain);
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
    }).connect(gain);
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 2800,
      octaves: 1
    }).connect(gain);
    disposables.push(kick, snare, hat);

    previewNotes.forEach((note) => {
      const time = start + note.startBeat * beatSeconds;
      if (note.pitch <= 36) kick.triggerAttackRelease("C1", "8n", time, note.velocity);
      else if (note.pitch <= 40) snare.triggerAttackRelease("16n", time, note.velocity);
      else hat.triggerAttackRelease("32n", time, note.velocity * 0.55);
    });
  } else {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.58, release: 0.35 }
    }).connect(gain);
    disposables.push(synth);

    previewNotes.forEach((note) => {
      synth.triggerAttackRelease(
        midiToNoteName(note.pitch),
        Math.max(0.08, note.durationBeats * beatSeconds),
        start + note.startBeat * beatSeconds,
        note.velocity
      );
    });
  }

  const endBeat = previewNotes.reduce((max, note) => Math.max(max, note.startBeat + note.durationBeats), 0);
  const timeout = window.setTimeout(() => stopAssistPreview(), endBeat * beatSeconds * 1000 + 700);
  activeCleanup = () => {
    window.clearTimeout(timeout);
    disposables.forEach((node) => node.dispose());
  };
}
