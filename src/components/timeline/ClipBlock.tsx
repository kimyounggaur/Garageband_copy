import type { PointerEvent } from "react";
import { Lock } from "lucide-react";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { clipTypeLabel } from "../../utils/labels";
import { CLIP_HEIGHT, beatToX, snapBeat } from "../../utils/timeline";
import { AudioWaveform } from "../audio/AudioWaveform";

type ClipBlockProps = {
  clip: Clip;
  pixelsPerBeat: number;
};

function textColorFor(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#10141c" : "#f8fafc";
}

export function ClipBlock({ clip, pixelsPerBeat }: ClipBlockProps) {
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const selected = selectedClipId === clip.id;
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const moveClip = useDawStore((state) => state.moveClip);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const left = beatToX(clip.startBeat, pixelsPerBeat);
  const width = Math.max(pixelsPerBeat * 0.25, beatToX(clip.lengthBeats, pixelsPerBeat));
  const textColor = textColorFor(clip.color);

  function beginMove(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    selectTrack(clip.trackId);
    selectClip(clip.id);
    if (clip.locked) return;
    beginHistorySnapshot();

    const startX = event.clientX;
    const originalBeat = clip.startBeat;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      moveClip(clip.id, snapBeat(originalBeat + delta, snapBeats), undefined, { recordHistory: false });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      commitHistorySnapshot();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    selectTrack(clip.trackId);
    selectClip(clip.id);
    if (clip.locked) return;
    beginHistorySnapshot();

    const startX = event.clientX;
    const originalLength = clip.lengthBeats;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      resizeClip(clip.id, snapBeat(originalLength + delta, snapBeats), { recordHistory: false });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      commitHistorySnapshot();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  return (
    <div
      className={`absolute top-3 overflow-hidden rounded-md border shadow-lg ${
        selected ? "border-white ring-2 ring-meter-cyan/70" : "border-black/30"
      }`}
      style={{ left, width, height: CLIP_HEIGHT, backgroundColor: clip.color, color: textColor }}
      onPointerDown={beginMove}
      onClick={(event) => event.stopPropagation()}
    >
      {clip.type === "audio" ? (
        <AudioWaveform clip={clip} color={textColor} className="pointer-events-none absolute inset-0 h-full w-full opacity-55" />
      ) : null}
      <div className="relative z-10 flex h-full min-w-0 flex-col justify-between px-2 py-1">
        <div className="flex min-w-0 items-center gap-1">
          {clip.locked ? <Lock size={11} className="shrink-0" /> : null}
          <span className="truncate text-xs font-black">{clip.name}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase opacity-80">
          <span>{clipTypeLabel(clip.type)}</span>
          <span>{clip.lengthBeats}b</span>
        </div>
      </div>
      <button
        className={`absolute right-0 top-0 h-full w-2 bg-black/18 transition hover:bg-black/32 ${
          clip.locked ? "cursor-not-allowed opacity-35" : "cursor-ew-resize"
        }`}
        title="클립 길이 조절"
        aria-label="클립 길이 조절"
        onPointerDown={beginResize}
      />
    </div>
  );
}
