import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./Tooltip";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  tone?: "default" | "play" | "record" | "cycle";
  tooltip?: string;
  children: ReactNode;
};

const toneClasses = {
  default: "",
  play: "text-accent-play",
  record: "text-accent-record",
  cycle: "text-accent-cycle"
};

export function IconButton({ label, active = false, tone = "default", tooltip, children, className = "", ...props }: IconButtonProps) {
  const button = (
    <button
      className={`studio-icon-button ${active ? "border-accent-sel bg-accent-sel/15 text-accent-sel" : toneClasses[tone]} ${className}`}
      aria-label={label}
      title={tooltip ?? label}
      {...props}
    >
      {children}
    </button>
  );

  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}
