import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StudioMode } from "../../education/types";
import { ClipboardCheck, GraduationCap, Keyboard, Music2, SlidersHorizontal } from "../icons";
import { InstrumentLibrary } from "../library/InstrumentLibrary";
import { LoopBrowser } from "../library/LoopBrowser";
import { MixerPanel } from "../mixer/MixerPanel";

type StudioTab = "library" | "loops" | "smart" | "lesson";

type StudioPanelProps = {
  mode: StudioMode;
  lessonContent: ReactNode;
};

const tabs: Array<{ value: StudioTab; label: string; icon: ReactNode }> = [
  { value: "library", label: "Library", icon: <Keyboard size={14} /> },
  { value: "loops", label: "Loops", icon: <Music2 size={14} /> },
  { value: "smart", label: "Smart", icon: <SlidersHorizontal size={14} /> },
  { value: "lesson", label: "Lesson", icon: <GraduationCap size={14} /> }
];

export function StudioPanel({ mode, lessonContent }: StudioPanelProps) {
  const [tab, setTab] = useState<StudioTab>("loops");

  useEffect(() => {
    if (mode === "lesson" || mode === "review") setTab("lesson");
  }, [mode]);

  function renderTab() {
    if (tab === "library") return <InstrumentLibrary />;
    if (tab === "loops") return <LoopBrowser />;
    if (tab === "smart") return <MixerPanel />;
    return <div className="min-h-0 [&>aside]:h-full">{lessonContent}</div>;
  }

  return (
    <aside className="grid min-h-0 grid-rows-[38px_minmax(0,1fr)] gap-2 rounded-lg">
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-graphite-700 bg-graphite-900/80 p-1">
        {tabs.map((item) => (
          <button
            key={item.value}
            className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-black transition ${
              tab === item.value ? "bg-accent-sel text-graphite-975" : "text-slate-300 hover:bg-white/[0.08]"
            }`}
            onClick={() => setTab(item.value)}
            title={item.label}
          >
            {item.value === "lesson" && mode === "review" ? <ClipboardCheck size={14} /> : item.icon}
            <span className="hidden xl:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0">{renderTab()}</div>
    </aside>
  );
}
