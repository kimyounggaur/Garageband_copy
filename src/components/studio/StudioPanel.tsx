import { GraduationCap, SlidersHorizontal } from "../icons";
import { useState } from "react";
import { MixerPanel } from "../mixer/MixerPanel";
import { StudentPanel } from "../education/StudentPanel";
import { RepositorySwitch } from "./RepositorySwitch";

type StudioTab = "mixer" | "class";

export function StudioPanel() {
  const [tab, setTab] = useState<StudioTab>("mixer");

  return (
    <aside className="grid min-h-0 grid-rows-[38px_auto_minmax(0,1fr)] gap-2 rounded-lg">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-graphite-700 bg-graphite-900/80 p-1">
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-black transition ${
            tab === "mixer" ? "bg-accent-sel text-graphite-975" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => setTab("mixer")}
          title="믹서"
        >
          <SlidersHorizontal size={14} />
          믹서
        </button>
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-black transition ${
            tab === "class" ? "bg-accent-play text-graphite-975" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => setTab("class")}
          title="수업"
        >
          <GraduationCap size={14} />
          수업
        </button>
      </div>

      <RepositorySwitch />

      <div className="min-h-0 [&>aside]:h-full">{tab === "mixer" ? <MixerPanel /> : <StudentPanel />}</div>
    </aside>
  );
}
