export type LcdMode = "beats" | "time" | "tuner";

export type TunerReading = {
  note: string;
  cents: number;
  frequency: number;
};

const LCD_MODES: LcdMode[] = ["beats", "time", "tuner"];
const PROJECT_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function nextLcdMode(mode: LcdMode): LcdMode {
  const index = LCD_MODES.indexOf(mode);
  return LCD_MODES[(index + 1) % LCD_MODES.length] ?? "beats";
}

export function normalizeProjectKey(key: unknown) {
  return typeof key === "string" && PROJECT_KEYS.includes(key) ? key : "C";
}

export function projectKeyOptions() {
  return PROJECT_KEYS;
}

export function normalizeTimeSignature(value: unknown): [number, number] {
  if (!Array.isArray(value)) return [4, 4];
  const beats = Number(value[0]);
  const noteValue = Number(value[1]);
  const validNoteValues = [2, 4, 8, 16];
  if (!Number.isInteger(beats) || beats < 1 || beats > 12) return [4, 4];
  if (!validNoteValues.includes(noteValue)) return [4, 4];
  return [beats, noteValue];
}

export function normalizeCountInBars(value: unknown) {
  const bars = Math.round(Number(value ?? 0));
  return Number.isFinite(bars) ? Math.max(0, Math.min(2, bars)) : 0;
}

export function normalizeMasterVolume(value: unknown, fallback = 0.85) {
  const volume = Number(value ?? fallback);
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : fallback;
}

export function masterVolumeToDb(volume: number) {
  const normalized = normalizeMasterVolume(volume, 0.85);
  if (normalized <= 0.001) return -60;
  return Math.max(-60, 20 * Math.log10(normalized));
}

export function estimateTapTempo(timestampsMs: number[]) {
  const ordered = timestampsMs.filter(Number.isFinite).slice(-5);
  if (ordered.length < 2) return undefined;
  const intervals = ordered
    .slice(1)
    .map((timestamp, index) => timestamp - ordered[index])
    .filter((interval) => interval >= 250 && interval <= 2000);
  if (intervals.length === 0) return undefined;
  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  return Math.round(Math.max(40, Math.min(220, 60000 / averageInterval)));
}

export function pitchToTunerReading(frequency: number): TunerReading {
  const safeFrequency = Math.max(1, frequency);
  const midi = Math.round(69 + 12 * Math.log2(safeFrequency / 440));
  const noteFrequency = 440 * 2 ** ((midi - 69) / 12);
  return {
    note: `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
    cents: Math.round(1200 * Math.log2(safeFrequency / noteFrequency)),
    frequency: safeFrequency
  };
}

export function detectPitchFromBuffer(samples: Float32Array, sampleRate: number) {
  if (samples.length < 32 || sampleRate <= 0) return undefined;

  let rms = 0;
  for (let index = 0; index < samples.length; index += 1) {
    rms += samples[index] * samples[index];
  }
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.01) return undefined;

  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.floor(sampleRate / 60), Math.floor(samples.length / 2));
  const correlations: number[] = [];
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    for (let index = 0; index < samples.length - lag; index += 1) {
      const current = samples[index];
      const delayed = samples[index + lag];
      correlation += current * delayed;
      energyA += current * current;
      energyB += delayed * delayed;
    }
    correlation = energyA > 0 && energyB > 0 ? correlation / Math.sqrt(energyA * energyB) : 0;
    correlations[lag] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
    }
  }

  if (bestCorrelation < 0.5) return undefined;
  const threshold = bestCorrelation * 0.92;
  let bestLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (correlations[lag] >= threshold && correlations[lag] >= correlations[lag - 1] && correlations[lag] >= correlations[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag <= 0) return undefined;

  const previous = correlations[bestLag - 1] ?? 0;
  const current = correlations[bestLag] ?? 0;
  const next = correlations[bestLag + 1] ?? 0;
  const denominator = previous - 2 * current + next;
  const adjustment = Math.abs(denominator) > 0.000001 ? (previous - next) / (2 * denominator) : 0;
  return sampleRate / (bestLag + adjustment);
}
