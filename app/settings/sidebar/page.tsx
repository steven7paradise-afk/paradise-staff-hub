import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { SidebarSettingsClient } from "./sidebar-settings-client";

export const dynamic = "force-dynamic";

export default async function SidebarSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/sidebar", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const [layoutSetting, usersWithMansione, mansioniSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "sidebar_configuration" } }),
    prisma.user.findMany({
      where: { active: true, NOT: { mansione: null } },
      select: { mansione: true },
      orderBy: { mansione: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: "mansioni_permissions" } }),
  ]);

  const configuredMansioni = mansioniSetting?.value
    && typeof mansioniSetting.value === "object"
    && !Array.isArray(mansioniSetting.value)
      ? Object.keys(mansioniSetting.value as Record<string, unknown>)
      : [];
  const mansioni = Array.from(new Set([
    ...usersWithMansione.map((user) => String(user.mansione || "").trim()),
    ...configuredMansioni,
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));

  return (
    <AppShell
      title="Organizza Barra Laterale"
      subtitle="Scegli una mansione e organizza le sue pagine nelle aree Lavoro e Personale."
      role={role}
    >
      <SidebarSettingsClient
        initialLayout={layoutSetting ? (layoutSetting.value as any) : null}
        mansioni={mansioni}
      />
    </AppShell>
  );
}
