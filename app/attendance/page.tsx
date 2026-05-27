import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttendanceManager } from "@/components/attendance-manager";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { closeForgottenShifts } from "@/lib/forgotten-shifts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const typeLabels = { ENTRATA: "Entrata", PAUSA: "Pausa", RIENTRO: "Rientro", USCITA: "Uscita" };

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await closeForgottenShifts();
  const where: Prisma.AttendanceLogWhereInput | undefined =
    session.user.role === "RESPONSABILE" ? { location_id: session.user.sedeId } : undefined;
  const [logs, workers] = await Promise.all([
    prisma.attendanceLog.findMany({
      where,
      include: { user: true, location: true, device: true },
      orderBy: { timestamp: "desc" },
      take: 150,
    }),
    session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
      ? prisma.user.findMany({ where: { active: true, role: { not: "SUPER_ADMIN" }, sede_id: { not: null } }, include: { location: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell title="Timbrature" subtitle="Registro ufficiale delle presenze salvate dai tablet autorizzati.">
      {session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? (
        <AttendanceManager
          workers={workers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone" }))}
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
          }))}
        />
      ) : null}
      {session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN" ? <Card className="overflow-hidden p-0">
        {logs.length === 0 ? <p className="p-5 text-sm text-black/50">Nessuna timbratura registrata.</p> : null}
        {logs.map((log) => (
          <div key={log.id} className="grid gap-4 border-b border-black/5 p-5 last:border-b-0 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr_1fr]">
            <div>
              <p className="font-semibold">{log.user.name}</p>
              <p className="text-sm text-black/50">{log.location.name}</p>
            </div>
            <Badge>{typeLabels[log.type]}</Badge>
            <p className="text-sm">{new Intl.DateTimeFormat("it-IT").format(log.date)}</p>
            <p className="text-sm">{log.time}</p>
            <p className="text-sm text-black/50">{log.device.device_name}</p>
          </div>
        ))}
      </Card> : null}
    </AppShell>
  );
}
