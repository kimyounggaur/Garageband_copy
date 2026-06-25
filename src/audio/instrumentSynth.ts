import * as Tone from "tone";
import { getInstrumentPatch } from "../data/instruments";

export function createInstrumentSynth(instrumentId?: string) {
  const patch = getInstrumentPatch(instrumentId);
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: patch.synth.oscillator },
    envelope: {
      attack: patch.synth.attack,
      decay: patch.synth.decay,
      sustain: patch.synth.sustain,
      release: patch.synth.release
    }
  });
}
