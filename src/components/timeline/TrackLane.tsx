import type { DragEvent } from "react";
import { useDawStore } from "../../store/useDawStore";
import type { Track } from "../../types/project";
import { PIXELS_PER_BEAT, TRACK_HEIGHT, snapBeat, xToBeat } from "../../utils/timeline";
import { ClipBlock } from "./ClipBlock";

type TrackLaneProps = {
  track: Track;
  width: number;
};

export function TrackLane({ track, width }: TrackLaneProps) {
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const addLoopClip = useDawStore((state) => state.addLoopClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = snapBeat(xToBeat(event.clientX - rect.left, PIXELS_PER_BEAT));
    const loopId = event.dataTransfer.getData("application/webband-loop");
    const midi = event.dataTransfer.getData("application/webband-midi");
    if (loopId) addLoopClip(loopId, track.id, beat);
    if (midi) addMidiClip(track.id, beat);
  }

  return (
    <div
      className="relative border-b border-white/10"
      style={{
        height: TRACK_HEIGHT,
        width,
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: `${PIXELS_PER_BEAT * 4}px 100%, ${PIXELS_PER_BEAT}px 100%`
      }}
      onClick={() => {
        selectTrack(track.id);
        selectClip(undefined);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {track.clips.map((clip) => (
        <ClipBlock key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
