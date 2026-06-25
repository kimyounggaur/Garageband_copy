import type { MasterFx, Project, Track, TrackFx, TrackSends } from "../types/project";

export type SmartControlMacro = "brightness" | "space" | "punch";

export const DEFAULT_TRACK_SENDS: Required<TrackSends> = {
  reverb: 0,
  delay: 0
};

export const DEFAULT_TRACK_FX: Required<TrackFx> = {
  eq: {
    low: 0,
    mid: 0,
    high: 0
  },
  comp: {
    threshold: -24,
    ratio: 2
  }
};

export const DEFAULT_MASTER_FX: MasterFx = {
  volume: 0.85,
  limiterOn: true,
  reverb: 0.25,
  delay: 0.18
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function normalizeTrackSends(sends?: TrackSends): Required<TrackSends> {
  return {
    reverb: round(clamp(finiteNumber(sends?.reverb, DEFAULT_TRACK_SENDS.reverb), 0, 1)),
    delay: round(clamp(finiteNumber(sends?.delay, DEFAULT_TRACK_SENDS.delay), 0, 1))
  };
}

export function normalizeTrackFx(fx?: TrackFx): Required<TrackFx> {
  return {
    eq: {
      low: round(clamp(finiteNumber(fx?.eq?.low, DEFAULT_TRACK_FX.eq.low), -24, 24)),
      mid: round(clamp(finiteNumber(fx?.eq?.mid, DEFAULT_TRACK_FX.eq.mid), -24, 24)),
      high: round(clamp(finiteNumber(fx?.eq?.high, DEFAULT_TRACK_FX.eq.high), -24, 24))
    },
    comp: {
      threshold: round(clamp(finiteNumber(fx?.comp?.threshold, DEFAULT_TRACK_FX.comp.threshold), -60, 0)),
      ratio: round(clamp(finiteNumber(fx?.comp?.ratio, DEFAULT_TRACK_FX.comp.ratio), 1, 20))
    }
  };
}

export function normalizeMasterFx(master?: Partial<MasterFx>, fallbackVolume = DEFAULT_MASTER_FX.volume): MasterFx {
  return {
    volume: round(clamp(finiteNumber(master?.volume, fallbackVolume), 0, 1)),
    limiterOn: master?.limiterOn !== false,
    reverb: round(clamp(finiteNumber(master?.reverb, DEFAULT_MASTER_FX.reverb ?? 0.25), 0, 1)),
    delay: round(clamp(finiteNumber(master?.delay, DEFAULT_MASTER_FX.delay ?? 0.18), 0, 1))
  };
}

export function resolveProjectMasterFx(project: Pick<Project, "master" | "masterVolume">) {
  return normalizeMasterFx(project.master, project.masterVolume ?? DEFAULT_MASTER_FX.volume);
}

export function gainToDb(volume: number) {
  if (volume <= 0.001) return -60;
  return Math.max(-60, 20 * Math.log10(volume));
}

export function resolveTrackAudibleGain(track: Pick<Track, "volume" | "muted" | "solo">, hasSolo: boolean) {
  if (hasSolo) return track.solo ? clamp(track.volume, 0, 1) : 0;
  return track.muted ? 0 : clamp(track.volume, 0, 1);
}

export function resolveTrackMute(track: Pick<Track, "muted" | "solo">, hasSolo: boolean) {
  return hasSolo ? !track.solo : track.muted;
}

export function mergeTrackSends(current: TrackSends | undefined, patch: TrackSends) {
  return normalizeTrackSends({ ...normalizeTrackSends(current), ...patch });
}

export function mergeTrackFx(current: TrackFx | undefined, patch: TrackFx) {
  const base = normalizeTrackFx(current);
  return normalizeTrackFx({
    eq: { ...base.eq, ...patch.eq },
    comp: { ...base.comp, ...patch.comp }
  });
}

export function buildSmartControlPatch(macro: SmartControlMacro, value: number): { sends?: Required<TrackSends>; fx?: TrackFx } {
  const normalized = round(clamp(finiteNumber(value, 0), 0, 1));
  if (macro === "brightness") {
    return {
      fx: {
        eq: {
          low: round((0.5 - normalized) * 12),
          mid: 0,
          high: round(-12 + normalized * 24)
        }
      }
    };
  }
  if (macro === "space") {
    return {
      sends: normalizeTrackSends({
        reverb: normalized,
        delay: normalized * 0.6
      })
    };
  }
  return {
    fx: {
      comp: {
        threshold: round(-54 + normalized * 48),
        ratio: round(1 + normalized * 7)
      }
    }
  };
}

export function resolveSmartControlMacros(track: Pick<Track, "sends" | "fx">) {
  const sends = normalizeTrackSends(track.sends);
  const fx = normalizeTrackFx(track.fx);
  return {
    brightness: round(clamp((fx.eq.high + 12) / 24, 0, 1)),
    space: round(clamp(Math.max(sends.reverb, sends.delay / 0.6), 0, 1)),
    punch: round(clamp((fx.comp.ratio - 1) / 7, 0, 1))
  };
}
