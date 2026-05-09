import type { PointerEvent } from "react";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { CLIP_HEIGHT, PIXELS_PER_BEAT, beatToX, snapBeat } from "../../utils/timeline";

type ClipBlockProps = {
  clip: Clip;
};

function textColorFor(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#10141c" : "#f8fafc";
}

export function ClipBlock({ clip }: ClipBlockProps) {
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const selected = selectedClipId === clip.id;
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const moveClip = useDawStore((state) => state.moveClip);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const left = beatToX(clip.startBeat);
  const width = Math.max(PIXELS_PER_BEAT * 0.25, beatToX(clip.lengthBeats));
  const textColor = textColorFor(clip.color);

  function beginMove(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    selectTrack(clip.trackId);
    selectClip(clip.id);

    const startX = event.clientX;
    const originalBeat = clip.startBeat;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / PIXELS_PER_BEAT;
      moveClip(clip.id, snapBeat(originalBeat + delta));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    selectTrack(clip.trackId);
    selectClip(clip.id);

    const startX = event.clientX;
    const originalLength = clip.lengthBeats;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / PIXELS_PER_BEAT;
      resizeClip(clip.id, snapBeat(originalLength + delta));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      className={`absolute top-3 overflow-hidden rounded-md border shadow-lg ${
        selected ? "border-white ring-2 ring-meter-cyan/70" : "border-black/30"
      }`}
      style={{ left, width, height: CLIP_HEIGHT, backgroundColor: clip.color, color: textColor }}
      onPointerDown={beginMove}
    >
      <div className="flex h-full min-w-0 flex-col justify-between px-2 py-1">
        <div className="truncate text-xs font-black">{clip.name}</div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase opacity-80">
          <span>{clip.type}</span>
          <span>{clip.lengthBeats}b</span>
        </div>
      </div>
      <button
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/18 transition hover:bg-black/32"
        title="Resize clip"
        aria-label="Resize clip"
        onPointerDown={beginResize}
      />
    </div>
  );
}
