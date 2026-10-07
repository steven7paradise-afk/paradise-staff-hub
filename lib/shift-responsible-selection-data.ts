import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/shift-reports";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { selectShiftResponsible } from "@/lib/shift-responsible-selection";

export async function resolveShiftResponsible(day: string, preferredId?: string) {
  const { date, start, end } = romeDayRange(day);
  const people = await prisma.user.findMany({
    where: { active: true, employee_status: { not: "Ex dipendente" }, mansione: { contains: "responsabile salone", mode: "insensitive" }, location: { name: { contains: "Buenos Aires", mode: "insensitive" } } },
    select: { id: true, mansione: true,
      schedule_entries: { where: { date }, select: { start_time: true, end_time: true, category: { select: { name: true, start_time: true, end_time: true } } } },
      attendance_logs: { where: { timestamp: { gte: start, lt: end } }, select: { type: true, timestamp: true } },
    }, orderBy: { name: "asc" },
  });
  return selectShiftResponsible(people.map(person => ({
    id: person.id, vice: /vice/i.test(person.mansione || ""),
    resting: person.schedule_entries.length > 0 && person.schedule_entries.every(entry => /riposo/i.test(entry.category.name)),
    working: person.schedule_entries.some(entry => !/riposo|ferie|malattia|permesso|assenz/i.test(entry.category.name) && Boolean((entry.start_time || entry.category.start_time) && (entry.end_time || entry.category.end_time))),
    clockedIn: Boolean(deriveAttendanceState(person.attendance_logs).firstEntry),
  })), preferredId);
}

export async function loadUpcomingResponsibles(day: string) {
  const { previewShiftResponsible } = await import("@/lib/shift-responsible-preview");
  const dates = [1, 2].map(offset => {
    const value = new Date(`${day}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  });
  const people = await prisma.user.findMany({
    where: { active: true, employee_status: { not: "Ex dipendente" }, mansione: { contains: "responsabile salone", mode: "insensitive" }, location: { name: { contains: "Buenos Aires", mode: "insensitive" } } },
    select: { name: true, mansione: true, schedule_entries: { where: { date: { in: dates.map(d => romeDayRange(d).date) } }, select: { date: true, start_time: true, end_time: true, category: { select: { name: true, start_time: true, end_time: true } } } } },
    orderBy: { name: "asc" },
  });
  return dates.map(d => previewShiftResponsible(d, people.map(person => {
    const entry = person.schedule_entries.find(e => e.date.toISOString().slice(0, 10) === d);
    return { name: person.name, vice: /vice/i.test(person.mansione || ""), category: entry?.category.name || "Non programmato", start: entry?.start_time || entry?.category.start_time || null, end: entry?.end_time || entry?.category.end_time || null };
  })));
}
