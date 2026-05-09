import * as Tone from "tone";
import { getLoopById } from "../data/loops";
import type { Clip, Project } from "../types/project";
import { clipGain, createClipAudioUrl, resolveClipAudioTiming } from "./clipAudio";

type BeatCallback = (beat: number) => void;
type EndCallback = () => void;

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
  private frameId = 0;
  private lengthBeats = 16;

  async play(project: Project, onBeat: BeatCallback, onEnded: EndCallback) {
    await Tone.start();
    this.stop();

    Tone.Transport.PPQ = PPQ;
    Tone.Transport.bpm.value = project.bpm;
    Tone.Transport.position = 0;
    Tone.Transport.cancel(0);

    this.lengthBeats = projectLength(project);
    this.createChannels(project);
    await this.scheduleProject(project);
    await Tone.loaded();
    this.startBeatLoop(onBeat, onEnded);
    Tone.Transport.start("+0.04");
  }

  stop() {
    cancelAnimationFrame(this.frameId);
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    this.scheduledIds = [];
    this.nodes.forEach((node) => node.dispose());
    this.nodes = [];
    this.channels.forEach((channel) => channel.dispose());
    this.channels.clear();
    this.audioUrlCleanups.forEach((cleanup) => cleanup());
    this.audioUrlCleanups = [];
  }

  updateTrackControls(project: Project) {
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const channel = this.channels.get(track.id);
      if (!channel) return;
      channel.volume.value = gainToDb(track.volume);
      channel.pan.value = track.pan;
      channel.mute = hasSolo ? !track.solo : track.muted;
    });
  }

  private createChannels(project: Project) {
    const hasSolo = project.tracks.some((track) => track.solo);
    project.tracks.forEach((track) => {
      const channel = new Tone.Channel({
        volume: gainToDb(track.volume),
        pan: track.pan,
        mute: hasSolo ? !track.solo : track.muted
      }).toDestination();
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
    if (source.revoke) this.audioUrlCleanups.push(source.revoke);

    const gain = new Tone.Gain(clipGain(clip)).connect(channel);
    const player = new Tone.Player({
      url: source.url,
      fadeIn: 0,
      fadeOut: 0
    }).connect(gain);
    this.nodes.push(gain, player);
    await player.load(source.url);

    const timing = resolveClipAudioTiming(clip, project.bpm, player.buffer.duration);
    if (timing.durationSeconds <= 0) return;
    player.fadeIn = Math.min(clip.fadeInSeconds ?? 0, timing.durationSeconds / 2);
    player.fadeOut = Math.min(clip.fadeOutSeconds ?? 0, timing.durationSeconds / 2);

    const id = Tone.Transport.schedule((time) => {
      player.start(time, timing.offsetSeconds, timing.durationSeconds);
    }, tickTime(clip.startBeat));
    this.scheduledIds.push(id);
  }

  private startBeatLoop(onBeat: BeatCallback, onEnded: EndCallback) {
    const loop = () => {
      const beat = Tone.Transport.ticks / PPQ;
      onBeat(beat);
      if (beat >= this.lengthBeats + 0.1) {
        this.stop();
        onBeat(0);
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
