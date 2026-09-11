export const TASK_VIEW_OPTIONS = [
  { value: "HOME", label: "Home" },
  { value: "TABLE", label: "Tabella" },
  { value: "BOARD", label: "Board" },
  { value: "CALENDAR", label: "Calendario" },
  { value: "LIST", label: "Lista" },
] as const;

export type TaskViewPreference = (typeof TASK_VIEW_OPTIONS)[number]["value"];

const taskViewValues = new Set<string>(TASK_VIEW_OPTIONS.map((option) => option.value));

export function normalizeTaskView(value: unknown): TaskViewPreference {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return taskViewValues.has(normalized) ? normalized as TaskViewPreference : "HOME";
}
