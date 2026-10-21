import { prisma } from '@/lib/prisma';
import { isRestSchedule, isClosedSchedule } from '@/lib/scheduled-attendance';
import { addDays } from './time';

export async function scheduledShifts(employeeIds: string[], from: string, to: string) {
  // Planning stores calendar dates at UTC midnight, not instants in Rome.
  const rows = await prisma.scheduleEntry.findMany({
    where: { user_id: { in: employeeIds }, date: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(`${addDays(to, 1)}T00:00:00Z`) } },
    select: { id: true, user_id: true, date: true, start_time: true, end_time: true,
      category: { select: { name: true, code: true, start_time: true, end_time: true } } },
    orderBy: [{ date: 'asc' }, { user_id: 'asc' }],
  });
  return rows.flatMap(row => {
    const category = row.category;
    const rest = isRestSchedule(category.name, category.code);
    const start = row.start_time || category.start_time;
    const end = row.end_time || category.end_time;
    const absence = ['F', 'P', 'M', 'A', 'AI', 'AS', 'FERIE', 'PERMESSO', 'MALATTIA'].includes(category.code.trim().toUpperCase())
      || /ferie|permesso|malattia|assenza/i.test(category.name);
    if (!rest && (absence || isClosedSchedule(category.name, category.code) || (!start && !end))) return [];
    return [{ id: row.id, employee_id: row.user_id, date: row.date.toISOString().slice(0, 10),
      type: rest ? 'RIPOSO' as const : 'TURNO' as const,
      start_time: rest ? null : start, end_time: rest ? null : end }];
  });
}
