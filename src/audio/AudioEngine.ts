import * as Tone from "tone";
import { getLoopById, resolveLoopPattern } from "../data/loops";
import type { AutomationParam, Clip, Project, Track } from "../types/project";
import { normalizeCountInBars } from "../utils/transport";
import { barLengthBeats, metronomeClickPattern, type MetronomeClick } from "../utils/meterMath";
import { logError } from "../utils/logger";
import { automationBaseValue, normalizeTrackAutomation } from "./automation";
import { clipGain, createClipAudioUrl, resolveClipAudioSegment, secondsPerBeat, segmentGainAt } from "./clipAudio";
import { gainToDb, normalizeTrackFx, normalizeTrackSends, resolveProjectMasterFx, resolveTrackMute } from "./fx";
import { createInstrumentVoice } from "./instrumentVoice";
import { liveLoopCellToClip, liveLoopTriggerBeat, resolveProjectLiveLoops } from "./liveLoops";
import { getInstrumentPatch } from "../data/instruments";
import { sampleLibrary } from "./sampleLibrary";
import { reportSampleFallback } from "./sampleNotice";

type BeatCallback = (beat: number) => void;
type EndCallback = () => void;
type MeterCallback = (level: number) => void;
type PlayOptions = {
  startBeat?: number;
  countIn?: boolean;
  onMeter?: MeterCallback;
  onTransportStart?: (beat: number) => void;
  resumeLiveLoopCellIds?: string[];
};

const PPQ = 192;

function tickTime(beat: number) {
  return `${Math.max(0, Math.round(beat * PPQ))}i`;
}

function safeBeat(beat: number | undefined) {
  return typeof beat === "number" && Number.isFinite(beat) ? Math.max(0, beat) : 0;
}

function beatDuration(beats = 0.25) {
  return `${Math.max(1, Math.round(beats * PPQ))}i`;
}

