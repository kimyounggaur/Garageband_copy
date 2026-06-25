import { useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import {
  AUTOMATION_PARAM_LABELS,
  AUTOMATION_PARAMS,
  automationBaseValue,
  automationParamRange,
  trackAutomationEntry
} from "../../audio/automation";
import { useDawStore } from "../../store/useDawStore";
import type { AutomationParam, AutomationPoint, Track } from "../../types/project";
import { AUTOMATION_LANE_HEIGHT, beatToX, clamp, snapBeat, xToBeat } from "../../utils/timeline";

type AutomationLaneProps = {
  track: Track;
  width: number;
  pixelsPerBeat: number;
};

const LANE_PADDING_TOP = 9;
const LANE_PADDING_BOTTOM = 12;

function getParamFromTrack(track: Track): AutomationParam {
  return track.automation?.[0]?.param ?? "volume";
}

export function AutomationLane({ track, width, pixelsPerBeat }: AutomationLaneProps) {
  const [param, setParam] = useState<AutomationParam>(() => getParamFromTrack(track));
  const snapBeats = useDawStore((state) => state.snapBeats);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const addAutomationPoint = useDawStore((state) => state.addAutomationPoint);
  const updateAutomationPoint = useDawStore((state) => state.updateAutomationPoint);
  const removeAutomationPoint = useDawStore((state) => state.removeAutomationPoint);
  const beginHistorySnapshot = useDawStore((state) => state.beginHistorySnapshot);
  const commitHistorySnapshot = useDawStore((state) => state.commitHistorySnapshot);
  const entry = trackAutomationEntry(track, param);
  const range = automationParamRange(param);
  const laneHeight = AUTOMATION_LANE_HEIGHT - LANE_PADDING_TOP - LANE_PADDING_BOTTOM;
  const totalBeats = Math.max(1, width / pixelsPerBeat);

  function valueToY(value: number) {
    const progress = (clamp(value, range.min, range.max) - range.min) / (range.max - range.min || 1);
    return LANE_PADDING_TOP + (1 - progress) * laneHeight;
  }

  function yToValue(y: number) {
    const progress = 1 - clamp((y - LANE_PADDING_TOP) / laneHeight, 0, 1);
    return clamp(range.min + progress * (range.max - range.min), range.min, range.max);
  }

  function pointFromClient(clientX: number, clientY: number, element: HTMLElement, shouldSnap: boolean) {
    const rect = element.getBoundingClientRect();
    const rawBeat = xToBeat(clientX - rect.left, pixelsPerBeat);
    return {
      beat: shouldSnap ? snapBeat(rawBeat, snapBeats) : Math.max(0, rawBeat),
      value: yToValue(clientY - rect.top)
    };
  }

  const curvePoints = useMemo(() => {
    const baseValue = automationBaseValue(track, param);
    if (entry.points.length === 0) {
      return [
        { id: "base-start", beat: 0, value: baseValue },
        { id: "base-end", beat: totalBeats, value: baseValue }
      ];
    }
    const points: AutomationPoint[] = [...entry.points];
    if (points[0].beat > 0) {
      points.unshift({ id: "base-start", beat: 0, value: baseValue });
    }
    const last = points[points.length - 1];
    if (last.beat < totalBeats) {
      points.push({ id: "base-end", beat: totalBeats, value: last.value });
    }
    return points;
  }, [entry.points, param, track, totalBeats]);

  const polyline = curvePoints.map((point) => `${beatToX(point.beat, pixelsPerBeat)},${valueToY(point.value)}`).join(" ");

  function handleLanePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectTrack(track.id);
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    const point = pointFromClient(event.clientX, event.clientY, event.currentTarget, shouldSnap);
    addAutomationPoint(track.id, param, point.beat, point.value, { snap: shouldSnap });
  }

  function beginPointDrag(event: PointerEvent<HTMLButtonElement>, point: AutomationPoint) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = event.currentTarget.parentElement;
    if (!lane) return;
    const laneElement = lane;
    const shouldSnap = !event.ctrlKey && !event.metaKey;
    selectTrack(track.id);
    beginHistorySnapshot();

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const nextPoint = pointFromClient(moveEvent.clientX, moveEvent.clientY, laneElement, shouldSnap);
      updateAutomationPoint(track.id, param, point.id, nextPoint, { recordHistory: false, snap: shouldSnap });
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

  function deletePoint(event: MouseEvent<HTMLButtonElement>, point: AutomationPoint) {
    event.preventDefault();
    event.stopPropagation();
    removeAutomationPoint(track.id, param, point.id);
  }

  return (
    <div
      className="relative border-t border-white/10 bg-black/20"
      style={{ height: AUTOMATION_LANE_HEIGHT, width }}
      onPointerDown={handleLanePointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${AUTOMATION_LANE_HEIGHT}`} preserveAspectRatio="none">
        <polyline points={polyline} fill="none" stroke="rgba(94,194,107,0.82)" strokeWidth="2.5" />
        <line x1="0" x2={width} y1={valueToY(automationBaseValue(track, param))} y2={valueToY(automationBaseValue(track, param))} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
      </svg>

      <select
        className="absolute left-2 top-2 z-10 h-7 w-28 rounded-md border border-white/10 bg-studio-950/95 px-2 text-[11px] font-bold text-slate-100 outline-none focus:border-meter-green"
        value={param}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setParam(event.target.value as AutomationParam)}
        aria-label="Automation parameter"
      >
        {AUTOMATION_PARAMS.map((item) => (
          <option key={item} value={item}>
            {AUTOMATION_PARAM_LABELS[item]}
          </option>
        ))}
      </select>

      {entry.points.map((point) => (
        <button
          key={point.id}
          className="absolute z-20 h-3 w-3 rounded-full border border-studio-950 bg-meter-green shadow-[0_0_10px_rgba(94,194,107,0.5)] transition hover:scale-125 focus:outline-none focus:ring-2 focus:ring-meter-green"
          style={{
            left: beatToX(point.beat, pixelsPerBeat) - 6,
            top: valueToY(point.value) - 6
          }}
          onPointerDown={(event) => beginPointDrag(event, point)}
          onDoubleClick={(event) => deletePoint(event, point)}
          aria-label={`${AUTOMATION_PARAM_LABELS[param]} automation point`}
          title={`${AUTOMATION_PARAM_LABELS[param]} ${point.value.toFixed(2)} @ ${point.beat.toFixed(2)}`}
        />
      ))}
    </div>
  );
}
