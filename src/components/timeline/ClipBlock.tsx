import type { MouseEvent, PointerEvent } from "react";
import { useEffect, useState } from "react";
import { Copy, Lock, PlayCircle, Scissors, Trash2 } from "../icons";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { clipTypeLabel } from "../../utils/labels";
import { CLIP_HEIGHT, beatToX, clamp, snapBeat } from "../../utils/timeline";
import { AudioWaveform } from "../audio/AudioWaveform";

type ClipBlockProps = {
  clip: Clip;
  pixelsPerBeat: number;
};

type ClipMenuState = {
  x: number;
  y: number;
  beat: number;
};

function textColorFor(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#10141c" : "#f8fafc";
}

function menuPosition(clientX: number, clientY: number) {
  return {
    x: clamp(clientX, 8, Math.max(8, window.innerWidth - 236)),
    y: clamp(clientY, 8, Math.max(8, window.innerHeight - 248))
  };
}

export function ClipBlock({ clip, pixelsPerBeat }: ClipBlockProps) {
  const [menu, setMenu] = useState<ClipMenuState | undefined>();
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const selected = selectedClipId === clip.id;
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const moveClip = useDawStore((state) => state.moveClip);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const duplicateClip = useDawStore((state) => state.duplicateClip);
  const removeClip = useDawStore((state) => state.removeClip);
  const splitSelectedAudioClip = useDawStore((state) => state.splitSelectedAudioClip);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const left = beatToX(clip.startBeat, pixelsPerBeat);
  const width = Math.max(pixelsPerBeat * 0.25, beatToX(clip.lengthBeats, pixelsPerBeat));
  const textColor = textColorFor(clip.color);
  const canSplitAtMenuBeat =
    Boolean(menu) &&
    clip.type === "audio" &&
    !clip.locked &&
    menu!.beat - clip.startBeat >= 0.25 &&
    clip.startBeat + clip.lengthBeats - menu!.beat >= 0.25;

  useEffect(() => {
    if (!menu) return;
    const closeMenu = () => setMenu(undefined);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  function beginMove(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.button !== 0) return;
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setMenu(undefined);
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
    if (event.button !== 0) return;
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setMenu(undefined);
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

  function openClipMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const rawBeat = clip.startBeat + (event.clientX - rect.left) / pixelsPerBeat;
    const beat = clamp(snapBeat(rawBeat, snapBeats), clip.startBeat, clip.startBeat + clip.lengthBeats);
    const position = menuPosition(event.clientX, event.clientY);
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setCurrentBeat(beat);
    setMenu({ ...position, beat });
  }

  function runMenuAction(action: () => void) {
    setMenu(undefined);
    action();
  }

  return (
    <div
      className={`absolute top-3 overflow-hidden rounded-md border shadow-lg ${
        selected ? "border-white ring-2 ring-meter-cyan/70" : "border-black/30"
      }`}
      style={{ left, width, height: CLIP_HEIGHT, backgroundColor: clip.color, color: textColor }}
      onPointerDown={beginMove}
      onContextMenu={openClipMenu}
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

      {menu ? (
        <div
          className="fixed z-[80] w-56 overflow-hidden rounded-lg border border-white/10 bg-studio-900/98 p-1 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label={`${clip.name} 클립 메뉴`}
        >
          <div className="border-b border-white/10 px-2 py-2">
            <div className="truncate text-xs font-black text-slate-100">{clip.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <span>{clipTypeLabel(clip.type)}</span>
              <span>{menu.beat.toFixed(2)}박</span>
              {clip.locked ? <span>잠김</span> : null}
            </div>
          </div>

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => setCurrentBeat(clip.startBeat))}
            role="menuitem"
          >
            <PlayCircle size={14} />
            클립 시작으로 이동
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => runMenuAction(() => duplicateClip(clip.id))}
            role="menuitem"
          >
            <Copy size={14} />
            클립 복제
          </button>
          <button
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
              canSplitAtMenuBeat ? "text-slate-200 hover:bg-white/[0.08]" : "cursor-not-allowed text-slate-600"
            }`}
            onClick={() =>
              canSplitAtMenuBeat
                ? runMenuAction(() => {
                    setCurrentBeat(menu.beat);
                    splitSelectedAudioClip();
                  })
                : undefined
            }
            disabled={!canSplitAtMenuBeat}
            role="menuitem"
          >
            <Scissors size={14} />
            여기서 오디오 분할
          </button>
          <button
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
              clip.locked ? "cursor-not-allowed text-slate-600" : "text-red-200 hover:bg-red-500/12"
            }`}
            onClick={() => (clip.locked ? undefined : runMenuAction(() => removeClip(clip.id)))}
            disabled={clip.locked}
            role="menuitem"
          >
            <Trash2 size={14} />
            {clip.locked ? "잠긴 클립" : "클립 삭제"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
