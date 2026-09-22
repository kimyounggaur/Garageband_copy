import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";
import { clip, project, track } from "./fixtures";

const tone = vi.hoisted(() => {
  const nodes: AudioNode[] = [];
  class AudioNode {
    connectedTo?: AudioNode;
    gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    };
    threshold = { value: 0 };
    volume = { value: 0 };
    pan = { value: 0 };
    low = { value: 0 };
    mid = { value: 0 };
    high = { value: 0 };
    ratio = { value: 1 };
    connect(node: AudioNode) { this.connectedTo = node; return this; }
    toDestination() { return this; }
    dispose() { /* audio graph cleanup */ }
    getValue() { return 0; }
    triggerAttackRelease = vi.fn();
    constructor() { nodes.push(this); }
  }
  const players: Player[] = [];
  const startAudio = vi.fn<() => Promise<void>>(async () => {});
  const loaded = vi.fn<() => Promise<void>>(async () => {});
  class Player extends AudioNode {
    buffer = { duration: 10 };
    playbackRate = 1;
    fadeIn = 0;
    fadeOut = 0;
    load = vi.fn(async () => undefined);
    start = vi.fn();
    stop = vi.fn();
    constructor() {
      super();
      players.push(this);
    }
  }
  const transport = {
    PPQ: 192,
    bpm: { value: 120 },
    ticks: 0,
    state: "stopped",
    loop: false,
    loopStart: "0i",
    loopEnd: "0i",
    position: "0i",
    start: vi.fn(() => { transport.state = "started"; }),
    pause: vi.fn(() => { transport.state = "paused"; }),
    stop: vi.fn(() => { transport.state = "stopped"; }),
    cancel: vi.fn(),
    schedule: vi.fn(() => 1),
    scheduleOnce: vi.fn((_callback: (time: number) => void, _at: string) => 2),
    clear: vi.fn()
  };
  return { AudioNode, Player, players, nodes, startAudio, loaded, transport };
});

vi.mock("../src/audio/clipAudio", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/audio/clipAudio")>(),
  createClipAudioUrl: vi.fn(async () => ({ url: "/test.wav" }))
}));

vi.mock("tone", () => ({
  start: tone.startAudio,
  loaded: tone.loaded,
  Transport: tone.transport,
  Gain: tone.AudioNode,
  Channel: tone.AudioNode,
  EQ3: tone.AudioNode,
  Compressor: tone.AudioNode,
  Player: tone.Player,
  Limiter: tone.AudioNode,
  Meter: tone.AudioNode,
  Reverb: tone.AudioNode,
  FeedbackDelay: tone.AudioNode,
  Synth: tone.AudioNode
}));

