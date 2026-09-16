import { attendanceActualMinutes, currentRomeMinutes, isClosedSchedule, isRestSchedule, scheduledEntryPolicy } from "./scheduled-attendance";
import { leaveCoversWholeShift } from "./register-leave";

export type SummaryEvent = { date: string; label: string; status: string; minutes: number };
export type StaffSummaryRow = {
  id: string; name: string; location: string; active: boolean; photoUrl?: string | null;
  late: number; lateMinutes: number; missing: number; unjustified: number; sickness: number; holidays: number; permits: number; rest: number; other: number; pending: number;
  events: SummaryEvent[];
};
type Employee = { id: string; name: string; active: boolean; photo_url?: string | null; location: { name: string } | null };
type Schedule = { user_id: string; date: Date; start_time: string | null; end_time: string | null; category: { name: string; code: string; start_time: string | null; end_time: string | null }; location: { name: string } | null };
type Clock = { user_id: string; date: Date; timestamp: Date; type: string; note: string | null };
type Leave = { user_id: string; type: string; start_date: Date; end_date: Date; start_time: string | null; end_time: string | null; status: string; reason: string | null; sickness_unjustified?: boolean };
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const leaveFields = { MALATTIA: "sickness", FERIE: "holidays", PERMESSO: "permits", RIPOSO: "rest", ALTRO: "other" } as const;
const leaveLabels = { MALATTIA: "Malattia", FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", ALTRO: "Altra assenza autorizzata" };

export function buildStaffSummary({ employees, schedules, clocks, leaves, start, end, now = new Date() }: {
  employees: Employee[]; schedules: Schedule[]; clocks: Clock[]; leaves: Leave[]; start: Date; end: Date; now?: Date;
}): StaffSummaryRow[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const logs = new Map<string, Clock[]>();
  for (const log of clocks) {
    const key = `${log.user_id}:${dayKey(log.date)}`;
    logs.set(key, [...(logs.get(key) || []), log]);
  }
  const rows = new Map(employees.map((employee) => [employee.id, {
    id: employee.id, name: employee.name, active: employee.active, photoUrl: employee.photo_url || null, location: employee.location?.name || "Senza sede",
    late: 0, lateMinutes: 0, missing: 0, unjustified: 0, sickness: 0, holidays: 0, permits: 0, rest: 0, other: 0, pending: 0, events: [] as SummaryEvent[],
  }]));
  const counted = new Set<string>();
  for (const leave of leaves) {
    const row = rows.get(leave.user_id);
    if (!row || leave.start_date >= end || leave.end_date < start) continue;
    // Automatic late requests are permits in the database, not days of leave.
    if ((leave.reason || "").startsWith("RITARDO AUTOMATICO")) continue;
    if (leave.status === "PENDING" || leave.status === "FLAGGED") {
      row.pending++;
      row.events.push({ date: dayKey(leave.start_date < start ? start : leave.start_date), label: `${leaveLabels[leave.type as keyof typeof leaveLabels] || "Richiesta"} (richiesta)`, status: "In attesa / da verificare", minutes: 0 });
      continue;
    }
    if (leave.status !== "APPROVED") continue;
    const field = leave.sickness_unjustified ? "unjustified" : leaveFields[leave.type as keyof typeof leaveFields];
    if (!field) continue;
    for (let date = new Date(Math.max(start.getTime(), new Date(`${dayKey(leave.start_date)}T00:00:00Z`).getTime())); date < end && dayKey(date) <= dayKey(leave.end_date); date = new Date(date.getTime() + 86400000)) {
      const key = `${row.id}:${field}:${dayKey(date)}`;
      if (counted.has(key)) continue;
      counted.add(key); row[field]++;
      row.events.push({ date: dayKey(date), label: leaveLabels[leave.type as keyof typeof leaveLabels], status: leave.sickness_unjustified ? "Senza giustifica" : "Approvata", minutes: 0 });
    }
  }
  for (const schedule of schedules) {
    const row = rows.get(schedule.user_id);
    const date = dayKey(schedule.date);
    if (!row || schedule.date < start || schedule.date >= end || date > today || isRestSchedule(schedule.category.name, schedule.category.code) || isClosedSchedule(schedule.category.name, schedule.category.code)) continue;
    const { deadlineMinutes } = scheduledEntryPolicy({ plannedStart: schedule.start_time || schedule.category.start_time, plannedEnd: schedule.end_time || schedule.category.end_time, locationName: schedule.location?.name });
    if (deadlineMinutes === null) continue;
    const dayLogs = (logs.get(`${row.id}:${date}`) || []).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const approved = leaves.filter((leave) => leave.user_id === row.id && leave.status === "APPROVED" && dayKey(leave.start_date) <= date && dayKey(leave.end_date) >= date && !(leave.reason || "").startsWith("RITARDO AUTOMATICO"));
    const fullDayLeave = approved.some((leave) => leaveCoversWholeShift(leave, schedule.start_time || schedule.category.start_time, schedule.end_time || schedule.category.end_time));
    if (fullDayLeave) continue;
    const entry = dayLogs.find((log) => log.type === "ENTRATA");
    if (!dayLogs.some((log) => log.type === "ENTRATA" || log.type === "RIENTRO") && (date < today || currentRomeMinutes(now) > deadlineMinutes)) {
      row.missing++; row.events.push({ date, label: "Assenza / mancata timbratura", status: "Da verificare", minutes: 0 });
    }
    // A partial permit is not automatically a justification for every late entry.
    if (entry) {
      const delay = attendanceActualMinutes(entry) - deadlineMinutes;
      if (delay > 0) {
        row.late++; row.lateMinutes += delay;
        row.events.push({ date, label: "Ritardo ingresso", status: approved.length ? "Da verificare (permesso parziale)" : "Rilevato", minutes: delay });
      }
    }
    for (const log of dayLogs.filter((log) => log.type === "RIENTRO")) {
      if (!/Rientro pausa in ritardo:/i.test(log.note || "")) continue;
      const delay = Number((log.note || "").match(/ritardo (\d+) min/i)?.[1] || 0);
      if (!delay) continue;
      row.late++; row.lateMinutes += delay;
      row.events.push({ date, label: "Ritardo rientro pausa", status: "Rilevato", minutes: delay });
    }
  }
  return [...rows.values()].map((row) => ({ ...row, events: row.events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)) }));
}
