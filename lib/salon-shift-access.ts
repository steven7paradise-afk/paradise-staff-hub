import { deriveAttendanceState } from "@/lib/attendance-state";
import { prisma } from "@/lib/prisma";

type SalonCollaboratorIdentity = {
  role?: string | null;
  location?: { name?: string | null } | null;
};

const SHIFT_PROTECTED_PAGE_PREFIXES = ["/appointments", "/service-forms"] as const;
const SHIFT_PROTECTED_API_PREFIXES = [
  "/api/appointments",
  "/api/service-forms",
  "/api/client-control/analytics",
  "/api/client-control/polish-note",
  "/api/client-control/tablet-submit",
  "/api/orders/pickup",
  "/api/shopify-order-lookup",
] as const;

export function isSalonCollaborator(user?: SalonCollaboratorIdentity | null) {
  if (user?.role !== "DIPENDENTE") return false;
  const locationName = String(user.location?.name ?? "").trim().toLowerCase();
  return Boolean(locationName) && !locationName.includes("ufficio");
}

export function isShiftProtectedPath(pathname: string) {
  return [...SHIFT_PROTECTED_PAGE_PREFIXES, ...SHIFT_PROTECTED_API_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function romeTodayDate(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}

export async function hasActiveAttendanceShift(userId: string, now = new Date()) {
  const date = romeTodayDate(now);
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const [logs, schedule] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { user_id: userId, date: { gte: date, lt: nextDate } },
      select: { type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.scheduleEntry.findFirst({
      where: { user_id: userId, date: { gte: date, lt: nextDate } },
      select: { category: { select: { name: true, code: true } } },
    }),
  ]);
  if (!schedule) return false;
  const categoryName = schedule.category.name.toLowerCase();
  const categoryCode = schedule.category.code.toUpperCase();
  const isNonWorkingDay =
    categoryName.includes("riposo") ||
    categoryName.includes("chiuso") ||
    categoryName.includes("ferie") ||
    categoryName.includes("malattia") ||
    ["R", "RI", "R3", "RIPOSO"].includes(categoryCode);
  if (isNonWorkingDay) return false;
  const state = deriveAttendanceState(logs);
  return state.status === "IN" || state.status === "BREAK";
}

export async function canAccessSalonShiftModules(
  user: SalonCollaboratorIdentity & { id: string },
  now = new Date(),
) {
  if (!isSalonCollaborator(user)) return true;
  return hasActiveAttendanceShift(user.id, now);
}