describe("AudioEngine transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tone.transport.ticks = 0;
    tone.transport.state = "stopped";
    tone.transport.position = "0i";
    tone.transport.loop = false;
    tone.players.length = 0;
    tone.nodes.length = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("window", { setTimeout, clearTimeout });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts from the requested beat instead of bar one", async () => {
    const engine = new AudioEngine();
    await engine.play(project(), vi.fn(), vi.fn(), { startBeat: 8.5 });
    expect(tone.transport.position).toBe("1632i");
    expect(tone.transport.start).toHaveBeenCalledOnce();
    engine.stop();
  });

  it("starts a recording callback at the transport beat and cancels it on stop", async () => {
    const engine = new AudioEngine();
    const onTransportStart = vi.fn();
    await engine.play(project({ countInBars: 1 }), vi.fn(), vi.fn(), {
      startBeat: 2,
      countIn: true,
      onTransportStart
    });
    const entry = tone.transport.scheduleOnce.mock.calls.find(([, at]) => at === "384i");
    expect(entry).toBeDefined();
    expect(onTransportStart).not.toHaveBeenCalled();
    entry?.[0](10);
    expect(onTransportStart).toHaveBeenCalledWith(2);
    engine.stop();
    entry?.[0](11);
    expect(onTransportStart).toHaveBeenCalledTimes(1);
  });

  it("starts within the cycle and wraps only when outside its half-open interval", async () => {
    const engine = new AudioEngine();
    const loopProject = project({ cycleEnabled: true, cycleStart: 4, cycleEnd: 8 });
    await engine.play(loopProject, vi.fn(), vi.fn(), { startBeat: 6 });
    expect(tone.transport.position).toBe("1152i");
    expect(tone.transport.loop).toBe(true);
    expect(tone.transport.loopStart).toBe("768i");
    expect(tone.transport.loopEnd).toBe("1536i");

    await engine.play(loopProject, vi.fn(), vi.fn(), { startBeat: 8 });
    expect(tone.transport.position).toBe("768i");
    engine.stop();
  });

  it("normalizes invalid start beats before cycle bounds are applied", async () => {
    const engine = new AudioEngine();
    await engine.play(project(), vi.fn(), vi.fn(), { startBeat: Number.NaN });
    expect(tone.transport.position).toBe("0i");
    await engine.play(project(), vi.fn(), vi.fn(), { startBeat: -10 });
    expect(tone.transport.position).toBe("0i");
    await engine.play(project({ cycleEnabled: true, cycleStart: 4, cycleEnd: 8 }), vi.fn(), vi.fn(), { startBeat: Number.NaN });
    expect(tone.transport.position).toBe("768i");
    engine.stop();
  });

  it("pauses at the current Tone beat and seeks while suspended", async () => {
    const engine = new AudioEngine();
    await engine.play(project(), vi.fn(), vi.fn(), { startBeat: 4 });
    tone.transport.ticks = 5.25 * 192;

    expect(engine.pause()).toBe(5.25);
    expect(tone.transport.state).toBe("stopped");
    expect(tone.transport.position).toBe("1008i");
    expect(engine.seek(7)).toBe(7);
    expect(tone.transport.position).toBe("1344i");
    engine.stop();
    expect(tone.transport.stop).toHaveBeenCalled();
  });

  it("moves the Tone transport when scrubbing during playback", async () => {
    const engine = new AudioEngine();
    await engine.play(project(), vi.fn(), vi.fn(), { startBeat: 4 });

    expect(engine.seek(9)).toBe(9);
    await vi.waitFor(() => expect(tone.transport.position).toBe("1728i"));
    expect(tone.transport.start).toHaveBeenCalledTimes(2);
    engine.stop();
  });

  it("restores an active audio Live Loop before starting after a seek", async () => {
    const engine = new AudioEngine();
    const liveProject = project({
      tracks: [track({ id: "audio-track", type: "audio", role: "recording", clips: [] })],
      liveLoops: {
        scenes: [{ id: "scene-1", name: "장면 1" }],
        cells: [{
          id: "cell-1", trackId: "audio-track", sceneId: "scene-1", type: "audio",
          name: "오디오 루프", color: "#38bdf8", lengthBeats: 4, audioUrl: "/test.wav"
        }],
        quantizeBeats: 4
      }
    });
    await engine.play(liveProject, vi.fn(), vi.fn(), { startBeat: 2 });
    await engine.triggerLiveLoopCells(liveProject, ["cell-1"], 4);

    engine.seek(6);
    await vi.waitFor(() => expect(tone.transport.start).toHaveBeenCalledTimes(2));
    const restored = tone.transport.schedule.mock.calls.find(([, at]) => at === "1152i");
    expect(restored).toBeDefined();
    expect(tone.transport.schedule.mock.invocationCallOrder.at(-1))
      .toBeLessThan(tone.transport.start.mock.invocationCallOrder.at(-1)!);
    engine.stop();
  });

  it("keeps a Live Loop queued until its transport beat", async () => {
    const engine = new AudioEngine();
    const liveProject = project({
      tracks: [track({ id: "audio-track", type: "audio", role: "recording", clips: [] })],
      liveLoops: {
        scenes: [{ id: "scene-1", name: "장면 1" }],
        cells: [{
          id: "cell-1", trackId: "audio-track", sceneId: "scene-1", type: "audio",
          name: "오디오 루프", color: "#38bdf8", lengthBeats: 4, audioUrl: "/test.wav"
        }],
        quantizeBeats: 4
      }
    });
    await engine.play(liveProject, vi.fn(), vi.fn());
    tone.transport.ticks = 2 * 192;
    const onTriggered = vi.fn();
    await engine.triggerLiveLoopCells(liveProject, ["cell-1"], 4, onTriggered);
    expect(onTriggered).not.toHaveBeenCalled();

    const scheduled = tone.transport.scheduleOnce.mock.calls.find(([, at]) => at === "768i");
    expect(scheduled).toBeDefined();
    scheduled?.[0](10);
    expect(onTriggered).toHaveBeenCalledOnce();
    engine.stop();
  });

  it("schedules the playable remainder when entering an audio clip midway", async () => {
    const engine = new AudioEngine();
    const audioClip = clip({
      type: "audio", audioUrl: "/test.wav", startBeat: 4, lengthBeats: 8,
      trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2
    });
    const audioProject = project({ tracks: [track({ type: "audio", role: "recording", clips: [audioClip] })] });
    await engine.play(audioProject, vi.fn(), vi.fn(), { startBeat: 6 });

    expect(tone.players).toHaveLength(1);
    const entry = tone.transport.scheduleOnce.mock.calls.find(([, at]) => at === "1152i");
    expect(entry).toBeDefined();
    entry?.[0](10);
    expect(tone.players[0].start).toHaveBeenCalledWith(10, 3, 6);
    expect(tone.players[0].stop).not.toHaveBeenCalled();

    tone.transport.ticks = 7 * 192;
    expect(engine.pause()).toBe(7);
    expect(tone.players[0].stop).toHaveBeenCalledOnce();
  });

  it("plays a clip crossing cycle start and caps it at cycle end", async () => {
    const engine = new AudioEngine();
    const audioClip = clip({
      type: "audio", audioUrl: "/test.wav", startBeat: 2, lengthBeats: 8,
      trimStartSeconds: 1, trimEndSeconds: 1, playbackRate: 2
    });
    const audioProject = project({
      cycleEnabled: true, cycleStart: 4, cycleEnd: 8,
      tracks: [track({ type: "audio", role: "recording", clips: [audioClip] })]
    });
    await engine.play(audioProject, vi.fn(), vi.fn(), { startBeat: 6 });

    const once = tone.transport.scheduleOnce.mock.calls.filter(([, at]) => at === "1152i");
    const eachCycle = tone.transport.schedule.mock.calls.filter(([, at]) => at === "768i");
    expect(once).toHaveLength(1);
    expect(eachCycle).toHaveLength(1);

    once[0][0](10);
    expect(tone.players[0].start).toHaveBeenCalledWith(10, 5, 2);
    eachCycle[0][0](12);
    expect(tone.players[0].start).toHaveBeenCalledWith(12, 3, 4);
    expect(tone.players[0].start).toHaveBeenCalledTimes(2);
    engine.stop();
  });

  it("starts inside the original fade-out without a gain jump", async () => {
    const engine = new AudioEngine();
    const audioClip = clip({
      type: "audio", audioUrl: "/test.wav", startBeat: 4, lengthBeats: 8,
      fadeOutSeconds: 1
    });
    const audioProject = project({ tracks: [track({ type: "audio", role: "recording", clips: [audioClip] })] });
    await engine.play(audioProject, vi.fn(), vi.fn(), { startBeat: 11 });

    const entry = tone.transport.scheduleOnce.mock.calls.find(([, at]) => at === "2112i");
    expect(entry).toBeDefined();
    entry?.[0](10);

    const gain = tone.players[0].connectedTo?.gain;
    expect(gain?.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
    expect(gain?.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.5);
    engine.stop();
  });

  it("does not start a pending playback after stop invalidates its generation", async () => {
    let resolveAudioStart: (() => void) | undefined;
    tone.startAudio.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveAudioStart = resolve; }));
    const engine = new AudioEngine();
    const playPromise = engine.play(project(), vi.fn(), vi.fn(), { startBeat: 8 });
    engine.stop();
    resolveAudioStart?.();
    await playPromise;

    expect(tone.transport.start).not.toHaveBeenCalled();
  });

  it("clears count-in clicks on stop before delayed playback begins", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.fn(setTimeout);
    const clearTimeoutSpy = vi.fn(clearTimeout);
    vi.stubGlobal("window", { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy });
    const engine = new AudioEngine();
    await engine.play(project({ countInBars: 1, bpm: 120 }), vi.fn(), vi.fn(), { countIn: true, startBeat: 4 });
    expect(setTimeoutSpy).toHaveBeenCalledTimes(4);
    engine.stop();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
    expect(tone.transport.stop).toHaveBeenCalled();
  });

  it.each([
    [[4, 4], 4, 2, [0, 500, 1000, 1500]],
    [[3, 4], 3, 1.5, [0, 500, 1000]],
    [[6, 8], 6, 1.5, [0, 250, 500, 750, 1000, 1250]]
  ] as const)("uses one %j bar for count-in timing", async (signature, clicks, seconds, offsetsMs) => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.fn(setTimeout);
    vi.stubGlobal("window", { setTimeout: setTimeoutSpy, clearTimeout });
    const engine = new AudioEngine();
    await engine.play(project({ countInBars: 1, bpm: 120, timeSignature: [...signature] }), vi.fn(), vi.fn(), { countIn: true });
    expect(tone.transport.start).toHaveBeenCalledWith(`+${seconds + 0.04}`, "0i");
    expect(setTimeoutSpy).toHaveBeenCalledTimes(clicks);
    expect(setTimeoutSpy.mock.calls.map(([, delay]) => delay)).toEqual(offsetsMs);
    engine.stop();
  });

  it("schedules six eighth-note metronome clicks with accents on 1 and 4 in 6/8", async () => {
    const engine = new AudioEngine();
    await engine.play(project({ timeSignature: [6, 8], metronomeOn: true }), vi.fn(), vi.fn());
    const barClicks = tone.transport.schedule.mock.calls.filter(([, at]) =>
      ["0i", "96i", "192i", "288i", "384i", "480i"].includes(at)
    );
    expect(barClicks.map(([, at]) => at)).toEqual(["0i", "96i", "192i", "288i", "384i", "480i"]);
    barClicks.forEach(([callback]) => callback(0));
    const pitches = tone.nodes.flatMap((node) => node.triggerAttackRelease.mock.calls.map(([pitch]) => pitch));
    expect(pitches).toEqual(["C6", "C5", "C5", "G5", "C5", "C5"]);
    engine.stop();
  });

  it("cancels count-in on pause and keeps the selected beat", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.fn(clearTimeout);
    vi.stubGlobal("window", { setTimeout, clearTimeout: clearTimeoutSpy });
    const engine = new AudioEngine();
    await engine.play(project({ countInBars: 1, bpm: 120 }), vi.fn(), vi.fn(), { countIn: true, startBeat: 4 });
    tone.transport.state = "stopped"; // delayed start has not fired yet

    expect(engine.pause()).toBe(4);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
    expect(tone.transport.position).toBe("768i");
  });
});
