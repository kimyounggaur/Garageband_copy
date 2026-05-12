import { Copy, Keyboard, Pencil, Plus, Trash2, Volume2 } from "../icons";
import type { MouseEvent } from "react";
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
  pixelsPerBeatForZoom,
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
  }, DEFAULT_PROJECT_BEATS);
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
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const timelineZoom = useDawStore((state) => state.timelineZoom);
  const preventClipOverlap = useDawStore((state) => state.preventClipOverlap);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const addTrack = useDawStore((state) => state.addTrack);
  const addMidiClip = useDawStore((state) => state.addMidiClip);
  const renameTrack = useDawStore((state) => state.renameTrack);
  const duplicateTrack = useDawStore((state) => state.duplicateTrack);
  const removeTrack = useDawStore((state) => state.removeTrack);
  const toggleMute = useDawStore((state) => state.toggleMute);
  const toggleSolo = useDawStore((state) => state.toggleSolo);
  const setSnapBeats = useDawStore((state) => state.setSnapBeats);
  const setTimelineZoom = useDawStore((state) => state.setTimelineZoom);
  const setPreventClipOverlap = useDawStore((state) => state.setPreventClipOverlap);
  const totalBeats = useMemo(getTimelineBeats, [project]);
  const menuTrack = project.tracks.find((track) => track.id === trackMenu?.trackId);
  const bars = Array.from({ length: Math.ceil(totalBeats / 4) }, (_, index) => index + 1);
  const pixelsPerBeat = pixelsPerBeatForZoom(timelineZoom);
  const width = Math.max(totalBeats * pixelsPerBeat, viewportWidth);

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
          <button className="studio-button" onClick={() => addTrack("instrument", "악기")}>
            <Plus size={14} />
            악기
          </button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-[132px_minmax(0,1fr)] sm:grid-cols-[178px_minmax(0,1fr)]">
        <div className="border-r border-white/10 bg-black/10">
          <div className="h-9 border-b border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
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

        <div ref={timelineViewportRef} className="min-w-0 overflow-auto bg-studio-950/80">
          <div className="relative min-w-full" style={{ width }}>
            <div
              className="sticky top-0 z-20 flex h-9 border-b border-white/10 bg-studio-900/95"
              style={{ width }}
            >
              {bars.map((bar) => (
                <div
                  key={bar}
                  className="h-full border-r border-white/10 px-2 py-2 text-[11px] font-bold text-slate-500"
                  style={{ width: pixelsPerBeat * 4 }}
                >
                  {bar}
                </div>
              ))}
            </div>

            <div
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-meter-green shadow-[0_0_0_1px_rgba(74,222,128,0.18)]"
              style={{ left: beatToX(currentBeat, pixelsPerBeat) }}
            >
              <div className="-ml-1.5 h-3 w-3 rounded-sm bg-meter-green" />
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
