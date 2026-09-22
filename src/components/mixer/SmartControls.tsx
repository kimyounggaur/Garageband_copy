import { buildSmartControlPatch, normalizeTrackFx, normalizeTrackSends, resolveSmartControlMacros } from "../../audio/fx";
import { useDawStore } from "../../store/useDawStore";
import { uiText } from "../../utils/uiText";
import { Knob } from "../ui";

export function SmartControls() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const applyTrackSmartControl = useDawStore((state) => state.applyTrackSmartControl);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId) ?? project.tracks[0];

  if (!selectedTrack) {
    return (
      <section className="rounded-md border border-graphite-700 bg-graphite-800/70 p-3 text-xs font-bold text-graphite-500">
        스마트 컨트롤을 사용하려면 트랙을 선택해 주세요.
      </section>
    );
  }

  const macros = resolveSmartControlMacros(selectedTrack);
  const sends = normalizeTrackSends(selectedTrack.sends);
  const fx = normalizeTrackFx(selectedTrack.fx);
  const preview = {
    brightness: buildSmartControlPatch("brightness", macros.brightness).fx?.eq,
    space: buildSmartControlPatch("space", macros.space).sends,
    punch: buildSmartControlPatch("punch", macros.punch).fx?.comp
  };

  return (
    <section className="rounded-md border border-graphite-700 bg-graphite-800/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="panel-title truncate">스마트 컨트롤</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold text-graphite-500">{selectedTrack.name}</div>
        </div>
        <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-ink-body">
          효과
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Knob
          label="밝기"
          value={macros.brightness}
          step={0.02}
          onChange={(value) => applyTrackSmartControl(selectedTrack.id, "brightness", value)}
        />
        <Knob label="공간감" value={macros.space} step={0.02} onChange={(value) => applyTrackSmartControl(selectedTrack.id, "space", value)} />
        <Knob label="타격감" value={macros.punch} step={0.02} onChange={(value) => applyTrackSmartControl(selectedTrack.id, "punch", value)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-graphite-500">
        <div className="rounded bg-black/20 p-2">
          <div className="text-ink-body">이퀄라이저</div>
          <div>저음 {fx.eq.low.toFixed(1)} dB</div>
          <div>중음 {fx.eq.mid.toFixed(1)} dB</div>
          <div>고음 {fx.eq.high.toFixed(1)} dB</div>
        </div>
        <div className="rounded bg-black/20 p-2">
          <div className="text-ink-body">{uiText.common.bus}</div>
          <div>리버브 {(sends.reverb * 100).toFixed(0)}%</div>
          <div>딜레이 {(sends.delay * 100).toFixed(0)}%</div>
          <div>압축 비율 {fx.comp.ratio.toFixed(1)}:1</div>
        </div>
      </div>

      <div className="mt-2 hidden text-[10px] text-graphite-600 xl:block">
        밝기는 고음 조절량 {preview.brightness?.high.toFixed(1)} dB, 공간감은 리버브 {((preview.space?.reverb ?? 0) * 100).toFixed(0)}%,
        타격감은 압축 비율 {preview.punch?.ratio.toFixed(1)}:1에 반영됩니다.
      </div>
    </section>
  );
}
