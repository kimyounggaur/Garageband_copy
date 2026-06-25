import type { InstrumentCategory, TrackRole, TrackType } from "../types/project";

export type InstrumentPatch = {
  id: string;
  name: string;
  category: InstrumentCategory;
  iconKey: "drum" | "bass" | "keys" | "synth" | "fx";
  description: string;
  synth: {
    oscillator: "sine" | "triangle" | "square" | "sawtooth";
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
};

export const INSTRUMENT_PATCHES: InstrumentPatch[] = [
  {
    id: "studio-drum-kit",
    name: "Studio Drum Kit",
    category: "Drums",
    iconKey: "drum",
    description: "Tight kick, snare, and hat mapping for MIDI drum tracks.",
    synth: { oscillator: "square", attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.12 }
  },
  {
    id: "warm-analog-bass",
    name: "Warm Analog Bass",
    category: "Bass",
    iconKey: "bass",
    description: "Rounded mono-style bass for low melodic parts.",
    synth: { oscillator: "square", attack: 0.008, decay: 0.15, sustain: 0.44, release: 0.12 }
  },
  {
    id: "classic-electric-piano",
    name: "Classic Electric Piano",
    category: "Keys",
    iconKey: "keys",
    description: "Soft attack and clear sustain for chords and lessons.",
    synth: { oscillator: "triangle", attack: 0.018, decay: 0.18, sustain: 0.58, release: 0.36 }
  },
  {
    id: "bright-studio-keys",
    name: "Bright Studio Keys",
    category: "Keys",
    iconKey: "keys",
    description: "A clear keyboard patch for melodic hooks.",
    synth: { oscillator: "sine", attack: 0.01, decay: 0.12, sustain: 0.62, release: 0.28 }
  },
  {
    id: "glass-poly-synth",
    name: "Glass Poly Synth",
    category: "Synths",
    iconKey: "synth",
    description: "Clean arpeggios and bright layered textures.",
    synth: { oscillator: "sine", attack: 0.006, decay: 0.1, sustain: 0.48, release: 0.42 }
  },
  {
    id: "cinematic-pad",
    name: "Cinematic Pad",
    category: "Synths",
    iconKey: "synth",
    description: "Slow pad for long harmony beds and transitions.",
    synth: { oscillator: "sawtooth", attack: 0.16, decay: 0.3, sustain: 0.72, release: 0.9 }
  },
  {
    id: "soft-fx-tone",
    name: "Soft FX Tone",
    category: "FX",
    iconKey: "fx",
    description: "Simple tonal effects for risers and accents.",
    synth: { oscillator: "triangle", attack: 0.02, decay: 0.16, sustain: 0.34, release: 0.5 }
  }
];

export function getInstrumentPatch(instrumentId?: string) {
  return INSTRUMENT_PATCHES.find((patch) => patch.id === instrumentId) ?? INSTRUMENT_PATCHES[2];
}

export function instrumentPatchesByCategory() {
  const categories: InstrumentCategory[] = ["Drums", "Bass", "Keys", "Synths", "FX"];
  return categories.map((category) => ({
    category,
    patches: INSTRUMENT_PATCHES.filter((patch) => patch.category === category)
  }));
}

export function defaultInstrumentForTrack(track: { type?: TrackType; role?: TrackRole }) {
  if (track.type === "drum" || track.role === "beat") return "studio-drum-kit";
  if (track.role === "bass") return "warm-analog-bass";
  if (track.role === "harmony") return "classic-electric-piano";
  if (track.role === "melody") return "bright-studio-keys";
  return "classic-electric-piano";
}

export function normalizeInstrumentId(instrumentId: unknown, track: { type?: TrackType; role?: TrackRole } = {}) {
  return typeof instrumentId === "string" && INSTRUMENT_PATCHES.some((patch) => patch.id === instrumentId)
    ? instrumentId
    : defaultInstrumentForTrack(track);
}
