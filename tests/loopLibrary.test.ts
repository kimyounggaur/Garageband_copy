import { beforeEach, describe, expect, it } from "vitest";
import { getLoopById, loopMatchSummary, resolveLoopPattern } from "../src/data/loops";
import { normalizeExportOptions } from "../src/audio/exportProject";
import { useDawStore } from "../src/store/useDawStore";
import { project } from "./fixtures";

describe("MIDI loop preview and placement", () => {
  beforeEach(() => {
    useDawStore.getState().loadProject(project({ key: "D", bpm: 120, timeSignature: [4, 4] }));
  });

  it("transposes the named C major progression for both preview and placement", () => {
    const source = getLoopById("chords-pop-c");
    expect(source).toBeDefined();
    const preview = resolveLoopPattern(source!, "D");
    expect(preview.filter((step) => step.beat === 0).map((step) => step.note).sort())
      .toEqual(["A4", "D4", "F#4"]);
    expect(preview.map((step) => step.beat)).toEqual(source!.pattern.map((step) => step.beat));

    const clipId = useDawStore.getState().addLoopClip(source!.id, undefined, 8);
    const clip = useDawStore.getState().project.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    expect(clip).toMatchObject({ loopId: source!.id, startBeat: 8, lengthBeats: 16 });
    expect(clip?.instructions).toContain("조성 C → D 전조");
    expect(clip?.instructions).toContain("템포 100 → 120 BPM");
  });

  it("keeps drums keyless and warns about a different meter or mode", () => {
    const drums = getLoopById("drums-grid")!;
    expect(drums.key).toBeUndefined();
    expect(loopMatchSummary(drums, { bpm: 120, key: "D", timeSignature: [4, 4] }).needsKeyMatch).toBe(false);

    const minor = getLoopById("bass-midnight")!;
    const mismatch = loopMatchSummary({ ...minor, timeSignature: [3, 4] }, { bpm: 120, key: "C", timeSignature: [4, 4] });
    expect(mismatch).toMatchObject({ needsMeterMatch: true, needsKeyMatch: true, keyConvertible: false });
    expect(mismatch.meterLabel).toContain("3/4 → 4/4");
  });

  it.each([
    ["drums-waltz-three", [3, 4], 6, 12],
    ["drums-six-eight", [6, 8], 3, 12],
    ["chords-six-eight-d", [6, 8], 6, 12],
    ["blues-twelve-bar", [4, 4], 48, 48]
  ] as const)("keeps %s in its own meter from preview through placement and full export", (loopId, meter, loopLength, exportEnd) => {
    const loop = getLoopById(loopId)!;
    const source = project({ timeSignature: [...meter], key: loop.key ?? "C" });
    useDawStore.getState().loadProject(source);
    expect(loop.timeSignature).toEqual(meter);

    const preview = resolveLoopPattern(loop, source.key);
    const clipId = useDawStore.getState().addLoopClip(loop.id, undefined, 0);
    const placedProject = useDawStore.getState().project;
    const placed = placedProject.tracks.flatMap((item) => item.clips).find((item) => item.id === clipId)!;
    expect(placed).toMatchObject({ loopId, startBeat: 0, lengthBeats: loopLength });
    expect(placed.instructions ?? "").not.toContain("박자표가 다릅니다");
    expect(resolveLoopPattern(getLoopById(placed.loopId)!, placedProject.key)).toEqual(preview);
    expect(normalizeExportOptions(placedProject).endBeat).toBe(exportEnd);
  });
});
