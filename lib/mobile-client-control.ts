import { prisma } from "./prisma";
import { getCowlendarBookingsForRange } from "./cowlendar";
import { appointmentDayBoundaryIso } from "./appointment-date";
import { isAssignedWorker, type AssignedMate } from "./mobile-client-control-policy";

export async function assignedClientBookings(userId: string, date: string) {
  const [bookings, settings] = await Promise.all([
    getCowlendarBookingsForRange({ startDate: appointmentDayBoundaryIso(date), endDate: appointmentDayBoundaryIso(date, true), limit: 400 }),
    prisma.setting.findMany({ where: { key: { in: ["appointment_team_overrides", "appointment_staff_aliases", "appointment_status_overrides"] } } }),
  ]);
  const values = new Map(settings.map(s => [s.key, s.value]));
  const teams = (values.get("appointment_team_overrides") ?? {}) as Record<string, { teammates?: AssignedMate[] }>;
  const aliases = (values.get("appointment_staff_aliases") ?? {}) as Record<string, { userId?: string }>;
  const statuses = (values.get("appointment_status_overrides") ?? {}) as Record<string, { status?: string }>;
  // Never use fuzzy names for authorization. Unknown external IDs fail closed.
  return [...new Map(bookings.map(b => [b.id, b])).values()].filter(b => !b.is_canceled).flatMap(b => {
    const team = teams[b.id]?.teammates ?? (b.teammates ?? []).map(t => ({ id: t.id, name: [t.firstname, t.lastname].filter(Boolean).join(" ") }));
    if (!isAssignedWorker(userId, team, aliases)) return [];
    return [{ booking: b, status: statuses[b.id]?.status ?? b.attendance ?? b.confirmation_status ?? "PRENOTATO" }];
  });
}
