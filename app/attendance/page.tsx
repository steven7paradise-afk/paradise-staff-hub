import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttendanceManager } from "@/components/attendance-manager";
import { auth } from "@/lib/auth";
import { closeForgottenShifts } from "@/lib/forgotten-shifts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await closeForgottenShifts();
  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - 6);
  dateLimit.setHours(0, 0, 0, 0);

  const exEmployeeLabels = ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"];
  const currentEmployeeWhere: Prisma.UserWhereInput = {
    active: true,
    role: { not: "SUPER_ADMIN" },
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
    ...(session.user.role === "RESPONSABILE" ? { location_id: session.user.sedeId } : {}),
  };

  const [logs, workers] = await Promise.all([
    prisma.attendanceLog.findMany({
      where,
      include: { user: true, location: true, device: true },
      orderBy: { timestamp: "desc" },
    }),
    session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
      ? prisma.user.findMany({ where: { ...currentEmployeeWhere, sede_id: { not: null } }, include: { location: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell title="Timbrature" subtitle="Registro ufficiale delle presenze salvate dai tablet autorizzati.">
      <AttendanceManager
        readOnly={session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN"}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", photoUrl: worker.photo_url }))}
        initialLogs={logs.map((log) => ({
          id: log.id,
          userId: log.user_id,
          employee: log.user.name,
          location: log.location.name,
          device: log.device.device_name,
          type: log.type,
          timestamp: log.timestamp.toISOString(),
          time: log.time,
          note: log.note ?? "",
          photoUrl: log.user.photo_url,
        }))}
      />
    </AppShell>
  );
}
