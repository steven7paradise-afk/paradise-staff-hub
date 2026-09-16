import { scheduleTimeToMinutes } from "./scheduled-attendance";

/** An absence with times can still cover the entire scheduled shift. */
export function leaveCoversWholeShift(leave: { start_time?: string | null; end_time?: string | null }, plannedStart?: string | null, plannedEnd?: string | null) {
  if (!leave.start_time && !leave.end_time) return true;
  const start = scheduleTimeToMinutes(leave.start_time);
  const end = scheduleTimeToMinutes(leave.end_time);
  const shiftStart = scheduleTimeToMinutes(plannedStart);
  const shiftEnd = scheduleTimeToMinutes(plannedEnd);
  if (start === null || end === null || shiftStart === null || shiftEnd === null) return false;
  return end >= start && shiftEnd >= shiftStart && start <= shiftStart && end >= shiftEnd;
}
