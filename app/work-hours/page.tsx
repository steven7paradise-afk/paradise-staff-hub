import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkHoursManager } from "@/components/work-hours-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function WorkHoursPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const workers = await prisma.user.findMany({
      where: {
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
        active: true,
      },
      include: { location: true },
      orderBy: { name: "asc" },
    });

  return (
    <AppShell title="Ore staff" subtitle="Controllo mensile ore lavorate per singolo lavoratore, con correzioni manuali e note." role={role}>
      <WorkHoursManager
        initialYear={year}
        initialMonth={month}
        workers={workers.map((worker) => ({
          id: worker.id,
          name: worker.name,
          email: worker.email,
          active: worker.active,
          location: worker.location?.name ?? "Nessun salone",
          photoUrl: worker.photo_url ?? null,
        }))}
      />
    </AppShell>
  );
}
