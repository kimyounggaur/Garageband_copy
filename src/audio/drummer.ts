import type { MidiNote } from "../types/project";

export type DrummerPresetId = "Pop" | "Rock" | "Hip Hop" | "EDM" | "R&B";

type PresetDefinition = {
  id: DrummerPresetId;
  name: string;
  kick: number[];
  snare: number[];
  hatStep: number;
  hatPitch: 42 | 46;
  accent: number;
  syncopation: number[];
};

export type DrummerSettings = {
  preset: string;
  complexity: number;
  loudness: number;
  swing: number;
  fills: number;
  lengthBeats: number;
  seed?: number | string;
};

export const DRUMMER_PRESETS: PresetDefinition[] = [
  {
    id: "Pop",
    name: "Pop",
    kick: [0, 2],
    snare: [1, 3],
    hatStep: 0.5,
    hatPitch: 42,
    accent: 0.88,
    syncopation: [0.75, 2.75]
  },
  {
    id: "Rock",
    name: "Rock",
    kick: [0, 0.5, 2],
    snare: [1, 3],
    hatStep: 0.5,
    hatPitch: 46,
    accent: 0.96,
    syncopation: [2.5, 3.5]
  },
  {
    id: "Hip Hop",
    name: "Hip Hop",
    kick: [0, 1.75, 2.5],
    snare: [1, 3],
    hatStep: 0.5,
    hatPitch: 42,
    accent: 0.78,
    syncopation: [0.75, 2.25, 3.25]
  },
  {
    id: "EDM",
    name: "EDM",
    kick: [0, 1, 2, 3],
    snare: [1, 3],
    hatStep: 0.25,
    hatPitch: 46,
    accent: 0.92,
    syncopation: [0.5, 1.5, 2.5, 3.5]
  },
  {
    id: "R&B",
    name: "R&B",
    kick: [0, 1.5, 2.75],
    snare: [1, 3],
    hatStep: 0.5,
    hatPitch: 42,
    accent: 0.74,
    syncopation: [0.75, 1.75, 3.5]
  }
];

const DEFAULT_SETTINGS: DrummerSettings = {
  preset: "Pop",
  complexity: 0.55,
  loudness: 0.72,
  swing: 0.12,
  fills: 0.35,
  lengthBeats: 16,
  seed: 0
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function roundBeat(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundVelocity(value: number) {
  return Math.round(clamp(value, 0.2, 1) * 100) / 100;
}

function hashSeed(seed: number | string | undefined, preset: string) {
  const source = `${seed ?? 0}:${preset}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function presetById(preset: string) {
  return DRUMMER_PRESETS.find((item) => item.id === preset) ?? DRUMMER_PRESETS[0];
}

export function defaultDrummerSettings(): DrummerSettings {
  return { ...DEFAULT_SETTINGS };
}

export function normalizeDrummerSettings(settings: Partial<DrummerSettings> = {}): DrummerSettings {
  const preset = presetById(settings.preset ?? DEFAULT_SETTINGS.preset).id;
  return {
    preset,
    complexity: clamp(finiteNumber(settings.complexity, DEFAULT_SETTINGS.complexity), 0, 1),
    loudness: clamp(finiteNumber(settings.loudness, DEFAULT_SETTINGS.loudness), 0, 1),
    swing: clamp(finiteNumber(settings.swing, DEFAULT_SETTINGS.swing), 0, 1),
    fills: clamp(finiteNumber(settings.fills, DEFAULT_SETTINGS.fills), 0, 1),
    lengthBeats: Math.max(1, finiteNumber(settings.lengthBeats, DEFAULT_SETTINGS.lengthBeats)),
    seed: settings.seed ?? DEFAULT_SETTINGS.seed
  };
}

export function generateDrummerPattern(options: Partial<DrummerSettings> = {}): Array<Omit<MidiNote, "id">> {
  const settings = normalizeDrummerSettings(options);
  const preset = presetById(settings.preset);
  const random = randomFromSeed(hashSeed(settings.seed, `${settings.preset}:${settings.complexity}:${settings.fills}`));
  const notes = new Map<string, Omit<MidiNote, "id">>();
  const bars = Math.ceil(settings.lengthBeats / 4);
  const baseVelocity = 0.24 + settings.loudness * 0.66;

  function swingBeat(beat: number) {
    const eighth = Math.round(beat / 0.5);
    const isOffbeat = Math.abs(beat / 0.5 - eighth) < 0.001 && eighth % 2 === 1;
    return isOffbeat ? beat + settings.swing * 0.16 : beat;
  }

  function addNote(pitch: number, beat: number, velocity: number, durationBeats = 0.25, swingable = false) {
    const startBeat = roundBeat(clamp(swingable ? swingBeat(beat) : beat, 0, settings.lengthBeats - 0.0625));
    if (startBeat >= settings.lengthBeats) return;
    const key = `${pitch}:${startBeat}`;
    const nextNote = {
      pitch,
      startBeat,
      durationBeats: roundBeat(Math.max(0.0625, durationBeats)),
      velocity: roundVelocity(velocity)
    };
    const previous = notes.get(key);
    notes.set(key, previous && previous.velocity > nextNote.velocity ? previous : nextNote);
  }

  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * 4;

    preset.kick.forEach((beat) => {
      addNote(36, barStart + beat, baseVelocity * preset.accent, 0.35);
    });
    preset.snare.forEach((beat) => {
      addNote(38, barStart + beat, baseVelocity * 0.9, 0.25);
    });

    for (let beat = 0; beat < 4; beat += preset.hatStep) {
      const localBeat = barStart + beat;
      const accent = beat % 1 === 0 ? 0.66 : 0.48;
      addNote(preset.hatPitch, localBeat, baseVelocity * accent, 0.125, true);
      if (settings.complexity > 0.68 && preset.hatStep >= 0.5) {
        addNote(42, localBeat + 0.25, baseVelocity * 0.36, 0.1, true);
      }
    }

    preset.syncopation.forEach((beat) => {
      if (random() < settings.complexity * 0.72) {
        addNote(beat < 2 ? 36 : 42, barStart + beat, baseVelocity * (beat < 2 ? 0.72 : 0.42), 0.16, true);
      }
    });

    if (settings.complexity > 0.35 && random() < settings.complexity) {
      addNote(38, barStart + 3.75, baseVelocity * 0.34, 0.12, true);
    }

    const isPhraseEnd = bar % 2 === 1 || bar === bars - 1;
    if (isPhraseEnd && random() < settings.fills + settings.complexity * 0.25) {
      const fillCount = Math.max(1, Math.round(settings.fills * 4));
      const fillPitches = preset.id === "EDM" ? [39, 38, 46, 39] : [45, 47, 38, 45];
      for (let index = 0; index < fillCount; index += 1) {
        const beat = barStart + 3 + index * 0.25;
        addNote(fillPitches[index % fillPitches.length], beat, baseVelocity * (0.58 + index * 0.08), 0.14, true);
      }
    }
  }

  return [...notes.values()].sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch);
}
