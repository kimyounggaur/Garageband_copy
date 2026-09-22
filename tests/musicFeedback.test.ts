import { describe, expect, it } from "vitest";
import { analyzeOptionalMusic, optionalMusicFeedback } from "../src/education/musicFeedback";
import { summarizeLesson } from "../src/education/evaluateMission";
import { LESSONS } from "../src/education/lessons";
import { createReviewSummary } from "../src/education/reviewProject";
import { effectiveDecision, effectiveStatusLabel, withTeacherDecision } from "../src/education/teacherReview";
import { clip, project, track } from "./fixtures";

const notes = (pitches: number[], starts = pitches.map((_, index) => index * 0.5)) =>
  pitches.map((pitch, index) => ({
    id: `note-${index}`,
    pitch,
    startBeat: starts[index],
    durationBeats: 0.5,
    velocity: 0.7
  }));

describe("optional, descriptive music feedback", () => {
  it("counts C major and A minor notes without treating chromatic notes as mistakes", () => {
    const melody = track({ clips: [clip({ notes: notes([60, 64, 67, 61]) })] });
    const major = analyzeOptionalMusic(project({ key: "C", scale: "major", tracks: [melody] }));
    expect(major.scale).toMatchObject({ key: "C", mode: "major", inScale: 3, total: 4 });

    const minor = analyzeOptionalMusic(project({
      key: "Am", scale: "minor",
      tracks: [track({ clips: [clip({ notes: notes([57, 60, 64, 68]) })] })]
    }));
    expect(minor.scale).toMatchObject({ key: "Am", mode: "minor", inScale: 3, total: 4 });

    const chromaticProject = project({ key: "C", scale: "chromatic", tracks: [melody] });
    expect(analyzeOptionalMusic(chromaticProject).scale.inScale).toBe(4);
    expect(optionalMusicFeedback(chromaticProject).scale).toContain("틀렸다고 판단하지 않습니다");
  });

  it("reports eighth-grid positions, range, and melodic motion as observations", () => {
    const result = analyzeOptionalMusic(project({
      tracks: [track({ clips: [clip({ notes: notes([60, 62, 67, 67], [0, 0.5, 1.25, 1.25]) })] })]
    }));
    expect(result.rhythm).toMatchObject({ eighthGridBeats: 0.5, aligned: 2, total: 4 });
    expect(result.rangeSemitones).toBe(7);
    expect(result.adjacentMotion).toEqual({ steps: 1, pairs: 2 });
  });

  it("compares actual A/B participation and density using the meter", () => {
    const arrangement = project({
      timeSignature: [6, 8],
      tracks: [
        track({ id: "beat", type: "drum", role: "beat", clips: [clip({ id: "a", trackId: "beat", type: "loop", startBeat: 0, lengthBeats: 12, notes: undefined })] }),
        track({ id: "melody", role: "melody", clips: [clip({ id: "b", trackId: "melody", startBeat: 12, lengthBeats: 12, notes: notes([60, 62, 64]) })] })
      ]
    });
    expect(analyzeOptionalMusic(arrangement).sections).toMatchObject({
      barBeats: 3, aRoles: ["beat"], bRoles: ["melody"], aNotes: 0, bNotes: 3
    });
    expect(optionalMusicFeedback(arrangement).sections).toContain("참여 악기 역할 비트→멜로디, 미디 음 0→3개");
  });

  it("leaves the five existing lesson mission results based on their original checks", () => {
    expect(LESSONS).toHaveLength(5);
    const before = LESSONS.map((lesson) => summarizeLesson(lesson.templateProject, lesson));
    expect(LESSONS.map((lesson, index) => [lesson.id, before[index].completed, before[index].total])).toEqual([
      ["drum-foundation", 0, 2],
      ["bass-layer", 0, 2],
      ["melody-sketch", 1, 2],
      ["song-structure", 0, 2],
      ["recording-layer", 0, 2]
    ]);
    LESSONS.forEach((lesson) => { optionalMusicFeedback(lesson.templateProject); });
    const after = LESSONS.map((lesson) => summarizeLesson(lesson.templateProject, lesson));
    expect(after).toEqual(before);
  });

  it("lets a teacher override or ignore an automatic submission decision without changing its evidence", () => {
    const automatic = createReviewSummary(project());
    const originalItems = automatic.items;
    const ready = withTeacherDecision(automatic, "ready", 1234);
    expect(effectiveDecision(ready)).toBe("ready");
    expect(effectiveStatusLabel(ready)).toBe("교사 확인: 제출 가능");
    expect(ready.items).toBe(originalItems);
    const ignored = withTeacherDecision(ready, "ignore", 1235);
    expect(effectiveDecision(ignored)).toBe("ignore");
    expect(effectiveStatusLabel(ignored)).toBe("교사 검토 중");
    expect(withTeacherDecision(ignored, "auto")).toEqual(automatic);
  });
});
