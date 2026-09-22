import type { ReviewSummary } from "./types";

export type TeacherDecision = "auto" | "ready" | "needsWork" | "ignore";

export function effectiveDecision(summary: ReviewSummary): Exclude<TeacherDecision, "auto"> {
  return summary.teacherDecision?.decision ?? (summary.ready ? "ready" : "needsWork");
}

export function effectiveStatusLabel(summary: ReviewSummary) {
  switch (summary.teacherDecision?.decision) {
    case "ready": return "교사 확인: 제출 가능";
    case "needsWork": return "교사 확인: 보완 필요";
    case "ignore": return "교사 검토 중";
    default: return summary.statusLabel;
  }
}

export function withTeacherDecision(summary: ReviewSummary, decision: TeacherDecision, updatedAt = Date.now()): ReviewSummary {
  if (decision === "auto") {
    const original = { ...summary };
    delete original.teacherDecision;
    return original;
  }
  return { ...summary, teacherDecision: { decision, updatedAt } };
}
