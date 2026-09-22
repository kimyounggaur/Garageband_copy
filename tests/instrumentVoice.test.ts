import { describe, expect, it, vi } from "vitest";
import type { LoadedSamplePack } from "../src/types/samples";

const tone = vi.hoisted(() => {
  const samplers: Array<{ options: Record<string, unknown>; triggerAttackRelease: ReturnType<typeof vi.fn> }> = [];
  class Gain {
    constructor(public level: number) {}
    connect() { return this; }
    toDestination() { return this; }
    dispose() { /* test fixture */ }
  }
  class Sampler {
    triggerAttackRelease = vi.fn();
    constructor(public options: Record<string, unknown>) { samplers.push(this); }
    connect() { return this; }
    dispose() { /* test fixture */ }
  }
  return { Gain, Sampler, samplers };
});
vi.mock("tone", () => ({ Gain: tone.Gain, Sampler: tone.Sampler }));

import { makeSampleVoice } from "../src/audio/instrumentVoice";

describe("sampled instrument voice", () => {
  it("passes decoded buffers to Tone.Sampler and selects the same nearest root as offline WAV", () => {
    tone.samplers.length = 0;
    const c4 = { duration: 0.8 } as AudioBuffer;
    const g4 = { duration: 0.8 } as AudioBuffer;
    const pack = { samples: [
      { file: { id: "c4", note: 60, velocityLayer: { min: 0, max: 1 }, gain: 1 }, buffer: c4 },
      { file: { id: "g4", note: 67, velocityLayer: { min: 0, max: 1 }, gain: 0.8 }, buffer: g4 }
    ] } as LoadedSamplePack;
    const voice = makeSampleVoice(pack);
    expect(tone.samplers[0].options.urls).toEqual({ 60: c4 });
    expect(tone.samplers[1].options.urls).toEqual({ 67: g4 });
    voice.trigger(72, 0.5, 10, 0.6);
    expect(tone.samplers[0].triggerAttackRelease).not.toHaveBeenCalled();
    expect(tone.samplers[1].triggerAttackRelease).toHaveBeenCalledWith("C5", 0.5, 10, 0.6);
    voice.dispose();
  });
});
