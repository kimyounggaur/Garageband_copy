import * as Tone from "tone";
import { getInstrumentPatch } from "../data/instruments";
import type { LoadedSamplePack } from "../types/samples";
import { createInstrumentSynth } from "./instrumentSynth";
import { clearSampleNotice, reportSampleFallback } from "./sampleNotice";
import { SAMPLE_PLAYBACK_GAIN, sampleLibrary, selectSampleForNote } from "./sampleLibrary";

export function midiNoteName(pitch: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${notes[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

export type InstrumentVoice = {
  nodes: Tone.ToneAudioNode[];
  sampled: boolean;
  trigger(pitch: number, duration: string | number, time: string | number, velocity: number): void;
  dispose(): void;
};

export function makeSampleVoice(pack: LoadedSamplePack, destination?: Tone.ToneAudioNode): InstrumentVoice {
  const samplers = new Map<string, Tone.Sampler>();
  const nodes: Tone.ToneAudioNode[] = [];
  for (const sample of pack.samples) {
    const gain = new Tone.Gain(sample.file.gain * SAMPLE_PLAYBACK_GAIN);
    if (destination) gain.connect(destination);
    else gain.toDestination();
    const sampler = new Tone.Sampler({ urls: { [sample.file.note]: sample.buffer }, attack: 0, release: 0.005, curve: "linear" }).connect(gain);
    samplers.set(sample.file.id, sampler);
    nodes.push(sampler, gain);
  }
  return {
    nodes,
    sampled: true,
    trigger(pitch, duration, time, velocity) {
      const selected = selectSampleForNote(pack, pitch, velocity);
      samplers.get(selected.file.id)!.triggerAttackRelease(midiNoteName(pitch), duration, time, velocity);
    },
    dispose() { nodes.forEach((node) => node.dispose()); }
  };
}

export async function createInstrumentVoice(instrumentId?: string, destination?: Tone.ToneAudioNode, signal?: AbortSignal, forceSynth = false): Promise<InstrumentVoice> {
  if (signal?.aborted) throw new DOMException("샘플 로딩을 취소했습니다.", "AbortError");
  const patch = getInstrumentPatch(instrumentId);
  if (patch.samplePackId && !forceSynth) {
    try {
      const pack = await sampleLibrary.loadPack(patch.samplePackId, signal);
      if (signal?.aborted) throw new DOMException("샘플 로딩을 취소했습니다.", "AbortError");
      const voice = makeSampleVoice(pack, destination);
      clearSampleNotice();
      return voice;
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      reportSampleFallback(error);
    }
  }
  const synth = createInstrumentSynth(instrumentId);
  if (signal?.aborted) {
    synth.dispose();
    throw new DOMException("악기 로딩을 취소했습니다.", "AbortError");
  }
  if (destination) synth.connect(destination);
  else synth.toDestination();
  return {
    nodes: [synth], sampled: false,
    trigger(pitch, duration, time, velocity) { synth.triggerAttackRelease(midiNoteName(pitch), duration, time, velocity); },
    dispose() { synth.dispose(); }
  };
}
