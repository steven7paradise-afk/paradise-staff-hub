export const WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY = "weekly_shift_responsibles";

export type ShiftResponsibleAssignments = Record<string, string>;

export function normalizeShiftResponsibleAssignments(value: unknown): ShiftResponsibleAssignments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([day, userId]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && typeof userId === "string" && userId.trim())
      .map(([day, userId]) => [day, String(userId).trim()]),
  );
}

export function weekDays(monday: string) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(monday)
    ? new Date(`${monday}T12:00:00.000Z`)
    : new Date();
  const weekday = anchor.getUTCDay();
  anchor.setUTCDate(anchor.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
