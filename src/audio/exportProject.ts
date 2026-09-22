import { getLoopById, resolveLoopPattern } from "../data/loops";
import type { AutomationParam, Clip, LoopStep, Project, Track } from "../types/project";
import { automationBaseValue, automationValueAtBeat, normalizeTrackAutomation } from "./automation";
import { clipGain, resolveClipAudioSegment, segmentGainAt } from "./clipAudioMath";
import { normalizeTrackFx, normalizeTrackSends, resolveProjectMasterFx, resolveTrackAudibleGain } from "./fx";
import { normalizeProject } from "../utils/projectMigration";
import { barLengthBeats } from "../utils/meterMath";
import { logError } from "../utils/logger";
import { getInstrumentPatch } from "../data/instruments";
import { reportSampleFallback } from "./sampleNotice";
import { SAMPLE_PLAYBACK_GAIN, sampleLibrary, samplePlaybackRate, selectSampleForNote } from "./sampleLibrary";

const EXPORT_QUALITY = {
  standard: { sampleRate: 44100, bitDepth: 16 },
  high: { sampleRate: 48000, bitDepth: 24 }
} as const;
const TWO_PI = Math.PI * 2;

export type ExportQuality = "standard" | "high";
export type ExportRangeMode = "full" | "cycle";

export type ExportAudioOptions = {
  quality?: ExportQuality;
  range?: ExportRangeMode;
};

export type ResolvedExportOptions = {
  quality: ExportQuality;
  range: ExportRangeMode;
  startBeat: number;
  endBeat: number;
  sampleRate: 44100 | 48000;
  bitDepth: 16 | 24;
};

export type ExportAudioResult = {
  blob: Blob;
  fileName: string;
  format: "wav";
  mimeType: "audio/wav";
  sampleRate: 44100 | 48000;
  bitDepth: 16 | 24;
};

export class AudioExportError extends Error {
  readonly clipId: string;
  readonly clipName: string;

  constructor(clip: Pick<Clip, "id" | "name">) {
    super(`“${clip.name}” 오디오 클립을 내보내지 못했습니다.`);
    this.name = "AudioExportError";
    this.clipId = clip.id;
    this.clipName = clip.name;
  }
}

function beatSeconds(project: Project) {
  return 60 / Math.max(1, Number(project.bpm) || 120);
}

function projectEndBeat(project: Project) {
  return project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats);
  }, 0);
}

function projectDurationSeconds(project: Project, range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">) {
  return Math.max(0.25, range.endBeat - range.startBeat) * beatSeconds(project) + 1;
}

function clampBeat(value: unknown, fallback = 0) {
  const beat = Number(value ?? fallback);
  return Number.isFinite(beat) ? Math.max(0, beat) : fallback;
}

function safeBaseName(name: string) {
  return name.trim().replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^[.-]+|[.-]+$/g, "") || "webband-project";
}

function safeZipEntryName(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => safeBaseName(part))
    .filter(Boolean)
    .join("/");
}

export function resolveExportFileName(projectName: string, extension: string) {
  const cleanExtension = extension.replace(/^\.+/, "");
  return `${safeBaseName(projectName)}.${cleanExtension || "wav"}`;
}

export function normalizeExportOptions(project: Project, options: ExportAudioOptions = {}): ResolvedExportOptions {
  const quality = options.quality === "high" ? "high" : "standard";
  const fullEndBeat = Math.max(4 * barLengthBeats(project.timeSignature), projectEndBeat(project));
  const cycleStart = clampBeat(project.cycleStart, 0);
  const cycleEnd = clampBeat(project.cycleEnd, cycleStart);
  const useCycle = options.range === "cycle" && project.cycleEnabled && cycleEnd > cycleStart;

  return {
    quality,
    range: useCycle ? "cycle" : "full",
    startBeat: useCycle ? cycleStart : 0,
    endBeat: useCycle ? cycleEnd : fullEndBeat,
    ...EXPORT_QUALITY[quality]
  };
}

export function createProjectFileBlob(project: Project) {
  const normalized = normalizeProject(project);
  return new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
}

