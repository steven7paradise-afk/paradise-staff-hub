import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { profilePerformance, type ProfilePerformance } from "@/lib/profile-performance";
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
import { attendanceActualMinutes } from "@/lib/scheduled-attendance";
import { isAutomaticLateReason } from "@/lib/automatic-late-requests";

function romeInstantStart(calendarDate: Date) {
  const year = calendarDate.getUTCFullYear();
  const month = calendarDate.getUTCMonth();
  const day = calendarDate.getUTCDate();
  const noon = new Date(Date.UTC(year, month, day, 12));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(noon);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const offset = representedAsUtc - noon.getTime();
  return new Date(Date.UTC(year, month, day) - offset);
}

export const dynamic = "force-dynamic";

function displayDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(value)
    : "Non impostata";
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
  
  let performance: ProfilePerformance | null = null;
  if (hasCowlendarToken()) {
    try {
      const firstDay = new Date(Date.UTC(todayYear, todayMonth - 1, 1));
      const nextDay = new Date(todayCalendarDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const [bookings, teams, statuses, staff] = await Promise.all([
        getCowlendarBookingsForRange({ startDate: romeInstantStart(firstDay).toISOString(), endDate: new Date(romeInstantStart(nextDay).getTime() - 1).toISOString(), limit: 5000 }),
        prisma.setting.findUnique({where: {key: "appointment_team_overrides"}}),
        prisma.setting.findUnique({where: {key: "appointment_status_overrides"}}),
        prisma.user.findMany({select: {name: true}}),
      ]);
      performance = profilePerformance(bookings, (teams?.value || {}) as Parameters<typeof profilePerformance>[1], (statuses?.value || {}) as Parameters<typeof profilePerformance>[2], {id: user.id, name: user.name}, staff.map(person => person.name), now);
    } catch { console.error("Profile appointment performance temporarily unavailable"); }
  }

  const hours = monthlyPersonalHours(year, month, schedules, logs, records);
  const plannedHours = hours.reduce((total, row) => total + row.plannedHours, 0);
  const workedHours = hours.reduce((total, row) => total + row.workedHours, 0);

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
        performance={performance}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          birthDateLabel: displayDate(user.birth_date),
          fiscalCode: user.fiscal_code ?? "Non impostato",
          contractStartLabel: displayDate(user.contract_start),
          contractEndLabel: displayDate(user.contract_end),
          photoUrl: user.photo_url,
          coverUrl: user.cover_url,
          locationName: user.location?.name ?? "Non assegnato",
          role: session.user.role,
          mansione: user.mansione,
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
        unreadNotifications={unreadNotifications}
        shiftWeeks={shiftWeeks}
        holidayRequests={holidayRequests.filter((request) => !isAutomaticLateReason(request.reason)).map((request) => ({
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

      />
    </AppShell>
  );
}
