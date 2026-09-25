import { deriveAttendanceState, type AttendanceStateLog } from "./attendance-state";
import { attendanceActualMinutes, compareScheduledClock, scheduledEntryPolicy, currentRomeMinutes, scheduleTimeToMinutes } from "./scheduled-attendance";

type Worker = {
  id: string; name: string; location: { name: string } | null;
  attendance_logs: (AttendanceStateLog & { timestamp: Date; note: string | null })[];
  schedule_entries: { start_time: string | null; end_time: string | null; location: { name: string } | null;
    category: { name: string; code: string; start_time: string | null; end_time: string | null } }[];
  leave_requests: { type: string; start_time: string | null; end_time: string | null }[];
};

export function staffDashboardItem(worker: Worker, now: Date) {
  const state = deriveAttendanceState(worker.attendance_logs.filter(log => log.timestamp <= now));
  const shift = worker.schedule_entries[0];
  const location = shift?.location?.name ?? worker.location?.name ?? "Sede non assegnata";
  const start = shift?.start_time ?? shift?.category.start_time;
  const end = shift?.end_time ?? shift?.category.end_time;
  const category = shift?.category.name.toLowerCase() ?? "";
  const vacation = worker.leave_requests.some(l => l.type === "FERIE") || category.includes("ferie");
  const sick = worker.leave_requests.some(l => l.type === "MALATTIA") || category.includes("malattia");
  const leaveNow = worker.leave_requests.some(l => {
    const start = scheduleTimeToMinutes(l.start_time), end = scheduleTimeToMinutes(l.end_time);
    return (start === null || currentRomeMinutes(now) >= start) && (end === null || currentRomeMinutes(now) < end);
  });
  const comparison = compareScheduledClock({ plannedStart: start, plannedEnd: end, locationName: location,
    categoryName: shift?.category.name, categoryCode: shift?.category.code,
    hasClockEntry: !!state.firstEntry, hasApprovedLeave: leaveNow || vacation || sick, now });
  const deadline = scheduledEntryPolicy({ plannedStart: start, plannedEnd: end, locationName: location }).deadlineMinutes;
  const lateMinutes = state.firstEntry && deadline !== null && !comparison.rest && !comparison.closed && !vacation && !sick
    ? Math.max(0, attendanceActualMinutes(state.firstEntry) - deadline) : 0;
  const categories: string[] = [];
  if (state.status !== "OUT") categories.push("present");
  if (comparison.absent) categories.push("absent");
  if (vacation) categories.push("vacation");
  if (sick) categories.push("sick");
  if (lateMinutes > 0) categories.push("late");
  return { id: worker.id, name: worker.name, location, categories, lateMinutes,
    detail: state.status === "BREAK" ? "In pausa" : state.status === "IN" ? "In turno" : comparison.absent ? `Ingresso previsto ${start}` : state.firstEntry ? "Turno terminato" : "" };
}