export async function parseProjectFile(file: Blob) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Project).tracks)) {
    throw new Error("Invalid WebBand project file.");
  }
  return normalizeProject(parsed as Project);
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

type OfflineMasterGraph = {
  input: GainNode;
  reverbInput: GainNode;
  delayInput: GainNode;
};

type OfflineTrackGraph = {
  input: GainNode;
  volume: AudioParam;
  pan: AudioParam;
  reverbSend: AudioParam;
  delaySend: AudioParam;
};

function createReverbImpulse(context: OfflineAudioContext) {
  const duration = 1.8;
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }
  }
  return buffer;
}

function createMasterGraph(context: OfflineAudioContext, project: Project): OfflineMasterGraph {
  const masterFx = resolveProjectMasterFx(project);
  const input = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const output = context.createGain();
  output.gain.value = masterFx.volume;
  limiter.threshold.value = masterFx.limiterOn === false ? 0 : -1;
  limiter.knee.value = masterFx.limiterOn === false ? 0 : 1;
  limiter.ratio.value = masterFx.limiterOn === false ? 1 : 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.08;
  input.connect(limiter).connect(output).connect(context.destination);

  const reverbInput = context.createGain();
  const convolver = context.createConvolver();
  const reverbReturn = context.createGain();
  convolver.buffer = createReverbImpulse(context);
  reverbReturn.gain.value = masterFx.reverb ?? 0;
  reverbInput.connect(convolver).connect(reverbReturn).connect(input);

  const delayInput = context.createGain();
  const delay = context.createDelay(2);
  const feedback = context.createGain();
  const delayReturn = context.createGain();
  delay.delayTime.value = beatSeconds(project) / 2;
  feedback.gain.value = 0.28;
  delayReturn.gain.value = masterFx.delay ?? 0;
  delayInput.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayReturn).connect(input);

  return { input, reverbInput, delayInput };
}

function connectTrackOutput(
  context: OfflineAudioContext,
  track: Track,
  master: OfflineMasterGraph,
  hasSolo: boolean
): OfflineTrackGraph {
  const input = context.createGain();
  const low = context.createBiquadFilter();
  const mid = context.createBiquadFilter();
  const high = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const pan = context.createStereoPanner();
  const gain = context.createGain();
  const reverbSend = context.createGain();
  const delaySend = context.createGain();
  const fx = normalizeTrackFx(track.fx);
  const sends = normalizeTrackSends(track.sends);

  low.type = "lowshelf";
  low.frequency.value = 180;
  low.gain.value = fx.eq.low;
  mid.type = "peaking";
  mid.frequency.value = 1100;
  mid.Q.value = 0.9;
  mid.gain.value = fx.eq.mid;
  high.type = "highshelf";
  high.frequency.value = 4200;
  high.gain.value = fx.eq.high;
  compressor.threshold.value = fx.comp.threshold;
  compressor.ratio.value = fx.comp.ratio;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.12;
  gain.gain.value = resolveTrackAudibleGain(track, hasSolo);
  pan.pan.value = track.pan;
  reverbSend.gain.value = sends.reverb;
  delaySend.gain.value = sends.delay;

  input.connect(low).connect(mid).connect(high).connect(compressor).connect(pan).connect(gain).connect(master.input);
  compressor.connect(reverbSend).connect(master.reverbInput);
  compressor.connect(delaySend).connect(master.delayInput);
  return { input, volume: gain.gain, pan: pan.pan, reverbSend: reverbSend.gain, delaySend: delaySend.gain };
}

function automationTarget(graph: OfflineTrackGraph, param: AutomationParam) {
  if (param === "volume") return graph.volume;
  if (param === "pan") return graph.pan;
  if (param === "send.reverb") return graph.reverbSend;
  return graph.delaySend;
}

function offlineAutomationValue(track: Track, param: AutomationParam, value: number, hasSolo: boolean) {
  if (param === "volume") return resolveTrackAudibleGain({ ...track, volume: value }, hasSolo);
  return value;
}

