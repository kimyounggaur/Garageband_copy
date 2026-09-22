import { describe, expect, it } from "vitest";
import {
  buildSmartControlPatch, gainToDb, mergeTrackFx, mergeTrackSends,
  normalizeMasterFx, normalizeTrackFx, normalizeTrackSends,
  resolveProjectMasterFx, resolveSmartControlMacros, resolveTrackAudibleGain, resolveTrackMute
} from "../src/audio/fx";

describe("mixer effect normalization", () => {
  it("fills defaults and clamps invalid sends and FX", () => {
    expect(normalizeTrackSends()).toEqual({ reverb: 0, delay: 0 });
    expect(normalizeTrackSends({ reverb: 1.25, delay: Number.NaN })).toEqual({ reverb: 1, delay: 0 });
    expect(normalizeTrackFx()).toEqual({ eq: { low: 0, mid: 0, high: 0 }, comp: { threshold: -24, ratio: 2 } });
    expect(normalizeTrackFx({ eq: { low: -30, mid: 0.123456, high: 30 }, comp: { threshold: -70, ratio: 30 } }))
      .toEqual({ eq: { low: -24, mid: 0.1235, high: 24 }, comp: { threshold: -60, ratio: 20 } });
  });

  it("normalizes master, including legacy volume fallback", () => {
    expect(normalizeMasterFx({ volume: 2, limiterOn: false, reverb: -1, delay: 2 }))
      .toEqual({ volume: 1, limiterOn: false, reverb: 0, delay: 1 });
    expect(resolveProjectMasterFx({ masterVolume: 0.3 })).toEqual({ volume: 0.3, limiterOn: true, reverb: 0.25, delay: 0.18 });
    expect(resolveProjectMasterFx({ master: { volume: 0.5 }, masterVolume: 0.3 }).volume).toBe(0.5);
  });

  it("resolves mute and audible gain under solo", () => {
    const silent = { volume: 0.8, muted: true, solo: false };
    const solo = { volume: 1.5, muted: true, solo: true };
    expect(gainToDb(1)).toBe(0);
    expect(gainToDb(0)).toBe(-60);
    expect(gainToDb(0.5)).toBeCloseTo(-6.0206, 4);
    expect(resolveTrackMute(silent, false)).toBe(true);
    expect(resolveTrackMute(silent, true)).toBe(true);
    expect(resolveTrackMute(solo, true)).toBe(false);
    expect(resolveTrackAudibleGain(silent, false)).toBe(0);
    expect(resolveTrackAudibleGain(silent, true)).toBe(0);
    expect(resolveTrackAudibleGain(solo, true)).toBe(1);
  });

  it("merges nested sends and FX without losing other fields", () => {
    expect(mergeTrackSends({ reverb: 0.4, delay: 0.2 }, { delay: 0.9 }))
      .toEqual({ reverb: 0.4, delay: 0.9 });
    expect(mergeTrackFx(undefined, { eq: { low: 3, mid: 0, high: 0 } }).comp)
      .toEqual({ threshold: -24, ratio: 2 });
  });

  it("maps smart control macro values in both directions", () => {
    expect(buildSmartControlPatch("brightness", 1).fx?.eq).toEqual({ low: -6, mid: 0, high: 12 });
    expect(buildSmartControlPatch("space", 0.5).sends).toEqual({ reverb: 0.5, delay: 0.3 });
    expect(buildSmartControlPatch("punch", 1).fx?.comp).toEqual({ threshold: -6, ratio: 8 });
    expect(resolveSmartControlMacros({ sends: { reverb: 0.5, delay: 0.1 }, fx: { eq: { low: 0, mid: 0, high: 0 }, comp: { threshold: -24, ratio: 4.5 } } }))
      .toEqual({ brightness: 0.5, space: 0.5, punch: 0.5 });
  });
});
