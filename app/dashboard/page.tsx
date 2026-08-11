import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardRedesignClient } from "@/components/dashboard-redesign-client";
import { ManagementDashboard, type ManagementDashboardData } from "@/components/management-dashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/app/api/settings/dashboard/route";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { ensureTomorrowRestNotifications } from "@/lib/rest-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function monthRange(monthParam: string | null = null) {
  const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  const [yearRaw, monthRaw] = (monthParam || fallback).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeYear = Number.isFinite(year) ? year : Number(fallback.slice(0, 4));
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : Number(fallback.slice(5, 7));
  const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0));
  return { key: `${safeYear}-${String(safeMonth).padStart(2, "0")}`, start, end };
}

function romeDate() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  return new Date(`${day}T00:00:00.000Z`);
}

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

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((name) => name.trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text.split(/[,;]+/).map((name) => name.trim()).filter(Boolean);
}

function countsInAnalytics(answers: Record<string, unknown>) {
  return String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare").trim().toLowerCase() !== "errore";
}

function timeToMinutes(value: string | null | undefined) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function romeTime(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function romeDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");

  const safe = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      console.error("Dashboard query unavailable:", error);
      return fallback;
    }
  };

  const dbUser = await safe(prisma.user.findUnique({
    where: { id: session.user.id },
    include: { location: true },
  }), null);

  if (dbUser && !dbUser.active) redirect("/login");

  const currentUser = dbUser ?? ({
    id: session.user.id,
    active: true,
    role: session.user.role,
    name: session.user.name || "Paradise Staff",
    email: session.user.email || "",
    sede_id: session.user.sedeId ?? null,
    location: null,
    photo_url: null,
  } as any);

  const role = currentUser.role || "DIPENDENTE";
  const { start, end } = monthRange(null);
  const statusToday = romeDate();
  const statusTomorrow = new Date(statusToday);
  statusTomorrow.setUTCDate(statusTomorrow.getUTCDate() + 1);
  const weekStart = new Date(statusToday);
  const mondayOffset = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  await safe(ensureTomorrowRestNotifications(statusToday), { created: 0 });

  const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
  if (managementRoles.has(role)) {
    const isResponsible = role === "RESPONSABILE";
    const scopedLocationId = isResponsible ? currentUser.sede_id : null;
    const userScope = isResponsible
      ? { sede_id: scopedLocationId || "__RESPONSABILE_WITHOUT_LOCATION__" }
      : {};
    const locationScope = scopedLocationId ? { location_id: scopedLocationId } : {};
    const responseLocationScope = scopedLocationId ? { user_location_id: scopedLocationId } : {};
    const yesterdayStart = new Date(statusToday);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const todayInstantStart = romeInstantStart(statusToday);
    const tomorrowInstantStart = romeInstantStart(statusTomorrow);
    const previousMonthDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
    const payrollMonth = previousMonthDate.getUTCMonth() + 1;
    const payrollYear = previousMonthDate.getUTCFullYear();

    const [
      managementUsers,
      attendanceLogs,
      schedules,
      leaveRequests,
      controlForms,
      todayResponses,
      payrollDocuments,
      closings,
      vaultWithdrawals,
      weekClosings,
      latestMonthClose,
    ] = await Promise.all([
      safe(prisma.user.findMany({
        where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] }, ...userScope },
        include: { location: true },
        orderBy: { name: "asc" },
      }), []),
      safe(prisma.attendanceLog.findMany({
        where: {
          date: { gte: statusToday, lt: statusTomorrow },
          ...locationScope,
          user: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
        },
        include: { user: { include: { location: true } }, location: true },
        orderBy: { timestamp: "asc" },
      }), []),
      safe(prisma.scheduleEntry.findMany({
        where: { date: { gte: statusToday, lt: statusTomorrow }, ...locationScope },
        include: { category: true, location: true, user: { include: { location: true } } },
      }), []),
      safe(prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          type: { in: ["FERIE", "MALATTIA", "RIPOSO"] },
          start_date: { lt: statusTomorrow },
          end_date: { gte: statusToday },
          user: { active: true, ...userScope },
        },
        include: { user: { include: { location: true } } },
        orderBy: { end_date: "asc" },
      }), []),
      safe(prisma.serviceForm.findMany({
        where: { active: true },
        select: { id: true, name: true, category: true },
      }), []),
      safe(prisma.serviceFormResponse.findMany({
        where: { created_at: { gte: todayInstantStart, lt: tomorrowInstantStart }, ...responseLocationScope },
        select: { form_id: true, created_at: true, answers: true, user_location_name: true },
        orderBy: { created_at: "asc" },
      }), []),
      safe(prisma.document.findMany({
        where: {
          type: "BUSTA_PAGA",
          month: payrollMonth,
          year: payrollYear,
          user: { active: true, ...userScope },
        },
        select: { user_id: true },
      }), []),
      safe(prisma.cashClosing.findMany({
        where: { date: { lt: statusTomorrow }, ...locationScope },
        orderBy: { created_at: "desc" },
      }), []),
      safe(prisma.cashVaultWithdrawal.findMany({
        where: { date: { lt: statusTomorrow }, ...locationScope },
        orderBy: { created_at: "desc" },
      }), []),
      safe(prisma.setting.findMany({
        where: { key: { startsWith: "cash_week_close:" } },
      }), []),
      safe(prisma.cashMonthClose.findFirst({ orderBy: { month: "desc" } }), null),
    ]);

    const logsByUser = new Map<string, typeof attendanceLogs>();
    for (const log of attendanceLogs) {
      const rows = logsByUser.get(log.user_id) || [];
      rows.push(log);
      logsByUser.set(log.user_id, rows);
    }
    const scheduleByUser = new Map(schedules.map((entry) => [entry.user_id, entry]));
    const clockedToday = Array.from(logsByUser.entries()).map(([userId, logs]) => {
      const state = deriveAttendanceState(logs);
      const firstEntry = state.firstEntry?.timestamp ? new Date(state.firstEntry.timestamp) : null;
      const schedule = scheduleByUser.get(userId);
      const shiftStart = schedule?.start_time || schedule?.category?.start_time || null;
      const actualMinutes = firstEntry ? romeDateTimeParts(firstEntry).totalMinutes : null;
      const plannedMinutes = timeToMinutes(shiftStart);
      const lateMinutes = actualMinutes !== null && plannedMinutes !== null ? Math.max(0, actualMinutes - plannedMinutes) : 0;
      const user = logs[0].user;
      return {
        id: userId,
        name: user.name,
        photoUrl: user.photo_url,
        location: logs[0].location?.name || user.location?.name || "Sede non indicata",
        firstEntry: firstEntry ? romeTime(firstEntry) : "--:--",
        shiftStart,
        status: state.status,
        lateMinutes,
      };
    }).sort((a, b) => a.firstEntry.localeCompare(b.firstEntry));

    const controlFormIds = new Set(controlForms.filter((form) => isClientControlFormName(form.name, form.category)).map((form) => form.id));
    const countedResponses = todayResponses.filter((response) => {
      if (!controlFormIds.has(response.form_id)) return false;
      const answers = (response.answers as Record<string, unknown>) || {};
      const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "").trim().toLowerCase();
      return correctness !== "finito" && countsInAnalytics(answers);
    });
    const hourlyMap = new Map<string, Map<string, number>>();
    for (const response of countedResponses) {
      const hour = `${String(romeDateTimeParts(response.created_at).hour).padStart(2, "0")}:00`;
      const locationName = response.user_location_name || "Sede non indicata";
      const locations = hourlyMap.get(hour) || new Map<string, number>();
      locations.set(locationName, (locations.get(locationName) || 0) + 1);
      hourlyMap.set(hour, locations);
    }
    const hourlyClients = Array.from(hourlyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([hour, locations]) => ({
      hour,
      count: Array.from(locations.values()).reduce((sum, value) => sum + value, 0),
      locations: Array.from(locations.entries()).map(([name, count]) => ({ name, count })),
    }));

    let openPeriodStart: Date | null = null;
    if (latestMonthClose?.month) {
      const [closedYear, closedMonth] = latestMonthClose.month.split("-").map(Number);
      openPeriodStart = new Date(Date.UTC(closedYear, closedMonth, 1));
    }
    const latestClosingByLocationDay = new Map<string, (typeof closings)[number]>();
    for (const closing of closings) {
      if (openPeriodStart && closing.date < openPeriodStart) continue;
      const key = `${closing.location_id}:${closing.date.toISOString().slice(0, 10)}`;
      if (!latestClosingByLocationDay.has(key)) latestClosingByLocationDay.set(key, closing);
    }
    const openClosings = Array.from(latestClosingByLocationDay.values());
    const yesterdayClosingsByLocation = new Map<string, (typeof closings)[number]>();
    for (const closing of closings) {
      if (closing.date < yesterdayStart || closing.date >= statusToday) continue;
      if (!yesterdayClosingsByLocation.has(closing.location_id)) {
        yesterdayClosingsByLocation.set(closing.location_id, closing);
      }
    }
    const yesterdayCashClosings = Array.from(yesterdayClosingsByLocation.values())
      .reduce((sum, closing) => sum + closing.withdrawn, 0);
    const openVaultWithdrawals = vaultWithdrawals.filter((row) => !openPeriodStart || row.date >= openPeriodStart);
    const weekCloseRange = (setting: (typeof weekClosings)[number]) => {
      const value = setting.value as { weekKey?: string } | null;
      if (!value?.weekKey) return null;
      const [startKey, endKey] = value.weekKey.split(":");
      const rangeStart = new Date(`${startKey}T00:00:00.000Z`);
      const rangeEnd = new Date(`${endKey || startKey}T23:59:59.999Z`);
      if (!endKey) rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 6);
      return { start: rangeStart, end: rangeEnd, locationId: setting.key.split(":")[1] || null };
    };
    const openWeekClosings = weekClosings.filter((setting) => {
      const range = weekCloseRange(setting);
      if (!range) return false;
      if (scopedLocationId && range.locationId !== scopedLocationId) return false;
      return !openPeriodStart || range.end >= openPeriodStart;
    });
    const depositedCash = openWeekClosings.reduce((sum, setting) => {
      const value = setting.value as { bank_deposit?: number } | null;
      const amount = Number(value?.bank_deposit || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const recordedWithdrawals = openWeekClosings.reduce((sum, setting) => {
      const value = setting.value as { withdrawals?: number } | null;
      const amount = Number(value?.withdrawals || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const unclosedVaultWithdrawals = openVaultWithdrawals.filter((withdrawal) => !openWeekClosings.some((setting) => {
      const range = weekCloseRange(setting);
      return Boolean(range && range.locationId === withdrawal.location_id && withdrawal.date >= range.start && withdrawal.date <= range.end);
    }));
    const availableCash = openClosings.reduce((sum, row) => sum + row.withdrawn, 0)
      - depositedCash
      - recordedWithdrawals
      - unclosedVaultWithdrawals.reduce((sum, row) => sum + row.amount, 0);
    const monthExpenses = vaultWithdrawals
      .filter((row) => row.date >= start && row.date < end)
      .reduce((sum, row) => sum + row.amount, 0);
    const latestMonthClosingByLocationDay = new Map<string, (typeof closings)[number]>();
    for (const closing of closings) {
      if (closing.date < start || closing.date >= end) continue;
      const dayKey = closing.date.toISOString().slice(0, 10);
      const key = `${closing.location_id}:${dayKey}`;
      if (!latestMonthClosingByLocationDay.has(key)) latestMonthClosingByLocationDay.set(key, closing);
    }
    const monthRevenue = Array.from(latestMonthClosingByLocationDay.values())
      .reduce((sum, closing) => sum + closing.withdrawn, 0);
    const monthWeekClosings = weekClosings.filter((setting) => {
      const value = setting.value as { weekKey?: string; locationId?: string } | null;
      if (!value?.weekKey) return false;
      if (scopedLocationId && value.locationId !== scopedLocationId) return false;
      const [rangeStart, rangeEnd] = value.weekKey.split(":");
      const endDate = new Date(`${rangeEnd || rangeStart}T00:00:00.000Z`);
      if (!rangeEnd) endDate.setUTCDate(endDate.getUTCDate() + 6);
      return endDate >= start && endDate < end;
    });
    const monthDeposits = monthWeekClosings.reduce((sum, setting) => {
      const value = setting.value as { bank_deposit?: number } | null;
      const amount = Number(value?.bank_deposit || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const monthWithdrawals = monthWeekClosings.reduce((sum, setting) => {
      const value = setting.value as { withdrawals?: number } | null;
      const amount = Number(value?.withdrawals || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const payrollUserIds = new Set(payrollDocuments.map((document) => document.user_id));
    const formatDate = (date: Date) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit" }).format(date);
    const leaveRows: ManagementDashboardData["leaves"] = leaveRequests.map((request) => ({
      id: request.id,
      name: request.user.name,
      photoUrl: request.user.photo_url,
      location: request.user.location?.name || "Sede non indicata",
      type: request.type as "FERIE" | "MALATTIA" | "RIPOSO",
      periodLabel: `fino al ${formatDate(request.end_date)}`,
    }));
    const leaveKeys = new Set(leaveRequests.map((request) => `${request.user_id}:${request.type}`));
    for (const schedule of schedules) {
      const categoryName = schedule.category.name.toLowerCase();
      const categoryCode = schedule.category.code.toUpperCase();
      const isRest = categoryName.includes("riposo") || ["R", "RI", "R3", "RIPOSO"].includes(categoryCode);
      if (!isRest) continue;
      const duplicateKey = `${schedule.user_id}:RIPOSO`;
      if (leaveKeys.has(duplicateKey)) continue;
      leaveKeys.add(duplicateKey);
      leaveRows.push({
        id: `schedule-rest-${schedule.id}`,
        name: schedule.user.name,
        photoUrl: schedule.user.photo_url,
        location: schedule.location?.name || schedule.user.location?.name || "Sede non indicata",
        type: "RIPOSO",
        periodLabel: "riposo programmato oggi",
      });
    }

    const managementData: ManagementDashboardData = {
      viewerName: currentUser.name || "Direzione",
      scopeLabel: scopedLocationId ? currentUser.location?.name || "Sede assegnata" : "Tutti i saloni",
      updatedAt: romeTime(new Date()),
      presentNow: clockedToday.filter((staff) => staff.status === "IN" || staff.status === "BREAK").length,
      clockedToday,
      lateStaff: clockedToday.filter((staff) => staff.lateMinutes > 10),
      leaves: leaveRows,
      clientsToday: countedResponses.length,
      hourlyClients,
      yesterdayCashClosings,
      availableCash,
      monthDeposits,
      monthWithdrawals,
      monthExpenses,
      monthRevenue,
      financialPeriodLabel: new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
      missingPayslips: managementUsers.filter((user) => !payrollUserIds.has(user.id)).map((user) => ({
        id: user.id,
        name: user.name,
        photoUrl: user.photo_url,
        location: user.location?.name || "Sede non indicata",
      })),
      payrollMonthLabel: new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(previousMonthDate),
    };

    return (
      <AppShell title="Dashboard" subtitle="Direzione operativa" role={role as any} hideHeader transparentMain>
        <ManagementDashboard data={managementData} />
      </AppShell>
    );
  }

  // Parallel Data Queries
  const [
    dashboardSettingRaw,
    clientControlForms,
    todayAttendanceLogs,
    todayShiftEntries,
    weeklyShiftEntries,
    monthlyAttendanceLogs,
    monthlyShiftEntries,
    upcomingLeaveRequests,
    clockRuleSetting,
    allEmployees,
    unreadCommunications,
    unreadNotificationsCount,
  ] = await Promise.all([
    safe(prisma.setting.findUnique({ where: { key: DASHBOARD_SETTINGS_KEY } }), null),
    safe(prisma.serviceForm.findMany({ where: { active: true }, select: { id: true, name: true, category: true } }), []),
    safe(prisma.attendanceLog.findMany({
      where: { user_id: currentUser.id, date: { gte: statusToday, lt: statusTomorrow } },
      orderBy: { timestamp: "asc" },
      select: { type: true, timestamp: true, time: true }
    }), []),
    safe(prisma.scheduleEntry.findMany({
      where: {
        date: { gte: statusToday, lt: statusTomorrow },
        ...(currentUser.sede_id ? { location_id: currentUser.sede_id } : {})
      },
      include: { user: true, category: true }
    }), []),
    safe(prisma.scheduleEntry.findMany({
      where: { user_id: currentUser.id, date: { gte: weekStart, lt: weekEnd } },
      include: { category: true },
      orderBy: { date: "asc" },
    }), []),
    safe(prisma.attendanceLog.findMany({
      where: { user_id: currentUser.id, date: { gte: start, lt: end } },
      orderBy: { timestamp: "asc" },
      select: { date: true, type: true, timestamp: true },
    }), []),
    safe(prisma.scheduleEntry.findMany({
      where: { user_id: currentUser.id, date: { gte: start, lt: end } },
      include: { category: true },
    }), []),
    safe(prisma.leaveRequest.findMany({
      where: {
        user_id: currentUser.id,
        end_date: { gte: statusToday },
        status: { in: ["PENDING", "APPROVED", "FLAGGED"] },
      },
      orderBy: { start_date: "asc" },
      take: 8,
    }), []),
    currentUser.sede_id
      ? safe(prisma.setting.findUnique({ where: { key: clockRuleKey(currentUser.sede_id) } }), null)
      : Promise.resolve(null),
    safe(prisma.user.findMany({
      where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }), []),
    safe(prisma.notification.findMany({
      where: {
        user_id: currentUser.id,
        type: "COMUNICAZIONE",
        read: false
      },
      orderBy: { created_at: "desc" }
    }), []),
    safe(prisma.notification.count({
      where: {
        user_id: currentUser.id,
        read: false
      }
    }), 0),
  ]);

  // Parse Dashboard Settings (Goals, Promos, Products, Announcements, Worker Bonus Map)
  const dashboardVal = (dashboardSettingRaw?.value as any) || {};
  const salonGoal = Number(dashboardVal?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal;
  const workerGoal = Number(dashboardVal?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal;
  const workerBonusMap = (dashboardVal?.workerBonusMap as Record<string, { manualBonusPoints?: number; redeemedPoints?: number }>) || {};
  const promos = Array.isArray(dashboardVal?.promos) ? dashboardVal.promos : DEFAULT_DASHBOARD_SETTINGS.promos;
  const sideCard1 = dashboardVal?.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1;
  const sideCard2 = dashboardVal?.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2;
  const productOfMonth = dashboardVal?.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth;
  const communications = Array.isArray(dashboardVal?.communications) ? dashboardVal.communications : DEFAULT_DASHBOARD_SETTINGS.communications;

  // Canonical Employee Names (exact match to /client-control analytics)
  const canonicalEmployeeNames = allEmployees
    .map((e) => e.name)
    .filter((n): n is string => Boolean(n?.trim()));
  const currentWorkerCanonicalName = resolveCanonicalStaffName(currentUser.name || "", canonicalEmployeeNames);

  // Calculate Points / Schede for Current Month from Controllo Cliente
  const clientControlFormIds = clientControlForms
    .filter((f) => isClientControlFormName(f.name, f.category))
    .map((f) => f.id);

  let currentSalonPoints = 0;
  let currentWorkerPoints = 0;
  let allWorkerPoints: {
    id: string;
    name: string;
    points: number;
    manualBonusPoints: number;
    redeemedPoints: number;
    totalEarnedPoints: number;
    availablePoints: number;
  }[] = [];

  if (clientControlFormIds.length > 0) {
    const rawResponses = await safe(prisma.serviceFormResponse.findMany({
      where: {
        form_id: { in: clientControlFormIds },
        created_at: { gte: start, lt: end }
      },
      select: {
        id: true,
        answers: true,
        user_location_name: true,
        user: { select: { name: true } }
      }
    }), []);

    // Filter out "finito" responses (exact match to /client-control analytics)
    const responses = rawResponses.filter((resp) => {
      const answers = (resp.answers as Record<string, unknown>) || {};
      const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || answers.client_control_correctness || "").trim().toLowerCase();
      return correctness !== "finito";
    });

    const staffCountsMap = new Map<string, number>();
    let countedSalonResponses = 0;

    for (const response of responses) {
      const answers = (response.answers as Record<string, unknown>) || {};
      if (!countsInAnalytics(answers)) continue;

      countedSalonResponses += 1;

      const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const staffNames = (selectedStaff.length > 0 ? selectedStaff : fallbackOwner.length > 0 ? fallbackOwner : [response.user?.name ?? "Senza responsabile"])
        .map((name) => resolveCanonicalStaffName(name, canonicalEmployeeNames));

      for (const name of staffNames) {
        staffCountsMap.set(name, (staffCountsMap.get(name) || 0) + 1);
      }
    }

    currentSalonPoints = countedSalonResponses;
    currentWorkerPoints = staffCountsMap.get(currentWorkerCanonicalName) || staffCountsMap.get(currentUser.name || "") || 0;

    const salonEarned = currentSalonPoints >= salonGoal;

    allWorkerPoints = allEmployees.map((emp) => {
      const canonical = resolveCanonicalStaffName(emp.name, canonicalEmployeeNames);
      const pts = staffCountsMap.get(canonical) || staffCountsMap.get(emp.name) || 0;
      const workerEarned = pts >= workerGoal;

      const userBonusRecord = workerBonusMap[emp.id] || workerBonusMap[canonical] || workerBonusMap[emp.name] || {};
      const manualBonusPoints = Number(userBonusRecord.manualBonusPoints) || 0;
      const redeemedPoints = Number(userBonusRecord.redeemedPoints) || 0;

      let monthGoalBonus = 0;
      if (salonEarned) monthGoalBonus += 10;
      if (workerEarned) monthGoalBonus += 10;

      const totalEarnedPoints = monthGoalBonus + manualBonusPoints;
      const availablePoints = Math.max(0, totalEarnedPoints - redeemedPoints);

      return {
        id: emp.id,
        name: emp.name,
        points: pts,
        manualBonusPoints,
        redeemedPoints,
        totalEarnedPoints,
        availablePoints,
      };
    }).sort((a, b) => b.points - a.points);
  }

  // Calculate Shift & Worked Hours for Logged-In User
  const myTodayShift = todayShiftEntries.find((e) => e.user_id === currentUser.id);
  const todayShiftStartTime = myTodayShift?.start_time ?? myTodayShift?.category?.start_time ?? null;
  const todayShiftEndTime = myTodayShift?.end_time ?? myTodayShift?.category?.end_time ?? null;
  const todayShiftTime = todayShiftStartTime && todayShiftEndTime ? `${todayShiftStartTime} - ${todayShiftEndTime}` : "Nessun turno oggi";

  const clockRule = parseClockRule(clockRuleSetting?.value);
  const breakDurationMinutes = clockRule.breakDurationMinutes;

  // Simple Worked Hours Formatted String from today's attendance logs
  let totalWorkedMs = 0;
  let lastEntryTime: number | null = null;

  for (const log of todayAttendanceLogs) {
    if (log.type === "ENTRATA" || log.type === "RIENTRO") {
      lastEntryTime = new Date(log.timestamp).getTime();
    } else if ((log.type === "PAUSA" || log.type === "USCITA") && lastEntryTime !== null) {
      totalWorkedMs += new Date(log.timestamp).getTime() - lastEntryTime;
      lastEntryTime = null;
    }
  }
  if (lastEntryTime !== null) {
    totalWorkedMs += Date.now() - lastEntryTime;
  }

  const totalWorkedMinutes = Math.floor(totalWorkedMs / 60000);
  const hours = Math.floor(totalWorkedMinutes / 60);
  const mins = totalWorkedMinutes % 60;
  const workedHoursFormatted = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  const firstEntriesByDate = new Map<string, Date>();
  for (const log of monthlyAttendanceLogs) {
    if (log.type !== "ENTRATA") continue;
    const key = log.date.toISOString().slice(0, 10);
    if (!firstEntriesByDate.has(key)) firstEntriesByDate.set(key, log.timestamp);
  }
  let monthlyLateCount = 0;
  for (const shift of monthlyShiftEntries) {
    const categoryName = shift.category.name.toLowerCase();
    if (categoryName.includes("riposo")) continue;
    const planned = timeToMinutes(shift.start_time || shift.category.start_time);
    const entry = firstEntriesByDate.get(shift.date.toISOString().slice(0, 10));
    if (planned === null || !entry) continue;
    if (romeDateTimeParts(entry).totalMinutes - planned > 10) monthlyLateCount += 1;
  }

  const firstTodayEntry = todayAttendanceLogs.find((log) => log.type === "ENTRATA");
  const plannedTodayMinutes = timeToMinutes(todayShiftStartTime);
  const todayLateMinutes = firstTodayEntry && plannedTodayMinutes !== null
    ? Math.max(0, romeDateTimeParts(firstTodayEntry.timestamp).totalMinutes - plannedTodayMinutes)
    : 0;

  const weeklyShifts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    const entry = weeklyShiftEntries.find((shift) => shift.date.toISOString().slice(0, 10) === date.toISOString().slice(0, 10));
    const categoryName = entry?.category.name || "Non programmato";
    const isRest = categoryName.toLowerCase().includes("riposo");
    const shiftStart = entry?.start_time || entry?.category.start_time;
    const shiftEnd = entry?.end_time || entry?.category.end_time;
    return {
      date: date.toISOString(),
      dayLabel: new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", ""),
      dayNumber: String(date.getUTCDate()).padStart(2, "0"),
      categoryName,
      time: shiftStart && shiftEnd ? `${shiftStart} - ${shiftEnd}` : isRest ? "Riposo" : "--:--",
      isToday: date.toISOString().slice(0, 10) === statusToday.toISOString().slice(0, 10),
      isRest,
    };
  });

  const formatLeaveDate = (date: Date) => new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  const workerRequests = upcomingLeaveRequests.map((request) => ({
    id: request.id,
    type: request.type,
    status: request.status,
    period: request.start_date.getTime() === request.end_date.getTime()
      ? formatLeaveDate(request.start_date)
      : `${formatLeaveDate(request.start_date)} - ${formatLeaveDate(request.end_date)}`,
    reason: request.reason,
  }));
  const isRestShift = (entry: (typeof monthlyShiftEntries)[number]) => {
    const code = entry.category.code.toUpperCase();
    return entry.category.name.toLowerCase().includes("riposo") || ["R", "RI", "R3", "RIPOSO"].includes(code);
  };
  const todayIsRest = Boolean(myTodayShift && isRestShift(myTodayShift));
  const nextWorkShift = monthlyShiftEntries
    .filter((entry) => entry.date > statusToday && !isRestShift(entry))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const nextWorkDayLabel = nextWorkShift
    ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(nextWorkShift.date)
    : null;

  return (
    <AppShell 
      title="Dashboard" 
      subtitle="Bacheca salone: obiettivi mensili schede, promozioni attive, presenza e clienti oggi." 
      role={role as any}
      hideHeader={true}
      transparentMain={true}
    >
      <DashboardRedesignClient
        currentUser={{
          id: currentUser.id,
          name: currentUser.name || "Paradise Staff",
          email: currentUser.email || "",
          role: currentUser.role || "DIPENDENTE",
          photo_url: currentUser.photo_url || null,
          locationName: currentUser.location?.name ?? null,
          sedeId: currentUser.sede_id ?? null,
        }}
        salonGoal={salonGoal}
        workerGoal={workerGoal}
        currentSalonPoints={currentSalonPoints}
        currentWorkerPoints={currentWorkerPoints}
        allWorkerPoints={allWorkerPoints}
        promos={promos}
        sideCard1={sideCard1}
        sideCard2={sideCard2}
        productOfMonth={productOfMonth}
        communications={communications}
        unreadCommunications={unreadCommunications.map(c => ({
          id: c.id,
          title: c.title,
          message: c.message,
          type: c.type,
          createdAt: c.created_at.toISOString()
        }))}
        unreadNotifications={unreadNotificationsCount}
        todayShiftTime={todayShiftTime}
        workedHoursFormatted={workedHoursFormatted}
        recentLogs={todayAttendanceLogs}
        breakDurationMinutes={breakDurationMinutes}
        todayShiftStartTime={todayShiftStartTime}
        todayShiftAssignedHours={myTodayShift?.category?.paid_hours ?? 8}
        weeklyShifts={weeklyShifts}
        monthlyLateCount={monthlyLateCount}
        todayLateMinutes={todayLateMinutes}
        workerRequests={workerRequests}
        todayIsRest={todayIsRest}
        nextWorkDayLabel={nextWorkDayLabel}
      />
    </AppShell>
  );
}
