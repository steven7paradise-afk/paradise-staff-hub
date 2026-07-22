import Link from "next/link";
import { CalendarDays, ChevronRight, FileCheck2, FileText, IdCard, LockKeyhole, User, Mail, Fingerprint, Briefcase, ShieldAlert, MapPin, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClientProfile } from "./client-profile";
import { LogoutButton } from "@/components/logout-button";
import { ProfileSettings } from "@/components/profile-settings";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/app/api/settings/dashboard/route";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";

export const dynamic = "force-dynamic";

function displayDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(value)
    : "Non impostata";
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

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } });
  if (!user) redirect("/login");
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  
  const [
    schedules,
    logs,
    records,
    openRequests,
    documents,
    unreadNotifications,
    taskInProgress,
    colleagues,
    dashboardSettingRaw,
    clientControlForms,
    allEmployees,
  ] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, include: { category: true } }),
    prisma.attendanceLog.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.leaveRequest.count({ where: { user_id: user.id, status: "PENDING" } }),
    prisma.document.count({ where: { user_id: user.id } }),
    prisma.notification.count({ where: { user_id: session.user.id, read: false } }),
    prisma.staffTask.count({ where: { assignees: { some: { id: user.id } }, status: "ACTIVE" } }),
    prisma.user.findMany({
      where: {
        id: { not: user.id },
        active: true
      },
      take: 4,
      select: {
        id: true,
        name: true,
        photo_url: true,
      }
    }),
    prisma.setting.findUnique({ where: { key: DASHBOARD_SETTINGS_KEY } }).catch(() => null),
    prisma.serviceForm.findMany({ where: { active: true }, select: { id: true, name: true, category: true } }).catch(() => []),
    prisma.user.findMany({ where: { active: true, role: { not: "SUPER_ADMIN" } }, select: { id: true, name: true } }).catch(() => []),
  ]);
  
  const hours = monthlyPersonalHours(year, month, schedules, logs, records);
  const plannedHours = hours.reduce((total, row) => total + row.plannedHours, 0);
  const workedHours = hours.reduce((total, row) => total + row.workedHours, 0);

  // Parse Dashboard Points & Schede
  const dashboardVal = (dashboardSettingRaw?.value as any) || {};
  const salonGoal = Number(dashboardVal?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal;
  const workerGoal = Number(dashboardVal?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal;
  const workerBonusMap = (dashboardVal?.workerBonusMap as Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>) || {};

  const canonicalEmployeeNames = allEmployees.map((e) => e.name).filter((n): n is string => Boolean(n?.trim()));
  const currentWorkerCanonicalName = resolveCanonicalStaffName(user.name || "", canonicalEmployeeNames);

  const clientControlFormIds = clientControlForms
    .filter((f) => isClientControlFormName(f.name, f.category))
    .map((f) => f.id);

  let schedeCount = 0;
  let salonSchedeCount = 0;

  if (clientControlFormIds.length > 0) {
    const rawResponses = await prisma.serviceFormResponse.findMany({
      where: {
        form_id: { in: clientControlFormIds },
        created_at: { gte: monthStart, lt: monthEnd }
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

  const salonEarned = salonSchedeCount >= salonGoal;
  const workerEarned = schedeCount >= workerGoal;

  const userBonusRecord = workerBonusMap[user.id] || workerBonusMap[currentWorkerCanonicalName] || workerBonusMap[user.name] || {};
  const manualBonusPoints = Number(userBonusRecord.manualBonusPoints) || 0;
  const redeemedPoints = Number(userBonusRecord.redeemedPoints) || 0;

  let monthGoalPoints = 0;
  if (salonEarned) monthGoalPoints += 10;
  if (workerEarned) monthGoalPoints += 10;

  const totalEarnedPoints = monthGoalPoints + manualBonusPoints;
  const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

  return (
    <AppShell title="Profilo" role={session.user.role as Role}>
      <ClientProfile
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          birthDateLabel: displayDate(user.birth_date),
          fiscalCode: user.fiscal_code ?? "Non impostato",
          contractStartLabel: displayDate(user.contract_start),
          contractEndLabel: displayDate(user.contract_end),
          photoUrl: user.photo_url,
          locationName: user.location?.name ?? "Non assegnato",
          role: session.user.role,
        }}
        colleagues={colleagues}
        stats={{
          plannedHours,
          workedHours,
          openRequests,
          documents,
          taskInProgress,
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
        unreadNotifications={unreadNotifications}
        settingsNode={
          <ProfileSettings
            photoUrl={user.photo_url}
            name={user.name}
            role={user.role}
            calendarSync={user.google_calendar_sync}
            calendarId={user.google_calendar_id}
            headerColor={user.header_color}
            sidebarColor={user.sidebar_color}
          />
        }
      />
    </AppShell>
  );
}
