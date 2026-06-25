export type TrackType = "drum" | "instrument" | "audio";
export type TrackRole = "beat" | "bass" | "melody" | "harmony" | "recording";
export type ClipType = "midi" | "audio" | "loop";
export type LoopCategory = "Drums" | "Bass" | "Synth" | "FX";

export const CURRENT_PROJECT_VERSION = 3;

export type Project = {
  id: string;
  version: number;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: Track[];
  cycleStart?: number;
  cycleEnd?: number;
  cycleEnabled?: boolean;
  lessonId?: string;
  assignmentId?: string;
  classId?: string;
  studentId?: string;
  lessonProgress?: Record<string, MissionProgress>;
  createdAt: number;
  updatedAt: number;
};

export type AudioAsset = {
  id: string;
  projectId: string;
  name: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  createdAt: number;
};

export type MissionProgress = {
  completed: boolean;
  progress: number;
  target: number;
  completedAt?: number;
};

export type Track = {
  id: string;
  name: string;
  type: TrackType;
  role?: TrackRole;
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
  audioAssetId?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  gain?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  fadeInBeats?: number;
  fadeOutBeats?: number;
  loopId?: string;
  loopEnabled?: boolean;
  locked?: boolean;
  instructions?: string;
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
