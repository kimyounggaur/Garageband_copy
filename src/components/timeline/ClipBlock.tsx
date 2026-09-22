import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Copy, Lock, PlayCircle, Scissors, Trash2 } from "../icons";
import { useDawStore } from "../../store/useDawStore";
import type { Clip } from "../../types/project";
import { clipTypeLabel } from "../../utils/labels";
import { CLIP_HEIGHT, beatToX, clamp, clipTypeRegionColor, formatBarBeatTick, snapBeat } from "../../utils/timeline";
import { AudioWaveform } from "../audio/AudioWaveform";
import { bestTextColor } from "../../utils/colorContrast";

type ClipBlockProps = {
  clip: Clip;
  pixelsPerBeat: number;
};

type ClipMenuState = {
  x: number;
  y: number;
  beat: number;
};

function menuPosition(clientX: number, clientY: number) {
  return {
    x: clamp(clientX, 8, Math.max(8, window.innerWidth - 236)),
    y: clamp(clientY, 8, Math.max(8, window.innerHeight - 248))
  };
}

function snapDelta(delta: number, snapBeats: number) {
  return Math.round(delta / snapBeats) * snapBeats;
}

export function ClipBlock({ clip, pixelsPerBeat }: ClipBlockProps) {
  const [menu, setMenu] = useState<ClipMenuState | undefined>();
  const clipRef = useRef<HTMLDivElement>(null);
  const selectedClipId = useDawStore((state) => state.selectedClipId);
  const selectedClipIds = useDawStore((state) => state.selectedClipIds);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const selected = selectedClipId === clip.id || selectedClipIds.includes(clip.id);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const seekToBeat = useDawStore((state) => state.seekToBeat);
  const moveClip = useDawStore((state) => state.moveClip);
  const moveSelectedClips = useDawStore((state) => state.moveSelectedClips);
  const resizeClip = useDawStore((state) => state.resizeClip);
  const resizeClipStart = useDawStore((state) => state.resizeClipStart);
  const setClipLoopEnabled = useDawStore((state) => state.setClipLoopEnabled);
  const duplicateClip = useDawStore((state) => state.duplicateClip);
  const removeClip = useDawStore((state) => state.removeClip);
  const splitSelectedAudioClip = useDawStore((state) => state.splitSelectedAudioClip);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const left = beatToX(clip.startBeat, pixelsPerBeat);
  const width = Math.max(pixelsPerBeat * 0.25, beatToX(clip.lengthBeats, pixelsPerBeat));
  const isDrummerClip = Boolean(clip.drummerPreset);
  const regionColor = clipTypeRegionColor(isDrummerClip ? "drummer" : clip.type);
  const clipKindLabel = isDrummerClip ? "드러머" : clipTypeLabel(clip.type);
  const textColor = bestTextColor(regionColor);
  const canSplitAtMenuBeat =
    Boolean(menu) &&
    clip.type === "audio" &&
    !clip.locked &&
    menu!.beat - clip.startBeat >= 0.25 &&
    clip.startBeat + clip.lengthBeats - menu!.beat >= 0.25;

  useEffect(() => {
    if (!menu) return;
    document.querySelector<HTMLElement>('[data-clip-menu]')?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    const closeMenu = () => setMenu(undefined);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        clipRef.current?.focus();
      }
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
    const additive = event.ctrlKey || event.metaKey;
    const shouldSnap = !additive;
    selectTrack(clip.trackId);
    if (additive && !selected) {
      selectClip(clip.id, true);
    } else if (!selected) {
      selectClip(clip.id);
    }
    setMenu(undefined);
    if (clip.locked) return;
    beginHistorySnapshot();

    const startX = event.clientX;
    let activeClipId = clip.id;
    let originalBeat = clip.startBeat;
    let moveGroup = selected && selectedClipIds.length > 1 && !event.altKey;
    if (event.altKey) {
      const duplicatedId = duplicateClip(clip.id);
      const duplicatedClip = useDawStore.getState().project.tracks.flatMap((track) => track.clips).find((item) => item.id === duplicatedId);
      if (duplicatedId && duplicatedClip) {
        activeClipId = duplicatedId;
        originalBeat = duplicatedClip.startBeat;
        moveGroup = false;
      }
    }
    let lastGroupDelta = 0;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const rawDelta = (moveEvent.clientX - startX) / pixelsPerBeat;
      if (moveGroup) {
        const nextDelta = shouldSnap ? snapDelta(rawDelta, snapBeats) : rawDelta;
        moveSelectedClips(nextDelta - lastGroupDelta, { recordHistory: false, snap: false });
        lastGroupDelta = nextDelta;
        return;
      }
      moveClip(activeClipId, originalBeat + rawDelta, undefined, { recordHistory: false, snap: shouldSnap });
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
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setMenu(undefined);
    if (clip.locked) return;
    beginHistorySnapshot();

    const startX = event.clientX;
    const originalLength = clip.lengthBeats;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      resizeClip(clip.id, originalLength + delta, { recordHistory: false, snap: shouldSnap });
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

  function beginResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.button !== 0) return;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setMenu(undefined);
    if (clip.locked) return;
    beginHistorySnapshot();

    const startX = event.clientX;
    const originalStart = clip.startBeat;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      resizeClipStart(clip.id, originalStart + delta, { recordHistory: false, snap: shouldSnap });
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

  function beginLoopResize(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.button !== 0) return;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    selectTrack(clip.trackId);
    selectClip(clip.id);
    setMenu(undefined);
    if (clip.locked) return;
    beginHistorySnapshot();
    setClipLoopEnabled(clip.id, true, { recordHistory: false });

    const startX = event.clientX;
    const originalLength = clip.lengthBeats;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      resizeClip(clip.id, originalLength + delta, { recordHistory: false, snap: shouldSnap });
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
    seekToBeat(beat);
    setMenu({ ...position, beat });
  }

  function runMenuAction(action: () => void) {
    setMenu(undefined);
    action();
    requestAnimationFrame(() => clipRef.current?.isConnected && clipRef.current.focus());
  }

  function handleClipKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      selectTrack(clip.trackId);
      selectClip(clip.id);
      seekToBeat(clip.startBeat);
      return;
    }
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      selectTrack(clip.trackId);
      selectClip(clip.id);
      setMenu({ ...menuPosition(rect.left + 24, rect.top + 24), beat: clip.startBeat });
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const tracks = useDawStore.getState().project.tracks;
    const trackIndex = tracks.findIndex((track) => track.id === clip.trackId);
    const track = tracks[trackIndex];
    const ordered = [...(track?.clips ?? [])].sort((a, b) => a.startBeat - b.startBeat);
    const clipIndex = ordered.findIndex((item) => item.id === clip.id);
    const next = event.key === "ArrowLeft" ? ordered[clipIndex - 1]
      : event.key === "ArrowRight" ? ordered[clipIndex + 1]
      : [...(tracks[trackIndex + (event.key === "ArrowUp" ? -1 : 1)]?.clips ?? [])]
          .sort((a, b) => Math.abs(a.startBeat - clip.startBeat) - Math.abs(b.startBeat - clip.startBeat))[0];
    if (next) document.querySelector<HTMLElement>(`[data-clip-id="${CSS.escape(next.id)}"]`)?.focus();
  }

  function handleClipMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setMenu(undefined);
      clipRef.current?.focus();
    }
  }

  return (
    <div
      ref={clipRef}
      data-clip-id={clip.id}
      role="group"
      tabIndex={0}
      aria-label={`${clip.name}, ${clipKindLabel}, ${useDawStore.getState().project.tracks.find((track) => track.id === clip.trackId)?.name ?? "트랙"}, 시작 ${formatBarBeatTick(clip.startBeat, useDawStore.getState().project.timeSignature)}, 길이 ${clip.lengthBeats}박${selected ? ", 선택됨" : ""}. Enter로 편집, 방향키로 클립 탐색`}
      className={`absolute top-3 overflow-hidden rounded-md border shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-accent ${
        selected ? "border-accent-sel ring-2 ring-accent-sel/70" : "border-black/30"
      }`}
      style={{ left, width, height: CLIP_HEIGHT, backgroundColor: regionColor, color: textColor }}
      onPointerDown={beginMove}
      onKeyDown={handleClipKeyDown}
      onContextMenu={openClipMenu}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        selectTrack(clip.trackId);
        selectClip(clip.id);
        seekToBeat(clip.startBeat);
      }}
    >
      {clip.loopEnabled ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px ${Math.max(
              14,
              pixelsPerBeat
            )}px)`
          }}
        />
      ) : null}
      {clip.type === "audio" ? (
        <AudioWaveform clip={clip} color={textColor} className="pointer-events-none absolute inset-0 h-full w-full opacity-55" />
      ) : null}
      <div className="relative z-10 flex h-full min-w-0 flex-col justify-between px-2 py-1">
        <div className="flex min-w-0 items-center gap-1">
          {clip.locked ? <Lock size={11} className="shrink-0" /> : null}
          <span className="truncate text-xs font-black">{clip.name}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase opacity-80">
          <span>{clipKindLabel}</span>
          <span>{clip.lengthBeats}b</span>
        </div>
      </div>
      <button
        className={`absolute left-0 top-0 h-full bg-black/18 transition hover:bg-black/32 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-accent ${
          clip.locked ? "cursor-not-allowed opacity-35" : "cursor-ew-resize"
        }`}
        style={{ width: Math.min(24, Math.max(8, width / 4)) }}
        title="클립 시작점 조절"
        aria-label="클립 시작점 조절"
        disabled={clip.locked}
        onPointerDown={beginResizeStart}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            resizeClipStart(clip.id, clip.startBeat + (event.key === "ArrowRight" ? snapBeats : -snapBeats));
          }
        }}
      />
      <button
        className={`absolute right-0 top-0 h-full bg-black/18 transition hover:bg-black/32 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-accent ${
          clip.locked ? "cursor-not-allowed opacity-35" : "cursor-ew-resize"
        }`}
        style={{ width: Math.min(24, Math.max(8, width / 4)) }}
        title="클립 길이 조절"
        aria-label="클립 길이 조절"
        disabled={clip.locked}
        onPointerDown={beginResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            resizeClip(clip.id, clip.lengthBeats + (event.key === "ArrowRight" ? snapBeats : -snapBeats));
          }
        }}
      />
      <button
        className={`absolute bottom-1 right-7 h-6 w-6 rounded-sm border border-white/60 bg-black/30 transition hover:bg-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-accent ${
          clip.locked ? "cursor-not-allowed opacity-35" : "cursor-ew-resize"
        }`}
        style={{ display: width < 80 ? "none" : undefined }}
        title="루프 반복 길이 조절"
        aria-label="루프 반복 길이 조절"
        disabled={clip.locked}
        onPointerDown={beginLoopResize}
      />

      {menu ? (
        <div
          data-clip-menu
          className="fixed z-[80] w-56 overflow-hidden rounded-lg border border-line bg-surface-panel p-1 text-ink-high shadow-2xl shadow-black/50 backdrop-blur"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label={`${clip.name} 클립 메뉴`}
          onKeyDown={handleClipMenuKeyDown}
        >
          <div className="border-b border-line px-2 py-2">
            <div className="truncate text-xs font-black text-ink-high">{clip.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-body">
              <span>{clipKindLabel}</span>
              <span>{menu.beat.toFixed(2)}박</span>
              {clip.locked ? <span>잠김</span> : null}
            </div>
          </div>

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-ink-high transition hover:bg-surface-raised"
            onClick={() => runMenuAction(() => seekToBeat(clip.startBeat))}
            role="menuitem"
          >
            <PlayCircle size={14} />
            클립 시작으로 이동
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-ink-high transition hover:bg-surface-raised"
            onClick={() => runMenuAction(() => duplicateClip(clip.id))}
            role="menuitem"
          >
            <Copy size={14} />
            클립 복제
          </button>
          <button
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
              canSplitAtMenuBeat ? "text-ink-high hover:bg-surface-raised" : "cursor-not-allowed text-ink-disabled"
            }`}
            onClick={() =>
              canSplitAtMenuBeat
                ? runMenuAction(() => {
                    seekToBeat(menu.beat);
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
              clip.locked ? "cursor-not-allowed text-ink-disabled" : "text-ink-high hover:bg-red-500/12"
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
