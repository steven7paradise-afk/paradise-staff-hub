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
import { canAccessForUser, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/lib/dashboard-settings";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { attendanceActualMinutes } from "@/lib/scheduled-attendance";

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
  const canAccessPage = await canAccessForUser(prisma, "/profile", {
    id: user.id,
    role: user.role,
    mansione: user.mansione,
  });
  if (!canAccessPage) redirect("/dashboard");
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const todayCalendarDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  const mondayOffset = todayCalendarDate.getUTCDay() === 0 ? -6 : 1 - todayCalendarDate.getUTCDay();
  const currentWeekStart = new Date(todayCalendarDate);
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + mondayOffset);
  const twoWeekEnd = new Date(currentWeekStart);
  twoWeekEnd.setUTCDate(twoWeekEnd.getUTCDate() + 14);
  
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
    weeklySchedules,
    weeklyAttendanceLogs,
    holidayRequests,
  ] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, include: { category: true } }),
    prisma.attendanceLog.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, select: { date: true, type: true, timestamp: true, note: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.leaveRequest.count({ where: { user_id: user.id, status: "PENDING" } }),
    prisma.document.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" } }),
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
    prisma.user.findMany({ where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } }, select: { id: true, name: true } }).catch(() => []),
    prisma.scheduleEntry.findMany({
      where: { user_id: user.id, date: { gte: currentWeekStart, lt: twoWeekEnd } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.attendanceLog.findMany({
      where: { user_id: user.id, date: { gte: currentWeekStart, lt: twoWeekEnd } },
      select: { date: true, type: true, time: true, timestamp: true, note: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { user_id: user.id, type: { in: ["FERIE", "PERMESSO", "MALATTIA"] } },
      select: {
        id: true,
        type: true,
        start_date: true,
        end_date: true,
        start_time: true,
        end_time: true,
        status: true,
        reason: true,
        admin_note: true,
        medical_code: true,
        created_at: true,
      },
      orderBy: [{ start_date: "desc" }, { created_at: "desc" }],
    }),
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

  const shiftWeeks = Array.from({ length: 2 }, (_, weekIndex) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + weekIndex * 7);
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + dayIndex);
      const dateKey = date.toISOString().slice(0, 10);
      const schedule = weeklySchedules.find((entry) => entry.date.toISOString().slice(0, 10) === dateKey);
      const startTime = schedule?.start_time || schedule?.category.start_time || null;
      const endTime = schedule?.end_time || schedule?.category.end_time || null;
      const attendance = weeklyAttendanceLogs
        .filter((log) => log.date.toISOString().slice(0, 10) === dateKey)
        .map((log) => {
          const minutes = attendanceActualMinutes(log);
          return {
            type: log.type,
            time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
            timestamp: log.timestamp.toISOString(),
            minutes,
          };
        });
      return {
        dateKey,
        dayName: new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" }).format(date),
        dayNumber: new Intl.DateTimeFormat("it-IT", { day: "2-digit", timeZone: "UTC" }).format(date),
        monthName: new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" }).format(date),
        fullDateLabel: new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date),
        isToday: dateKey === todayKey,
        shiftName: schedule?.category.name || "Nessun turno",
        startTime,
        endTime,
        note: schedule?.note || null,
        categoryColor: schedule?.category.color || null,
        categoryTextColor: schedule?.category.text_color || null,
        attendance,
      };
    });
    return {
      key: weekIndex === 0 ? "current" : "next",
      label: weekIndex === 0 ? "Questa settimana" : "Settimana successiva",
      rangeLabel: `${days[0].dayNumber} ${days[0].monthName} – ${days[6].dayNumber} ${days[6].monthName}`,
      days,
    };
  });

  return (
    <AppShell title="Profilo" role={session.user.role as Role} hideHeader={true} transparentMobileHeader={true} edgeToEdgeMain>
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
          documents: documents.length,
          taskInProgress,
        }}
        documentsList={documents.map(d => ({
          id: d.id,
          title: d.title,
          fileUrl: d.file_url,
          type: d.type,
          month: d.month,
          year: d.year,
          createdAt: d.created_at.toISOString()
        }))}
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
        shiftWeeks={shiftWeeks}
        holidayRequests={holidayRequests.map((request) => ({
          id: request.id,
          type: request.type as "FERIE" | "PERMESSO" | "MALATTIA",
          startDate: request.start_date.toISOString(),
          endDate: request.end_date.toISOString(),
          startTime: request.start_time,
          endTime: request.end_time,
          status: request.status,
          reason: request.reason,
          adminNote: request.admin_note,
          medicalCode: request.medical_code,
          createdAt: request.created_at.toISOString(),
        }))}
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
