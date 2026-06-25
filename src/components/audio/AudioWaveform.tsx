import { type PointerEvent, useEffect, useRef, useState } from "react";
import { getClipPeakOverview } from "../../audio/clipAudio";
import type { Clip } from "../../types/project";

type AudioWaveformProps = {
  clip: Clip;
  className?: string;
  color?: string;
  showTrim?: boolean;
  editable?: boolean;
  bpm?: number;
  playheadBeat?: number;
  onEdit?: (settings: Partial<Pick<Clip, "trimStartSeconds" | "trimEndSeconds" | "fadeInBeats" | "fadeOutBeats">>) => void;
};

type CanvasSize = {
  width: number;
  height: number;
};

function finiteSeconds(value: number | undefined) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function finiteBeats(value: number | undefined) {
  const beats = Number(value ?? 0);
  return Number.isFinite(beats) ? Math.max(0, beats) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return [226, 232, 240];
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AudioWaveform({
  clip,
  className,
  color = "#e2e8f0",
  showTrim = false,
  editable = false,
  bpm = 120,
  playheadBeat,
  onEdit
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getClipPeakOverview>>>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return;

    const updateSize = () => {
      setSize({
        width: Math.max(1, Math.round(parent.clientWidth)),
        height: Math.max(1, Math.round(parent.clientHeight))
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOverview(undefined);
    getClipPeakOverview(clip, 768)
      .then((nextOverview) => {
        if (!cancelled) setOverview(nextOverview);
      })
      .catch(() => {
        if (!cancelled) setOverview(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [clip.audioAssetId, clip.audioUrl, clip.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(size.width * scale));
    canvas.height = Math.max(1, Math.floor(size.height * scale));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const centerY = size.height / 2;
    context.strokeStyle = rgba(color, 0.22);
    context.beginPath();
    context.moveTo(0, centerY);
    context.lineTo(size.width, centerY);
    context.stroke();

    if (!overview?.peaks.length) {
      context.strokeStyle = rgba(color, 0.28);
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(0, centerY - 6);
      context.lineTo(size.width, centerY + 6);
      context.stroke();
      context.setLineDash([]);
      return;
    }

    context.strokeStyle = rgba(color, 0.78);
    context.lineWidth = Math.max(1, size.width / overview.peaks.length);

    for (let x = 0; x < size.width; x += 1) {
      const peakIndex = Math.min(overview.peaks.length - 1, Math.floor((x / size.width) * overview.peaks.length));
      const amplitude = Math.max(0.025, overview.peaks[peakIndex]);
      const height = amplitude * (size.height * 0.46);
      context.beginPath();
      context.moveTo(x + 0.5, centerY - height);
      context.lineTo(x + 0.5, centerY + height);
      context.stroke();
    }

    if (showTrim && overview.durationSeconds > 0) {
      const trimStart = finiteSeconds(clip.trimStartSeconds);
      const trimEnd = finiteSeconds(clip.trimEndSeconds);
      const left = Math.min(size.width, (trimStart / overview.durationSeconds) * size.width);
      const right = Math.max(0, size.width - (trimEnd / overview.durationSeconds) * size.width);
      context.fillStyle = "rgba(2, 6, 23, 0.58)";
      if (left > 0) context.fillRect(0, 0, left, size.height);
      if (right < size.width) context.fillRect(right, 0, size.width - right, size.height);
      context.strokeStyle = rgba("#38bdf8", 0.9);
      context.lineWidth = 1;
      [left, right].forEach((edge) => {
        context.beginPath();
        context.moveTo(edge, 0);
        context.lineTo(edge, size.height);
        context.stroke();
      });
    }

    const secondsPerBeat = 60 / Math.max(1, bpm);
    const fadeInSeconds = Math.max(finiteSeconds(clip.fadeInSeconds), finiteBeats(clip.fadeInBeats) * secondsPerBeat);
    const fadeOutSeconds = Math.max(finiteSeconds(clip.fadeOutSeconds), finiteBeats(clip.fadeOutBeats) * secondsPerBeat);
    if (overview.durationSeconds > 0 && (fadeInSeconds > 0 || fadeOutSeconds > 0)) {
      context.strokeStyle = rgba("#e0b341", 0.92);
      context.lineWidth = 2;
      if (fadeInSeconds > 0) {
        const fadeX = clamp((fadeInSeconds / overview.durationSeconds) * size.width, 0, size.width);
        context.beginPath();
        context.moveTo(0, size.height - 5);
        context.quadraticCurveTo(fadeX * 0.45, centerY, fadeX, 5);
        context.stroke();
      }
      if (fadeOutSeconds > 0) {
        const fadeX = clamp(size.width - (fadeOutSeconds / overview.durationSeconds) * size.width, 0, size.width);
        context.beginPath();
        context.moveTo(fadeX, 5);
        context.quadraticCurveTo(fadeX + (size.width - fadeX) * 0.55, centerY, size.width, size.height - 5);
        context.stroke();
      }
    }

    if (playheadBeat !== undefined && playheadBeat >= clip.startBeat && playheadBeat <= clip.startBeat + clip.lengthBeats) {
      const markerX = ((playheadBeat - clip.startBeat) / Math.max(0.25, clip.lengthBeats)) * size.width;
      context.strokeStyle = "rgba(251, 113, 133, 0.95)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(markerX, 0);
      context.lineTo(markerX, size.height);
      context.stroke();
    }
  }, [
    bpm,
    clip.fadeInBeats,
    clip.fadeInSeconds,
    clip.fadeOutBeats,
    clip.fadeOutSeconds,
    clip.gain,
    clip.lengthBeats,
    clip.startBeat,
    clip.trimEndSeconds,
    clip.trimStartSeconds,
    color,
    overview,
    playheadBeat,
    showTrim,
    size
  ]);

  function beginHandleDrag(kind: "trimStart" | "trimEnd" | "fadeIn" | "fadeOut", event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    function update(clientX: number) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !overview) return;
      const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      if (kind === "trimStart") onEdit?.({ trimStartSeconds: ratio * overview.durationSeconds });
      if (kind === "trimEnd") onEdit?.({ trimEndSeconds: (1 - ratio) * overview.durationSeconds });
      if (kind === "fadeIn") onEdit?.({ fadeInBeats: clamp(ratio * clip.lengthBeats, 0, clip.lengthBeats / 2) });
      if (kind === "fadeOut") onEdit?.({ fadeOutBeats: clamp((1 - ratio) * clip.lengthBeats, 0, clip.lengthBeats / 2) });
    }

    update(event.clientX);
    const handleMove = (moveEvent: globalThis.PointerEvent) => update(moveEvent.clientX);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  const trimLeft = overview?.durationSeconds ? (finiteSeconds(clip.trimStartSeconds) / overview.durationSeconds) * 100 : 0;
  const trimRight = overview?.durationSeconds ? 100 - (finiteSeconds(clip.trimEndSeconds) / overview.durationSeconds) * 100 : 100;
  const fadeInLeft = (finiteBeats(clip.fadeInBeats) / Math.max(0.25, clip.lengthBeats)) * 100;
  const fadeOutLeft = 100 - (finiteBeats(clip.fadeOutBeats) / Math.max(0.25, clip.lengthBeats)) * 100;

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Audio waveform" />
      {editable && overview ? (
        <>
          <button
            className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded bg-meter-cyan/80"
            style={{ left: `${trimLeft}%` }}
            title="Trim start"
            aria-label="Trim start"
            onPointerDown={(event) => beginHandleDrag("trimStart", event)}
          />
          <button
            className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded bg-meter-cyan/80"
            style={{ left: `${trimRight}%` }}
            title="Trim end"
            aria-label="Trim end"
            onPointerDown={(event) => beginHandleDrag("trimEnd", event)}
          />
          <button
            className="absolute top-1 h-4 w-4 -translate-x-1/2 cursor-ew-resize rounded-full border border-white/70 bg-meter-amber"
            style={{ left: `${fadeInLeft}%` }}
            title="Fade in"
            aria-label="Fade in"
            onPointerDown={(event) => beginHandleDrag("fadeIn", event)}
          />
          <button
            className="absolute bottom-1 h-4 w-4 -translate-x-1/2 cursor-ew-resize rounded-full border border-white/70 bg-meter-amber"
            style={{ left: `${fadeOutLeft}%` }}
            title="Fade out"
            aria-label="Fade out"
            onPointerDown={(event) => beginHandleDrag("fadeOut", event)}
          />
        </>
      ) : null}
    </div>
  );
}
