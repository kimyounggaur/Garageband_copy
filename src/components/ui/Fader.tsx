import type { ChangeEvent } from "react";
import { faderValueToPercent } from "./controlMath";

type FaderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  orientation?: "horizontal" | "vertical";
  onChange: (value: number) => void;
  className?: string;
};

export function Fader({ label, value, min = 0, max = 1, step = 0.01, orientation = "vertical", onChange, className = "" }: FaderProps) {
  const percent = faderValueToPercent(value, min, max);
  const isVertical = orientation === "vertical";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Number(event.target.value));
  }

  return (
    <label className={`flex min-w-0 items-center gap-2 ${isVertical ? "h-28 flex-col" : "w-full"} ${className}`}>
      <span className="sr-only">{label}</span>
      <input
        className={`${isVertical ? "h-24 w-6 [writing-mode:vertical-lr]" : "h-6 w-full"} cursor-pointer accent-accent-sel`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        aria-label={label}
        aria-valuetext={`${percent}%`}
      />
      <span className="min-w-8 text-center text-[11px] font-bold text-slate-400">{percent}</span>
    </label>
  );
}
