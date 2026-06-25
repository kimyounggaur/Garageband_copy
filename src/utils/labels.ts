import type { ClipType, LoopCategory, TrackRole, TrackType } from "../types/project";

export function statusLabel(
  status: "idle" | "working" | "done" | "error" | "recording" | "saving" | "counting",
  fallback: string
) {
  if (status === "counting") return "Count-in";
  if (status === "recording") return "녹음 중";
  if (status === "saving") return "저장 중";
  if (status === "working") return "처리 중";
  if (status === "done") return "완료";
  if (status === "error") return "오류";
  return fallback;
}

export function clipTypeLabel(type: ClipType) {
  if (type === "midi") return "미디";
  if (type === "audio") return "오디오";
  return "루프";
}

export function trackTypeLabel(type: TrackType) {
  if (type === "drum") return "드럼";
  if (type === "audio") return "오디오";
  return "악기";
}

export function trackRoleLabel(role?: TrackRole | TrackType) {
  if (role === "drummer") return "Drummer";
  if (role === "beat") return "비트";
  if (role === "bass") return "베이스";
  if (role === "melody") return "멜로디";
  if (role === "harmony") return "화성";
  if (role === "recording") return "녹음";
  if (role === "drum" || role === "audio" || role === "instrument") return trackTypeLabel(role);
  return "역할";
}

export function loopCategoryLabel(category: LoopCategory) {
  if (category === "Drums") return "드럼";
  if (category === "Bass") return "베이스";
  if (category === "Synth") return "신스";
  return "효과";
}
