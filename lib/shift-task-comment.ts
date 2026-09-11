import type { ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";

type CommentItem = {
  domanda: string;
  risposta: string;
  approfondimenti: Array<{ domanda: string; risposta: string }>;
};

function cleanText(value: unknown, limit = 1200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function formatStructuredAnswer(question: ShiftResponsibleQuestion, rawValue: string) {
  if (rawValue === "YES") return question.yesLabel || "Sì";
  if (rawValue === "NO") return question.noLabel || "No";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return cleanText(rawValue, 1600);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => cleanText(item, 300)).filter(Boolean).join(", ");
  }
  if (!parsed || typeof parsed !== "object") return cleanText(String(parsed ?? ""), 1600);

  const value = parsed as Record<string, unknown>;
  if (Array.isArray(value.staffNotes)) {
    return value.staffNotes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      const name = cleanText(entry.name, 160);
      const note = cleanText(entry.note, 500);
      return name && note ? [`${name}: ${note}`] : [];
    }).join("; ");
  }
  if (Array.isArray(value.clientNotes)) {
    return value.clientNotes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      const name = cleanText(entry.name, 160);
      const time = cleanText(entry.time, 20);
      const service = cleanText(entry.service, 240);
      const note = cleanText(entry.note, 700);
      if (!name || !note) return [];
      const details = [time, service].filter(Boolean).join(" · ");
      return [`${name}${details ? ` (${details})` : ""}: ${note}`];
    }).join("; ");
  }
  if (Array.isArray(value.textEntries)) {
    return value.textEntries.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      const label = cleanText(entry.label, 160).replace(/:\s*$/, "");
      const answer = cleanText(entry.value, 700);
      return label && answer ? [`${label}: ${answer}`] : [];
    }).join("; ");
  }
  if (Array.isArray(value.timelineEntries)) {
    return value.timelineEntries.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      const time = cleanText(entry.time, 20);
      const note = cleanText(entry.note, 700);
      return time && note ? [`${time} — ${note}`] : [];
    }).join("; ");
  }
  if (typeof value.fileName === "string" || typeof value.url === "string") {
    const fileName = cleanText(value.fileName, 240) || "File allegato";
    const url = cleanText(value.url, 800);
    return `${fileName}${url ? ` — ${url}` : ""}`;
  }

  return Object.entries(value).flatMap(([key, item]) => {
    if (["id", "staffId", "appointmentId", "driveFileId", "taskId", "assignees", "group"].includes(key)) return [];
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
    if (Array.isArray(item)) {
      const text = item.map((entry) => cleanText(entry, 200)).filter(Boolean).join(", ");
      return text ? [`${label}: ${text}`] : [];
    }
    const text = cleanText(item, 700);
    return text ? [`${label}: ${text}`] : [];
  }).join("; ");
}

function formatItalianDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function buildShiftTaskCommentContext(
  day: string,
  taskTitle: string,
  questions: ShiftResponsibleQuestion[],
  dayAnswers: Record<string, string>,
) {
  const items: CommentItem[] = questions.flatMap((question) => {
    if (question.answerType === "TASK") return [];
    const rawAnswer = dayAnswers[question.id];
    if (!rawAnswer) return [];
    const risposta = formatStructuredAnswer(question, rawAnswer);
    if (!risposta) return [];
    const approfondimenti = Object.entries(dayAnswers).flatMap(([key, answer]) => {
      if (!key.startsWith(`${question.id}::`)) return [];
      const branch = key.slice(question.id.length + 2);
      const prompt = branch === "YES" ? question.followUpYes : branch === "NO" ? question.followUpNo : question.followUps?.[branch];
      const formatted = cleanText(answer, 1200);
      return formatted ? [{ domanda: prompt || "Approfondimento", risposta: formatted }] : [];
    });
    return [{ domanda: question.title, risposta, approfondimenti }];
  });

  const lines = [
    `Turno del ${formatItalianDay(day)}`,
    `Task: ${cleanText(taskTitle, 500)}`,
    "",
    "Dati registrati:",
    ...items.flatMap((item) => [
      `• ${item.domanda}: ${item.risposta}`,
      ...item.approfondimenti.map((detail) => `  ${detail.domanda}: ${detail.risposta}`),
    ]),
  ];
  return { items, readableText: lines.join("\n").slice(0, 6000) };
}
