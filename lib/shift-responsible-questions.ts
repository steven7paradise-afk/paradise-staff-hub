export const SHIFT_RESPONSIBLE_QUESTIONS_KEY = "shift_responsible_questions";
export const SHIFT_RESPONSIBLE_ANSWERS_KEY = "shift_responsible_answers";

export type ShiftResponsibleQuestion = {
  id: string;
  title: string;
  description: string;
  answerType: "YES_NO" | "SHORT_TEXT" | "TEXT" | "MULTI_TEXT" | "TIMELINE" | "MULTIPLE_CHOICE" | "CHECKBOXES" | "DROPDOWN" | "FILE_UPLOAD" | "LINEAR_SCALE" | "RATING" | "MULTIPLE_CHOICE_GRID" | "CHECKBOX_GRID" | "DATE" | "TIME" | "STAFF_NOTE" | "CLIENT_NOTE" | "TASK";
  options?: string[];
  rows?: string[];
  scaleMin?: number;
  scaleMax?: number;
  required?: boolean;
  allowOther?: boolean;
  followUpYes: string;
  followUpNo: string;
  followUps?: Record<string, string>;
  yesLabel?: string;
  noLabel?: string;
};

export type ShiftResponsibleAnswer = "YES" | "NO";
export type ShiftResponsibleAnswers = Record<string, Record<string, string>>;

export function normalizeShiftResponsibleQuestions(value: unknown): ShiftResponsibleQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const title = String(raw.title ?? "").trim().slice(0, 160);
    if (!title) return [];
    const supportedTypes = new Set<ShiftResponsibleQuestion["answerType"]>(["YES_NO", "SHORT_TEXT", "TEXT", "MULTI_TEXT", "TIMELINE", "MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN", "FILE_UPLOAD", "LINEAR_SCALE", "RATING", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID", "DATE", "TIME", "STAFF_NOTE", "CLIENT_NOTE", "TASK"]);
    const candidateType = String(raw.answerType ?? "YES_NO") as ShiftResponsibleQuestion["answerType"];
    const answerType = supportedTypes.has(candidateType) ? candidateType : "YES_NO";
    const options = Array.isArray(raw.options)
      ? raw.options.map((option) => String(option).trim().slice(0, 120)).filter(Boolean).slice(0, 12)
      : [];
    const followUps = raw.followUps && typeof raw.followUps === "object" && !Array.isArray(raw.followUps)
      ? Object.fromEntries(Object.entries(raw.followUps as Record<string, unknown>)
          .flatMap(([key, prompt]) => {
            if (!/^(ANY|OTHER|OPTION_\d{1,2}|VALUE_\d{1,2})$/.test(key)) return [];
            const normalizedPrompt = String(prompt ?? "").trim().slice(0, 160);
            return normalizedPrompt ? [[key, normalizedPrompt]] : [];
          })
          .slice(0, 20))
      : {};
    return [{
      id: String(raw.id ?? `question-${index}`).trim().slice(0, 100) || `question-${index}`,
      title,
      description: String(raw.description ?? "").trim().slice(0, 500),
      answerType,
      options: ["MULTI_TEXT", "MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(answerType) ? options.slice(0, answerType === "MULTI_TEXT" ? 10 : 12) : [],
      rows: Array.isArray(raw.rows) ? raw.rows.map((row) => String(row).trim().slice(0, 120)).filter(Boolean).slice(0, 12) : [],
      scaleMin: Number(raw.scaleMin) === 0 ? 0 : 1,
      scaleMax: Math.max(2, Math.min(10, Number(raw.scaleMax) || 5)),
      required: raw.required !== false,
      allowOther: ["MULTIPLE_CHOICE", "CHECKBOXES"].includes(answerType) && raw.allowOther === true,
      followUpYes: String(raw.followUpYes ?? "").trim().slice(0, 160),
      followUpNo: String(raw.followUpNo ?? "").trim().slice(0, 160),
      followUps,
      yesLabel: String(raw.yesLabel ?? "Sì").trim().slice(0, 80) || "Sì",
      noLabel: String(raw.noLabel ?? "No").trim().slice(0, 80) || "No",
    }];
  });
}

export type ActiveShiftFollowUp = { key: string; prompt: string };

export function activeShiftFollowUps(question: ShiftResponsibleQuestion, answer?: string): ActiveShiftFollowUp[] {
  if (!answer) return [];
  if (question.answerType === "YES_NO") {
    const prompt = answer === "YES" ? question.followUpYes : answer === "NO" ? question.followUpNo : "";
    return prompt ? [{ key: answer, prompt }] : [];
  }

  const followUps = question.followUps ?? {};
  if (["MULTIPLE_CHOICE", "DROPDOWN"].includes(question.answerType)) {
    const index = question.options?.indexOf(answer) ?? -1;
    const key = index >= 0 ? `OPTION_${index}` : answer.startsWith("Altro: ") ? "OTHER" : "";
    return key && followUps[key] ? [{ key, prompt: followUps[key] }] : [];
  }
  if (question.answerType === "CHECKBOXES") {
    try {
      const selected = JSON.parse(answer) as unknown;
      if (!Array.isArray(selected)) return [];
      return selected.flatMap((value) => {
        if (typeof value !== "string") return [];
        const index = question.options?.indexOf(value) ?? -1;
        const key = index >= 0 ? `OPTION_${index}` : value.startsWith("Altro: ") ? "OTHER" : "";
        return key && followUps[key] ? [{ key, prompt: followUps[key] }] : [];
      });
    } catch { return []; }
  }
  if (["LINEAR_SCALE", "RATING"].includes(question.answerType)) {
    const key = `VALUE_${answer}`;
    return followUps[key] ? [{ key, prompt: followUps[key] }] : [];
  }
  return followUps.ANY ? [{ key: "ANY", prompt: followUps.ANY }] : [];
}

export function normalizeShiftResponsibleAnswers(value: unknown): ShiftResponsibleAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([day, answers]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && answers && typeof answers === "object" && !Array.isArray(answers))
      .map(([day, answers]) => [
        day,
        Object.fromEntries(
          Object.entries(answers as Record<string, unknown>)
            .flatMap(([questionId, answer]) => {
              if (typeof answer !== "string") return [];
              const normalized = answer.trim().slice(0, 12000);
              return normalized ? [[questionId, normalized]] : [];
            }),
        ),
      ]),
  );
}
