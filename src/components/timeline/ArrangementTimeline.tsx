import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDawStore } from "../../store/useDawStore";
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

function snapLabel(snapBeats: number) {
  if (snapBeats === 0.25) return "1/4";
  if (snapBeats === 0.5) return "1/2";
  if (snapBeats === 1) return "1 beat";
  return "1 bar";
}

function getTimelineBeats() {
  const project = useDawStore.getState().project;
  const end = project.tracks.flatMap((track) => track.clips).reduce((max, clip) => {
    return Math.max(max, clip.startBeat + clip.lengthBeats + 4);
  }, DEFAULT_PROJECT_BEATS);
  return Math.max(DEFAULT_PROJECT_BEATS, Math.ceil(end / 4) * 4);
}

export function ArrangementTimeline() {
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const project = useDawStore((state) => state.project);
  const currentBeat = useDawStore((state) => state.currentBeat);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const snapBeats = useDawStore((state) => state.snapBeats);
  const timelineZoom = useDawStore((state) => state.timelineZoom);
  const preventClipOverlap = useDawStore((state) => state.preventClipOverlap);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const addTrack = useDawStore((state) => state.addTrack);
  const setSnapBeats = useDawStore((state) => state.setSnapBeats);
  const setTimelineZoom = useDawStore((state) => state.setTimelineZoom);
  const setPreventClipOverlap = useDawStore((state) => state.setPreventClipOverlap);
  const totalBeats = useMemo(getTimelineBeats, [project]);
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

  return (
    <section className="panel grid min-h-0 min-w-0 grid-rows-[48px_minmax(0,1fr)] rounded-lg">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-3">
        <span className="panel-title">Arrangement</span>
        <div className="flex min-w-0 items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Snap
            <select
              className="h-6 rounded border border-white/10 bg-studio-950 px-2 text-xs font-bold normal-case tracking-normal text-slate-100 outline-none focus:border-meter-cyan"
              value={snapBeats}
              onChange={(event) => setSnapBeats(Number(event.target.value) as SnapBeats)}
              aria-label="Snap unit"
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
              aria-label="Prevent clip overlap"
            />
            No overlap
          </label>
          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Zoom
            <input
              className="w-24"
              type="range"
              min={MIN_TIMELINE_ZOOM}
              max={MAX_TIMELINE_ZOOM}
              step={0.05}
              value={timelineZoom}
              onChange={(event) => setTimelineZoom(Number(event.target.value))}
              aria-label="Timeline zoom"
            />
          </label>
          <button className="studio-button" onClick={() => addTrack("drum", "Drums")}>
            <Plus size={14} />
            Drum
          </button>
          <button className="studio-button" onClick={() => addTrack("instrument", "Instrument")}>
            <Plus size={14} />
            Inst
          </button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-[178px_minmax(0,1fr)]">
        <div className="border-r border-white/10 bg-black/10">
          <div className="h-9 border-b border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Tracks
          </div>
          {project.tracks.map((track) => (
            <button
              key={track.id}
              className={`flex w-full items-center gap-2 border-b border-white/10 px-3 text-left transition ${
                selectedTrackId === track.id ? "bg-meter-cyan/10" : "hover:bg-white/[0.045]"
              }`}
              style={{ height: TRACK_HEIGHT }}
              onClick={() => selectTrack(track.id)}
            >
              <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-100">{track.name}</span>
                <span className="block text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  {track.role ?? track.type}
                </span>
              </span>
            </button>
          ))}
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
