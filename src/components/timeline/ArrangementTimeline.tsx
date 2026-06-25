import { Circle, Copy, Drum, Keyboard, Pencil, Plus, Repeat2, Trash2, Volume2 } from "../icons";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDawStore } from "../../store/useDawStore";
import { trackRoleLabel } from "../../utils/labels";
import {
  DEFAULT_PROJECT_BEATS,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  SNAP_OPTIONS,
  TRACK_HEIGHT,
  beatToX,
  buildRulerTicks,
  clamp,
  formatBarBeatTick,
  normalizeCycleRange,
  pixelsPerBeatForZoom,
  snapBeat,
  xToBeat,
  type SnapBeats
} from "../../utils/timeline";
import { TrackLane } from "./TrackLane";
import type { Track } from "../../types/project";

type TrackMenuState = {
  x: number;
  y: number;
  trackId: string;
};

function snapLabel(snapBeats: number) {
  if (snapBeats === 0.25) return "1/4";
  if (snapBeats === 0.5) return "1/2";
  if (snapBeats === 1) return "1박";
  return "1마디";
}

function getTimelineBeats() {
  const project = useDawStore.getState().project;
  const end = project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats + 4);
  }, Math.max(DEFAULT_PROJECT_BEATS, (project.cycleEnd ?? 0) + 4));
  return Math.max(DEFAULT_PROJECT_BEATS, Math.ceil(end / 4) * 4);
}

function menuPosition(clientX: number, clientY: number) {
  return {
    x: Math.min(Math.max(clientX, 8), Math.max(8, window.innerWidth - 236)),
    y: Math.min(Math.max(clientY, 8), Math.max(8, window.innerHeight - 272))
  };
}

