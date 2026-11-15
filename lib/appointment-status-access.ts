import { appointmentDateKey } from "./appointment-date";
import { agendaSalonScope, resolveAgendaAppointmentSalon } from "./appointment-booking-salon";
import { appointmentSalonSlugFromName, repubblicaIncludesLegacyBuenosAires } from "./appointment-salon-url";
import { hasCurrentAttendanceAtAppointmentSalon, isAlwaysActiveAppointmentStaff, matchesAppointmentOwnerName } from "./appointment-staff-access";
import { deriveAttendanceState } from "./attendance-state";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
import type { CowlendarBooking } from "./cowlendar";
import { prisma } from "./prisma";

type BookingWorker = { id: string; name: string; sede_id: string | null; location: { name: string } | null };
type Teammate = { id?: string; name?: string };
type StaffAliases = Record<string, { userId?: string }>;

function nameParts(value?: string) {
  const name = String(value || "").split("|")[0].normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return name ? name.split(/\s+/) : [];
}

export function resolveAppointmentStatusWorkers(
  workers: BookingWorker[],
  booking: Pick<CowlendarBooking, "teammates">,
  override: Teammate[] | undefined,
  aliases: StaffAliases,
) {
  if (override?.length) {
    return workers.filter(worker => override.some(mate => mate.id === worker.id));
  }
  const assignedIds = new Set(booking.teammates?.map(mate => {
    const byId = workers.find(worker => worker.id === mate.id || worker.id === aliases[mate.id]?.userId);
    if (byId) return byId.id;
    const name = `${mate.firstname ?? ""} ${mate.lastname ?? ""}`;
    const parts = nameParts(name);
    const normalized = parts.join(" ");
    if (!normalized || /^(staff disponibile|staff assente paradise|non assegnat[oi])$/.test(normalized)) return null;
    const exact = workers.filter(worker => nameParts(worker.name).join(" ") === normalized || matchesAppointmentOwnerName(worker, name));
    if (exact.length) return exact.length === 1 ? exact[0].id : null;
    const partial = workers.filter(worker => parts.every(part => nameParts(worker.name).includes(part)));
    return partial.length === 1 ? partial[0].id : null;
  }));
  return workers.filter(worker => assignedIds.has(worker.id));
}

export async function appointmentStatusContext(bookingId: string) {
  const [record, settings, locations] = await Promise.all([
    prisma.appointmentArchive.findUnique({ where: { id: bookingId }, select: { payload: true, start_at: true, sheet: true } }),
    prisma.setting.findMany({
      where: { key: { in: ["appointment_team_overrides", "appointment_staff_aliases"] } },
      select: { key: true, value: true },
    }),
    prisma.location.findMany({ select: { id: true, name: true, active: true, opening_time: true } }),
  ]);
  if (!record) return null;
  const booking = record.payload as unknown as CowlendarBooking;
  if (!booking || booking.is_canceled) return null;
  const users = await prisma.user.findMany({
    where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } },
    select: { id: true, name: true, sede_id: true, location: { select: { name: true } } },
  });
  const overrides = settings.find(({ key }) => key === "appointment_team_overrides")?.value as Record<string, { teammates?: Teammate[] }> | undefined;
  const aliases = settings.find(({ key }) => key === "appointment_staff_aliases")?.value as StaffAliases | undefined;
  const workers = resolveAppointmentStatusWorkers(users, booking, overrides?.[bookingId]?.teammates, aliases ?? {});
  const scope = agendaSalonScope(locations);
  const salon = resolveAgendaAppointmentSalon(booking, workers.map(worker => worker.location?.name), scope, true);
  const location = locations.find(location => location.active && appointmentSalonSlugFromName(location.name) === salon);
  const eligibleLocationIds = !location ? [] : [location.id, ...locations
    .filter(other => salon === "repubblica" && repubblicaIncludesLegacyBuenosAires(locations, location.id) &&
      !other.active && appointmentSalonSlugFromName(other.name) === "buenos-aires")
    .map(other => other.id)];
  const sheet = record.sheet as { status?: string } | null;
  return { booking, scheduledAt: record.start_at, sheetStatus: sheet?.status, workers, salon, location, eligibleLocationIds };
}

export async function hasPresentAppointmentWorker(workerIds: string[], eligibleLocationIds: string[], now: Date) {
  if (!workerIds.length || !eligibleLocationIds.length) return false;
  const today = new Date(`${appointmentDateKey(now)}T00:00:00.000Z`);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: { in: workerIds }, date: { gte: today, lt: tomorrow }, timestamp: { lte: now } },
    select: { type: true, timestamp: true, location_id: true, user_id: true },
    orderBy: { timestamp: "asc" },
  });
  return workerIds.some(id => {
    const state = deriveAttendanceState(logs.filter(log => log.user_id === id));
    return hasCurrentAttendanceAtAppointmentSalon(state.status, state.lastValidLog?.location_id, eligibleLocationIds);
  });
}

export async function hasAvailableAssignedAppointmentWorker(
  workers: Pick<BookingWorker, "id" | "name">[],
  eligibleLocationIds: string[],
  now: Date,
) {
  if (!eligibleLocationIds.length) return false;
  if (workers.some(worker => isAlwaysActiveAppointmentStaff(worker.name, worker.id))) return true;
  return hasPresentAppointmentWorker(workers.map(worker => worker.id), eligibleLocationIds, now);
}
