import type { ReactNode } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
};

export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  const positionClass = side === "top" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        className={`pointer-events-none absolute left-1/2 z-[120] hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-graphite-700 bg-graphite-950 px-2 py-1 text-[11px] font-semibold text-slate-100 shadow-xl shadow-black/40 group-hover/tooltip:block group-focus-within/tooltip:block ${positionClass}`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
