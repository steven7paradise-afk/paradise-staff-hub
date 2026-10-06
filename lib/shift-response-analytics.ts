import type { ShiftResponsibleQuestion } from "./shift-responsible-questions";

export function shiftAnswerDistribution(question: ShiftResponsibleQuestion, values: Record<string, string>[]) {
  const counts = new Map<string, number>();
  let answered = 0;
  for (const row of values) {
    const raw = row[question.id]?.trim();
    if (!raw) continue;
    answered++;
    let labels: string[] = [];
    if (question.answerType === "YES_NO") labels = [raw === "YES" ? question.yesLabel || "Sì" : raw === "NO" ? question.noLabel || "No" : "Altra risposta"];
    else if (["MULTIPLE_CHOICE", "DROPDOWN", "RATING", "LINEAR_SCALE"].includes(question.answerType)) labels = [raw];
    else if (question.answerType === "CHECKBOXES") {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) labels = [...new Set(parsed.filter((v): v is string => typeof v === "string"))]; } catch { /* legacy answer stays in coverage */ }
    }
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  }
  return { answered, total: values.length, missing: values.length - answered,
    options: [...counts].map(([label, count]) => ({ label, count, percent: answered ? Math.round(count / answered * 100) : 0 })).sort((a, b) => b.count - a.count),
  };
}