export function ArrangementTimeline() {
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | undefined>();
  const project = useDawStore((state) => state.project);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const isPlaying = useDawStore((state) => state.isPlaying);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const timelineZoom = useDawStore((state) => state.timelineZoom);
  const preventClipOverlap = useDawStore((state) => state.preventClipOverlap);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const addTrack = useDawStore((state) => state.addTrack);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const addDrummerClip = useDawStore((state) => state.addDrummerClip);
  const renameTrack = useDawStore((state) => state.renameTrack);
  const duplicateTrack = useDawStore((state) => state.duplicateTrack);
  const removeTrack = useDawStore((state) => state.removeTrack);
  const setTrackRecordEnabled = useDawStore((state) => state.setTrackRecordEnabled);
  const toggleMute = useDawStore((state) => state.toggleMute);
  const toggleSolo = useDawStore((state) => state.toggleSolo);
  const setSnapBeats = useDawStore((state) => state.setSnapBeats);
  const setTimelineZoom = useDawStore((state) => state.setTimelineZoom);
  const setPreventClipOverlap = useDawStore((state) => state.setPreventClipOverlap);
  const setCycleRange = useDawStore((state) => state.setCycleRange);
  const toggleCycle = useDawStore((state) => state.toggleCycle);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const totalBeats = useMemo(getTimelineBeats, [project]);
  const menuTrack = project.tracks.find((track) => track.id === trackMenu?.trackId);
  const rulerTicks = useMemo(() => buildRulerTicks(totalBeats, project.timeSignature), [project.timeSignature, totalBeats]);
  const pixelsPerBeat = pixelsPerBeatForZoom(timelineZoom);
  const width = Math.max(totalBeats * pixelsPerBeat, viewportWidth);
  const cycleRange = normalizeCycleRange(project.cycleStart ?? 0, project.cycleEnd ?? 8, snapBeats);
  const cycleEnabled = Boolean(project.cycleEnabled);
  const cycleLeft = beatToX(cycleRange.start, pixelsPerBeat);
  const cycleWidth = Math.max(beatToX(cycleRange.end - cycleRange.start, pixelsPerBeat), pixelsPerBeat * 0.25);

  useEffect(() => {
    const element = timelineViewportRef.current;
    if (!element) return;

    const updateWidth = () => setViewportWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!trackMenu) return;
    const closeMenu = () => setTrackMenu(undefined);
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
  }, [trackMenu]);

  function openTrackMenu(event: MouseEvent<HTMLButtonElement>, track: Track) {
    event.preventDefault();
    event.stopPropagation();
    selectTrack(track.id);
    selectClip(undefined);
    setTrackMenu({ ...menuPosition(event.clientX, event.clientY), trackId: track.id });
  }

  function runTrackMenuAction(action: () => void) {
    setTrackMenu(undefined);
    action();
  }

  function renameSelectedTrack(track: Track) {
    const nextName = window.prompt("트랙 이름을 입력하세요.", track.name)?.trim();
    if (nextName) renameTrack(track.id, nextName);
  }

  function beatFromClientX(clientX: number, element: HTMLElement, shouldSnap: boolean) {
    const rect = element.getBoundingClientRect();
    const rawBeat = clamp(xToBeat(clientX - rect.left, pixelsPerBeat), 0, totalBeats);
    return shouldSnap ? snapBeat(rawBeat, snapBeats) : rawBeat;
  }

  function beginRulerScrub(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    setCurrentBeat(beatFromClientX(event.clientX, element, shouldSnap));

    function handleMove(moveEvent: globalThis.PointerEvent) {
      setCurrentBeat(beatFromClientX(moveEvent.clientX, element, shouldSnap));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function beginPlayheadDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isPlaying) return;
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.parentElement;
    if (!surface) return;
    const surfaceElement = surface;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    setCurrentBeat(beatFromClientX(event.clientX, surfaceElement, shouldSnap));

    function handleMove(moveEvent: globalThis.PointerEvent) {
      setCurrentBeat(beatFromClientX(moveEvent.clientX, surfaceElement, shouldSnap));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function beginCycleCreate(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    const startBeat = beatFromClientX(event.clientX, element, shouldSnap);
    beginHistorySnapshot();
    setCycleRange(startBeat, startBeat + snapBeats, { recordHistory: false, snap: shouldSnap });

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const endBeat = beatFromClientX(moveEvent.clientX, element, shouldSnap);
      setCycleRange(startBeat, endBeat, { recordHistory: false, snap: shouldSnap });
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

  function beginCycleEdit(event: PointerEvent<HTMLButtonElement>, mode: "move" | "start" | "end") {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    const originalStart = cycleRange.start;
    const originalEnd = cycleRange.end;
    const originalLength = originalEnd - originalStart;
    beginHistorySnapshot();

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const delta = (moveEvent.clientX - startX) / pixelsPerBeat;
      if (mode === "move") {
        const nextStart = shouldSnap ? snapBeat(originalStart + delta, snapBeats) : Math.max(0, originalStart + delta);
        setCycleRange(nextStart, nextStart + originalLength, { recordHistory: false, snap: false });
        return;
      }
      if (mode === "start") {
        setCycleRange(originalStart + delta, originalEnd, { recordHistory: false, snap: shouldSnap });
        return;
      }
      setCycleRange(originalStart, originalEnd + delta, { recordHistory: false, snap: shouldSnap });
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

  function handleTimelineWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setTimelineZoom(timelineZoom + direction * 0.08);
  }

  return (
    <section className="panel grid min-h-[260px] min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded-lg lg:min-h-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="panel-title">편곡</span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            스냅
            <select
              className="h-6 rounded border border-white/10 bg-studio-950 px-2 text-xs font-bold normal-case tracking-normal text-slate-100 outline-none focus:border-meter-cyan"
              value={snapBeats}
              onChange={(event) => setSnapBeats(Number(event.target.value) as SnapBeats)}
              aria-label="스냅 단위"
            >
              {SNAP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {snapLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={preventClipOverlap}
              onChange={(event) => setPreventClipOverlap(event.target.checked)}
              aria-label="클립 겹침 방지"
            />
            겹침 방지
          </label>
          <button
            className={`studio-button ${cycleEnabled ? "border-accent-sel bg-accent-sel/15 text-white" : ""}`}
            onClick={() => toggleCycle()}
            title={cycleEnabled ? "사이클 끄기" : "사이클 켜기"}
          >
            <Repeat2 size={14} />
            Cycle
          </button>
          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            확대
            <input
              className="w-24"
              type="range"
              min={MIN_TIMELINE_ZOOM}
              max={MAX_TIMELINE_ZOOM}
              step={0.05}
              value={timelineZoom}
              onChange={(event) => setTimelineZoom(Number(event.target.value))}
              aria-label="타임라인 확대"
            />
          </label>
          <button className="studio-button" onClick={() => addTrack("drum", "드럼")}>
            <Plus size={14} />
            드럼
          </button>
          <button className="studio-button" onClick={() => addDrummerClip(undefined, currentBeat)}>
            <Drum size={14} />
            Drummer
          </button>
          <button className="studio-button" onClick={() => addTrack("instrument", "악기")}>
            <Plus size={14} />
            악기
          </button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-[132px_minmax(0,1fr)] sm:grid-cols-[178px_minmax(0,1fr)]">
        <div className="border-r border-white/10 bg-black/10">
          <div className="flex h-12 items-end border-b border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            트랙
          </div>
          {project.tracks.map((track) => (
            <button
              key={track.id}
              className={`flex w-full items-center gap-2 border-b border-white/10 px-3 text-left transition ${
                selectedTrackId === track.id ? "bg-meter-cyan/10" : "hover:bg-white/[0.045]"
              }`}
              style={{ height: TRACK_HEIGHT }}
              onClick={() => selectTrack(track.id)}
              onContextMenu={(event) => openTrackMenu(event, track)}
            >
              <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-100">{track.name}</span>
                <span className="block text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  {trackRoleLabel(track.role ?? track.type)}
                </span>
              </span>
            </button>
          ))}
          {trackMenu && menuTrack ? (
            <div
              className="fixed z-[85] w-56 overflow-hidden rounded-lg border border-white/10 bg-studio-900/98 p-1 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
              style={{ left: trackMenu.x, top: trackMenu.y }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              role="menu"
              aria-label={`${menuTrack.name} 트랙 메뉴`}
            >
              <div className="border-b border-white/10 px-2 py-2">
                <div className="truncate text-xs font-black text-slate-100">{menuTrack.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <span>{trackRoleLabel(menuTrack.role ?? menuTrack.type)}</span>
                  <span>클립 {menuTrack.clips.length}개</span>
                </div>
              </div>

              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                onClick={() => runTrackMenuAction(() => renameSelectedTrack(menuTrack))}
                role="menuitem"
              >
                <Pencil size={14} />
                트랙 이름 변경
              </button>
              <button
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                  menuTrack.type === "audio" ? "cursor-not-allowed text-slate-600" : "text-slate-200 hover:bg-white/[0.08]"
                }`}
                onClick={() =>
                  menuTrack.type === "audio" ? undefined : runTrackMenuAction(() => addMidiClip(menuTrack.id, currentBeat))
                }
                disabled={menuTrack.type === "audio"}
                role="menuitem"
              >
                <Keyboard size={14} />
                현재 위치에 MIDI 클립
              </button>
              <button
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                  menuTrack.type === "audio" ? "cursor-not-allowed text-slate-600" : "text-slate-200 hover:bg-white/[0.08]"
                }`}
                onClick={() =>
                  menuTrack.type === "audio" ? undefined : runTrackMenuAction(() => addDrummerClip(menuTrack.id, currentBeat))
                }
                disabled={menuTrack.type === "audio"}
                role="menuitem"
              >
                <Drum size={14} />
                현재 위치에 Drummer 클립
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                onClick={() => runTrackMenuAction(() => duplicateTrack(menuTrack.id))}
                role="menuitem"
              >
                <Copy size={14} />
                트랙 복제
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                onClick={() => runTrackMenuAction(() => toggleMute(menuTrack.id))}
                role="menuitem"
              >
                <Volume2 size={14} />
                {menuTrack.muted ? "음소거 해제" : "트랙 음소거"}
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                onClick={() => runTrackMenuAction(() => toggleSolo(menuTrack.id))}
                role="menuitem"
              >
                <Volume2 size={14} />
                {menuTrack.solo ? "솔로 해제" : "트랙 솔로"}
              </button>
              {menuTrack.type === "audio" ? (
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                  onClick={() => runTrackMenuAction(() => setTrackRecordEnabled(menuTrack.id))}
                  role="menuitem"
                >
                  <Circle size={14} fill={menuTrack.recordEnabled ? "currentColor" : "none"} />
                  {menuTrack.recordEnabled ? "Record disable" : "Record enable"}
                </button>
              ) : null}
              <button
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                  project.tracks.length <= 1 ? "cursor-not-allowed text-slate-600" : "text-red-200 hover:bg-red-500/12"
                }`}
                onClick={() => (project.tracks.length <= 1 ? undefined : runTrackMenuAction(() => removeTrack(menuTrack.id)))}
                disabled={project.tracks.length <= 1}
                role="menuitem"
              >
                <Trash2 size={14} />
                {project.tracks.length <= 1 ? "마지막 트랙" : "트랙 삭제"}
              </button>
            </div>
          ) : null}
        </div>

        <div ref={timelineViewportRef} className="min-w-0 overflow-auto bg-studio-950/80" onWheel={handleTimelineWheel}>
          <div className="relative min-w-full" style={{ width }}>
            <div className="sticky top-0 z-20 h-12 border-b border-white/10 bg-studio-900/95" style={{ width }}>
              <div
                className="relative h-4 cursor-crosshair border-b border-white/10 bg-black/20"
                style={{ width }}
                onPointerDown={beginCycleCreate}
                title="드래그해서 사이클 구간 만들기"
              >
                {cycleEnabled ? (
                  <>
                    <button
                      className="absolute top-[3px] h-2 rounded-sm border border-accent-sel/70 bg-accent-sel/35 shadow-[0_0_12px_rgba(74,222,128,0.18)]"
                      style={{ left: cycleLeft, width: cycleWidth }}
                      onPointerDown={(event) => beginCycleEdit(event, "move")}
                      aria-label="사이클 구간 이동"
                      title={`${formatBarBeatTick(cycleRange.start, project.timeSignature)} - ${formatBarBeatTick(
                        cycleRange.end,
                        project.timeSignature
                      )}`}
                    />
                    <button
                      className="absolute top-0 h-4 w-3 cursor-ew-resize rounded-sm bg-accent-sel/70"
                      style={{ left: Math.max(0, cycleLeft - 3) }}
                      onPointerDown={(event) => beginCycleEdit(event, "start")}
                      aria-label="사이클 시작점 조절"
                      title="사이클 시작점 조절"
                    />
                    <button
                      className="absolute top-0 h-4 w-3 cursor-ew-resize rounded-sm bg-accent-sel/70"
                      style={{ left: cycleLeft + cycleWidth - 3 }}
                      onPointerDown={(event) => beginCycleEdit(event, "end")}
                      aria-label="사이클 끝점 조절"
                      title="사이클 끝점 조절"
                    />
                  </>
                ) : null}
              </div>

              <div
                className="relative h-8 cursor-col-resize bg-gradient-to-b from-graphite-900 to-studio-900"
                style={{ width }}
                onPointerDown={beginRulerScrub}
                title="클릭하거나 드래그해서 재생 위치 이동"
              >
                {rulerTicks.map((tick) => (
                  <div
                    key={`${tick.kind}-${tick.beat}`}
                    className="absolute bottom-0 top-0"
                    style={{ left: beatToX(tick.beat, pixelsPerBeat) }}
                  >
                    <div
                      className={`h-full ${tick.kind === "bar" ? "w-[2px] bg-white/24" : "w-px bg-white/10"}`}
                    />
                    {tick.label ? (
                      <span className="absolute left-1 top-1 text-[11px] font-bold text-slate-400">{tick.label}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`absolute bottom-0 top-0 z-30 w-px bg-meter-green shadow-[0_0_0_1px_rgba(74,222,128,0.18)] ${
                isPlaying ? "pointer-events-none" : "cursor-ew-resize"
              }`}
              style={{ left: beatToX(currentBeat, pixelsPerBeat) }}
              onPointerDown={beginPlayheadDrag}
              title={formatBarBeatTick(currentBeat, project.timeSignature)}
            >
              <div className="-ml-1.5 h-3 w-3 rounded-sm bg-meter-green shadow-[0_0_12px_rgba(94,194,107,0.55)]" />
            </div>

            {project.tracks.map((track) => (
              <TrackLane key={track.id} track={track} width={width} pixelsPerBeat={pixelsPerBeat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
