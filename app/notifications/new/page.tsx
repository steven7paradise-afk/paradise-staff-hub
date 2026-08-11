import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CommunicationComposer } from "@/components/communication-composer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const senderRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export default async function NewCommunicationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!senderRoles.has(session.user.role)) redirect("/notifications");

  const role = session.user.role as Role;
  const locationWhere = role === "RESPONSABILE"
    ? { id: session.user.sedeId ?? undefined, active: true }
    : { active: true };
  const recipientWhere = role === "RESPONSABILE"
    ? { sede_id: session.user.sedeId ?? undefined, active: true }
    : { active: true };

  const [locations, recipients] = await Promise.all([
    prisma.location.findMany({ where: locationWhere, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: recipientWhere, include: { location: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell title="Nuova comunicazione" role={role} hideHeader>
      <CommunicationComposer
        role={role}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        recipients={recipients.map((user) => ({
          id: user.id,
          name: user.name,
          photoUrl: user.photo_url,
          locationId: user.sede_id,
          locationName: user.location?.name ?? "Senza salone",
        }))}
      />
    </AppShell>
  );
}
