import * as Tone from "tone";
import { getLoopById } from "../data/loops";
import type { Clip, Project } from "../types/project";
import { normalizeCountInBars, normalizeMasterVolume } from "../utils/transport";
import { clipGain, createClipAudioUrl, resolveClipAudioTiming, resolveClipFadeDurations } from "./clipAudio";

type BeatCallback = (beat: number) => void;
type EndCallback = () => void;
type MeterCallback = (level: number) => void;
type PlayOptions = {
  countIn?: boolean;
  onMeter?: MeterCallback;
};

const PPQ = 192;

function gainToDb(volume: number) {
  if (volume <= 0.001) return -60;
  return Math.max(-60, 20 * Math.log10(volume));
}

function tickTime(beat: number) {
  return `${Math.max(0, Math.round(beat * PPQ))}i`;
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
  const end = project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats);
  }, 16);
  return Math.max(16, end);
}

export class AudioEngine {
  private channels = new Map<string, Tone.Channel>();
  private nodes: Tone.ToneAudioNode[] = [];
  private scheduledIds: number[] = [];
  private audioUrlCleanups: Array<() => void> = [];
  private countInTimeouts: number[] = [];
  private masterOutput?: Tone.Gain;
  private masterMeter?: Tone.Meter;
  private frameId = 0;
  private lengthBeats = 16;
  private cycleEnabled = false;

  async play(project: Project, onBeat: BeatCallback, onEnded: EndCallback, options: PlayOptions = {}) {
    await Tone.start();
    this.stop();

    Tone.Transport.PPQ = PPQ;
    Tone.Transport.bpm.value = project.bpm;
    const cycleStart = Math.max(0, project.cycleStart ?? 0);
    const cycleEnd = Math.max(cycleStart + 0.25, project.cycleEnd ?? cycleStart + 0.25);
    this.cycleEnabled = Boolean(project.cycleEnabled && cycleEnd > cycleStart);
    Tone.Transport.loop = this.cycleEnabled;
    Tone.Transport.loopStart = tickTime(cycleStart);
    Tone.Transport.loopEnd = tickTime(cycleEnd);
    Tone.Transport.position = this.cycleEnabled ? tickTime(cycleStart) : 0;
    Tone.Transport.cancel(0);

    this.lengthBeats = this.cycleEnabled ? cycleEnd : projectLength(project);
    this.createMasterOutput(project);
    this.createChannels(project);
    await this.scheduleProject(project);
    this.scheduleMetronome(project);
    await Tone.loaded();
    const countInBeats = options.countIn ? normalizeCountInBars(project.countInBars) * Math.max(1, project.timeSignature[0]) : 0;
    const delaySeconds = countInBeats * (60 / Math.max(1, project.bpm));
    if (countInBeats > 0) this.scheduleCountInClicks(project, countInBeats);
    this.startBeatLoop(onBeat, onEnded, options.onMeter);
    Tone.Transport.start(`+${delaySeconds + 0.04}`);
  }

  stop() {
    cancelAnimationFrame(this.frameId);
    this.countInTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.countInTimeouts = [];
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.loop = false;
    this.cycleEnabled = false;
    this.scheduledIds = [];
    this.nodes.forEach((node) => node.dispose());
    this.nodes = [];
    this.channels.forEach((channel) => channel.dispose());
    this.channels.clear();
    this.masterOutput = undefined;
    this.masterMeter = undefined;
    this.audioUrlCleanups.forEach((cleanup) => cleanup());
    this.audioUrlCleanups = [];
  }

