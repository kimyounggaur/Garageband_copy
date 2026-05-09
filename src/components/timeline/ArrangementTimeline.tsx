import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDawStore } from "../../store/useDawStore";
import { DEFAULT_PROJECT_BEATS, PIXELS_PER_BEAT, TRACK_HEIGHT, beatToX } from "../../utils/timeline";
import { TrackLane } from "./TrackLane";

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
  const selectTrack = useDawStore((state) => state.selectTrack);
  const addTrack = useDawStore((state) => state.addTrack);
  const totalBeats = useMemo(getTimelineBeats, [project]);
  const bars = Array.from({ length: Math.ceil(totalBeats / 4) }, (_, index) => index + 1);
  const width = Math.max(totalBeats * PIXELS_PER_BEAT, viewportWidth);

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
    <section className="panel grid min-h-0 min-w-0 grid-rows-[44px_minmax(0,1fr)] rounded-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <span className="panel-title">Arrangement</span>
        <div className="flex items-center gap-2">
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
                <span className="block text-[11px] uppercase tracking-[0.08em] text-slate-500">{track.type}</span>
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
                  style={{ width: PIXELS_PER_BEAT * 4 }}
                >
                  {bar}
                </div>
              ))}
            </div>

            <div
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-meter-green shadow-[0_0_0_1px_rgba(74,222,128,0.18)]"
              style={{ left: beatToX(currentBeat) }}
            >
              <div className="-ml-1.5 h-3 w-3 rounded-sm bg-meter-green" />
            </div>

            {project.tracks.map((track) => (
              <TrackLane key={track.id} track={track} width={width} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
