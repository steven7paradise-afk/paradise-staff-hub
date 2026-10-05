import { attendanceActualMinutes, scheduledEntryPolicy, scheduleTimeToMinutes } from "./scheduled-attendance";
import { summarizeLateBreakReturns } from "./attendance-break-summary";

type Log = { date: Date; type: string; timestamp: Date; note?: string | null };
type Shift = { date: Date; start_time: string | null; end_time: string | null; location: { name: string } | null;
  category: { code: string; name: string; start_time: string | null; end_time: string | null; paid_hours: number | null } };
type Leave = { start_date: Date; end_date: Date; type: string; start_time: string | null; end_time: string | null };
const key = (date: Date) => date.toISOString().slice(0, 10);
function workShift(shift: Shift) {
  const code = shift.category.code.toUpperCase();
  const name = shift.category.name.toLowerCase();
  return !["R", "RI", "R3", "RIPOSO", "F", "FE", "P", "PE", "M", "MA", "ML", "A", "AI", "NL", "ND"].includes(code)
    && !code.startsWith("CHIUSO")
    && !["riposo", "ferie", "permesso", "malattia", "assenza", "non lavora", "chiuso", "chiusura"].some(word => name.includes(word));
}

export function monthlyProgress(logs: Log[], shifts: Shift[], leaves: Leave[], breakMinutes: number, now: Date, today: string) {
  let workedSeconds = 0, plannedSeconds = 0, lateMinutes = 0, lateCount = 0;
  let running = false, incompleteDays = 0;
  const groups = new Map<string, Log[]>();
  for (const log of logs.filter(log => log.timestamp <= now)) {
    const day = key(log.date);
    groups.set(day, [...(groups.get(day) ?? []), log]);
  }
  for (const shift of shifts.filter(workShift)) {
    const start = scheduleTimeToMinutes(shift.start_time ?? shift.category.start_time);
    const end = scheduleTimeToMinutes(shift.end_time ?? shift.category.end_time);
    if (start === null || end === null) continue;
    const dayLeaves = leaves.filter(l => key(l.start_date) <= key(shift.date) && key(l.end_date) >= key(shift.date));
    if (dayLeaves.some(l => !l.start_time && !l.end_time)) continue;
    const duration = (end - start + 1440) % 1440;
    const net = shift.category.paid_hours !== null ? shift.category.paid_hours * 60 : Math.max(0, duration - (duration >= 360 ? 60 : 0));
    const permitted = dayLeaves.reduce((sum, leave) => {
      const a = scheduleTimeToMinutes(leave.start_time), b = scheduleTimeToMinutes(leave.end_time);
      return sum + (a === null || b === null ? 0 : Math.max(0, Math.min(end, b) - Math.max(start, a)));
    }, 0);
    plannedSeconds += Math.max(0, net - permitted) * 60;
  }
  for (const [day, entries] of groups) {
    const ordered = entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let segment: Date | null = null;
    for (const log of ordered) {
      if (["ENTRATA", "RIENTRO"].includes(log.type)) segment ??= log.timestamp;
      else if (["PAUSA", "USCITA"].includes(log.type) && segment) {
        workedSeconds += Math.max(0, (log.timestamp.getTime() - segment.getTime()) / 1000);
        segment = null;
      }
    }
    if (segment && day === today) {
      workedSeconds += Math.max(0, (now.getTime() - segment.getTime()) / 1000);
      running = true;
    } else if (segment) incompleteDays++;
    const shift = shifts.find(s => key(s.date) === day && workShift(s));
    const entry = ordered.find(log => log.type === "ENTRATA");
    if (shift && entry) {
      const actual = attendanceActualMinutes(entry);
      const excused = leaves.some(l => key(l.start_date) <= day && key(l.end_date) >= day
        && (scheduleTimeToMinutes(l.start_time) ?? 0) <= actual && (scheduleTimeToMinutes(l.end_time) ?? 1440) >= actual);
      const deadline = scheduledEntryPolicy({ plannedStart: shift.start_time ?? shift.category.start_time,
        plannedEnd: shift.end_time ?? shift.category.end_time, locationName: shift.location?.name }).deadlineMinutes;
      if (!excused && deadline !== null && actual > deadline) {
        lateMinutes += actual - deadline;
        lateCount++;
      }
    }
    const breaks = summarizeLateBreakReturns(ordered, breakMinutes);
    lateMinutes += breaks.lateMinutes;
    lateCount += breaks.lateCount;
  }
  return { workedSeconds: Math.floor(workedSeconds), plannedSeconds: Math.floor(plannedSeconds), lateMinutes, lateCount, running, incompleteDays };
}
