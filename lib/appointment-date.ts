export type AppointmentDateFilterMode = "all" | "today" | "tomorrow" | "custom";

const ROME_TIME_ZONE = "Europe/Rome";

export function appointmentDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isAppointmentDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function addAppointmentDays(dateKey: string, days: number) {
  if (!isAppointmentDateKey(dateKey)) return dateKey;
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function romeOffsetMilliseconds(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(
    numberPart("year"),
    numberPart("month") - 1,
    numberPart("day"),
    numberPart("hour"),
    numberPart("minute"),
    numberPart("second"),
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function appointmentDayBoundaryIso(dateKey: string, endOfDay = false) {
  if (!isAppointmentDateKey(dateKey)) throw new Error("Data appuntamenti non valida.");
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallClock = Date.UTC(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  let instant = targetWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = targetWallClock - romeOffsetMilliseconds(new Date(instant));
  }
  return new Date(instant).toISOString();
}

export function initialAppointmentDateFilter(options: {
  initialRangeFrom?: string;
  initialRangeTo?: string;
  initialScopeAll?: boolean;
  today?: string;
}) {
  const today = options.today && isAppointmentDateKey(options.today)
    ? options.today
    : appointmentDateKey();
  const tomorrow = addAppointmentDays(today, 1);
  const from = isAppointmentDateKey(options.initialRangeFrom) ? options.initialRangeFrom : today;
  const to = isAppointmentDateKey(options.initialRangeTo) ? options.initialRangeTo : from;

  if (options.initialScopeAll) return { mode: "all" as const, from, to };
  if (from === today && to === today) return { mode: "today" as const, from, to };
  if (from === tomorrow && to === tomorrow) return { mode: "tomorrow" as const, from, to };
  return { mode: "custom" as const, from, to };
}
