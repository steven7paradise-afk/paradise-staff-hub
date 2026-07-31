import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PlanningAccessSettings } from "@/components/planning-access-settings";
import { auth } from "@/lib/auth";
import { normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function PlanningSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/planning", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN");

  if (!canAccessPage) redirect("/dashboard");

  const [accessSetting, users] = await Promise.all([
    prisma.setting.findUnique({ where: { key: PLANNING_ACCESS_KEY } }),
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
      title="Permessi Planning"
      subtitle="Decidi chi può vedere la turnistica senza poter applicare modifiche."
      role={role}
    >
      <PlanningAccessSettings
        initialAccess={normalizePlanningAccess(accessSetting?.value)}
        canManagePlanningVisibility={role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN"}
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
