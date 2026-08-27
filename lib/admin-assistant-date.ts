const ITALIAN_MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
] as const;

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function romeMidnightInstant(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, date, 12));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(noon);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const offset = representedAsUtc - noon.getTime();
  return new Date(Date.UTC(year, month - 1, date) - offset);
}

export function formatRomeDateTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  const localTime = `${part("hour")}:${part("minute")}`;
  return { date: localDate, time: localTime, label: `${part("day")}/${part("month")}/${part("year")} ${localTime}`, timeZone: "Europe/Rome" as const };
}

export type AssistantDateContext = {
  timeZone: "Europe/Rome";
  today: string;
  todayLabel: string;
  yesterday: string;
  tomorrow: string;
  weekStart: string;
  weekEnd: string;
  currentMonth: number;
  currentMonthName: string;
  currentYear: number;
  previousMonth: number;
  previousMonthName: string;
  previousMonthYear: number;
  nextMonth: number;
  nextMonthName: string;
  nextMonthYear: number;
};

export function buildAssistantDateContext(now = new Date()): AssistantDateContext {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = today.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = anchor.getUTCDay() || 7;
  const weekStart = addUtcDays(anchor, 1 - weekday);
  const weekEnd = addUtcDays(weekStart, 6);
  const previous = new Date(Date.UTC(year, month - 2, 1, 12));
  const next = new Date(Date.UTC(year, month, 1, 12));
  return {
    timeZone: "Europe/Rome",
    today,
    todayLabel: new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full" }).format(now),
    yesterday: isoDay(addUtcDays(anchor, -1)),
    tomorrow: isoDay(addUtcDays(anchor, 1)),
    weekStart: isoDay(weekStart),
    weekEnd: isoDay(weekEnd),
    currentMonth: month,
    currentMonthName: ITALIAN_MONTHS[month - 1],
    currentYear: year,
    previousMonth: previous.getUTCMonth() + 1,
    previousMonthName: ITALIAN_MONTHS[previous.getUTCMonth()],
    previousMonthYear: previous.getUTCFullYear(),
    nextMonth: next.getUTCMonth() + 1,
    nextMonthName: ITALIAN_MONTHS[next.getUTCMonth()],
    nextMonthYear: next.getUTCFullYear(),
  };
}

export function requestedMonthPeriod(text: string, context: AssistantDateContext) {
  const normalized = text.toLocaleLowerCase("it");
  if (/questo mese|mese corrente|nel mese attuale/.test(normalized)) {
    return { month: context.currentMonth, year: context.currentYear };
  }
  if (/mese scorso|mese precedente/.test(normalized)) {
    return { month: context.previousMonth, year: context.previousMonthYear };
  }
  if (/mese prossimo|prossimo mese/.test(normalized)) {
    return { month: context.nextMonth, year: context.nextMonthYear };
  }
  const monthIndex = ITALIAN_MONTHS.findIndex((month) => normalized.includes(month));
  if (monthIndex < 0) return null;
  const explicitYear = normalized.match(/\b(20\d{2}|21\d{2})\b/)?.[1];
  return { month: monthIndex + 1, year: explicitYear ? Number(explicitYear) : context.currentYear };
}

export function requestedDayPeriod(text: string, context: AssistantDateContext) {
  const normalized = text.toLocaleLowerCase("it");
  const day = /\bieri\b/.test(normalized)
    ? context.yesterday
    : /\bdomani\b/.test(normalized)
      ? context.tomorrow
      : /\boggi\b/.test(normalized)
        ? context.today
        : null;
  if (!day) return null;
  const dayAnchor = new Date(`${day}T12:00:00.000Z`);
  const nextDay = isoDay(addUtcDays(dayAnchor, 1));
  const start = romeMidnightInstant(day);
  const end = romeMidnightInstant(nextDay);
  return { day, start: start.toISOString(), end: end.toISOString() };
}
