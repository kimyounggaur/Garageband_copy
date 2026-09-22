import { SHORTCUTS, type ShortcutId } from "../../utils/shortcutOverlay";
import { AccessibleModal } from "../ui/AccessibleModal";

type ShortcutHelpDialogProps = {
  activeShortcutId?: ShortcutId;
  onClose: () => void;
};

export function ShortcutHelpDialog({ activeShortcutId, onClose }: ShortcutHelpDialogProps) {
  return (
    <AccessibleModal
      label="단축키 확인"
      className="fixed inset-0 z-[140] grid place-items-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      onClose={onClose}
    >
      <div className="shortcut-help-dialog max-h-full w-[min(760px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-line bg-surface-panel p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-ink-high">단축키 확인</h2>
            <p className="mt-1 text-xs text-ink-body">편집 중에는 입력창 밖에서 단축키를 사용하세요.</p>
          </div>
          <button type="button" className="studio-button min-h-11 min-w-11" onClick={onClose}>
            닫기
          </button>
        </div>
        <ul className="grid gap-2" aria-label="키보드 단축키 목록">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.id}
              data-shortcut-id={shortcut.id}
              className={`grid gap-1 rounded-lg border p-3 sm:grid-cols-[170px_minmax(0,1fr)] ${
                activeShortcutId === shortcut.id
                  ? "border-ink-accent bg-surface-raised text-ink-high"
                  : "border-line bg-surface-raised/50 text-ink-body"
              }`}
            >
              <kbd className="w-fit rounded border border-line-strong bg-surface-base px-2 py-1 text-xs font-black text-ink-high">
                {shortcut.combo}
              </kbd>
              <div>
                <div className="text-sm font-bold text-ink-high">{shortcut.title}</div>
                <div className="mt-0.5 text-xs">{shortcut.description}</div>
                <div className="mt-1 text-[11px] text-ink-body">{shortcut.tip}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AccessibleModal>
  );
}
