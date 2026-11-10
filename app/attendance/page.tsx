import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttendanceManager } from "@/components/attendance-manager";
import { getRenderSession } from "@/lib/auth";
import { closeForgottenShifts } from "@/lib/forgotten-shifts";
import { prisma } from "@/lib/prisma";
import { canAccess, canEdit, getEffectivePermissionSet } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await getRenderSession();
  if (!session?.user?.id) redirect("/login");
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true },
  });
  if (!currentUser) redirect("/login");
  const permissions = await getEffectivePermissionSet(prisma, currentUser);
  const hasFullAttendanceAccess = canAccess("/attendance", currentUser.role, currentUser.mansione ?? undefined, permissions);
  const canEditAttendance = canEdit("/attendance", currentUser.role, currentUser.mansione ?? undefined, permissions);
  await closeForgottenShifts();
  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - 6);
  dateLimit.setHours(0, 0, 0, 0);

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
    date: {
      gte: dateLimit,
    },
    user: currentEmployeeWhere,
    ...(session.user.role === "RESPONSABILE" && !hasFullAttendanceAccess ? { location_id: session.user.sedeId } : {}),
  };

  const [logs, workers] = await Promise.all([
    prisma.attendanceLog.findMany({
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
      orderBy: { timestamp: "desc" },
    }),
    hasFullAttendanceAccess
      ? prisma.user.findMany({
          where: { ...currentEmployeeWhere, sede_id: { not: null } },
          select: { id: true, name: true, photo_url: true, location: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell title="Timbrature" subtitle="Registro ufficiale delle presenze salvate dai tablet autorizzati.">
      <div className="administrative-night-page">
      <AttendanceManager
        readOnly={!canEditAttendance}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", photoUrl: worker.photo_url }))}
        initialLogs={logs.map((log) => ({
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
        }))}
      />
      </div>
    </AppShell>
  );
}
