import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TablesAccessSettings } from "@/components/tables-access-settings";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ASSISTANCE_TABLES_ACCESS_KEY,
  normalizeAssistanceTablesAccess,
} from "@/lib/assistance-tables";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TablesSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") redirect("/dashboard");

  const [accessSetting, users] = await Promise.all([
    prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_ACCESS_KEY } }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        mansione: true,
        location: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell
      title="Tabelle Assistenza"
      subtitle="Gestisci chi può vedere e usare la pagina Tabelle."
      role={role}
    >
      <TablesAccessSettings
        initialAccess={normalizeAssistanceTablesAccess(accessSetting?.value)}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          role: user.role,
          mansione: user.mansione,
          sede: user.location?.name ?? null,
        }))}
      />
    </AppShell>
  );
}
