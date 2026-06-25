import type { ButtonHTMLAttributes } from "react";
import { formatLcdBeat } from "./controlMath";

type LcdMode = "beats" | "time" | "tuner";

type LcdDisplayProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: LcdMode;
  currentBeat?: number;
  bpm?: number;
  timeSignature?: [number, number];
  value?: string;
  detail?: string;
  label?: string;
};

function formatTime(beat: number, bpm: number) {
  const safeBpm = Math.max(1, Number.isFinite(bpm) ? bpm : 120);
  const seconds = Math.max(0, beat) * (60 / safeBpm);
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export function LcdDisplay({
  mode = "beats",
  currentBeat = 0,
  bpm = 120,
  timeSignature = [4, 4],
  value,
  detail,
  label = "LCD display",
  className = "",
  ...props
}: LcdDisplayProps) {
  const displayValue =
    value ?? (mode === "time" ? formatTime(currentBeat, bpm) : mode === "tuner" ? "--" : formatLcdBeat(currentBeat, timeSignature));
  const displayDetail = detail ?? (mode === "beats" ? `${bpm} BPM | ${timeSignature.join("/")}` : mode === "time" ? "time" : "tuner");

  return (
    <button
      type="button"
      className={`min-w-[128px] rounded-xl border border-lcd-dim/80 bg-lcd-bg px-3 py-1.5 text-left shadow-[inset_0_0_18px_rgba(124,255,178,0.06)] transition hover:border-lcd-text/50 focus:outline-none focus:ring-2 focus:ring-accent-sel/70 ${className}`}
      aria-label={label}
      {...props}
    >
      <span className="block font-mono text-base font-black leading-none text-lcd-text [font-variant-numeric:tabular-nums]">{displayValue}</span>
      <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-lcd-dim">{displayDetail}</span>
    </button>
  );
}
