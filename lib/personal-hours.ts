import type { AttendanceType } from "@prisma/client";
import { calculateClockHours } from "@/lib/work-hours";

type Category = {
  name: string;
  code: string;
  color: string;
  text_color: string;
  start_time: string | null;
  end_time: string | null;
  paid_hours: number | null;
};

type ScheduleRow = { date: Date; start_time?: string | null; end_time?: string | null; category: Category };
type ClockLog = { date: Date; type: AttendanceType; timestamp: Date };
type StoredHours = { date: Date; hours: number; paid_break: boolean; manual_override: boolean; note: string | null };

export type PersonalDayHours = {
  date: Date;
  schedule: ScheduleRow | undefined;
  plannedHours: number;
  workedHours: number;
  grossHours: number;
  breakHours: number;
  firstEntry: string | null;
  lastExit: string | null;
  note: string;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundedHours(hours: number) {
  return Math.round(hours * 100) / 100;
}

function durationHours(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

export function plannedHours(schedule?: ScheduleRow) {
  const startTime = schedule?.start_time ?? schedule?.category.start_time;
  const endTime = schedule?.end_time ?? schedule?.category.end_time;
  if (!startTime || !endTime) return 0;
  const rawHours = schedule?.category.paid_hours ?? durationHours(startTime, endTime);
  const expectedHours = rawHours >= 6 ? rawHours - 1 : rawHours;
  return roundedHours(expectedHours);
}

export function monthlyPersonalHours(year: number, month: number, schedules: ScheduleRow[], logs: ClockLog[], records: StoredHours[]) {
  const scheduleByDate = new Map(schedules.map((entry) => [dayKey(entry.date), entry]));
  const recordByDate = new Map(records.map((entry) => [dayKey(entry.date), entry]));
  const logGroups = new Map<string, ClockLog[]>();
  logs.forEach((log) => {
    const key = dayKey(log.date);
    logGroups.set(key, [...(logGroups.get(key) ?? []), log]);
  });

  const days = Array.from(
    { length: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() },
    (_, index) => new Date(Date.UTC(year, month, index + 1)),
  );

  return days.map((date) => {
    const key = dayKey(date);
    const schedule = scheduleByDate.get(key);
    const record = recordByDate.get(key);
    const clock = calculateClockHours(logGroups.get(key) ?? []);
    const automaticHours = record?.paid_break ? clock.grossHours : clock.netHours;
    return {
      date,
      schedule,
      plannedHours: plannedHours(schedule),
      workedHours: roundedHours(record?.manual_override ? record.hours : automaticHours),
      grossHours: clock.grossHours,
      breakHours: clock.breakHours,
      firstEntry: clock.firstEntry,
      lastExit: clock.lastExit,
      note: record?.note ?? "",
    };
  });
}