function midiToNoteName(pitch: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${notes[pitch % 12]}${octave}`;
}

function projectLength(project: Project) {
  const minimumBeats = 4 * barLengthBeats(project.timeSignature);
  const end = project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats);
  }, minimumBeats);
  return Math.max(minimumBeats, end);
}

function clickNote(accent: MetronomeClick["accent"]) {
  if (accent === "primary") return { pitch: "C6", velocity: 0.9 };
  if (accent === "secondary") return { pitch: "G5", velocity: 0.7 };
  return { pitch: "C5", velocity: 0.45 };
}

type TrackFxRuntime = {
  channel: Tone.Channel;
  eq: Tone.EQ3;
  compressor: Tone.Compressor;
  reverbSend: Tone.Gain;
  delaySend: Tone.Gain;
};

type AutomatableParam = {
  setValueAtTime: (value: number, time: number | string) => unknown;
  linearRampToValueAtTime: (value: number, time: number | string) => unknown;
};

export class AudioEngine {
  private channels = new Map<string, TrackFxRuntime>();
  private nodes: Tone.ToneAudioNode[] = [];
  private scheduledIds: number[] = [];
  private liveLoopScheduledIds: number[] = [];
  private activeLiveLoopCellIds: string[] = [];
  private audioUrlCleanups: Array<() => void> = [];
  private players = new Set<Tone.Player>();
  private countInTimeouts: number[] = [];
  private masterBus?: Tone.Gain;
  private masterOutput?: Tone.Gain;
  private masterMeter?: Tone.Meter;
  private masterLimiter?: Tone.Limiter;
  private masterReverb?: Tone.Reverb;
  private masterReverbReturn?: Tone.Gain;
  private masterDelay?: Tone.FeedbackDelay;
  private masterDelayReturn?: Tone.Gain;
  private frameId = 0;
  private lengthBeats = 16;
  private cycleEnabled = false;
  private cycleStart = 0;
  private cycleEnd = 0;
  private generation = 0;
  private sampleLoadController = new AbortController();
  private liveLoopLoadController = new AbortController();
  private requestedBeat = 0;
  private playback?: {
    project: Project;
    onBeat: BeatCallback;
    onEnded: EndCallback;
    options: PlayOptions;
  };

  async play(project: Project, onBeat: BeatCallback, onEnded: EndCallback, options: PlayOptions = {}) {
    this.stop();
    const generation = this.generation;
    this.cycleStart = safeBeat(project.cycleStart);
    this.cycleEnd = Math.max(this.cycleStart + 0.25, safeBeat(project.cycleEnd));
    this.cycleEnabled = Boolean(project.cycleEnabled && this.cycleEnd > this.cycleStart);
    this.requestedBeat = this.normalizeBeat(options.startBeat);
    this.playback = { project, onBeat, onEnded, options };

    try {
      await Tone.start();
      if (generation !== this.generation) return;

      Tone.Transport.PPQ = PPQ;
      Tone.Transport.bpm.value = project.bpm;
      Tone.Transport.loop = this.cycleEnabled;
      Tone.Transport.loopStart = tickTime(this.cycleStart);
      Tone.Transport.loopEnd = tickTime(this.cycleEnd);
      Tone.Transport.cancel(0);
      Tone.Transport.position = tickTime(this.requestedBeat);

      this.lengthBeats = this.cycleEnabled ? this.cycleEnd : projectLength(project);
      this.createMasterOutput(project);
      this.createChannels(project);
      this.scheduleTrackAutomation(project);
      await this.scheduleProject(project, generation, this.requestedBeat);
      if (generation !== this.generation) return;
      this.scheduleMetronome(project);
      await Tone.loaded();
      if (generation !== this.generation) return;
      if (options.resumeLiveLoopCellIds?.length) {
        await this.triggerLiveLoopCells(project, options.resumeLiveLoopCellIds, this.requestedBeat);
        if (generation !== this.generation) return;
      }

      const countInBars = options.countIn ? normalizeCountInBars(project.countInBars) : 0;
      const countInBeats = countInBars * barLengthBeats(project.timeSignature);
      const delaySeconds = countInBeats * secondsPerBeat(project.bpm);
      if (countInBars > 0) this.scheduleCountInClicks(project, countInBars);
      if (options.onTransportStart) {
        const startId = Tone.Transport.scheduleOnce(() => {
          if (generation === this.generation) options.onTransportStart?.(this.requestedBeat);
        }, tickTime(this.requestedBeat));
        this.scheduledIds.push(startId);
      }
      this.startBeatLoop(onBeat, onEnded, options.onMeter, generation);
      Tone.Transport.start(`+${delaySeconds + 0.04}`, tickTime(this.requestedBeat));
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }

  stop() {
    this.generation += 1;
    this.sampleLoadController.abort();
    this.sampleLoadController = new AbortController();
    this.liveLoopLoadController.abort();
    this.liveLoopLoadController = new AbortController();
    this.playback = undefined;
    this.requestedBeat = 0;
    cancelAnimationFrame(this.frameId);
    this.countInTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.countInTimeouts = [];
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.loop = false;
    this.cycleEnabled = false;
    this.scheduledIds = [];
    this.liveLoopScheduledIds = [];
    this.activeLiveLoopCellIds = [];
    this.players.forEach((player) => player.stop());
    this.players.clear();
    this.nodes.forEach((node) => node.dispose());
    this.nodes = [];
    this.channels.clear();
    this.masterBus = undefined;
    this.masterOutput = undefined;
    this.masterMeter = undefined;
    this.masterLimiter = undefined;
    this.masterReverb = undefined;
    this.masterReverbReturn = undefined;
    this.masterDelay = undefined;
    this.masterDelayReturn = undefined;
    this.audioUrlCleanups.forEach((cleanup) => cleanup());
    this.audioUrlCleanups = [];
  }

  pause() {
    const beat = Tone.Transport.state === "started"
      ? this.normalizeBeat(Tone.Transport.ticks / PPQ)
      : this.requestedBeat;
    this.stop();
    this.requestedBeat = beat;
    Tone.Transport.position = tickTime(beat);
    return beat;
  }

  seek(beat: number) {
    const nextBeat = this.normalizeBeat(beat);
    const playback = this.playback;
    if (playback) {
      const liveCellIds = [...this.activeLiveLoopCellIds];
      void this.play(playback.project, playback.onBeat, playback.onEnded, {
        ...playback.options,
        startBeat: nextBeat,
        countIn: false,
        onTransportStart: undefined,
        resumeLiveLoopCellIds: liveCellIds
      }).catch((error) => logError("AudioEngine.seek", error));
    } else {
      this.requestedBeat = nextBeat;
      Tone.Transport.position = tickTime(nextBeat);
    }
    return nextBeat;
  }

  private normalizeBeat(beat: number | undefined) {
    const normalized = safeBeat(beat);
    return this.cycleEnabled && (normalized < this.cycleStart || normalized >= this.cycleEnd)
      ? this.cycleStart
      : normalized;
  }

  updateTrackControls(project: Project) {
    const master = resolveProjectMasterFx(project);
    if (this.masterOutput) this.masterOutput.gain.value = master.volume;
    if (this.masterReverbReturn) this.masterReverbReturn.gain.value = master.reverb ?? 0;
    if (this.masterDelayReturn) this.masterDelayReturn.gain.value = master.delay ?? 0;
    if (this.masterLimiter) this.masterLimiter.threshold.value = master.limiterOn === false ? 6 : -1;
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const runtime = this.channels.get(track.id);
      if (!runtime) return;
      const fx = normalizeTrackFx(track.fx);
      const sends = normalizeTrackSends(track.sends);
      runtime.channel.volume.value = gainToDb(track.volume);
      runtime.channel.pan.value = track.pan;
      runtime.channel.mute = resolveTrackMute(track, hasSolo);
      runtime.eq.low.value = fx.eq.low;
      runtime.eq.mid.value = fx.eq.mid;
      runtime.eq.high.value = fx.eq.high;
      runtime.compressor.threshold.value = fx.comp.threshold;
      runtime.compressor.ratio.value = fx.comp.ratio;
      runtime.reverbSend.gain.value = sends.reverb;
      runtime.delaySend.gain.value = sends.delay;
    });
  }

  async triggerLiveLoopCells(project: Project, cellIds: string[], triggerBeat?: number, onTriggered?: () => void) {
    if (cellIds.length === 0 || this.channels.size === 0) return;
    const generation = this.generation;
    this.stopLiveLoops();
    const liveLoops = resolveProjectLiveLoops(project);
    const targetIds = new Set(cellIds);
    const liveLoadSignal = this.liveLoopLoadController.signal;
    const samplePackIds = [...new Set(liveLoops.cells.filter((cell) => targetIds.has(cell.id) && cell.type === "midi")
      .map((cell) => project.tracks.find((track) => track.id === cell.trackId))
      .filter((track) => track?.type === "instrument")
      .map((track) => getInstrumentPatch(track?.instrumentId).samplePackId)
      .filter((id): id is string => Boolean(id)))];
    const failedSamplePacks = new Set<string>();
    if (samplePackIds.length > 0) {
      await Promise.all(samplePackIds.map((id) => sampleLibrary.loadPack(id, liveLoadSignal).catch((error) => {
        if (liveLoadSignal.aborted) return;
        failedSamplePacks.add(id);
        reportSampleFallback(error);
      })));
      if (generation !== this.generation || liveLoadSignal.aborted) return;
    }
    const readyBeat = samplePackIds.length > 0 && Tone.Transport.state === "started"
      ? liveLoopTriggerBeat(Tone.Transport.ticks / PPQ + 0.02, project.timeSignature, liveLoops.quantizeBeats, liveLoops.quantizeMode)
      : 0;
    const startBeat = this.normalizeBeat(
      Math.max(readyBeat, triggerBeat ?? liveLoopTriggerBeat(Tone.Transport.ticks / PPQ, project.timeSignature, liveLoops.quantizeBeats, liveLoops.quantizeMode))
    );
    const audioSchedules: Promise<void>[] = [];

    liveLoops.cells
      .filter((cell) => targetIds.has(cell.id))
      .forEach((cell) => {
        const track = project.tracks.find((item) => item.id === cell.trackId);
        const runtime = this.channels.get(cell.trackId);
        if (!track || !runtime) return;
        const clip = liveLoopCellToClip(cell, startBeat);
        const beforeScheduleCount = this.scheduledIds.length;

        if (clip.type === "loop") this.scheduleLoopClip(project, clip, runtime.channel);
        if (clip.type === "midi") audioSchedules.push(this.scheduleMidiClip(track, clip, runtime.channel, generation, this.liveLoopLoadController.signal, failedSamplePacks.has(getInstrumentPatch(track.instrumentId).samplePackId ?? "")));
        if (clip.type === "audio") audioSchedules.push(this.scheduleAudioClip(project, clip, runtime.channel));

        this.liveLoopScheduledIds.push(...this.scheduledIds.slice(beforeScheduleCount));
      });

    if (audioSchedules.length > 0) {
      const beforeScheduleCount = this.scheduledIds.length;
      await Promise.all(audioSchedules);
      if (generation !== this.generation) return;
      this.liveLoopScheduledIds.push(...this.scheduledIds.slice(beforeScheduleCount));
    }
    this.activeLiveLoopCellIds = [...cellIds];
    if (onTriggered) {
      if (!this.cycleEnabled && startBeat <= Tone.Transport.ticks / PPQ) {
        onTriggered();
      } else {
        const id = Tone.Transport.scheduleOnce(() => {
          if (generation === this.generation) onTriggered();
        }, tickTime(startBeat));
        this.liveLoopScheduledIds.push(id);
      }
    }
  }

  stopLiveLoops() {
    this.liveLoopLoadController.abort();
    this.liveLoopLoadController = new AbortController();
    this.liveLoopScheduledIds.forEach((id) => Tone.Transport.clear(id));
    this.liveLoopScheduledIds = [];
    this.activeLiveLoopCellIds = [];
  }

  private createMasterOutput(project: Project) {
    const master = resolveProjectMasterFx(project);
    this.masterBus = new Tone.Gain(1);
    this.masterLimiter = new Tone.Limiter(master.limiterOn === false ? 6 : -1);
    this.masterOutput = new Tone.Gain(master.volume).toDestination();
    this.masterMeter = new Tone.Meter({ normalRange: true, smoothing: 0.78 });
    this.masterReverb = new Tone.Reverb({ decay: 2.6, preDelay: 0.02, wet: 1 });
    this.masterReverbReturn = new Tone.Gain(master.reverb ?? 0);
    this.masterDelay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.28, wet: 1 });
    this.masterDelayReturn = new Tone.Gain(master.delay ?? 0);
    this.masterBus.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterOutput);
    this.masterReverb.connect(this.masterReverbReturn);
    this.masterReverbReturn.connect(this.masterBus);
    this.masterDelay.connect(this.masterDelayReturn);
    this.masterDelayReturn.connect(this.masterBus);
    this.masterOutput.connect(this.masterMeter);
    this.nodes.push(
      this.masterBus,
      this.masterLimiter,
      this.masterOutput,
      this.masterMeter,
      this.masterReverb,
      this.masterReverbReturn,
      this.masterDelay,
      this.masterDelayReturn
    );
  }

  private createChannels(project: Project) {
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const fx = normalizeTrackFx(track.fx);
      const sends = normalizeTrackSends(track.sends);
      const channel = new Tone.Channel({
        volume: gainToDb(track.volume),
        pan: track.pan,
        mute: resolveTrackMute(track, hasSolo)
      });
      const eq = new Tone.EQ3();
      eq.low.value = fx.eq.low;
      eq.mid.value = fx.eq.mid;
      eq.high.value = fx.eq.high;
      const compressor = new Tone.Compressor({
        threshold: fx.comp.threshold,
        ratio: fx.comp.ratio,
        attack: 0.01,
        release: 0.12
      });
      const reverbSend = new Tone.Gain(sends.reverb);
      const delaySend = new Tone.Gain(sends.delay);
      channel.connect(eq);
      eq.connect(compressor);
      if (this.masterBus) compressor.connect(this.masterBus);
      else compressor.toDestination();
      if (this.masterReverb) {
        compressor.connect(reverbSend);
        reverbSend.connect(this.masterReverb);
      }
      if (this.masterDelay) {
        compressor.connect(delaySend);
        delaySend.connect(this.masterDelay);
      }
      this.channels.set(track.id, { channel, eq, compressor, reverbSend, delaySend });
      this.nodes.push(channel, eq, compressor, reverbSend, delaySend);
    });
  }

  private automationTarget(runtime: TrackFxRuntime, param: AutomationParam): AutomatableParam {
    if (param === "volume") return runtime.channel.volume as unknown as AutomatableParam;
    if (param === "pan") return runtime.channel.pan as unknown as AutomatableParam;
    if (param === "send.reverb") return runtime.reverbSend.gain as unknown as AutomatableParam;
    return runtime.delaySend.gain as unknown as AutomatableParam;
  }

  private automationAudioValue(param: AutomationParam, value: number) {
    return param === "volume" ? gainToDb(value) : value;
  }

  private scheduleTrackAutomation(project: Project) {
    project.tracks.forEach((track) => {
      const runtime = this.channels.get(track.id);
      if (!runtime) return;

      normalizeTrackAutomation(track.automation).forEach((entry) => {
        if (entry.points.length === 0) return;
        const target = this.automationTarget(runtime, entry.param);
        target.setValueAtTime(this.automationAudioValue(entry.param, automationBaseValue(track, entry.param)), tickTime(0));

        entry.points.forEach((point, index) => {
          const value = this.automationAudioValue(entry.param, point.value);
          if (index === 0 || point.beat <= entry.points[index - 1].beat) {
            target.setValueAtTime(value, tickTime(point.beat));
            return;
          }
          target.linearRampToValueAtTime(value, tickTime(point.beat));
        });
      });
    });
  }

  private async scheduleProject(project: Project, generation: number, startBeat: number) {
    const audioLoads: Promise<void>[] = [];
    project.tracks.forEach((track) => {
      const channel = this.channels.get(track.id);
      if (!channel) return;

      track.clips.forEach((clip) => {
        if (clip.type === "loop") {
          this.scheduleLoopClip(project, clip, channel.channel);
        }
        if (clip.type === "midi") {
          audioLoads.push(this.scheduleMidiClip(track, clip, channel.channel, generation));
        }
        if (clip.type === "audio") {
          audioLoads.push(this.scheduleAudioClip(project, clip, channel.channel, generation, startBeat));
        }
      });
    });
    await Promise.all(audioLoads);
  }

  private createClickSynth() {
    const synth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.025 }
    });
    if (this.masterOutput) synth.connect(this.masterOutput);
    else synth.toDestination();
    this.nodes.push(synth);
    return synth;
  }

  private scheduleMetronome(project: Project) {
    if (!project.metronomeOn) return;
    const click = this.createClickSynth();
    const barBeats = barLengthBeats(project.timeSignature);
    const pattern = metronomeClickPattern(project.timeSignature);

    for (let bar = 0; bar * barBeats <= this.lengthBeats; bar += 1) {
      for (const step of pattern) {
        const atBeat = bar * barBeats + step.offsetBeats;
        if (atBeat > this.lengthBeats) break;
        const sound = clickNote(step.accent);
        const id = Tone.Transport.schedule((time) => {
          click.triggerAttackRelease(sound.pitch, "32n", time, sound.velocity);
        }, tickTime(atBeat));
        this.scheduledIds.push(id);
      }
    }
  }

  private scheduleCountInClicks(project: Project, countInBars: number) {
    const click = this.createClickSynth();
    const barBeats = barLengthBeats(project.timeSignature);
    const pattern = metronomeClickPattern(project.timeSignature);
    const millisecondsPerBeat = secondsPerBeat(project.bpm) * 1000;

    for (let bar = 0; bar < countInBars; bar += 1) {
      for (const step of pattern) {
        const sound = clickNote(step.accent);
        const offsetBeats = bar * barBeats + step.offsetBeats;
        const timeoutId = window.setTimeout(() => {
          click.triggerAttackRelease(sound.pitch, "32n", undefined, sound.velocity);
        }, offsetBeats * millisecondsPerBeat);
        this.countInTimeouts.push(timeoutId);
      }
    }
  }

  private scheduleLoopClip(project: Project, clip: Clip, channel: Tone.Channel) {
    const loop = getLoopById(clip.loopId);
    if (!loop) return;

    if (loop.category === "Drums") {
      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.025,
        octaves: 7,
        envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.2 }
      }).connect(channel);
      const snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
      }).connect(channel);
      const hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
        harmonicity: 5.1,
        modulationIndex: 20,
        resonance: 2800,
        octaves: 1
      }).connect(channel);
      this.nodes.push(kick, snare, hat);

      this.scheduleRepeatedLoop(clip, loop.lengthBeats, project.key, (absoluteBeat, step) => {
        const id = Tone.Transport.schedule((time) => {
          const velocity = step.velocity ?? 0.75;
          if (step.drum === "kick") kick.triggerAttackRelease("C1", "8n", time, velocity);
          if (step.drum === "snare" || step.drum === "clap") snare.triggerAttackRelease("16n", time, velocity);
          if (step.drum === "hat") hat.triggerAttackRelease("32n", time, velocity * 0.5);
        }, tickTime(absoluteBeat));
        this.scheduledIds.push(id);
      });
      return;
    }

    const synth =
      loop.category === "Bass"
        ? new Tone.MonoSynth({
            oscillator: { type: "square" },
            filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
            envelope: { attack: 0.01, decay: 0.15, sustain: 0.45, release: 0.1 },
            filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.2, baseFrequency: 90, octaves: 2.5 }
          }).connect(channel)
        : new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: loop.category === "FX" ? "triangle" : "sine" },
            envelope: { attack: 0.02, decay: 0.12, sustain: 0.5, release: 0.4 }
          }).connect(channel);

    this.nodes.push(synth);
    this.scheduleRepeatedLoop(clip, loop.lengthBeats, project.key, (absoluteBeat, step) => {
      if (!step.note) return;
      const id = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(
          step.note!,
          beatDuration(step.durationBeats ?? 0.25),
          time,
          step.velocity ?? 0.7
        );
      }, tickTime(absoluteBeat));
      this.scheduledIds.push(id);
    });
  }

  private scheduleRepeatedLoop(
    clip: Clip,
    loopLengthBeats: number,
    projectKey: string | undefined,
    schedule: (absoluteBeat: number, step: NonNullable<ReturnType<typeof getLoopById>>["pattern"][number]) => void
  ) {
    const loop = getLoopById(clip.loopId);
    if (!loop) return;
    const pattern = resolveLoopPattern(loop, projectKey);
    for (let offset = 0; offset < clip.lengthBeats; offset += loopLengthBeats) {
      pattern.forEach((step) => {
        const absoluteBeat = clip.startBeat + offset + step.beat;
        if (absoluteBeat < clip.startBeat + clip.lengthBeats) {
          schedule(absoluteBeat, step);
        }
      });
    }
  }

  private async scheduleMidiClip(
    track: Pick<Track, "type" | "role" | "instrumentId">,
    clip: Clip,
    channel: Tone.Channel,
    generation = this.generation,
    signal = this.sampleLoadController.signal,
    forceSynth = false
  ) {
    if (track.type === "drum" || track.role === "beat" || track.role === "drummer") {
      this.scheduleDrumMidiClip(clip, channel);
      return;
    }

    let voice;
    try {
      voice = await createInstrumentVoice(track.instrumentId, channel, signal, forceSynth);
    } catch (error) {
      if (generation !== this.generation || signal.aborted) return;
      throw error;
    }
    if (generation !== this.generation || signal.aborted) {
      voice.dispose();
      return;
    }
    this.nodes.push(...voice.nodes);

    (clip.notes ?? []).forEach((note) => {
      const absoluteBeat = clip.startBeat + note.startBeat;
      if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
      const id = Tone.Transport.schedule((time) => {
        voice.trigger(
          note.pitch,
          beatDuration(note.durationBeats),
          time,
          note.velocity
        );
      }, tickTime(absoluteBeat));
      this.scheduledIds.push(id);
    });
  }

  private scheduleDrumMidiClip(clip: Clip, channel: Tone.Channel) {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.2 }
    }).connect(channel);
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
    }).connect(channel);
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 2800,
      octaves: 1
    }).connect(channel);
    this.nodes.push(kick, snare, hat);

    (clip.notes ?? []).forEach((note) => {
      const absoluteBeat = clip.startBeat + note.startBeat;
      if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
      const id = Tone.Transport.schedule((time) => {
        if (note.pitch <= 36) kick.triggerAttackRelease("C1", "8n", time, note.velocity);
        else if (note.pitch <= 40) snare.triggerAttackRelease("16n", time, note.velocity);
        else hat.triggerAttackRelease("32n", time, note.velocity * 0.55);
      }, tickTime(absoluteBeat));
      this.scheduledIds.push(id);
    });
  }

  private async scheduleAudioClip(
    project: Project,
    clip: Clip,
    channel: Tone.Channel,
    generation = this.generation,
    startBeat?: number
  ) {
    const source = await createClipAudioUrl(clip);
    if (!source) return;
    if (generation !== this.generation) {
      source.revoke?.();
      return;
    }
    const gain = new Tone.Gain(clipGain(clip)).connect(channel);
    const player = new Tone.Player({ fadeIn: 0, fadeOut: 0 }).connect(gain);
    try {
      await player.load(source.url);
      if (generation !== this.generation) {
        player.dispose();
        gain.dispose();
        source.revoke?.();
        return;
      }
      this.nodes.push(gain, player);
      this.players.add(player);
      if (source.revoke) this.audioUrlCleanups.push(source.revoke);
      const baseGain = clipGain(clip);

      const scheduleAt = (entryBeat: number, once: boolean) => {
        const segment = resolveClipAudioSegment(clip, project.bpm, player.buffer.duration, entryBeat);
        if (segment.durationSeconds <= 0) return;
        const availableSeconds = this.cycleEnabled
          ? Math.max(0, (this.cycleEnd - entryBeat) * secondsPerBeat(project.bpm))
          : segment.durationSeconds;
        const durationSeconds = Math.min(segment.durationSeconds, availableSeconds);
        if (durationSeconds <= 0) return;

        const callback = (time: number) => {
          const clippedByCycle = durationSeconds < segment.durationSeconds;
          const cutFade = clippedByCycle ? Math.min(0.005, durationSeconds / 2) : 0;
          const lastEnvelopePoint = durationSeconds - cutFade;
          const fadeInEnd = Math.min(segment.fadeInSeconds, lastEnvelopePoint);
          const fadeOutStart = segment.durationSeconds - segment.fadeOutSeconds;
          const points = [0, fadeInEnd, fadeOutStart, lastEnvelopePoint]
            .filter((point) => point >= 0 && point <= lastEnvelopePoint)
            .sort((left, right) => left - right)
            .filter((point, index, all) => index === 0 || point > all[index - 1]);
          const parameter = gain.gain;
          parameter.cancelScheduledValues(time);
          points.forEach((point, index) => {
            const value = baseGain * segmentGainAt(segment, point);
            if (index === 0) parameter.setValueAtTime(value, time);
            else parameter.linearRampToValueAtTime(value, time + point);
          });
          if (clippedByCycle) {
            parameter.linearRampToValueAtTime(0, time + durationSeconds);
          }
          player.playbackRate = segment.playbackRate;
          player.start(time, segment.offsetSeconds, durationSeconds * segment.playbackRate);
        };
        const id = once
          ? Tone.Transport.scheduleOnce(callback, tickTime(entryBeat))
          : Tone.Transport.schedule(callback, tickTime(entryBeat));
        this.scheduledIds.push(id);
      };

      const entryBeat = this.cycleEnabled ? Math.max(this.cycleStart, clip.startBeat) : clip.startBeat;
      if (!this.cycleEnabled || entryBeat < this.cycleEnd) scheduleAt(entryBeat, false);
      if (startBeat !== undefined && startBeat > entryBeat && startBeat < clip.startBeat + clip.lengthBeats) {
        scheduleAt(startBeat, true);
      }
    } catch (error) {
      if (generation === this.generation) logError("AudioEngine.scheduleAudioClip", error);
      this.players.delete(player);
      player.dispose();
      gain.dispose();
      source.revoke?.();
    }
  }

  private getMasterLevel() {
    const value = this.masterMeter?.getValue();
    const level = Array.isArray(value) ? Math.max(...value) : value;
    const finiteLevel = typeof level === "number" && Number.isFinite(level) ? level : 0;
    return Math.max(0, Math.min(1, finiteLevel));
  }

  private startBeatLoop(onBeat: BeatCallback, onEnded: EndCallback, onMeter: MeterCallback | undefined, generation: number) {
    const loop = () => {
      if (generation !== this.generation) return;
      const beat = Tone.Transport.ticks / PPQ;
      onBeat(beat);
      onMeter?.(this.getMasterLevel());
      if (!this.cycleEnabled && beat >= this.lengthBeats + 0.1) {
        this.stop();
        onBeat(0);
        onMeter?.(0);
        onEnded();
        return;
      }
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }
}

let singleton: AudioEngine | undefined;

export function getAudioEngine() {
  singleton ??= new AudioEngine();
  return singleton;
}
