import type { InstrumentPatch } from "../../data/instruments";
import { instrumentPatchesByCategory } from "../../data/instruments";
import { useDawStore } from "../../store/useDawStore";
import { Drum, Keyboard, Music2, Sparkles } from "../icons";

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
      <div className="flex h-11 items-center justify-between border-b border-graphite-700 px-3">
        <span className="panel-title">Instrument Library</span>
        <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">
          {selectedTrack?.name ?? "No track"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-3">
          {groups.map((group) => (
            <section key={group.category}>
              <div className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-graphite-500">{group.category}</div>
              <div className="space-y-1">
                {group.patches.map((patch) => {
                  const active = selectedTrack?.instrumentId === patch.id;
                  return (
                    <button
                      key={patch.id}
                      className={`flex w-full items-start gap-2 rounded-md border p-2 text-left transition ${
                        active
                          ? "border-accent-sel bg-accent-sel/12 text-white"
                          : "border-graphite-700 bg-graphite-800/70 text-slate-200 hover:border-graphite-600 hover:bg-graphite-750"
                      }`}
                      onClick={() => applyPatch(patch)}
                      title={`${patch.name} patch`}
                    >
                      <span className="mt-0.5 text-accent-sel">{patchIcon(patch)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black">{patch.name}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-graphite-500">{patch.description}</span>
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
