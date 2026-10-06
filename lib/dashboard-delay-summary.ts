import { attendanceActualMinutes, isRestSchedule, isClosedSchedule, scheduledEntryPolicy } from "./scheduled-attendance";
import { summarizeLateBreakReturns } from "./attendance-break-summary";

type Log = { date: Date; type: string; timestamp: Date; note?: string | null };
type Shift = { date: Date; start_time?: string | null; end_time?: string | null; category: { name: string; code: string; start_time?: string | null; end_time?: string | null } };
export function dashboardDelaySummary(logs: Log[], shifts: Shift[], locationName: string | null | undefined, breakLimit: number) {
  const days = new Map<string, Log[]>();
  for (const log of logs) { const key = log.date.toISOString().slice(0, 10); days.set(key, [...(days.get(key) || []), log]); }
  let entryMinutes = 0, entryCount = 0, breakCount = 0, breakMinutes = 0;
  const seen = new Set<string>();
  for (const shift of shifts) {
    const key = shift.date.toISOString().slice(0, 10);
    if (seen.has(key) || isRestSchedule(shift.category.name, shift.category.code) || isClosedSchedule(shift.category.name, shift.category.code)) continue;
    seen.add(key);
    const entry = (days.get(key) || []).filter(log => log.type === "ENTRATA").sort((a,b) => +a.timestamp - +b.timestamp)[0];
    const policy = scheduledEntryPolicy({ plannedStart: shift.start_time || shift.category.start_time, plannedEnd: shift.end_time || shift.category.end_time, locationName });
    if (entry && policy.deadlineMinutes !== null) {
      const delay = Math.max(0, attendanceActualMinutes(entry) - policy.deadlineMinutes);
      if (delay) { entryCount++; entryMinutes += delay; }
    }
  }
  for (const dailyLogs of days.values()) {
    const summary = summarizeLateBreakReturns(dailyLogs, breakLimit);
    breakMinutes += summary.lateMinutes;
    breakCount += summary.lateCount;
  }
  return { entryMinutes, breakMinutes, entryCount, breakCount, totalCount: entryCount + breakCount, totalMinutes: entryMinutes + breakMinutes };
}
export function formatDelayMinutes(minutes: number) {
  const value = Math.max(0, Math.floor(minutes));
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}`;
}

export function formatDelayCount(count: number) {
  return `${count} ${count === 1 ? "ritardo" : "ritardi"}`;
}
