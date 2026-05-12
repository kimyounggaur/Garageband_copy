import { getLoopById } from "../data/loops";
import type { Clip, LoopStep, Project, Track } from "../types/project";
import { clipGain, getClipAudioBlob, resolveClipAudioTiming, resolveClipFadeDurations } from "./clipAudio";

const SAMPLE_RATE = 44100;
const TWO_PI = Math.PI * 2;

function beatSeconds(project: Project) {
  return 60 / Math.max(1, Number(project.bpm) || 120);
}

function projectDurationSeconds(project: Project) {
  const endBeat = project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats);
  }, 16);
  return Math.max(16, endBeat) * beatSeconds(project) + 1;
}

function midiToFrequency(pitch: number) {
  return 440 * 2 ** ((pitch - 69) / 12);
}

function noteToFrequency(note: string) {
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  if (!match) return 440;
  const notes: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11
  };
  const [, name, octave] = match;
  return midiToFrequency((Number(octave) + 1) * 12 + notes[name]);
}

function connectTrackOutput(context: OfflineAudioContext, track: Track, destination: AudioNode, hasSolo: boolean) {
  const gain = context.createGain();
  const pan = context.createStereoPanner();
  gain.gain.value = hasSolo ? (track.solo ? track.volume : 0) : track.muted ? 0 : track.volume;
  pan.pan.value = track.pan;
  gain.connect(pan).connect(destination);
  return gain;
}

function scheduleOscillator(
  context: OfflineAudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = "sine"
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.02, duration));
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(start + Math.max(0.03, duration + 0.04));
}

function scheduleNoise(
  context: OfflineAudioContext,
  output: AudioNode,
  start: number,
  duration: number,
  gainValue: number,
  highpass = 900
) {
  const buffer = context.createBuffer(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(output);
  source.start(start);
  source.stop(start + duration);
}

function scheduleDrumStep(context: OfflineAudioContext, output: AudioNode, step: LoopStep, start: number) {
  const velocity = step.velocity ?? 0.75;
  if (step.drum === "kick") {
    scheduleOscillator(context, output, 80, start, 0.18, 0.65 * velocity, "sine");
    scheduleOscillator(context, output, 45, start + 0.025, 0.16, 0.5 * velocity, "sine");
  }
  if (step.drum === "snare" || step.drum === "clap") {
    scheduleNoise(context, output, start, 0.12, 0.28 * velocity, 700);
    scheduleOscillator(context, output, 190, start, 0.08, 0.18 * velocity, "triangle");
  }
  if (step.drum === "hat") {
    scheduleNoise(context, output, start, 0.045, 0.16 * velocity, 4200);
  }
}

function scheduleLoopClip(context: OfflineAudioContext, project: Project, output: AudioNode, clip: Clip) {
  const loop = getLoopById(clip.loopId);
  if (!loop) return;
  const beat = beatSeconds(project);

  for (let offset = 0; offset < clip.lengthBeats; offset += loop.lengthBeats) {
    loop.pattern.forEach((step) => {
      const absoluteBeat = clip.startBeat + offset + step.beat;
      if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
      const start = absoluteBeat * beat;

      if (step.drum) {
        scheduleDrumStep(context, output, step, start);
        return;
      }

      if (step.note) {
        scheduleOscillator(
          context,
          output,
          noteToFrequency(step.note),
          start,
          (step.durationBeats ?? 0.25) * beat,
          (step.velocity ?? 0.6) * 0.28,
          loop.category === "Bass" ? "square" : "triangle"
        );
      }
    });
  }
}

function scheduleMidiDrumClip(context: OfflineAudioContext, project: Project, output: AudioNode, clip: Clip) {
  const beat = beatSeconds(project);
  (clip.notes ?? []).forEach((note) => {
    const absoluteBeat = clip.startBeat + note.startBeat;
    if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
    const start = absoluteBeat * beat;
    if (note.pitch <= 36) {
      scheduleDrumStep(context, output, { beat: 0, drum: "kick", velocity: note.velocity }, start);
    } else if (note.pitch <= 40) {
      scheduleDrumStep(context, output, { beat: 0, drum: "snare", velocity: note.velocity }, start);
    } else {
      scheduleDrumStep(context, output, { beat: 0, drum: "hat", velocity: note.velocity }, start);
    }
  });
}

function scheduleMidiClip(context: OfflineAudioContext, project: Project, output: AudioNode, clip: Clip) {
  const beat = beatSeconds(project);
  (clip.notes ?? []).forEach((note) => {
    const absoluteBeat = clip.startBeat + note.startBeat;
    if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
    scheduleOscillator(
      context,
      output,
      midiToFrequency(note.pitch),
      absoluteBeat * beat,
      note.durationBeats * beat,
      note.velocity * 0.26,
      "triangle"
    );
  });
}

async function scheduleAudioClip(context: OfflineAudioContext, project: Project, output: AudioNode, clip: Clip) {
  try {
    const blob = await getClipAudioBlob(clip);
    if (!blob) return;
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const beat = beatSeconds(project);
    const start = clip.startBeat * beat;
    const timing = resolveClipAudioTiming(clip, project.bpm, decoded.duration);
    const duration = timing.durationSeconds;
    const clipGainValue = clipGain(clip);
    if (duration <= 0) return;

    source.buffer = decoded;
    const { fadeInSeconds: fadeIn, fadeOutSeconds: fadeOut } = resolveClipFadeDurations(clip, duration);
    gain.gain.setValueAtTime(fadeIn > 0 ? 0 : clipGainValue, start);
    if (fadeIn > 0) {
      gain.gain.linearRampToValueAtTime(clipGainValue, start + fadeIn);
    }
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(clipGainValue, Math.max(start + fadeIn, start + duration - fadeOut));
      gain.gain.linearRampToValueAtTime(0, start + duration);
    } else {
      gain.gain.setValueAtTime(clipGainValue, start + duration);
    }
    source.connect(gain).connect(output);
    source.start(start, timing.offsetSeconds, duration);
    source.stop(start + duration);
  } catch {
    // Skip unreadable imported audio while preserving the rest of the export.
  }
}

function encodeWav(buffer: AudioBuffer) {
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const length = buffer.length * 4 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

export async function exportProjectToWav(project: Project) {
  const duration = projectDurationSeconds(project);
  const context = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.value = 0.88;
  master.connect(context.destination);

  const hasSolo = project.tracks.some((track) => track.solo);
  const audioSchedules: Promise<void>[] = [];
  project.tracks.forEach((track) => {
    const trackOutput = connectTrackOutput(context, track, master, hasSolo);
    track.clips.forEach((clip) => {
      if (clip.type === "loop") scheduleLoopClip(context, project, trackOutput, clip);
      if (clip.type === "midi") {
        if (track.type === "drum" || track.role === "beat") scheduleMidiDrumClip(context, project, trackOutput, clip);
        else scheduleMidiClip(context, project, trackOutput, clip);
      }
      if (clip.type === "audio") audioSchedules.push(scheduleAudioClip(context, project, trackOutput, clip));
    });
  });

  await Promise.all(audioSchedules);
  const rendered = await context.startRendering();
  return encodeWav(rendered);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
