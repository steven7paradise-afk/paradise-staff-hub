import { ShiftCalendar } from "./shift-calendar";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";
import { prisma } from "@/lib/prisma";
import { coerceEmployeeScheduleMonth, isEmployeeScheduleMonthVisible, visibleScheduleMonthsForEmployee } from "@/lib/schedule-visibility";
import { cookies } from "next/headers";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { MonthSelector, TodayShiftCountdown } from "./client-components";

export const dynamic = "force-dynamic";

const monthNames = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

function hours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

function timeRange(entry?: { start_time?: string | null; end_time?: string | null; category: { start_time: string | null; end_time: string | null } }) {
  const start = entry?.start_time ?? entry?.category.start_time;
  const end = entry?.end_time ?? entry?.category.end_time;
  return start && end ? `${start.slice(0,5)}–${end.slice(0,5)}` : "Nessun orario";
}

export default async function MyShiftsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; weekOffset?: string; userId?: string }> }) {
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
  if (!["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"].includes(sessionUser.role)) redirect("/dashboard");

  const values = await searchParams;
  const targetUserId = (sessionUser.id === "PC_CASSA" && values.userId) ? values.userId : sessionUser.id;
  const today = new Date(new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Rome"}).format(new Date()) + "T12:00:00Z");
  const requestedMonth = Number(values.month);
  const requestedYear = Number(values.year);
  const parsedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth - 1 : today.getMonth();
  const parsedYear = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : today.getFullYear();

  const isEmployee = sessionUser.role === "DIPENDENTE";
  const planningAccessSetting = isEmployee ? await prisma.setting.findUnique({ where: { key: PLANNING_ACCESS_KEY } }) : null;
  const planningAccess = normalizePlanningAccess(planningAccessSetting?.value);
  const employeeAllowedMonths = isEmployee ? visibleScheduleMonthsForEmployee(today, planningAccess.nextMonthVisible) : undefined;
  const selectedMonth = isEmployee ? coerceEmployeeScheduleMonth(parsedMonth, parsedYear, today, planningAccess.nextMonthVisible) : { month: parsedMonth, year: parsedYear };
  const month = selectedMonth.month;
  const year = selectedMonth.year;
  
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  // Expand query range by 7 days on both ends to support week boundaries without boundary cuts
  const queryStart = new Date(start);
  queryStart.setUTCDate(queryStart.getUTCDate() - 7);
  const queryEnd = new Date(end);
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 7);

  const [user, schedules, logs, records] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetUserId }, include: { location: true } }),
    prisma.scheduleEntry.findMany({ where: { user_id: targetUserId, date: { gte: queryStart, lt: queryEnd } }, include: { category: true }, orderBy: { date: "asc" } }),
    prisma.attendanceLog.findMany({ where: { user_id: targetUserId, date: { gte: queryStart, lt: queryEnd } }, select: { date: true, type: true, timestamp: true, time: true, note: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: targetUserId, date: { gte: queryStart, lt: queryEnd } } }),
  ]);
  
  if (!user) redirect("/login");

  const clockRuleSetting = user.sede_id
    ? await prisma.setting.findUnique({ where: { key: clockRuleKey(user.sede_id) } }).catch(() => null)
    : null;
  const breakDurationMinutes = parseClockRule(clockRuleSetting?.value).breakDurationMinutes;


  const rows = monthlyPersonalHours(year, month, schedules, logs, records);
  const planned = rows.reduce((total, row) => total + row.plannedHours, 0);
  const worked = rows.reduce((total, row) => total + row.workedHours, 0);
  const breaks = rows.reduce((total, row) => total + row.breakHours, 0);
  const recordedDays = rows.filter(row => row.firstEntry).length;
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(today);
  const currentMonth = todayStr.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`;
  const todaySchedule = schedules.find(s => s.date.toISOString().slice(0, 10) === todayStr);
  const todayLogs = logs.filter(l => l.date.toISOString().slice(0, 10) === todayStr);
  const nextShift = rows.find(r => r.date.toISOString().slice(0, 10) > todayStr && r.plannedHours > 0 && !/riposo|ferie|malattia|permesso|chius/i.test(r.schedule?.category.name || ""));
  const previous = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));
  const canOpenPreviousMonth = !isEmployee || isEmployeeScheduleMonthVisible(previous.getUTCMonth(), previous.getUTCFullYear(), today, planningAccess.nextMonthVisible);
  const canOpenNextMonth = !isEmployee || isEmployeeScheduleMonthVisible(next.getUTCMonth(), next.getUTCFullYear(), today, planningAccess.nextMonthVisible);
  const href = (m: number, y: number) => `/my-shifts?month=${m + 1}&year=${y}${isPC ? `&userId=${encodeURIComponent(targetUserId)}` : ""}`;
  const days = rows.map(row => ({
    dateIso: row.date.toISOString(),
    dayName: new Intl.DateTimeFormat("it-IT", {weekday:"long",timeZone:"UTC"}).format(row.date),
    dayNum: new Intl.DateTimeFormat("it-IT", {day:"2-digit",timeZone:"UTC"}).format(row.date),
    monthName: new Intl.DateTimeFormat("it-IT", {month:"short",timeZone:"UTC"}).format(row.date),
    shiftName: row.schedule?.category.name || "Non programmato", shiftTime: timeRange(row.schedule),
    firstEntry: row.firstEntry, firstPause: row.firstPause, lastReturn: row.lastReturn, lastExit: row.lastExit,
    workedHours: row.workedHours, grossHours: row.grossHours, plannedGrossHours: row.plannedGrossHours,
    plannedHours: row.plannedHours, breakHours: row.breakHours, paidBreak: row.paidBreak, note: row.note,
  }));
  return <AppShell title="I miei turni" role={sessionUser.role} hideHeader edgeToEdgeMain>
    <main className="my-shifts-page">
      <header className="shift-page-heading"><div><h1>I miei turni</h1><p>{user.name} · {user.location?.name || "Sede non assegnata"}</p></div><Link className="shift-today-link" href={href(Number(todayStr.slice(5,7))-1, Number(todayStr.slice(0,4)))}>Mese corrente</Link></header>
      {currentMonth && <div className="shift-today-row"><section className="shift-today-card"><span className="shift-eyebrow">Oggi, {new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"long",timeZone:"Europe/Rome"}).format(today)}</span><strong>{todaySchedule ? timeRange(todaySchedule) === "Nessun orario" ? todaySchedule.category.name : timeRange(todaySchedule) : "Nessun turno programmato"}</strong><p>{todaySchedule?.category.name || "Controlla i prossimi giorni nel calendario."}</p></section><section className="shift-today-card shift-next-card"><span className="shift-eyebrow">Prossimo turno nel mese</span><strong>{nextShift ? new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"short",timeZone:"UTC"}).format(nextShift.date) : "Nessun altro turno previsto"}</strong>{nextShift && <p>{timeRange(nextShift.schedule)} · {nextShift.schedule?.category.name}</p>}</section></div>}
      <div className="shift-month-toolbar"><MonthSelector currentMonth={month} currentYear={year} allowedMonths={employeeAllowedMonths} targetUserId={isPC?targetUserId:undefined}/><div className="shift-month-nav">{canOpenPreviousMonth&&<Link href={href(previous.getUTCMonth(),previous.getUTCFullYear())} aria-label="Mese precedente"><ChevronLeft size={20}/></Link>}{canOpenNextMonth&&<Link href={href(next.getUTCMonth(),next.getUTCFullYear())} aria-label="Mese successivo"><ChevronRight size={20}/></Link>}</div></div>
      <ShiftCalendar key={`${year}-${month}`} days={days} today={todayStr} monthLabel={`${monthNames[month]} ${year}`}/>
      <section aria-label="Riepilogo del mese"><h2 className="mt-6">Riepilogo · {monthNames[month]}</h2><p className="mt-1 text-sm text-neutral-600">Ore previste per tutto il mese e ore già conteggiate dalle timbrature.</p><dl className="shift-month-summary">{[["Ore previste nel mese",`${hours(planned)} h`],["Ore conteggiate",`${hours(worked)} h`],["Giorni con timbratura",String(recordedDays)],["Pause registrate",`${hours(breaks)} h`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      {currentMonth && <details className="mt-5 rounded-2xl border border-pink-100 bg-white p-5"><summary className="cursor-pointer font-semibold">Turno in tempo reale e pausa di oggi</summary><div className="mt-4"><TodayShiftCountdown initialNow={new Date().toISOString()} shiftName={todaySchedule?.category.name || "Non programmato"} shiftTime={timeRange(todaySchedule)} startTime={todaySchedule?.start_time ?? todaySchedule?.category.start_time ?? null} endTime={todaySchedule?.end_time ?? todaySchedule?.category.end_time ?? null} locationName={user.location?.name} breakDurationMinutes={breakDurationMinutes} initialLogs={todayLogs.map(log=>({type:log.type,timestamp:log.timestamp.toISOString(),time:log.time}))}/></div></details>}
    </main>
  </AppShell>;
}
