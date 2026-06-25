import { SHORTCUTS, type ShortcutId } from "../../utils/shortcutOverlay";

type ShortcutHelpDialogProps = {
  activeShortcutId?: ShortcutId;
  onClose: () => void;
};

const rowY = 112;
const rowHeight = 62;

export function ShortcutHelpDialog({ activeShortcutId, onClose }: ShortcutHelpDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="단축키 확인"
      onMouseDown={onClose}
    >
      <div className="shortcut-help-dialog w-[min(940px,calc(100vw-24px))]" aria-live="polite">
        <svg className="shortcut-help-poster h-auto w-full" viewBox="0 0 940 560" role="img" aria-labelledby="shortcut-help-title shortcut-help-desc">
          <title id="shortcut-help-title">GarageBand Copy 단축키 이미지</title>
          <desc id="shortcut-help-desc">재생, 녹음, 처음으로 이동, 실행 취소, 다시 실행 단축키 목록입니다.</desc>
          <defs>
            <linearGradient id="shortcutPosterBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#17202d" />
              <stop offset="55%" stopColor="#0f1217" />
              <stop offset="100%" stopColor="#0a0c10" />
            </linearGradient>
            <linearGradient id="shortcutPosterAccent" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7ad7ff" />
              <stop offset="52%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#f6c453" />
            </linearGradient>
            <filter id="shortcutGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="10" y="10" width="920" height="540" rx="24" fill="url(#shortcutPosterBg)" stroke="#343c49" strokeWidth="2" />
          <rect x="34" y="32" width="872" height="6" rx="3" fill="url(#shortcutPosterAccent)" />
          <text x="56" y="74" className="shortcut-help-eyebrow">
            USER MANUAL
          </text>
          <text x="56" y="104" className="shortcut-help-title">
            단축키 확인
          </text>
          <text x="728" y="86" className="shortcut-help-hint">
            다른 키 또는 클릭: 닫기
          </text>

          <g transform={`translate(40 ${rowY})`}>
            <rect x="0" y="-6" width="860" height="38" rx="10" fill="rgba(255,255,255,0.055)" />
            <text x="26" y="18" className="shortcut-help-column">
              단축키
            </text>
            <text x="280" y="18" className="shortcut-help-column">
              동작
            </text>
            <text x="548" y="18" className="shortcut-help-column">
              사용 팁
            </text>
          </g>

          {SHORTCUTS.map((shortcut, index) => {
            const y = rowY + 48 + index * rowHeight;
            const active = activeShortcutId === shortcut.id;
            return (
              <g key={shortcut.id} className={`shortcut-help-row ${active ? "is-active" : ""}`} data-shortcut-id={shortcut.id} transform={`translate(40 ${y})`}>
                <rect className="shortcut-help-row-bg" x="0" y="0" width="860" height="52" rx="14" />
                <rect className="shortcut-help-keycap" x="24" y="11" width="200" height="30" rx="8" />
                <text className="shortcut-help-key" x="124" y="31" textAnchor="middle">
                  {shortcut.combo}
                </text>
                <text className="shortcut-help-action" x="280" y="22">
                  {shortcut.title}
                </text>
                <text className="shortcut-help-description" x="280" y="39">
                  {shortcut.description}
                </text>
                <text className="shortcut-help-tip" x="548" y="31">
                  {shortcut.tip}
                </text>
                {active ? <rect className="shortcut-help-pulse" x="8" y="4" width="844" height="44" rx="13" filter="url(#shortcutGlow)" /> : null}
              </g>
            );
          })}

          <text x="470" y="525" textAnchor="middle" className="shortcut-help-footer">
            팝업이 열린 동안 위 단축키를 누르면 해당 텍스트가 빛납니다.
          </text>
        </svg>
      </div>
    </div>
  );
}
