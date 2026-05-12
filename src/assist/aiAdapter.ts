import type { Project } from "../types/project";
import {
  continueMelody,
  explainProject,
  generateDrumSuggestions,
  suggestChordProgressions,
  type ChordSuggestion,
  type DrumSuggestion,
  type LearningFeedback,
  type MelodySuggestion
} from "./creativeAssist";

export type CreativeAssistAdapter = {
  id: string;
  label: string;
  suggestChords: (project: Project) => Promise<ChordSuggestion[]> | ChordSuggestion[];
  suggestDrums: (project: Project) => Promise<DrumSuggestion[]> | DrumSuggestion[];
  continueMelody: (project: Project, selectedClipId?: string) => Promise<MelodySuggestion[]> | MelodySuggestion[];
  explain: (project: Project, selectedClipId?: string) => Promise<LearningFeedback> | LearningFeedback;
};

export type ExternalAiAssistProvider = Partial<Omit<CreativeAssistAdapter, "id" | "label">>;

export const ruleBasedAssistAdapter: CreativeAssistAdapter = {
  id: "rules",
  label: "규칙 기반",
  suggestChords: suggestChordProgressions,
  suggestDrums: generateDrumSuggestions,
  continueMelody,
  explain: explainProject
};

export function createExternalAiAssistAdapter(provider?: ExternalAiAssistProvider): CreativeAssistAdapter {
  return {
    id: "external-ai",
    label: "AI 연결",
    suggestChords: (project) => provider?.suggestChords?.(project) ?? ruleBasedAssistAdapter.suggestChords(project),
    suggestDrums: (project) => provider?.suggestDrums?.(project) ?? ruleBasedAssistAdapter.suggestDrums(project),
    continueMelody: (project, selectedClipId) =>
      provider?.continueMelody?.(project, selectedClipId) ?? ruleBasedAssistAdapter.continueMelody(project, selectedClipId),
    explain: (project, selectedClipId) => provider?.explain?.(project, selectedClipId) ?? ruleBasedAssistAdapter.explain(project, selectedClipId)
  };
}
