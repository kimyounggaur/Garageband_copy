export type TrackType = "drum" | "instrument" | "audio";
export type ClipType = "midi" | "audio" | "loop";
export type LoopCategory = "Drums" | "Bass" | "Synth" | "FX";

export type Project = {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
};

export type Track = {
  id: string;
  name: string;
  type: TrackType;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
  clips: Clip[];
};

export type Clip = {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  startBeat: number;
  lengthBeats: number;
  color: string;
  notes?: MidiNote[];
  audioUrl?: string;
  loopId?: string;
};

export type MidiNote = {
  id: string;
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type LoopStep = {
  beat: number;
  durationBeats?: number;
  note?: string;
  drum?: "kick" | "snare" | "hat" | "clap" | "tom";
  velocity?: number;
};

export type LoopDefinition = {
  id: string;
  name: string;
  category: LoopCategory;
  trackType: TrackType;
  bpm: number;
  lengthBeats: number;
  color: string;
  description: string;
  audioUrl?: string;
  pattern: LoopStep[];
};
