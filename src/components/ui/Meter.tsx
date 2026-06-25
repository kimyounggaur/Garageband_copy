import { meterLevelToPercent } from "./controlMath";

type MeterProps = {
  value: number;
  label: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function Meter({ value, label, orientation = "horizontal", className = "" }: MeterProps) {
  const percent = meterLevelToPercent(value);
  const isVertical = orientation === "vertical";

  return (
    <div
      className={`overflow-hidden rounded-full border border-black/30 bg-black/35 ${isVertical ? "h-20 w-2" : "h-2 w-full"} ${className}`}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      role="meter"
    >
      <div
        className="bg-gradient-to-r from-accent-play via-accent-cycle to-accent-record transition-all"
        style={isVertical ? { height: `${percent}%`, marginTop: `${100 - percent}%` } : { width: `${percent}%`, height: "100%" }}
      />
    </div>
  );
}
