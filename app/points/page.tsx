import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/app/api/settings/dashboard/route";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { PointsClient } from "@/components/points-client";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currentMonthRange() {
  const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  const [yearRaw, monthRaw] = fallback.split("-");
  const start = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(Number(yearRaw), Number(monthRaw), 1, 0, 0, 0));
  return { start, end };
}

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((name) => name.trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text.split(/[,;]+/).map((name) => name.trim()).filter(Boolean);
}

function countsInAnalytics(answers: Record<string, unknown>) {
  return String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare").trim().toLowerCase() !== "errore";
}

export default async function PointsPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const session = await auth();
  let sessionUser = session?.user;
  let isPC = false;

  if (!sessionUser) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isPC = true;
      sessionUser = {
        id: "PC_CASSA",
        role: "RESPONSABILE",
        sedeId: pcAuth.locationId,
      } as any;
    }
  }

  if (!sessionUser) redirect("/login");

  const values = await searchParams;
  const targetUserId = (sessionUser.id === "PC_CASSA" && values.userId) ? values.userId : sessionUser.id;

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { location: true },
  });

  if (!user || !user.active) redirect("/login");

  const { start, end } = currentMonthRange();

  // Load dashboard settings, notifications & forms in parallel
  const [
    dashboardSettingRaw,
    clientControlForms,
    allEmployees,
    readCommunications,
    unreadCommunications,
  ] = await Promise.all([
    prisma.setting.findUnique({ where: { key: DASHBOARD_SETTINGS_KEY } }).catch(() => null),
    prisma.serviceForm.findMany({ where: { active: true }, select: { id: true, name: true, category: true } }).catch(() => []),
    prisma.user.findMany({ where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } }, select: { id: true, name: true } }).catch(() => []),
    prisma.notification.findMany({
      where: { user_id: user.id, type: "COMUNICAZIONE", read: true },
      orderBy: { created_at: "desc" },
    }).catch(() => []),
    prisma.notification.findMany({
      where: { user_id: user.id, type: "COMUNICAZIONE", read: false },
      orderBy: { created_at: "desc" },
    }).catch(() => []),
  ]);

  // Parse Settings
  const dashboardVal = (dashboardSettingRaw?.value as any) || {};
  const salonGoal = Number(dashboardVal?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal;
  const workerGoal = Number(dashboardVal?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal;
  const workerBonusMap = (dashboardVal?.workerBonusMap as Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>) || {};

  const canonicalEmployeeNames = allEmployees.map((e) => e.name).filter((n): n is string => Boolean(n?.trim()));
  const currentWorkerCanonicalName = resolveCanonicalStaffName(user.name || "", canonicalEmployeeNames);

  // Compute completed client control forms count for the current month
  const clientControlFormIds = clientControlForms
    .filter((f) => isClientControlFormName(f.name, f.category))
    .map((f) => f.id);

  let schedeCount = 0;
  let salonSchedeCount = 0;

  if (clientControlFormIds.length > 0) {
    const rawResponses = await prisma.serviceFormResponse.findMany({
      where: {
        form_id: { in: clientControlFormIds },
        created_at: { gte: start, lt: end }
      },
      select: {
        id: true,
        answers: true,
        user: { select: { name: true } }
      }
    }).catch(() => []);

    const validResponses = rawResponses.filter((resp) => {
      const answers = (resp.answers as Record<string, unknown>) || {};
      const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || answers.client_control_correctness || "").trim().toLowerCase();
      return correctness !== "finito";
    });

    for (const response of validResponses) {
      const answers = (response.answers as Record<string, unknown>) || {};
      if (!countsInAnalytics(answers)) continue;
      salonSchedeCount += 1;

      const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const staffNames = (selectedStaff.length > 0 ? selectedStaff : fallbackOwner.length > 0 ? fallbackOwner : [response.user?.name ?? "Senza responsabile"])
        .map((name) => resolveCanonicalStaffName(name, canonicalEmployeeNames));

      if (staffNames.includes(currentWorkerCanonicalName) || staffNames.includes(user.name)) {
        schedeCount += 1;
      }
    }
  }

  const userBonusRecord = workerBonusMap[user.id] || workerBonusMap[currentWorkerCanonicalName] || workerBonusMap[user.name] || {};
  const manualBonusPoints = Number(userBonusRecord.manualBonusPoints) || 0;
  const redeemedPoints = Number(userBonusRecord.redeemedPoints) || 0;

  const salonEarned = salonSchedeCount >= salonGoal;
  const workerEarned = schedeCount >= workerGoal;

  let monthGoalPoints = 0;
  if (salonEarned) monthGoalPoints += 10;
  if (workerEarned) monthGoalPoints += 10;

  const totalEarnedPoints = monthGoalPoints + manualBonusPoints;
  const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

  return (
    <AppShell title="Centro Punti" role={user.role as Role} hideHeader={true} transparentMobileHeader={true}>
      <PointsClient
        user={{
          id: user.id,
          name: user.name,
          role: user.role,
        }}
        pointsStats={{
          schedeCount,
          workerGoal,
          salonSchedeCount,
          salonGoal,
          salonEarned,
          workerEarned,
          manualBonusPoints,
          redeemedPoints,
          availablePoints,
          totalEarnedPoints,
        }}
        readCommunications={readCommunications.map(c => ({
          id: c.id,
          title: c.title,
          createdAt: c.created_at.toISOString()
        }))}
        unreadCommunications={unreadCommunications.map(c => ({
          id: c.id,
          title: c.title,
          message: c.message,
          createdAt: c.created_at.toISOString()
        }))}
      />
    </AppShell>
  );
}
