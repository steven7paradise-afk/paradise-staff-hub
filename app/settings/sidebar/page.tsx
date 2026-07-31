import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { getBrandingTheme } from "@/lib/branding";
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

  // Fetch current layout settings from DB
  const layoutSetting = await prisma.setting.findUnique({
    where: { key: "sidebar_configuration" }
  });

  // Fetch current branding colors from DB
  const branding = await getBrandingTheme();

  return (
    <AppShell
      title="Personalizza Barra Laterale"
      subtitle="Modifica il colore di sfondo e cambia l'ordine di visualizzazione dei tasti della barra."
      role={role}
    >
      <SidebarSettingsClient
        initialBranding={{
          sidebar_color: branding.sidebar_color,
          dark_sidebar_color: branding.dark_sidebar_color,
        }}
        initialLayout={layoutSetting ? (layoutSetting.value as any) : null}
      />
    </AppShell>
  );
}
