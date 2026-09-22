import { describe, expect, it } from "vitest";
import { normalizeProject } from "../src/utils/projectMigration";
import { CURRENT_PROJECT_VERSION, type Project } from "../src/types/project";
import { clip, project, track } from "./fixtures";

describe("saved project normalization", () => {
  it.each(Array.from({ length: 12 }, (_, index) => index + 1))(
    "opens a version %i project and preserves its identity, timing, and clips",
    (version) => {
      const saved = project({
        version,
        bpm: 93,
        tracks: [track({ clips: [clip({ id: `clip-v${version}`, startBeat: version, lengthBeats: 2 })] })]
      });
      const migrated = normalizeProject(saved);
      expect(migrated).toMatchObject({
        id: "project-1",
        version: CURRENT_PROJECT_VERSION,
        bpm: 93,
        createdAt: 1000,
        updatedAt: 2000,
        tracks: [{ id: "track-1", clips: [{ id: `clip-v${version}`, trackId: "track-1", startBeat: version, lengthBeats: 2 }] }]
      });
      expect(migrated.cycleEnd).toBeGreaterThan(migrated.cycleStart ?? 0);
    }
  );

  it("normalizes recent transport, mixer, take, automation, and drummer fields", () => {
    const saved = project({
      bpm: 300,
      cycleStart: 8,
      cycleEnd: 4,
      cycleEnabled: true,
      key: "D",
      scale: "minor",
      metronomeOn: true,
      countInBars: 2,
      masterVolume: 0.4,
      master: { volume: 0.6, limiterOn: false, reverb: 0.3, delay: 0.2 },
      lessonId: "lesson-1",
      lessonProgress: { "mission-1": { completed: true, progress: 1, target: 1 } },
      tracks: [track({
        name: "Bass synth",
        role: "bass",
        volume: 3,
        pan: -3,
        recordEnabled: true,
        sends: { reverb: 3, delay: -1 },
        automation: [{ param: "volume", points: [{ id: "point-1", beat: 2, value: 0.4 }] }],
        clips: [clip({
          type: "audio", audioAssetId: "take-a", takeIds: ["take-a", "take-a", "take-b"],
          takeSections: [{ id: "section-a", takeId: "take-b", startBeat: 1, lengthBeats: 2 }],
          trimStartSeconds: 1, trimEndSeconds: 2, playbackRate: 8, pitchSemitones: 30,
          fadeInBeats: 1, fadeOutBeats: 2, loopEnabled: true
        })]
      })]
    });
    const migrated = normalizeProject(saved);
    expect(migrated).toMatchObject({
      bpm: 220, cycleStart: 8, cycleEnd: 8.25, cycleEnabled: true,
      key: "D", scale: "minor", metronomeOn: true, countInBars: 2,
      masterVolume: 0.6, lessonId: "lesson-1",
      lessonProgress: { "mission-1": { completed: true, progress: 1, target: 1 } },
      tracks: [{
        role: "bass", volume: 1, pan: -1, recordEnabled: false,
        sends: { reverb: 1, delay: 0 },
        automation: [{ param: "volume", points: [{ id: "point-1", beat: 2, value: 0.4 }] }],
        clips: [{
          activeTakeId: "take-a", takeIds: ["take-a", "take-b"],
          takeSections: [{ id: "section-a", takeId: "take-b", startBeat: 1, lengthBeats: 2 }],
          playbackRate: 4, pitchSemitones: 24, fadeInBeats: 1, fadeOutBeats: 2, loopEnabled: true
        }]
      }]
    });
  });

  it("repairs malformed legacy clips and infers track roles", () => {
    const legacy = project({ tracks: [
      track({ id: "drum", type: "drum", role: undefined, name: "Drums", clips: [clip({ id: "bad", type: "midi", notes: [
        { id: "note", pitch: 200, startBeat: -2, durationBeats: 0, velocity: 2 }
      ] })] }),
      track({ id: "record", type: "audio", role: undefined, name: "recording", clips: [] }),
      track({ id: "chord", role: undefined, name: "Chord pad", clips: [] }),
      track({ id: "melody", role: undefined, name: "Lead", clips: [] }),
      track({ id: "drummer", role: undefined, name: "드러머", clips: [] })
    ] });
    const normalized = normalizeProject(legacy);
    expect(normalized.tracks.map((entry) => entry.role)).toEqual(["beat", "recording", "harmony", "melody", "drummer"]);
    expect(normalized.tracks[0].clips[0].notes?.[0]).toEqual({ id: "note", pitch: 127, startBeat: 0, durationBeats: 0.25, velocity: 1 });
    expect(normalized.tracks[1].recordEnabled).toBe(false);
  });

  it("supplies missing legacy fields without dropping project identity", () => {
    const legacy = {
      id: "legacy",
      version: 1,
      tracks: [{ id: "legacy-track", type: "invalid", clips: [{ id: "legacy-clip", type: "invalid", startBeat: -4, lengthBeats: 0, gain: -2 }] }]
    } as unknown as Project;
    const migrated = normalizeProject(legacy);
    expect(migrated.id).toBe("legacy");
    expect(migrated.version).toBe(12);
    expect(migrated.name).toBe("새 프로젝트");
    expect(migrated.bpm).toBe(120);
    expect(migrated.tracks[0].type).toBe("instrument");
    expect(migrated.tracks[0].clips[0]).toMatchObject({ type: "midi", startBeat: 0, lengthBeats: 0.25, gain: 0 });
    expect(Number.isFinite(migrated.createdAt)).toBe(true);
  });
});
