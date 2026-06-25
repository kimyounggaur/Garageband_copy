import type { KeyboardEvent, PointerEvent } from "react";
import { denormalizeValue, knobValueToDegrees, normalizeValue } from "./controlMath";

type KnobProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
};

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Knob({ label, value, min = 0, max = 1, step = 0.01, onChange, className = "" }: KnobProps) {
  const normalized = normalizeValue(value, min, max);
  const degrees = knobValueToDegrees(value, min, max);

  function commit(nextValue: number) {
    onChange(clampValue(Number(nextValue.toFixed(4)), min, max));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startValue = value;

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const delta = (startY - moveEvent.clientY) * step;
      commit(startValue + delta);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      commit(value + step);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      commit(value - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      commit(min);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(max);
    }
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div
        className="relative grid h-11 w-11 place-items-center rounded-full border border-graphite-700 bg-gradient-to-b from-graphite-750 to-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_14px_rgba(0,0,0,0.28)] focus:outline-none focus:ring-2 focus:ring-accent-sel/70"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(normalized * 100)}%`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <span
          className="absolute left-1/2 top-1/2 h-5 w-0.5 origin-bottom rounded-full bg-accent-sel"
          style={{ transform: `translate(-50%, -100%) rotate(${degrees}deg)` }}
        />
        <span className="h-2.5 w-2.5 rounded-full bg-graphite-600 shadow-inner" />
      </div>
      <span className="max-w-16 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
    </div>
  );
}
