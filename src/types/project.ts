export type TrackType = "drum" | "instrument" | "audio";
export type TrackRole = "beat" | "drummer" | "bass" | "melody" | "harmony" | "recording";
export type ClipType = "midi" | "audio" | "loop";
export type LoopCategory = "Drums" | "Bass" | "Synth" | "FX";
export type LoopPlaybackType = "midi" | "audio";
export type InstrumentCategory = "Drums" | "Bass" | "Keys" | "Synths" | "FX";
export type ProjectScale = "major" | "minor" | "chromatic";

export const CURRENT_PROJECT_VERSION = 12;

export type TrackSends = {
  reverb?: number;
  delay?: number;
};

export type TrackFx = {
  eq?: {
    low: number;
    mid: number;
    high: number;
  };
  comp?: {
    threshold: number;
    ratio: number;
  };
};

export type MasterFx = {
  volume: number;
  limiterOn?: boolean;
  reverb?: number;
  delay?: number;
};

export type AutomationParam = "volume" | "pan" | "send.reverb" | "send.delay";

export type AutomationPoint = {
  id: string;
  beat: number;
  value: number;
};

export type TrackAutomation = {
  param: AutomationParam;
  points: AutomationPoint[];
};

export type LiveLoopScene = {
  id: string;
  name: string;
};

export type LiveLoopCell = {
  id: string;
  trackId: string;
  sceneId: string;
  type: ClipType;
  name: string;
  color: string;
  lengthBeats: number;
  loopId?: string;
  notes?: MidiNote[];
  audioUrl?: string;
  audioAssetId?: string;
};

export type LiveLoops = {
  scenes: LiveLoopScene[];
  cells: LiveLoopCell[];
  quantizeBeats?: number;
};

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
  key?: string;
  scale?: ProjectScale;
  metronomeOn?: boolean;
  countInBars?: number;
  masterVolume?: number;
  master?: MasterFx;
  liveLoops?: LiveLoops;
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
  instrumentId?: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  recordEnabled?: boolean;
  sends?: TrackSends;
  fx?: TrackFx;
  automation?: TrackAutomation[];
  color: string;
  clips: Clip[];
};

export type AudioTakeSection = {
  id: string;
  takeId: string;
  startBeat: number;
  lengthBeats: number;
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
  playbackRate?: number;
  pitchSemitones?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  fadeInBeats?: number;
  fadeOutBeats?: number;
  takeIds?: string[];
  activeTakeId?: string;
  takeSections?: AudioTakeSection[];
  loopId?: string;
  loopEnabled?: boolean;
  locked?: boolean;
  instructions?: string;
  drummerPreset?: string;
  drummerComplexity?: number;
  drummerLoudness?: number;
  drummerSwing?: number;
  drummerFills?: number;
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
  type: LoopPlaybackType;
  trackType: TrackType;
  key?: string;
  genre?: string;
  mood?: string[];
  bpm: number;
  lengthBeats: number;
  color: string;
  description: string;
  audioUrl?: string;
  pattern: LoopStep[];
};
