export type ShortcutId = "play-pause" | "record" | "go-start" | "undo" | "redo-shift" | "redo";

export type ShortcutInfo = {
  id: ShortcutId;
  combo: string;
  title: string;
  description: string;
  tip: string;
};

export type ShortcutKeyLike = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export const SHORTCUTS: ShortcutInfo[] = [
  {
    id: "play-pause",
    combo: "Space",
    title: "재생 / 일시정지",
    description: "현재 위치에서 재생을 시작하거나 멈춥니다.",
    tip: "녹음 중에는 재생 상태만 빠르게 확인할 때 씁니다."
  },
  {
    id: "record",
    combo: "R",
    title: "녹음 시작 / 정지",
    description: "선택된 트랙에서 녹음을 시작하거나 종료합니다.",
    tip: "마이크나 악기 입력을 준비한 뒤 누릅니다."
  },
  {
    id: "go-start",
    combo: "Enter",
    title: "처음으로 이동",
    description: "플레이헤드를 프로젝트 시작 지점으로 되돌립니다.",
    tip: "전체 곡을 처음부터 다시 들을 때 편합니다."
  },
  {
    id: "undo",
    combo: "Ctrl / Cmd + Z",
    title: "실행 취소",
    description: "마지막 편집 작업을 되돌립니다.",
    tip: "클립 이동, 노트 편집, 트랙 설정 변경에 사용합니다."
  },
  {
    id: "redo-shift",
    combo: "Ctrl / Cmd + Shift + Z",
    title: "다시 실행",
    description: "실행 취소한 작업을 다시 적용합니다.",
    tip: "Mac 스타일 다시 실행 단축키입니다."
  },
  {
    id: "redo",
    combo: "Ctrl / Cmd + Y",
    title: "다시 실행",
    description: "실행 취소한 작업을 다시 적용합니다.",
    tip: "Windows 스타일 다시 실행 단축키입니다."
  }
];

function commandPressed(event: ShortcutKeyLike) {
  return Boolean(event.ctrlKey || event.metaKey);
}

export function resolveShortcutKey(event: ShortcutKeyLike) {
  if (event.altKey) return undefined;
  const key = event.key.toLowerCase();
  const code = event.code ?? "";
  const hasCommand = commandPressed(event);

  if (!hasCommand && !event.shiftKey && code === "Space") return SHORTCUTS.find((shortcut) => shortcut.id === "play-pause");
  if (!hasCommand && !event.shiftKey && key === "r") return SHORTCUTS.find((shortcut) => shortcut.id === "record");
  if (!hasCommand && !event.shiftKey && key === "enter") return SHORTCUTS.find((shortcut) => shortcut.id === "go-start");
  if (hasCommand && key === "z" && event.shiftKey) return SHORTCUTS.find((shortcut) => shortcut.id === "redo-shift");
  if (hasCommand && key === "z" && !event.shiftKey) return SHORTCUTS.find((shortcut) => shortcut.id === "undo");
  if (hasCommand && key === "y" && !event.shiftKey) return SHORTCUTS.find((shortcut) => shortcut.id === "redo");

  return undefined;
}

export function shouldDismissShortcutOverlay(event: ShortcutKeyLike) {
  return !resolveShortcutKey(event);
}
