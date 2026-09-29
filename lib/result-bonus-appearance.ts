import { normalizeShiftResponsibleAnswers, normalizeShiftResponsibleQuestions } from "./shift-responsible-questions";
import type { ResultBonusEvent } from "./result-bonus";

type AppearanceEvent = Pick<ResultBonusEvent, "id" | "userId" | "date" | "type" | "amount" | "evidence" | "actorName">;

/** Read saved, explicit No answers only. Unchecked boxes are not violations. */
export function resultBonusAppearanceEvents(questionsValue: unknown, answersValue: unknown, month: string, today: string, staffIds: string[]): AppearanceEvent[] {
  const questions = normalizeShiftResponsibleQuestions(questionsValue)
    .filter((question) => question.answerType === "STAFF_CHECKLIST" && /presentabilit/i.test(question.title));
  const answers = normalizeShiftResponsibleAnswers(answersValue);
  const allowed = new Set(staffIds);
  const failures = new Map<string, { userId: string; date: string; criteria: Set<string> }>();
  for (const [date, dayAnswers] of Object.entries(answers)) {
    if (!date.startsWith(`${month}-`) || date > today) continue;
    for (const question of questions) {
      let payload: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(dayAnswers[question.id] ?? "null");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        payload = parsed as Record<string, unknown>;
      } catch { continue; }
      const mode = payload.staffResponseMode ?? question.staffResponseMode;
      if (mode !== "YES_NO" || !Array.isArray(payload.staffChecks)) continue;
      for (const raw of payload.staffChecks) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const entry = raw as Record<string, unknown>;
        if (typeof entry.staffId !== "string" || !allowed.has(entry.staffId)
          || !entry.responses || typeof entry.responses !== "object" || Array.isArray(entry.responses)) continue;
        const responses = entry.responses as Record<string, unknown>;
        const criteria = (question.options ?? []).filter((criterion) => responses[criterion] === "NO");
        if (!criteria.length) continue;
        const id = `appearance:${entry.staffId}:${date}`;
        const failure = failures.get(id) ?? { userId: entry.staffId, date, criteria: new Set<string>() };
        criteria.forEach((criterion) => failure.criteria.add(criterion));
        failures.set(id, failure);
      }
    }
  }
  return Array.from(failures, ([id, failure]) => ({
    id, userId: failure.userId, date: failure.date, type: "APPEARANCE",
    evidence: `Presentabilità non conforme: ${[...failure.criteria].join("; ")}`,
    actorName: "Controllo responsabile di turno",
  }));
}