  updateTrackControls(project: Project) {
    if (this.masterOutput) {
      this.masterOutput.gain.value = normalizeMasterVolume(project.masterVolume);
    }
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const channel = this.channels.get(track.id);
      if (!channel) return;
      channel.volume.value = gainToDb(track.volume);
      channel.pan.value = track.pan;
      channel.mute = hasSolo ? !track.solo : track.muted;
    });
  }

  private createMasterOutput(project: Project) {
    this.masterOutput = new Tone.Gain(normalizeMasterVolume(project.masterVolume)).toDestination();
    this.masterMeter = new Tone.Meter({ normalRange: true, smoothing: 0.78 });
    this.masterOutput.connect(this.masterMeter);
    this.nodes.push(this.masterOutput, this.masterMeter);
  }

  private createChannels(project: Project) {
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const channel = new Tone.Channel({
        volume: gainToDb(track.volume),
        pan: track.pan,
        mute: hasSolo ? !track.solo : track.muted
      });
      if (this.masterOutput) channel.connect(this.masterOutput);
      else channel.toDestination();
      this.channels.set(track.id, channel);
      this.nodes.push(channel);
    });
  }

  private async scheduleProject(project: Project) {
    const audioLoads: Promise<void>[] = [];
    project.tracks.forEach((track) => {
      const channel = this.channels.get(track.id);
      if (!channel) return;

      track.clips.forEach((clip) => {
        if (clip.type === "loop") {
          this.scheduleLoopClip(clip, channel);
        }
        if (clip.type === "midi") {
          this.scheduleMidiClip(track, clip, channel);
        }
        if (clip.type === "audio") {
          audioLoads.push(this.scheduleAudioClip(project, clip, channel));
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
    const beatsPerBar = Math.max(1, project.timeSignature[0]);
    const endBeat = Math.ceil(this.lengthBeats);

    for (let beat = 0; beat <= endBeat; beat += 1) {
      const id = Tone.Transport.schedule((time) => {
        const strong = beat % beatsPerBar === 0;
        click.triggerAttackRelease(strong ? "C6" : "C5", "32n", time, strong ? 0.9 : 0.45);
      }, tickTime(beat));
      this.scheduledIds.push(id);
    }
  }

  private scheduleCountInClicks(project: Project, countInBeats: number) {
    const click = this.createClickSynth();
    const secondsPerBeat = 60 / Math.max(1, project.bpm);
    const beatsPerBar = Math.max(1, project.timeSignature[0]);

    for (let beat = 0; beat < countInBeats; beat += 1) {
      const timeoutId = window.setTimeout(() => {
        const strong = beat % beatsPerBar === 0;
        click.triggerAttackRelease(strong ? "C6" : "C5", "32n", undefined, strong ? 0.9 : 0.45);
      }, beat * secondsPerBeat * 1000);
      this.countInTimeouts.push(timeoutId);
    }
  }

  private scheduleLoopClip(clip: Clip, channel: Tone.Channel) {
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

      this.scheduleRepeatedLoop(clip, loop.lengthBeats, (absoluteBeat, step) => {
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
    this.scheduleRepeatedLoop(clip, loop.lengthBeats, (absoluteBeat, step) => {
      if (!step.note) return;
      const id = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(step.note!, beatDuration(step.durationBeats ?? 0.25), time, step.velocity ?? 0.7);
      }, tickTime(absoluteBeat));
      this.scheduledIds.push(id);
    });
  }

  private scheduleRepeatedLoop(
    clip: Clip,
    loopLengthBeats: number,
    schedule: (absoluteBeat: number, step: NonNullable<ReturnType<typeof getLoopById>>["pattern"][number]) => void
  ) {
    const loop = getLoopById(clip.loopId);
    if (!loop) return;
    for (let offset = 0; offset < clip.lengthBeats; offset += loopLengthBeats) {
      loop.pattern.forEach((step) => {
        const absoluteBeat = clip.startBeat + offset + step.beat;
        if (absoluteBeat < clip.startBeat + clip.lengthBeats) {
          schedule(absoluteBeat, step);
        }
      });
    }
  }

  private scheduleMidiClip(track: { type: string; role?: string }, clip: Clip, channel: Tone.Channel) {
    if (track.type === "drum" || track.role === "beat") {
      this.scheduleDrumMidiClip(clip, channel);
      return;
    }

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.58, release: 0.35 }
    }).connect(channel);
    this.nodes.push(synth);

    (clip.notes ?? []).forEach((note) => {
      const absoluteBeat = clip.startBeat + note.startBeat;
      if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
      const id = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(
          midiToNoteName(note.pitch),
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

  private async scheduleAudioClip(project: Project, clip: Clip, channel: Tone.Channel) {
    const source = await createClipAudioUrl(clip);
    if (!source) return;
    const gain = new Tone.Gain(clipGain(clip)).connect(channel);
    const player = new Tone.Player({
      url: source.url,
      fadeIn: 0,
      fadeOut: 0
    }).connect(gain);
    try {
      await player.load(source.url);
      this.nodes.push(gain, player);
      if (source.revoke) this.audioUrlCleanups.push(source.revoke);

      const timing = resolveClipAudioTiming(clip, project.bpm, player.buffer.duration);
      if (timing.durationSeconds <= 0) return;
      const fades = resolveClipFadeDurations(clip, timing.durationSeconds);
      player.fadeIn = fades.fadeInSeconds;
      player.fadeOut = fades.fadeOutSeconds;

      const id = Tone.Transport.schedule((time) => {
        player.start(time, timing.offsetSeconds, timing.durationSeconds);
      }, tickTime(clip.startBeat));
      this.scheduledIds.push(id);
    } catch {
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

  private startBeatLoop(onBeat: BeatCallback, onEnded: EndCallback, onMeter?: MeterCallback) {
    const loop = () => {
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
