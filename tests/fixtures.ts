import type { Clip, Project, Track } from "../src/types/project";
import { CURRENT_PROJECT_VERSION } from "../src/types/project";

export function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip-1",
    trackId: "track-1",
    type: "midi",
    name: "클립",
    startBeat: 0,
    lengthBeats: 4,
    color: "#fff",
    ...overrides
  };
}

export function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    name: "멜로디",
    type: "instrument",
    role: "melody",
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    color: "#fff",
    clips: [],
    ...overrides
  };
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    version: CURRENT_PROJECT_VERSION,
    name: "테스트 프로젝트",
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides
  };
}
