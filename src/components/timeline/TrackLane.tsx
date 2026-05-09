import type { DragEvent } from "react";
import { useDawStore } from "../../store/useDawStore";
import type { Track } from "../../types/project";
import { TRACK_HEIGHT, snapBeat, xToBeat } from "../../utils/timeline";
import { ClipBlock } from "./ClipBlock";

type TrackLaneProps = {
  track: Track;
  width: number;
  pixelsPerBeat: number;
};

export function TrackLane({ track, width, pixelsPerBeat }: TrackLaneProps) {
  const snapBeats = useDawStore((state) => state.snapBeats);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const selectClip = useDawStore((state) => state.selectClip);
  const setCurrentBeat = useDawStore((state) => state.setCurrentBeat);
  const addLoopClip = useDawStore((state) => state.addLoopClip);
  const addMidiClip = useDawStore((state) => state.addMidiClip);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = snapBeat(xToBeat(event.clientX - rect.left, pixelsPerBeat), snapBeats);
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
        minWidth: "100%",
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: `${pixelsPerBeat * 4}px 100%, ${pixelsPerBeat}px 100%`
      }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setCurrentBeat(snapBeat(xToBeat(event.clientX - rect.left, pixelsPerBeat), snapBeats));
        selectTrack(track.id);
        selectClip(undefined);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {track.clips.map((clip) => (
        <ClipBlock key={clip.id} clip={clip} pixelsPerBeat={pixelsPerBeat} />
      ))}
    </div>
  );
}