function scheduleOfflineTrackAutomation(
  context: OfflineAudioContext,
  project: Project,
  track: Track,
  graph: OfflineTrackGraph,
  hasSolo: boolean,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">
) {
  const beat = beatSeconds(project);
  normalizeTrackAutomation(track.automation).forEach((entry) => {
    if (entry.points.length === 0) return;
    const target = automationTarget(graph, entry.param);
    const baseValue = automationBaseValue(track, entry.param);
    target.setValueAtTime(
      offlineAutomationValue(track, entry.param, automationValueAtBeat(track, entry.param, range.startBeat, baseValue), hasSolo),
      0
    );

    entry.points.forEach((point, index) => {
      if (point.beat < range.startBeat || point.beat > range.endBeat) return;
      const time = Math.max(0, (point.beat - range.startBeat) * beat);
      const value = offlineAutomationValue(track, entry.param, point.value, hasSolo);
      if (index === 0 || point.beat <= entry.points[index - 1].beat) {
        target.setValueAtTime(value, time);
        return;
      }
      target.linearRampToValueAtTime(value, time);
    });
  });
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
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
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

function scheduleLoopClip(
  context: OfflineAudioContext,
  project: Project,
  output: AudioNode,
  clip: Clip,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">
) {
  const loop = getLoopById(clip.loopId);
  if (!loop) return;
  const beat = beatSeconds(project);
  const pattern = resolveLoopPattern(loop, project.key);

  for (let offset = 0; offset < clip.lengthBeats; offset += loop.lengthBeats) {
    pattern.forEach((step) => {
      const absoluteBeat = clip.startBeat + offset + step.beat;
      if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
      if (absoluteBeat < range.startBeat || absoluteBeat >= range.endBeat) return;
      const start = (absoluteBeat - range.startBeat) * beat;

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

function scheduleMidiDrumClip(
  context: OfflineAudioContext,
  project: Project,
  output: AudioNode,
  clip: Clip,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">
) {
  const beat = beatSeconds(project);
  (clip.notes ?? []).forEach((note) => {
    const absoluteBeat = clip.startBeat + note.startBeat;
    if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
    if (absoluteBeat < range.startBeat || absoluteBeat >= range.endBeat) return;
    const start = (absoluteBeat - range.startBeat) * beat;
    if (note.pitch <= 36) {
      scheduleDrumStep(context, output, { beat: 0, drum: "kick", velocity: note.velocity }, start);
    } else if (note.pitch <= 40) {
      scheduleDrumStep(context, output, { beat: 0, drum: "snare", velocity: note.velocity }, start);
    } else {
      scheduleDrumStep(context, output, { beat: 0, drum: "hat", velocity: note.velocity }, start);
    }
  });
}

function scheduleMidiClip(
  context: OfflineAudioContext,
  project: Project,
  output: AudioNode,
  clip: Clip,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">,
  oscillator: OscillatorType = "triangle"
) {
  const beat = beatSeconds(project);
  (clip.notes ?? []).forEach((note) => {
    const absoluteBeat = clip.startBeat + note.startBeat;
    if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
    if (absoluteBeat < range.startBeat || absoluteBeat >= range.endBeat) return;
    scheduleOscillator(
      context,
      output,
      midiToFrequency(note.pitch),
      (absoluteBeat - range.startBeat) * beat,
      note.durationBeats * beat,
      note.velocity * 0.26,
      oscillator
    );
  });
}

async function scheduleAudioClip(
  context: OfflineAudioContext,
  project: Project,
  output: AudioNode,
  clip: Clip,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">
) {
  const clipEndBeat = clip.startBeat + clip.lengthBeats;
  if (clipEndBeat <= range.startBeat || clip.startBeat >= range.endBeat) return;

  try {
    const { getClipAudioBlob } = await import("./clipAudio");
    const blob = await getClipAudioBlob(clip);
    if (!blob) throw new Error("오디오 원본이 없습니다.");
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer);
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error("오디오 길이를 확인할 수 없습니다.");
    }
    const beat = beatSeconds(project);
    const overlapStartBeat = Math.max(clip.startBeat, range.startBeat);
    const overlapEndBeat = Math.min(clipEndBeat, range.endBeat);
    const start = (overlapStartBeat - range.startBeat) * beat;
    const segment = resolveClipAudioSegment(clip, project.bpm, decoded.duration, overlapStartBeat);
    const duration = Math.min(segment.durationSeconds, Math.max(0, (overlapEndBeat - overlapStartBeat) * beat));
    if (duration <= 0) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = decoded;
    source.playbackRate.value = segment.playbackRate;
    const fadeInEnd = Math.min(segment.fadeInSeconds, duration);
    const fadeOutStart = segment.durationSeconds - segment.fadeOutSeconds;
    const points = [0, fadeInEnd, fadeOutStart, duration]
      .filter((point) => point >= 0 && point <= duration)
      .sort((left, right) => left - right)
      .filter((point, index, all) => index === 0 || point > all[index - 1]);
    const baseGain = clipGain(clip);
    points.forEach((point, index) => {
      const value = baseGain * segmentGainAt(segment, point);
      if (index === 0) gain.gain.setValueAtTime(value, start);
      else gain.gain.linearRampToValueAtTime(value, start + point);
    });
    if (duration < segment.durationSeconds) {
      const cutFade = Math.min(0.005, duration / 2);
      gain.gain.setValueAtTime(baseGain * segmentGainAt(segment, duration - cutFade), start + duration - cutFade);
      gain.gain.linearRampToValueAtTime(0, start + duration);
    }
    source.connect(gain).connect(output);
    source.start(start, segment.offsetSeconds, duration * segment.playbackRate);
    source.stop(start + duration);
  } catch (error) {
    logError("exportProject.scheduleAudioClip", error);
    throw new AudioExportError(clip);
  }
}

async function scheduleSampleMidiClip(
  context: OfflineAudioContext,
  project: Project,
  output: AudioNode,
  clip: Clip,
  range: Pick<ResolvedExportOptions, "startBeat" | "endBeat">,
  packId: string,
  fallbackOscillator: OscillatorType
) {
  let pack;
  try {
    pack = await sampleLibrary.loadPack(packId);
  } catch (error) {
    reportSampleFallback(error);
    scheduleMidiClip(context, project, output, clip, range, fallbackOscillator);
    return;
  }
  const beat = beatSeconds(project);
  (clip.notes ?? []).forEach((note) => {
    const absoluteBeat = clip.startBeat + note.startBeat;
    if (absoluteBeat >= clip.startBeat + clip.lengthBeats) return;
    if (absoluteBeat < range.startBeat || absoluteBeat >= range.endBeat) return;
    const selected = selectSampleForNote(pack, note.pitch, note.velocity);
    const rate = samplePlaybackRate(note.pitch, selected.file.note);
    const start = (absoluteBeat - range.startBeat) * beat;
    const holdDuration = Math.min(note.durationBeats * beat, (range.endBeat - absoluteBeat) * beat);
    const duration = Math.min(holdDuration + 0.005, selected.buffer.duration / rate);
    if (duration <= 0) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = selected.buffer;
    source.playbackRate.value = rate;
    const level = note.velocity * selected.file.gain * SAMPLE_PLAYBACK_GAIN;
    gain.gain.setValueAtTime(level, start);
    if (holdDuration < selected.buffer.duration / rate) {
      gain.gain.setValueAtTime(level, start + holdDuration);
      gain.gain.linearRampToValueAtTime(0, start + duration);
    }
    source.connect(gain).connect(output);
    source.start(start);
    source.stop(start + duration);
  });
}

export function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24 = 16) {
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const bytesPerFrame = 2 * (bitDepth / 8);
  const length = buffer.length * bytesPerFrame + 44;
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
  view.setUint32(28, buffer.sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      if (bitDepth === 16) {
        view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
        offset += 2;
      } else {
        const pcm = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(offset, pcm & 0xff);
        view.setUint8(offset + 1, (pcm >> 8) & 0xff);
        view.setUint8(offset + 2, (pcm >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

async function renderProjectToWav(project: Project, range: ResolvedExportOptions) {
  const duration = projectDurationSeconds(project, range);
  const context = new OfflineAudioContext(2, Math.ceil(duration * range.sampleRate), range.sampleRate);
  const master = createMasterGraph(context, project);

  const hasSolo = project.tracks.some((track) => track.solo);
  const audioSchedules: Promise<void>[] = [];
  project.tracks.forEach((track) => {
    const trackOutput = connectTrackOutput(context, track, master, hasSolo);
    scheduleOfflineTrackAutomation(context, project, track, trackOutput, hasSolo, range);
    track.clips.forEach((clip) => {
      if (clip.type === "loop") scheduleLoopClip(context, project, trackOutput.input, clip, range);
      if (clip.type === "midi") {
        if (track.type === "drum" || track.role === "beat") scheduleMidiDrumClip(context, project, trackOutput.input, clip, range);
        else {
          const patch = getInstrumentPatch(track.instrumentId);
          if (patch.samplePackId) audioSchedules.push(scheduleSampleMidiClip(context, project, trackOutput.input, clip, range, patch.samplePackId, patch.synth.oscillator));
          else scheduleMidiClip(context, project, trackOutput.input, clip, range);
        }
      }
      if (clip.type === "audio") audioSchedules.push(scheduleAudioClip(context, project, trackOutput.input, clip, range));
    });
  });

  await Promise.all(audioSchedules);
  const rendered = await context.startRendering();
  return encodeWav(rendered, range.bitDepth);
}

export async function exportProjectToWav(project: Project, options: ExportAudioOptions = {}) {
  return renderProjectToWav(project, normalizeExportOptions(project, options));
}

export async function exportProjectAudio(project: Project, options: ExportAudioOptions = {}): Promise<ExportAudioResult> {
  const resolved = normalizeExportOptions(project, options);
  const blob = await renderProjectToWav(project, resolved);
  return {
    blob,
    fileName: resolveExportFileName(project.name, "wav"),
    format: "wav",
    mimeType: "audio/wav",
    sampleRate: resolved.sampleRate,
    bitDepth: resolved.bitDepth
  };
}

function copyProjectForTrack(project: Project, track: Track): Project {
  return {
    ...project,
    tracks: [{ ...track, solo: false, muted: false }]
  };
}

export async function exportProjectStemsZip(project: Project, options: ExportAudioOptions = {}) {
  const range = normalizeExportOptions(project, options);
  const files = await Promise.all(
    project.tracks.map(async (track, index) => {
      const blob = await renderProjectToWav(copyProjectForTrack(project, track), range);
      return {
        name: `stems/${String(index + 1).padStart(2, "0")}-${safeBaseName(track.name)}.wav`,
        blob
      };
    })
  );
  return createStoredZipBlob(files);
}

function zipCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = zipCrcTable();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesPart(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytesPart(bytes);
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytesPart(bytes);
}

function zipLocalHeader(nameBytes: Uint8Array, dataBytes: Uint8Array, crc: number) {
  return new Blob([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(dataBytes.length),
    uint32(dataBytes.length),
    uint16(nameBytes.length),
    uint16(0),
    bytesPart(nameBytes)
  ]);
}

function zipCentralHeader(nameBytes: Uint8Array, dataBytes: Uint8Array, crc: number, offset: number) {
  return new Blob([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(dataBytes.length),
    uint32(dataBytes.length),
    uint16(nameBytes.length),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(offset),
    bytesPart(nameBytes)
  ]);
}

export async function createStoredZipBlob(files: Array<{ name: string; blob: Blob }>) {
  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: Blob[] = [];
  let offset = 0;

  for (const file of files) {
    const safeName = safeZipEntryName(file.name);
    if (!safeName) continue;
    const nameBytes = encoder.encode(safeName);
    const dataBytes = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(dataBytes);
    const localHeader = zipLocalHeader(nameBytes, dataBytes, crc);
    const centralHeader = zipCentralHeader(nameBytes, dataBytes, crc, offset);
    localParts.push(localHeader, bytesPart(dataBytes));
    centralParts.push(centralHeader);
    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((size, part) => size + part.size, 0);
  const entryCount = centralParts.length;
  return new Blob(
    [
      ...localParts,
      ...centralParts,
      uint32(0x06054b50),
      uint16(0),
      uint16(0),
      uint16(entryCount),
      uint16(entryCount),
      uint32(centralSize),
      uint32(offset),
      uint16(0)
    ],
    { type: "application/zip" }
  );
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
