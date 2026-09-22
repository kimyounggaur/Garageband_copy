import type { InstrumentPatch } from "../../data/instruments";
import { instrumentPatchesByCategory } from "../../data/instruments";
import { useDawStore } from "../../store/useDawStore";
import { Drum, Keyboard, Music2, Sparkles } from "../icons";

const CATEGORY_LABELS: Record<InstrumentPatch["category"], string> = {
  Drums: "드럼", Bass: "베이스", Keys: "건반", Synths: "신스", FX: "효과"
};
const PATCH_DESCRIPTIONS: Record<string, string> = {
  "studio-drum-kit": "MIDI 드럼 트랙용 킥, 스네어, 하이햇 소리입니다.",
  "warm-analog-bass": "낮은 선율에 어울리는 둥글고 따뜻한 베이스입니다.",
  "classic-electric-piano": "코드와 수업에 어울리는 부드럽고 또렷한 건반입니다.",
  "bright-studio-keys": "선율을 또렷하게 들려주는 밝은 건반입니다.",
  "glass-poly-synth": "맑은 아르페지오와 밝은 겹소리에 어울립니다.",
  "cinematic-pad": "긴 화음과 장면 전환에 어울리는 느린 패드입니다.",
  "soft-fx-tone": "상승음과 강조에 쓰는 단순한 효과음입니다.",
  "webband-test-tone": "자체 생성 사인파 샘플로 재생 경로를 시험합니다. 실제 악기 음원이 아닙니다."
};

function patchIcon(patch: InstrumentPatch) {
  if (patch.iconKey === "drum") return <Drum size={14} />;
  if (patch.iconKey === "bass") return <Music2 size={14} />;
  if (patch.iconKey === "synth" || patch.iconKey === "fx") return <Sparkles size={14} />;
  return <Keyboard size={14} />;
}

function trackTypeForPatch(patch: InstrumentPatch) {
  return patch.category === "Drums" ? "drum" : "instrument";
}

export function InstrumentLibrary() {
  const project = useDawStore((state) => state.project);
  const selectedTrackId = useDawStore((state) => state.selectedTrackId);
  const addTrack = useDawStore((state) => state.addTrack);
  const selectTrack = useDawStore((state) => state.selectTrack);
  const setTrackInstrument = useDawStore((state) => state.setTrackInstrument);
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId);
  const groups = instrumentPatchesByCategory();

  function applyPatch(patch: InstrumentPatch) {
    const canUseSelected =
      selectedTrack && selectedTrack.type !== "audio" && (patch.category === "Drums" ? selectedTrack.type === "drum" : selectedTrack.type !== "drum");
    const targetTrackId = canUseSelected ? selectedTrack.id : addTrack(trackTypeForPatch(patch), patch.name);
    setTrackInstrument(targetTrackId, patch.id);
    selectTrack(targetTrackId);
  }

  return (
    <aside className="panel flex h-full min-h-0 flex-col rounded-lg">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <span className="panel-title">악기 라이브러리</span>
        <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">
          {selectedTrack?.name ?? "선택된 트랙 없음"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-3">
          {groups.map((group) => (
            <section key={group.category}>
              <div className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-graphite-500">{CATEGORY_LABELS[group.category]}</div>
              <div className="space-y-1">
                {group.patches.map((patch) => {
                  const active = selectedTrack?.instrumentId === patch.id;
                  return (
                    <button
                      key={patch.id}
                      className={`flex w-full items-start gap-2 rounded-md border p-2 text-left transition ${
                        active
                          ? "border-accent-sel bg-accent-sel/12 text-ink-high"
                          : "border-line bg-graphite-800/70 text-ink-high hover:border-graphite-600 hover:bg-graphite-750"
                      }`}
                      onClick={() => applyPatch(patch)}
                      title={`${patch.name} 악기 적용`}
                    >
                      <span className="mt-0.5 text-ink-accent">{patchIcon(patch)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black">{patch.name}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-graphite-500">{PATCH_DESCRIPTIONS[patch.id] ?? patch.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
