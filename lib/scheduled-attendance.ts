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

export function scheduledEntryPolicy({
  plannedStart,
  plannedEnd,
  locationName,
}: {
  plannedStart: string | null | undefined;
  plannedEnd?: string | null | undefined;
  locationName?: string | null | undefined;
}) {
  const plannedMinutes = scheduleTimeToMinutes(plannedStart);
  const officeFlexible = String(locationName || "").toLowerCase().includes("ufficio paradise")
    && ["09:00", "10:00"].includes(String(plannedStart || "").slice(0, 5))
    && String(plannedEnd || "").slice(0, 5) === "18:00";
  const deadlineMinutes = plannedMinutes === null
    ? null
    : officeFlexible
      ? 10 * 60
      : plannedMinutes + ABSENCE_GRACE_MINUTES;
  return { plannedMinutes, deadlineMinutes, officeFlexible };
}

export function expectedShiftEndTime({
  plannedStart,
  plannedEnd,
  locationName,
  actualEntryMinutes,
}: {
  plannedStart: string | null | undefined;
  plannedEnd: string | null | undefined;
  locationName?: string | null | undefined;
  actualEntryMinutes?: number | null;
}) {
  const endMinutes = scheduleTimeToMinutes(plannedEnd);
  if (endMinutes === null) return null;

  const { plannedMinutes, officeFlexible } = scheduledEntryPolicy({ plannedStart, plannedEnd, locationName });
  const entryDelay = officeFlexible && plannedMinutes !== null && actualEntryMinutes !== null && actualEntryMinutes !== undefined
    ? Math.max(0, actualEntryMinutes - plannedMinutes)
    : 0;
  const expectedMinutes = endMinutes + entryDelay;
  return `${String(Math.floor(expectedMinutes / 60) % 24).padStart(2, "0")}:${String(expectedMinutes % 60).padStart(2, "0")}`;
}

export function compareScheduledClock({
  plannedStart,
  plannedEnd,
  locationName,
  categoryName,
  categoryCode,
  hasClockEntry,
  hasApprovedLeave,
  now = new Date(),
}: {
  plannedStart: string | null | undefined;
  plannedEnd?: string | null | undefined;
  locationName?: string | null | undefined;
  categoryName: string | null | undefined;
  categoryCode: string | null | undefined;
  hasClockEntry: boolean;
  hasApprovedLeave: boolean;
  now?: Date;
}) {
  const rest = isRestSchedule(categoryName, categoryCode);
  const { plannedMinutes, deadlineMinutes, officeFlexible } = scheduledEntryPolicy({ plannedStart, plannedEnd, locationName });
  const elapsedMinutes = deadlineMinutes === null ? 0 : Math.max(0, currentRomeMinutes(now) - deadlineMinutes);
  const absent = !rest
    && !hasApprovedLeave
    && !hasClockEntry
    && deadlineMinutes !== null
    && currentRomeMinutes(now) > deadlineMinutes;

  return { absent, rest, elapsedMinutes, plannedMinutes, deadlineMinutes, officeFlexible };
}
