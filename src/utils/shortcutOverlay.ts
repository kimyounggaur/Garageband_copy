export type ShortcutHandlers = {
  playPause: () => void;
  record: () => void;
  stop: () => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  duplicateClip: () => void;
  deleteClip: () => void;
  moveClipBack: () => void;
  moveClipForward: () => void;
  selectPreviousTrack: () => void;
  selectNextTrack: () => void;
  seekBack: () => void;
  seekForward: () => void;
  toggleCycle: () => void;
  help: () => void;
};

export type ShortcutId =
  | "play-pause" | "record" | "stop" | "stop-enter" | "undo" | "redo-shift" | "redo"
  | "save" | "duplicate-clip" | "delete-clip" | "move-clip-back" | "move-clip-forward"
  | "previous-track" | "next-track" | "seek-back" | "seek-forward" | "cycle" | "help";

export type ShortcutInfo = {
  id: ShortcutId;
  combo: string;
  title: string;
  description: string;
  tip: string;
  scope: "workspace" | "timeline";
  key?: string;
  code?: string;
  command?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (actions: ShortcutHandlers) => void;
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
  { id: "play-pause", combo: "Space", title: "재생 / 일시정지", description: "현재 위치에서 재생하거나 멈춥니다.", tip: "입력창과 버튼에서는 기본 키 동작을 우선합니다.", scope: "workspace", code: "Space", handler: (a) => a.playPause() },
  { id: "record", combo: "R", title: "녹음 시작 / 정지", description: "준비된 트랙에서 녹음을 시작하거나 끝냅니다.", tip: "오디오 트랙 녹음에는 마이크 권한이 필요합니다.", scope: "workspace", key: "r", handler: (a) => a.record() },
  { id: "stop", combo: "Shift + Space", title: "정지", description: "재생을 멈추고 처음으로 이동합니다.", tip: "Space는 일시정지 후 이어 듣기입니다.", scope: "workspace", code: "Space", shift: true, handler: (a) => a.stop() },
  { id: "stop-enter", combo: "Enter", title: "정지", description: "재생을 멈추고 처음으로 이동합니다.", tip: "클립·버튼에 초점이 있으면 해당 항목을 먼저 실행합니다.", scope: "workspace", key: "enter", handler: (a) => a.stop() },
  { id: "undo", combo: "Ctrl / Cmd + Z", title: "실행 취소", description: "마지막 편집을 되돌립니다.", tip: "입력창 안에서는 문자 실행 취소가 우선합니다.", scope: "workspace", key: "z", command: true, handler: (a) => a.undo() },
  { id: "redo-shift", combo: "Ctrl / Cmd + Shift + Z", title: "다시 실행", description: "취소한 편집을 다시 적용합니다.", tip: "Mac 스타일 다시 실행입니다.", scope: "workspace", key: "z", command: true, shift: true, handler: (a) => a.redo() },
  { id: "redo", combo: "Ctrl / Cmd + Y", title: "다시 실행", description: "취소한 편집을 다시 적용합니다.", tip: "Windows 스타일 다시 실행입니다.", scope: "workspace", key: "y", command: true, handler: (a) => a.redo() },
  { id: "save", combo: "Ctrl / Cmd + S", title: "프로젝트 저장", description: "현재 프로젝트를 로컬 저장소에 저장합니다.", tip: "브라우저의 페이지 저장 대신 프로젝트 저장이 실행됩니다.", scope: "workspace", key: "s", command: true, handler: (a) => a.save() },
  { id: "duplicate-clip", combo: "Alt + Shift + D", title: "선택 클립 복제", description: "선택한 클립을 복제합니다.", tip: "브라우저 북마크 키와 겹치지 않도록 Alt를 사용합니다.", scope: "timeline", key: "d", shift: true, alt: true, handler: (a) => a.duplicateClip() },
  { id: "delete-clip", combo: "Delete", title: "선택 클립 삭제", description: "타임라인에서 선택한 클립을 삭제합니다.", tip: "타임라인에 초점이 있을 때만 동작합니다.", scope: "timeline", key: "delete", handler: (a) => a.deleteClip() },
  { id: "move-clip-back", combo: "Alt + Shift + ←", title: "클립 왼쪽 이동", description: "선택한 클립을 스냅 한 칸 앞당깁니다.", tip: "잠긴 클립은 움직이지 않습니다.", scope: "timeline", key: "arrowleft", shift: true, alt: true, handler: (a) => a.moveClipBack() },
  { id: "move-clip-forward", combo: "Alt + Shift + →", title: "클립 오른쪽 이동", description: "선택한 클립을 스냅 한 칸 늦춥니다.", tip: "잠긴 클립은 움직이지 않습니다.", scope: "timeline", key: "arrowright", shift: true, alt: true, handler: (a) => a.moveClipForward() },
  { id: "previous-track", combo: "Alt + Shift + ↑", title: "이전 트랙", description: "위쪽 트랙을 선택합니다.", tip: "트랙 제목에서 방향키로도 이동할 수 있습니다.", scope: "timeline", key: "arrowup", shift: true, alt: true, handler: (a) => a.selectPreviousTrack() },
  { id: "next-track", combo: "Alt + Shift + ↓", title: "다음 트랙", description: "아래쪽 트랙을 선택합니다.", tip: "트랙 제목에서 방향키로도 이동할 수 있습니다.", scope: "timeline", key: "arrowdown", shift: true, alt: true, handler: (a) => a.selectNextTrack() },
  { id: "seek-back", combo: "Alt + Shift + J", title: "재생 위치 이전", description: "재생 위치를 스냅 한 칸 앞당깁니다.", tip: "브라우저 뒤로 가기 키와 구분합니다.", scope: "workspace", key: "j", shift: true, alt: true, handler: (a) => a.seekBack() },
  { id: "seek-forward", combo: "Alt + Shift + K", title: "재생 위치 다음", description: "재생 위치를 스냅 한 칸 늦춥니다.", tip: "타임라인 눈금에서 방향키로도 이동할 수 있습니다.", scope: "workspace", key: "k", shift: true, alt: true, handler: (a) => a.seekForward() },
  { id: "cycle", combo: "C", title: "반복 켜기 / 끄기", description: "현재 반복 구간을 켜거나 끕니다.", tip: "반복 구간은 눈금에서 드래그해 만들 수 있습니다.", scope: "workspace", key: "c", handler: (a) => a.toggleCycle() },
  { id: "help", combo: "?", title: "단축키 도움말", description: "단축키 목록을 엽니다.", tip: "열린 창은 Escape로 닫습니다.", scope: "workspace", code: "Slash", shift: true, handler: (a) => a.help() }
];

export function resolveShortcutKey(event: ShortcutKeyLike) {
  const command = Boolean(event.ctrlKey || event.metaKey);
  const key = event.key.toLowerCase();
  return SHORTCUTS.find((shortcut) =>
    command === Boolean(shortcut.command) &&
    Boolean(event.shiftKey) === Boolean(shortcut.shift) &&
    Boolean(event.altKey) === Boolean(shortcut.alt) &&
    (shortcut.code ? event.code === shortcut.code : key === shortcut.key)
  );
}

export function shouldDismissShortcutOverlay(event: ShortcutKeyLike) {
  return !resolveShortcutKey(event);
}
