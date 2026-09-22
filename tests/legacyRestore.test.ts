import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalProjectRepository } from "../src/db/localRepositories";
import { CURRENT_PROJECT_VERSION, type Project } from "../src/types/project";

const database = vi.hoisted(() => ({
  projects: { get: vi.fn() },
  metadata: { get: vi.fn() }
}));

vi.mock("../src/db/projectsDb", () => ({ db: database }));

// This shape matches the original MVP Project/Track/Clip schema at 6cf8ffe:
// it predates the version field, roles, cycle, effects, and lesson metadata.
const originalProject = {
  id: "original-class-project",
  name: "오래된 수업 작품",
  bpm: 96,
  timeSignature: [3, 4],
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  tracks: [{
    id: "original-track",
    name: "멜로디",
    type: "instrument",
    volume: 0.7,
    pan: 0,
    muted: false,
    solo: false,
    color: "#a78bfa",
    clips: [{
      id: "original-clip",
      trackId: "original-track",
      type: "midi",
      name: "첫 악절",
      startBeat: 3,
      lengthBeats: 3,
      color: "#a78bfa",
      notes: [{ id: "original-note", pitch: 64, startBeat: 0, durationBeats: 1, velocity: 0.8 }]
    }]
  }]
} as unknown as Project;

describe("original project repository restore", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads the last-project pointer and migrates an original stored project", async () => {
    database.metadata.get.mockResolvedValue({ key: "lastProjectId", value: originalProject.id });
    database.projects.get.mockResolvedValue(originalProject);

    const restored = await new LocalProjectRepository().loadLastProject();

    expect(database.metadata.get).toHaveBeenCalledWith("lastProjectId");
    expect(database.projects.get).toHaveBeenCalledWith(originalProject.id);
    expect(restored).toMatchObject({
      id: originalProject.id,
      version: CURRENT_PROJECT_VERSION,
      name: originalProject.name,
      bpm: 96,
      timeSignature: [3, 4],
      createdAt: originalProject.createdAt,
      updatedAt: originalProject.updatedAt,
      tracks: [{
        id: "original-track",
        role: "melody",
        clips: [{
          id: "original-clip",
          trackId: "original-track",
          startBeat: 3,
          lengthBeats: 3,
          notes: [{ id: "original-note", pitch: 64, startBeat: 0, durationBeats: 1, velocity: 0.8 }]
        }]
      }]
    });
  });

  it("does not invent a project when the last-project pointer is missing", async () => {
    database.metadata.get.mockResolvedValue(undefined);

    expect(await new LocalProjectRepository().loadLastProject()).toBeUndefined();
    expect(database.projects.get).not.toHaveBeenCalled();
  });
});
