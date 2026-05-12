import { useEffect, useRef, useState } from "react";
import { getClipPeakOverview } from "../../audio/clipAudio";
import type { Clip } from "../../types/project";

type AudioWaveformProps = {
  clip: Clip;
  className?: string;
  color?: string;
  showTrim?: boolean;
};

type CanvasSize = {
  width: number;
  height: number;
};

function finiteSeconds(value: number | undefined) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
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

export function AudioWaveform({ clip, className, color = "#e2e8f0", showTrim = false }: AudioWaveformProps) {
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
  }, [clip.fadeInSeconds, clip.fadeOutSeconds, clip.gain, clip.trimEndSeconds, clip.trimStartSeconds, color, overview, showTrim, size]);

  return <canvas ref={canvasRef} className={className} aria-label="오디오 파형" />;
}
