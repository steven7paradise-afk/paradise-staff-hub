import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LocationManager } from "@/components/location-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const where = role === "RESPONSABILE" ? { id: session.user.sedeId, active: true } : {};
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const locations = await prisma.location.findMany({
    where,
    include: {
      users: {
        where: { active: true },
        orderBy: { name: "asc" },
      },
      attendance_logs: {
        where: { timestamp: { gte: monthStart } },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell title="Saloni" subtitle="Schede operative per sede: modifica saloni, orari, contatti, personale attivo e riepiloghi." role={role}>
      <LocationManager
        canManage={role === "ADMIN" || role === "SUPER_ADMIN"}
        initialLocations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          address: location.address ?? "",
          phone: location.phone ?? "",
          openingTime: location.opening_time ?? "",
          closingTime: location.closing_time ?? "",
          active: location.active,
          logsCount: location.attendance_logs.length,
          users: location.users.map((user) => ({ id: user.id, name: user.name, role: user.role })),
        }))}
      />
    </AppShell>
  );
}
