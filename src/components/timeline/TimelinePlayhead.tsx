import type { PointerEventHandler } from "react";
import { useDawStore } from "../../store/useDawStore";
import { beatToX, formatBarBeatTick } from "../../utils/timeline";

type TimelinePlayheadProps = {
  pixelsPerBeat: number;
  timeSignature: [number, number];
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

export function TimelinePlayhead({ pixelsPerBeat, timeSignature, onPointerDown }: TimelinePlayheadProps) {
  const currentBeat = useDawStore((state) => state.currentBeat);

  return (
    <div
      className="absolute bottom-0 top-0 z-30 w-px cursor-ew-resize bg-meter-green shadow-[0_0_0_1px_rgba(74,222,128,0.18)]"
      style={{ left: beatToX(currentBeat, pixelsPerBeat) }}
      onPointerDown={onPointerDown}
      title={formatBarBeatTick(currentBeat, timeSignature)}
    >
      <div className="-ml-1.5 h-3 w-3 rounded-sm bg-meter-green shadow-[0_0_12px_rgba(94,194,107,0.55)]" />
    </div>
  );
}
