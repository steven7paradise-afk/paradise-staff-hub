import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/app/api/settings/dashboard/route";
import { DashboardSettingsClient } from "./dashboard-settings-client";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = (accessUser?.role || session.user.role) as string;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/dashboard", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN");

  if (!canAccessPage && role !== "ZERO" && role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [employees, setting] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, photo_url: true }
    }).catch(() => []),
    prisma.setting.findUnique({
      where: { key: DASHBOARD_SETTINGS_KEY },
    }).catch(() => null)
  ]);

  const val = setting?.value as any;

  const initialSettings = {
    salonGoal: Number(val?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal,
    workerGoal: Number(val?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal,
    workerBonusMap: (val?.workerBonusMap as Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>) || {},
    promos: Array.isArray(val?.promos) ? val.promos : DEFAULT_DASHBOARD_SETTINGS.promos,
    sideCard1: val?.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1,
    sideCard2: val?.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2,
    productOfMonth: val?.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth,
    communications: Array.isArray(val?.communications) ? val.communications : DEFAULT_DASHBOARD_SETTINGS.communications,
    employees,
  };

  return (
    <AppShell
      title="Configura Dashboard, Obiettivi & Promo"
      subtitle="Pannello Super Admin per impostare gli obiettivi mensili, lo schema punti lavoratori, l'assegnazione/riscatto premi, promozioni e comunicazioni."
      role={role as any}
    >
      <DashboardSettingsClient role={role} initialSettings={initialSettings} />
    </AppShell>
  );
}
