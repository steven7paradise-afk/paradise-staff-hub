import type { Prisma } from "@prisma/client";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { prisma } from "@/lib/prisma";
import { canAccess, canEdit, getEffectivePermissionSet } from "@/lib/roles";

const romeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });

export function attendanceToday(now = new Date()) {
  return romeDate.format(now);
}

export async function attendanceRegisterAccess(userId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, mansione: true, active: true, employee_status: true },
  });
  if (!currentUser?.active || currentUser.employee_status === FORMER_EMPLOYEE_STATUS) return null;
  const permissions = await getEffectivePermissionSet(prisma, currentUser);
  const hasFullAttendanceAccess = canAccess("/attendance", currentUser.role, currentUser.mansione ?? undefined, permissions);
  const canEditAttendance = canEdit("/attendance", currentUser.role, currentUser.mansione ?? undefined, permissions);
  const exEmployeeLabels = ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"];
  const currentEmployeeWhere: Prisma.UserWhereInput = {
    active: true,
    role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    NOT: [
      {
        mansione: {
          in: exEmployeeLabels,
          mode: "insensitive",
        },
      },
      {
        employee_status: {
          in: exEmployeeLabels,
          mode: "insensitive",
        },
      },
    ],
  };

  const where: Prisma.AttendanceLogWhereInput = {
    user: currentEmployeeWhere,
  };

  return { where, currentEmployeeWhere, hasFullAttendanceAccess, canEditAttendance };
}

export async function readAttendanceLogs(where: Prisma.AttendanceLogWhereInput) {
  const logs = await prisma.attendanceLog.findMany({
    where,
    select: {
      id: true,
      user_id: true,
      type: true,
      timestamp: true,
      date: true,
      time: true,
      note: true,
      user: { select: { name: true, photo_url: true } },
      location: { select: { name: true } },
      device: { select: { device_name: true } },
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return logs.map((log) => ({
    id: log.id,
    userId: log.user_id,
    employee: log.user.name,
    location: log.location.name,
    device: log.device.device_name,
    type: log.type,
    timestamp: log.timestamp.toISOString(),
    date: log.date.toISOString(),
    time: log.time,
    note: log.note ?? "",
    photoUrl: log.user.photo_url,
  }));
}

export async function readAttendanceDay(where: Prisma.AttendanceLogWhereInput) {
  const today = attendanceToday();
  const date = new Date(today);
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return { today, logs: await readAttendanceLogs({ ...where, date: { in: [yesterday, date] } }) };
}
