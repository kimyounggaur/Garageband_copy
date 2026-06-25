import type { ReactNode } from "react";

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  labelClassName?: string;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  labelClassName = "hidden sm:inline"
}: SegmentedToggleProps<T>) {
  return (
    <div className={`inline-grid gap-1 rounded-md border border-graphite-700 bg-graphite-950/80 p-1 ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded px-2 text-xs font-black transition ${
            value === item.value ? "bg-accent-sel text-graphite-975" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => onChange(item.value)}
          aria-pressed={value === item.value}
          title={item.label}
        >
          {item.icon}
          <span className={labelClassName}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
