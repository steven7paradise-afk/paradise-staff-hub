import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RequestManager } from "@/components/request-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  const employeeView = role === "DIPENDENTE";
  let where: Prisma.LeaveRequestWhereInput | undefined;
  if (employeeView) where = { user_id: session.user.id };
  if (role === "RESPONSABILE") where = { user: { sede_id: session.user.sedeId } };
  const [requests, workers] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: { user: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.user.findMany({
      where: role === "DIPENDENTE"
        ? { id: session.user.id, active: true }
        : role === "RESPONSABILE"
          ? { sede_id: session.user.sedeId, active: true, role: { not: "SUPER_ADMIN" } }
          : { active: true, role: { not: "SUPER_ADMIN" } },
      include: { location: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell title="Ferie e permessi" subtitle={employeeView ? "Invia e controlla le tue richieste personali." : "Quando Admin o Super Admin approva, la richiesta viene inserita automaticamente nel planning mensile."}>
      <RequestManager
        role={role as Role}
        initialRequests={requests.map((request) => ({
          id: request.id,
          employee: request.user.name,
          type: request.type,
          startDate: request.start_date.toISOString(),
          endDate: request.end_date.toISOString(),
          startTime: request.start_time,
          endTime: request.end_time,
          reason: request.reason,
          status: request.status,
        }))}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? null }))}
      />
    </AppShell>
  );
}
