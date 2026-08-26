export const ABSENCE_GRACE_MINUTES = 30;

export function scheduleTimeToMinutes(value: string | null | undefined) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function currentRomeMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function romeMinutesForInstant(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function isRestSchedule(categoryName: string | null | undefined, categoryCode: string | null | undefined) {
  const name = String(categoryName || "").trim().toLowerCase();
  const code = String(categoryCode || "").trim().toUpperCase();
  return name.includes("riposo") || ["R", "RI", "R3", "RIPOSO"].includes(code);
}

export function compareScheduledClock({
  plannedStart,
  categoryName,
  categoryCode,
  hasClockEntry,
  hasApprovedLeave,
  now = new Date(),
}: {
  plannedStart: string | null | undefined;
  categoryName: string | null | undefined;
  categoryCode: string | null | undefined;
  hasClockEntry: boolean;
  hasApprovedLeave: boolean;
  now?: Date;
}) {
  const rest = isRestSchedule(categoryName, categoryCode);
  const plannedMinutes = scheduleTimeToMinutes(plannedStart);
  const elapsedMinutes = plannedMinutes === null ? 0 : Math.max(0, currentRomeMinutes(now) - plannedMinutes);
  const absent = !rest
    && !hasApprovedLeave
    && !hasClockEntry
    && plannedMinutes !== null
    && elapsedMinutes > ABSENCE_GRACE_MINUTES;

  return { absent, rest, elapsedMinutes, plannedMinutes };
}
