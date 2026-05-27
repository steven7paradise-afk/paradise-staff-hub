import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationManager } from "@/components/notification-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  const [notifications, locations, recipients] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "desc" },
    }),
    prisma.location.findMany({ where: role === "RESPONSABILE" ? { id: session.user.sedeId ?? undefined, active: true } : { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: role === "RESPONSABILE" ? { sede_id: session.user.sedeId ?? undefined, active: true } : { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell title="Comunicazioni" subtitle="Avvisi aziendali e conferme o rifiuti delle tue richieste, riservati al tuo profilo." role={role}>
      <NotificationManager
        role={role}
        notifications={notifications.map((notification) => ({ id: notification.id, title: notification.title, message: notification.message, type: notification.type, read: notification.read }))}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        recipients={recipients.map((user) => ({ id: user.id, name: user.name, locationId: user.sede_id }))}
      />
    </AppShell>
  );
}
