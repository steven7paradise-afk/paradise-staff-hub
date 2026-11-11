import { after } from "next/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttendanceManager } from "@/components/attendance-manager";
import { getRenderSession } from "@/lib/auth";
import { attendanceRegisterAccess, readAttendanceDay } from "@/lib/attendance-register";
import { closeForgottenShifts } from "@/lib/forgotten-shifts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await getRenderSession();
  if (!session?.user?.id) redirect("/login");
  const access = await attendanceRegisterAccess(session.user.id);
  if (!access?.hasFullAttendanceAccess) redirect("/dashboard");
  const { where, currentEmployeeWhere, canEditAttendance } = access;

  after(() => closeForgottenShifts().catch((error: unknown) => {
    console.error("Automatic attendance closure failed", error);
  }));

  const [day, workers] = await Promise.all([
    readAttendanceDay(where),
    prisma.user.findMany({
      where: { ...currentEmployeeWhere, sede_id: { not: null } },
      select: { id: true, name: true, photo_url: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell title="Timbrature" subtitle="Registro ufficiale delle presenze salvate dai tablet autorizzati.">
      <div className="administrative-night-page">
      <AttendanceManager
        readOnly={!canEditAttendance}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", photoUrl: worker.photo_url }))}
        initialDay={day}
      />
      </div>
    </AppShell>
  );
}
