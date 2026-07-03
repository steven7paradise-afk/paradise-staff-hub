import Link from "next/link";
import { 
  Activity, ArrowRight, BellRing, Building2, CalendarDays, 
  Clock3, FileCheck2, FileText, UserCheck, Users, 
  ClipboardList, CheckSquare, Settings, ShieldCheck, UserRound,
  UserPlus, Calculator, Clock
} from "lucide-react";
import type { AttendanceType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

import { EmployeeLiveSummary } from "@/components/employee-live-summary";
import { InstantLink } from "@/components/instant-link";
import { LiveAttendance } from "@/components/live-attendance";
import { LiveTeamStatus } from "@/components/live-team-status";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { CASH_CLOSING_FIELD_IDS } from "@/lib/cash-closing-form";
import { monthlyPersonalHours, type PersonalDayHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const attendanceNames = { ENTRATA: "Entrata", PAUSA: "Pausa", RIENTRO: "Rientro", USCITA: "Uscita" };
const requestNames = { FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", MALATTIA: "Malattia", ALTRO: "Altro" };
const statusLabels = { PENDING: "In attesa", APPROVED: "Approvata", REJECTED: "Rifiutata", FLAGGED: "Segnalata" };
type AttendanceWithRelations = Prisma.AttendanceLogGetPayload<{
  include: { user: true; location: true; device: true };
}>;
type RequestWithUser = Prisma.LeaveRequestGetPayload<{ include: { user: true } }>;
type UserWithLocation = Prisma.UserGetPayload<{ include: { location: true } }>;
type ScheduleWithUserCategory = Prisma.ScheduleEntryGetPayload<{ include: { user: true; category: true } }>;
type ScheduleWithCategory = Prisma.ScheduleEntryGetPayload<{ include: { category: true } }>;
type WorkerRow = { id: string; name: string };
type PersonalDocument = { id: string; title: string; file_url: string; storage_path: string | null; type: string; month: number | null; year: number | null };

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const month = new Date(start.getFullYear(), start.getMonth(), 1);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end, month, nextMonth };
}

function romeDate() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  return new Date(`${day}T00:00:00.000Z`);
}

function formatDate(date?: Date | null) {
  if (!date) return "Non impostata";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

function daysUntil(date?: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function monthDays(month: Date) {
  return Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
}

function mondayOffset(date: Date) {
  return (date.getDay() + 6) % 7;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");

  const safe = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      console.error("Dashboard data unavailable:", error);
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
    name: session.user.name || "Paradise",
    email: session.user.email || "",
    sede_id: session.user.sedeId ?? null,
    location: null,
    photo_url: null,
    whatsapp_phone: null,
    fiscal_code: null,
  } as any);

  const role: Role = currentUser.role;

  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date());

  const { start, end, month, nextMonth } = dayRange();
  const statusToday = romeDate();
  const statusTomorrow = new Date(statusToday);
  statusTomorrow.setUTCDate(statusTomorrow.getUTCDate() + 1);
  const statusYesterday = new Date(statusToday);
  statusYesterday.setUTCDate(statusYesterday.getUTCDate() - 1);
  let attendanceWhere: Prisma.AttendanceLogWhereInput = {};
  let requestWhere: Prisma.LeaveRequestWhereInput = {};
  if (role === "DIPENDENTE") {
    attendanceWhere = { user_id: currentUser.id };
    requestWhere = { user_id: currentUser.id };
  }
  if (role === "RESPONSABILE") {
    attendanceWhere = { location_id: currentUser.sede_id ?? undefined };
    requestWhere = { user: { sede_id: currentUser.sede_id ?? undefined } };
  }

  const [recentAttendance, recentRequests] = await Promise.all([
    safe(prisma.attendanceLog.findMany({ where: attendanceWhere, include: { user: true, location: true, device: true }, orderBy: { timestamp: "desc" }, take: 5 }), [] as AttendanceWithRelations[]),
    safe(prisma.leaveRequest.findMany({ where: requestWhere, include: { user: true }, orderBy: { created_at: "desc" }, take: 5 }), [] as RequestWithUser[]),
  ]);

  let subtitle = "Controllo operativo HR, presenze, documenti e notifiche in un unico spazio.";
  let attendanceTitle = "Timbrature recenti";
  let requestsTitle = "Ferie e permessi";
  let metrics: Array<{ label: string; value: number | string; trend: string; icon: typeof Activity }>;
  let todayShift: ScheduleWithCategory | null = null;
  let nextShift: ScheduleWithCategory | null = null;
  let colleaguesToday = 0;
  let pendingPersonalRequests = 0;
  let unreadCommunications = 0;
  let personalTodayLogs: Array<{ type: AttendanceType; timestamp: Date; time: string }> = [];
  let personalFutureEntries: ScheduleWithCategory[] = [];
  let breakDurationMinutes = 0;
  let next7Days: Date[] = [];
  let todayShiftStartTime: string | null = null;
  let todayShiftAssignedHours = 0;
  let todaySalonWorkers: any[] = [];

  const [personalSchedule, personalMonthLogs, personalHourRecords, salonSchedule, salonWorkers, personalDocuments, personalNotifications, liveTeamWorkers, activeAbsences, locationsOverview, contractDeadlines, liveClockSettings, rawNewResponses, todayCashClosings] = await Promise.all([
    role === "DIPENDENTE"
      ? safe(prisma.scheduleEntry.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } }, include: { category: true }, orderBy: { date: "asc" } }), [] as ScheduleWithCategory[])
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? safe(prisma.attendanceLog.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }), [])
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? safe(prisma.workHourRecord.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } } }), [])
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? safe(prisma.scheduleEntry.findMany({
          where: { user: { sede_id: currentUser.sede_id ?? undefined }, date: { gte: month, lt: nextMonth } },
          include: { user: true, category: true },
          orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
        }), [] as ScheduleWithUserCategory[])
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? safe(prisma.user.findMany({ where: { active: true, sede_id: currentUser.sede_id, role: { not: "SUPER_ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }), [] as WorkerRow[])
      : Promise.resolve([] as WorkerRow[]),
    role === "DIPENDENTE"
      ? safe(prisma.document.findMany({ where: { user_id: currentUser.id }, select: { id: true, title: true, file_url: true, storage_path: true, type: true, month: true, year: true }, orderBy: { created_at: "desc" }, take: 5 }), [] as PersonalDocument[])
      : Promise.resolve([] as PersonalDocument[]),
    safe(prisma.notification.findMany({ where: { user_id: currentUser.id }, orderBy: { created_at: "desc" }, take: 5 }), []),
    role !== "DIPENDENTE"
      ? safe(prisma.user.findMany({
          where: {
            active: true,
            role: { not: "SUPER_ADMIN" },
            ...(role === "RESPONSABILE" ? { sede_id: currentUser.sede_id } : {}),
          },
          include: { location: true, attendance_logs: { where: { date: { gte: statusToday, lt: statusTomorrow } }, orderBy: { timestamp: "desc" }, take: 1 } },
          orderBy: { name: "asc" },
        }), [])
      : Promise.resolve([]),
    role !== "DIPENDENTE"
      ? safe(prisma.leaveRequest.findMany({
          where: {
            ...(role === "RESPONSABILE" ? { user: { sede_id: currentUser.sede_id ?? undefined } } : {}),
            status: "APPROVED",
            start_date: { lte: end },
            end_date: { gte: start },
          },
          include: { user: true },
          orderBy: { start_date: "asc" },
        }), [])
      : Promise.resolve([]),
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? safe(prisma.location.findMany({ where: { active: true }, include: { users: { where: { active: true, role: { not: "SUPER_ADMIN" } }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }), [])
      : Promise.resolve([]),
    role !== "DIPENDENTE"
      ? safe(prisma.user.findMany({
          where: {
            active: true,
            role: { not: "SUPER_ADMIN" },
            ...(role === "RESPONSABILE" ? { sede_id: currentUser.sede_id } : {}),
            contract_end: { not: null },
          },
          include: { location: true },
          orderBy: { contract_end: "asc" },
          take: 8,
        }), [])
      : Promise.resolve([]),
    role === "DIPENDENTE" && currentUser.sede_id
      ? safe(prisma.setting.findMany({ where: { key: clockRuleKey(currentUser.sede_id) } }), [])
      : role !== "DIPENDENTE"
      ? safe(prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } }), [])
      : Promise.resolve([]),
    safe(prisma.serviceFormResponse.findMany({
      where: {
        status: "NEW",
      },
      include: {
        form: true,
        user: { select: { id: true, name: true, role: true, photo_url: true, sede_id: true } },
      },
      orderBy: { created_at: "desc" },
      take: 30,
    }), []),
    role !== "DIPENDENTE"
      ? safe(
          prisma.cashClosing.findMany({
            where: {
              created_at: { gte: statusYesterday, lt: statusTomorrow },
              ...(role === "RESPONSABILE" ? { location_id: currentUser.sede_id ?? undefined } : {}),
            },
            include: { user: true, location: true },
            orderBy: { created_at: "desc" },
            take: 20,
          }).then(closings => closings.map(c => ({
            id: c.id,
            user_location_name: c.location?.name,
            user: c.user,
            created_at: c.created_at,
            answers: {
              [CASH_CLOSING_FIELD_IDS.withdrawn]: c.withdrawn,
              [CASH_CLOSING_FIELD_IDS.fund]: c.fund,
              [CASH_CLOSING_FIELD_IDS.notes]: c.notes,
              _signature: { user_name: c.signature_name },
            }
          }))),
          []
        )
      : Promise.resolve([]),
  ]);
  const allowedNewResponses = rawNewResponses.filter((r: any) => {
    // Exclude cash closing or safe prelievo forms
    const isCashForm = r.form?.name?.toLowerCase().includes("cassa") || 
                       r.form?.category?.toLowerCase().includes("cassa") ||
                       r.form?.name?.toLowerCase().includes("prelievo") || 
                       r.form?.category?.toLowerCase().includes("cassaforte");
    if (isCashForm) return false;

    // Exclude own submissions
    if (r.user_id === currentUser.id) return false;

    // Managers
    if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
    if (role === "RESPONSABILE" && r.user?.sede_id === currentUser.sede_id) return true;

    // User explicitly notified
    const notifyUserIds = r.form?.notify_user_ids as string[] | null;
    if (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(currentUser.id)) return true;

    // Role notified
    const notifyRoles = r.form?.notify_roles as string[] | null;
    if (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role)) return true;

    return false;
  });
  const newResponsesCount = allowedNewResponses.length;

  const personalHourDays = role === "DIPENDENTE"
    ? monthlyPersonalHours(month.getFullYear(), month.getMonth(), personalSchedule, personalMonthLogs, personalHourRecords)
    : [];

  if (role === "DIPENDENTE") {
    const today = statusToday;
    const tomorrow = statusTomorrow;
    const [todayEntry, futureEntries, todaySalonEntries, openRequests, unread, todayLogs] = await Promise.all([
      safe(prisma.scheduleEntry.findFirst({ where: { user_id: currentUser.id, date: { gte: today, lt: tomorrow } }, include: { category: true } }), null),
      safe(prisma.scheduleEntry.findMany({ where: { user_id: currentUser.id, date: { gte: tomorrow } }, include: { category: true }, orderBy: { date: "asc" }, take: 24 }), [] as ScheduleWithCategory[]),
      safe(prisma.scheduleEntry.findMany({ 
        where: { location_id: currentUser.sede_id ?? undefined, date: { gte: today, lt: tomorrow } }, 
        include: { user: true, category: true },
        orderBy: { user: { name: "asc" } }
      }), [] as ScheduleWithUserCategory[]),
      safe(prisma.leaveRequest.count({ where: { user_id: currentUser.id, status: "PENDING" } }), 0),
      safe(prisma.notification.count({ where: { user_id: currentUser.id, read: false, type: "COMUNICAZIONE" } }), 0),
      safe(prisma.attendanceLog.findMany({ where: { user_id: currentUser.id, date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true, time: true }, orderBy: { timestamp: "asc" } }), []),
    ]);
    todayShift = todayEntry;
    nextShift = futureEntries.find((entry) => Boolean((entry.start_time ?? entry.category.start_time) && (entry.end_time ?? entry.category.end_time))) ?? null;
    colleaguesToday = todaySalonEntries.filter((entry) => Boolean((entry.start_time ?? entry.category.start_time) && (entry.end_time ?? entry.category.end_time))).length;
    pendingPersonalRequests = openRequests;
    unreadCommunications = unread;
    personalTodayLogs = todayLogs;
    personalFutureEntries = futureEntries;
    
    // Sort so current user is first, followed by working colleagues, then resting/absent colleagues
    todaySalonWorkers = [...todaySalonEntries].sort((a, b) => {
      if (a.user_id === currentUser.id) return -1;
      if (b.user_id === currentUser.id) return 1;
      
      const hasShiftA = !!(a.start_time ?? a.category.start_time) && !!(a.end_time ?? a.category.end_time);
      const hasShiftB = !!(b.start_time ?? b.category.start_time) && !!(b.end_time ?? b.category.end_time);
      
      if (hasShiftA && !hasShiftB) return -1;
      if (!hasShiftA && hasShiftB) return 1;
      
      return a.user.name.localeCompare(b.user.name);
    });
    
    breakDurationMinutes = parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(currentUser.sede_id ?? ""))?.value).breakDurationMinutes;
    
    // Calcola orario e ore assegnate per oggi
    todayShiftStartTime = todayShift?.start_time ?? todayShift?.category.start_time ?? null;
    const todayShiftEndTime = todayShift?.end_time ?? todayShift?.category.end_time ?? null;
    const todayShiftDuration = todayShiftStartTime && todayShiftEndTime ? categoryDuration(todayShiftStartTime, todayShiftEndTime) : 0;
    todayShiftAssignedHours = todayShift ? (todayShift.category.paid_hours ?? Math.max(0, todayShiftDuration - breakDurationMinutes / 60)) : 0;
    
    next7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(statusToday);
      d.setDate(d.getDate() + i);
      return d;
    });

    subtitle = `Ecco cosa c'è di importante oggi${currentUser.location ? ` in ${currentUser.location.name}` : ""}.`;
    attendanceTitle = "Le mie timbrature";
    requestsTitle = "Le mie richieste";
    metrics = [
      { label: "Timbrature recenti", value: recentAttendance.length, icon: Clock3, trend: "Ultime registrate" },
      { label: "Richieste aperte", value: openRequests, icon: FileCheck2, trend: "In attesa di risposta" },
      { label: "Salone", value: currentUser.location?.name ?? "Non assegnato", icon: Building2, trend: "Vista del team" },
      { label: "Comunicazioni", value: unread, icon: BellRing, trend: "Da leggere" },
    ];
  } else if (role === "RESPONSABILE") {
    subtitle = `Vista responsabile: andamento turno, assenze e contratti di ${currentUser.location?.name ?? "sede assegnata"}.`;
    const [team, todaysLogs, openRequests, scheduleItems] = await Promise.all([
      safe(prisma.user.count({ where: { sede_id: currentUser.sede_id, active: true, role: { not: "SUPER_ADMIN" } } }), 0),
      safe(prisma.attendanceLog.count({ where: { location_id: currentUser.sede_id ?? undefined, date: { gte: start, lt: end } } }), 0),
      safe(prisma.leaveRequest.count({ where: { user: { sede_id: currentUser.sede_id ?? undefined }, status: "PENDING" } }), 0),
      safe(prisma.scheduleEntry.count({ where: { location_id: currentUser.sede_id ?? undefined, date: { gte: month } } }), 0),
    ]);
    metrics = [
      { label: "Personale sede", value: team, icon: Users, trend: "Account attivi" },
      { label: "Timbrature oggi", value: todaysLogs, icon: UserCheck, trend: "Solo la tua sede" },
      { label: "Richieste aperte", value: openRequests, icon: FileCheck2, trend: "Da verificare" },
      { label: "Turni mese", value: scheduleItems, icon: CalendarDays, trend: "Turni nel planning" },
    ];
  } else if (role === "ADMIN") {
    subtitle = "Gestione operativa: dipendenti, timbrature, richieste, documenti e saloni.";
    const [staff, todaysLogs, openRequests, documents] = await Promise.all([
      safe(prisma.user.count({ where: { active: true, role: "DIPENDENTE" } }), 0),
      safe(prisma.attendanceLog.count({ where: { date: { gte: start, lt: end } } }), 0),
      safe(prisma.leaveRequest.count({ where: { status: "PENDING" } }), 0),
      safe(prisma.document.count(), 0),
    ]);
    metrics = [
      { label: "Dipendenti attivi", value: staff, icon: Users, trend: "Tutte le sedi" },
      { label: "Timbrature oggi", value: todaysLogs, icon: UserCheck, trend: "Registro ufficiale" },
      { label: "Richieste aperte", value: openRequests, icon: FileCheck2, trend: "Da approvare" },
      { label: "Documenti", value: documents, icon: FileText, trend: "Archivio caricato" },
    ];
  } else {
    subtitle = "Console Super Admin: sistema, saloni, contratti e controllo completo.";
    const [locations, staff, devices, openRequests] = await Promise.all([
      safe(prisma.location.count({ where: { active: true } }), 0),
      safe(prisma.user.count({ where: { active: true, role: { not: "SUPER_ADMIN" } } }), 0),
      safe(prisma.device.count({ where: { status: "ACTIVE", archived_at: null, NOT: { device_id: { startsWith: "ADMIN-MANUAL-" } } } }), 0),
      safe(prisma.leaveRequest.count({ where: { status: "PENDING" } }), 0),
    ]);
    metrics = [
      { label: "Sedi attive", value: locations, icon: Building2, trend: "Configurate nel sistema" },
      { label: "Utenti attivi", value: staff, icon: Users, trend: "Tutti i ruoli" },
      { label: "Tablet attivi", value: devices, icon: UserCheck, trend: "Autorizzati a timbrare" },
      { label: "Richieste aperte", value: openRequests, icon: FileCheck2, trend: "Da gestire" },
    ];
  }

  return (
    <AppShell 
      title={role === "DIPENDENTE" ? `Ciao, ${currentUser.name.split(" ")[0]}` : "Dashboard"} 
      subtitle={subtitle} 
      role={role}
      hideHeader={role === "DIPENDENTE"}
    >
      {/* Sfondo fisso per garantire l'effetto Glassmorphism/Neumorphism indipendentemente dal tema dell'utente */}
      <div className="fixed inset-0 -z-10 bg-[#f4f7f9] dark:bg-[#0f0f11] pointer-events-none" />
      
      {/* Profile Banner (Replaces standard header for DIPENDENTE) */}
      {role === "DIPENDENTE" ? (
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 dark:bg-white/5 dark:border-white/10 p-5 md:p-6 shadow-luxury backdrop-blur-xl flex flex-col md:flex-row items-center md:items-start justify-between gap-5 transition-all duration-300 mb-6">
          <div className="absolute top-0 right-0 -z-10 translate-x-12 -translate-y-12 size-40 rounded-full bg-paradise-softPink/20 dark:bg-white/5 blur-3xl" />
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 w-full md:w-auto">
            {/* User Photo */}
            <div className="relative shrink-0">
              <div className="relative grid size-20 md:size-24 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-3xl font-extrabold shadow-luxury ring-4 ring-white dark:ring-white/10">
                {currentUser.photo_url ? (
                  <img src={currentUser.photo_url} alt={currentUser.name} className="size-full object-cover" />
                ) : (
                  currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900 animate-pulse-green" />
            </div>

            {/* User details */}
            <div className="min-w-0 flex-1 text-center sm:text-left flex flex-col justify-center h-full pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                <h2 className="text-2xl font-bold tracking-tight text-[color:var(--text)]">
                  {currentUser.name}
                </h2>
                {currentUser.location && (
                  <div className="inline-flex self-center sm:self-auto items-center gap-1.5 rounded-full bg-paradise-softPink/60 dark:bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-[#B85B68] dark:text-paradise-pink">
                    <Building2 className="size-3" />
                    {currentUser.location.name}
                  </div>
                )}
              </div>
              
              {/* Contact Information & details */}
              <div className="mt-3.5 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-sm text-black/60 dark:text-white/60">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-black/30 dark:text-white/30 font-medium">Email:</span>
                  <span className="font-semibold text-black/80 dark:text-white/80">{currentUser.email}</span>
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-black/30 dark:text-white/30 font-medium">Telefono:</span>
                  <span className="font-semibold text-black/80 dark:text-white/80">{currentUser.whatsapp_phone ?? "Non impostato"}</span>
                </div>
                {currentUser.fiscal_code && (
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-black/30 dark:text-white/30 font-medium">CF:</span>
                    <span className="font-semibold text-black/80 dark:text-white/80 uppercase">{currentUser.fiscal_code}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date Badge */}
          <div className="shrink-0 rounded-full border border-black/5 bg-white dark:border-white/10 dark:bg-white/10 px-4 py-2 text-sm shadow-sm font-medium text-black/75 dark:text-white/80 self-center md:self-start">
            {dateLabel}
          </div>
        </div>
      ) : null}
      {newResponsesCount > 0 && (role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE") && (
        <div className="mb-6 flex items-center justify-between rounded-[20px] border border-[#e8b1bf]/45 bg-[#FFF7F9] p-4 text-sm font-semibold text-[#A74758] shadow-sm">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="size-4.5 animate-pulse text-[#C66170]" />
            <span>Hai {newResponsesCount} {newResponsesCount === 1 ? "modulo compilato" : "moduli compilati"} da verificare</span>
          </div>
          <Link href="/service-forms/to-verify" className="inline-flex items-center gap-1 text-xs font-extrabold uppercase hover:underline">
            Verifica ora <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
      {role !== "DIPENDENTE" ? <CashClosingTodayDashboard responses={todayCashClosings as any[]} statusToday={statusToday} /> : null}

      {role !== "DIPENDENTE" ? (
        <>
          <section 
            className="flex gap-3 overflow-x-auto pb-3 snap-x md:grid md:gap-4 md:grid-cols-2 xl:grid-cols-4 md:pb-0 animate-fade-in-up opacity-0 mb-6" 
            style={{ animationFillMode: "forwards" }}
          >
            {metrics.map((metric, idx) => {
              const Icon = metric.icon;
              const metricStyles = [
                { bg: "bg-purple-500/10 dark:bg-purple-500/20", icon: "text-purple-600 dark:text-purple-400" },
                { bg: "bg-blue-500/10 dark:bg-blue-500/20", icon: "text-blue-600 dark:text-blue-400" },
                { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-400" },
                { bg: "bg-orange-500/10 dark:bg-orange-500/20", icon: "text-orange-600 dark:text-orange-400" }
              ];
              const style = metricStyles[idx % metricStyles.length];
              return (
                <Card 
                  key={metric.label} 
                  className="p-5 md:p-7 min-w-[170px] shrink-0 snap-start flex-1 md:min-w-0 border-none relative overflow-hidden group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">{metric.label}</p>
                      <p className="mt-3 md:mt-4 text-3xl md:text-4xl font-black tracking-tight text-[color:var(--text)]">{metric.value}</p>
                    </div>
                    <div className={cn("grid size-12 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", style.bg, style.icon)}>
                      <Icon className="size-6" />
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] md:text-[11px] font-semibold text-black/35 dark:text-white/40">{metric.trend}</p>
                </Card>
              );
            })}
          </section>

          {/* Quick Actions Panel for non-DIPENDENTE */}
          <QuickActionsPanel role={role} />
        </>
      ) : null}

      {role === "DIPENDENTE" ? (
        <section className="min-w-0 grid gap-5 animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
          <EmployeeLiveSummary
            plannedTime={shiftTime(todayShift)}
            shiftName={todayShift?.category.name ?? "Nessun turno assegnato"}
            pendingRequests={pendingPersonalRequests}
            colleaguesToday={colleaguesToday}
            initialLogs={personalTodayLogs.map((log) => ({ type: log.type, timestamp: log.timestamp.toISOString(), time: log.time }))}
            breakDurationMinutes={breakDurationMinutes}
            startTime={todayShiftStartTime}
            assignedHours={todayShiftAssignedHours}
          />
          
          {/* Quick Actions Panel for DIPENDENTE */}
          <QuickActionsPanel role={role} />
          <div className="grid gap-5 xl:grid-cols-3 animate-fade-in-up [animation-delay:100ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <Card>
              <PanelHeader title="Il mio turno di oggi" href="/my-shifts" icon={CalendarDays} />
              {todayShift ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md dark:bg-white/5 p-4 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:bg-white/70">
                  <div className="min-w-14 rounded-xl bg-white/80 dark:bg-white/10 p-2 text-center shadow-sm">
                    <p className="text-xs font-bold uppercase text-black/45 dark:text-white/40">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(todayShift.date)}</p>
                    <p className="text-2xl font-semibold">{todayShift.date.getDate()}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{shiftTime(todayShift)}</p>
                    <p className="mt-1 text-xs text-black/55 dark:text-white/50">{todayShift.category.name}</p>
                    <p className="mt-1 text-[11px] text-black/45 dark:text-white/40">{currentUser.location?.name ?? "Salone"}</p>
                  </div>
                </div>
              ) : <EmptyText text="Nessun turno programmato per oggi." />}
            </Card>
            <Card>
              <PanelHeader title="Timbrature di oggi" href="/my-shifts" icon={Clock3} />
              <TodayClockList logs={personalTodayLogs} />
            </Card>
            <Card>
              <PanelHeader title="Il mio prossimo turno" href="/my-shifts" icon={CalendarDays} />
              {nextShift ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md dark:bg-white/5 p-4 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:bg-white/70">
                  <div className="min-w-14 rounded-xl bg-white/80 dark:bg-white/10 p-2 text-center shadow-sm">
                    <p className="text-xs font-bold uppercase text-black/45 dark:text-white/40">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(nextShift.date)}</p>
                    <p className="text-2xl font-semibold">{nextShift.date.getDate()}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{shiftTime(nextShift)}</p>
                    <p className="mt-1 text-xs text-black/55 dark:text-white/50">{nextShift.category.name}</p>
                    <p className="mt-1 text-[11px] text-black/45 dark:text-white/40">{currentUser.location?.name ?? "Salone"}</p>
                  </div>
                </div>
              ) : <EmptyText text="Nessun prossimo turno programmato." />}
            </Card>
          </div>
          <div className="animate-fade-in-up [animation-delay:200ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <Card>
              <PanelHeader title="Documenti recenti" href="/documents" icon={FileText} />
              <div className="mt-3"><PersonalDocuments documents={personalDocuments.slice(0, 3)} /></div>
            </Card>
          </div>
          <Card id="calendario" className="animate-fade-in-up [animation-delay:300ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-paradise-noir">I miei prossimi orari e turni</h2>
                <p className="text-xs text-black/55 dark:text-white/40">Visualizzazione dei tuoi orari pianificati per i prossimi 7 giorni</p>
              </div>
              <Badge tone="pink">7 Giorni</Badge>
            </div>
            
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
              {next7Days.map((date) => {
                const isToday = date.toDateString() === statusToday.toDateString();
                const key = date.toISOString().slice(0, 10);
                
                // Trova l'entry corrispondente
                const entry = isToday 
                  ? todayShift 
                  : personalFutureEntries.find(e => e.date.toISOString().slice(0, 10) === key);
                  
                const hasShift = entry && (entry.start_time ?? entry.category.start_time) && (entry.end_time ?? entry.category.end_time);
                
                const startTime = entry?.start_time ?? entry?.category.start_time;
                const endTime = entry?.end_time ?? entry?.category.end_time;
                const duration = startTime && endTime ? categoryDuration(startTime, endTime) : 0;
                const paidHours = entry ? (entry.category.paid_hours ?? Math.max(0, duration - breakDurationMinutes / 60)) : 0;
                
                return (
                  <div 
                    key={key} 
                    className={cn(
                      "flex flex-col justify-between rounded-2xl border p-3.5 transition-all duration-300",
                      isToday 
                        ? "border-[#e8b1bf] bg-paradise-softPink/10 dark:bg-white/10 shadow-sm"
                        : "border-white/40 bg-white/50 backdrop-blur-sm dark:bg-white/5 dark:border-white/10 hover:border-white/80 hover:bg-white/70 hover:shadow-sm"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/45">
                          {new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date)}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-paradise-pink px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                            Oggi
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-lg font-bold tracking-tight text-[color:var(--text)]">
                        {date.getDate()} {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date)}
                      </p>
                      
                      {hasShift ? (
                        <div className="mt-3">
                          <span 
                            className="inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                            style={{ 
                              backgroundColor: entry.category.color ? entry.category.color + '20' : 'rgba(255,168,221,0.2)',
                              color: entry.category.text_color || '#B85B68'
                            }}
                          >
                            {entry.category.name}
                          </span>
                          <p className="mt-2 text-sm font-extrabold tracking-tight text-neutral-800 dark:text-white">
                            {startTime} - {endTime}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <span className="inline-block rounded-lg bg-neutral-100 dark:bg-white/5 border border-neutral-200/50 px-2 py-0.5 text-[10px] font-bold text-neutral-400 dark:text-white/40 uppercase tracking-wider">
                            Riposo
                          </span>
                          <p className="mt-2 text-sm font-medium text-black/35">—</p>
                        </div>
                      )}
                    </div>
                    
                    {hasShift && paidHours > 0 && (
                      <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-2 text-[10px] text-black/45 dark:text-white/40">
                        Ore ass.: <strong className="text-black/70 dark:text-white/80">{paidHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <Link href="/my-shifts" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#B85B68] transition hover:translate-x-1 duration-200">
              Apri dettaglio mensile turni e timbrature <ArrowRight className="size-4" />
            </Link>
          </Card>
          <Card id="colleghi" className="overflow-hidden animate-fade-in-up [animation-delay:400ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Colleghi in servizio oggi</h2>
              </div>
              <Badge tone="green">{currentUser.location?.name ?? "Salone"}</Badge>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
              {todaySalonWorkers.length === 0 ? (
                <p className="col-span-full text-sm text-black/50 dark:text-white/45 py-3 text-center">Nessun collega pianificato per oggi.</p>
              ) : (
                todaySalonWorkers.map((entry) => {
                  const startTime = entry.start_time ?? entry.category.start_time;
                  const endTime = entry.end_time ?? entry.category.end_time;
                  const hasShift = !!(startTime && endTime);
                  
                  return (
                    <div 
                      key={entry.id} 
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3.5 transition-all duration-300",
                        entry.user_id === currentUser.id 
                          ? "border-[#e8b1bf] bg-paradise-softPink/10 dark:bg-white/10 shadow-sm"
                          : "border-white/40 bg-white/50 backdrop-blur-sm dark:bg-white/5 dark:border-white/10 hover:border-white/80 hover:bg-white/70 hover:shadow-sm",
                        !hasShift && "opacity-60"
                      )}
                    >
                      <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-paradise-softPink font-bold text-xs shadow-sm">
                        {entry.user.photo_url ? (
                          <img src={entry.user.photo_url} alt={entry.user.name} className="size-full object-cover" />
                        ) : (
                          entry.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                        )}
                        {entry.user_id === currentUser.id && (
                          <span className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-[color:var(--text)]">
                          {entry.user_id === currentUser.id ? `${entry.user.name} (Tu)` : entry.user.name}
                        </p>
                        <p className="text-xs font-medium text-black/45 dark:text-white/40 mt-0.5">
                          {hasShift ? `${startTime} - ${endTime}` : (entry.category?.name || "Riposo")}
                        </p>
                      </div>
                      
                      {entry.category && (
                        <span 
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                          style={{ 
                            backgroundColor: entry.category.color ? entry.category.color + '15' : 'rgba(255, 168, 221, 0.15)',
                            color: entry.category.text_color || '#B85B68',
                            border: `1px solid ${entry.category.color ? entry.category.color + '30' : 'rgba(255, 168, 221, 0.3)'}`
                          }}
                        >
                          {entry.category.code}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </section>
      ) : null}

      {role === "RESPONSABILE" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr] animate-fade-in-up [animation-delay:100ms] opacity-0" style={{ animationFillMode: "forwards" }}>
          <Card className="border-none relative overflow-hidden">
            <div className="mb-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Andamento turno sede</h2>
              </div>
              <Link href="/schedules" className="rounded-full bg-paradise-softPink/40 px-3 py-1 text-[11px] font-semibold text-[#B85B68] transition hover:bg-paradise-softPink/60 dark:text-[#F4A3C4]">Modifica orario</Link>
            </div>
            <LiveTeamStatus initialWorkers={liveTeamWorkers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", breakDurationMinutes: parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes, lastLog: worker.attendance_logs[0] ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() } : null }))} />
          </Card>
          <Card className="border-none relative overflow-hidden">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <ShieldCheck className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Assenze e malattie attive</h2>
            </div>
            <AbsenceList absences={activeAbsences} />
          </Card>
          <Card className="xl:col-span-2 border-none relative overflow-hidden">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <FileText className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Contratti da controllare</h2>
            </div>
            <ContractList users={contractDeadlines} />
          </Card>
        </section>
      ) : null}

      {role === "ADMIN" || role === "SUPER_ADMIN" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr] animate-fade-in-up [animation-delay:100ms] opacity-0" style={{ animationFillMode: "forwards" }}>
          <Card className="p-0 overflow-hidden border-none relative">
            <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <Building2 className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Personale per sede</h2>
              </div>
              <Link href="/locations" className="rounded-full bg-paradise-softPink/40 px-3 py-1 text-[11px] font-semibold text-[#B85B68] transition hover:bg-paradise-softPink/60 dark:text-[#F4A3C4]">Apri saloni</Link>
            </div>
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {locationsOverview.map((location) => (
                <Link 
                  key={location.id} 
                  href={`/locations?salon=${location.id}`} 
                  className="block p-5 bg-white/10 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-sm text-[color:var(--text)]">{location.name}</p>
                    <Badge tone="gold">{location.users.length} attivi</Badge>
                  </div>
                  <p className="mt-2 text-xs text-black/50 dark:text-white/40">{location.users.map((user) => user.name).join(", ") || "Nessun lavoratore assegnato"}</p>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="border-none relative overflow-hidden">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <FileText className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Contratti in scadenza</h2>
            </div>
            <ContractList users={contractDeadlines} />
          </Card>
          <Card className="xl:col-span-2 border-none relative overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Stato personale in tempo reale</h2>
              </div>
              <Badge tone="green">Online</Badge>
            </div>
            <LiveTeamStatus initialWorkers={liveTeamWorkers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", breakDurationMinutes: parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes, lastLog: worker.attendance_logs[0] ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() } : null }))} />
          </Card>
        </section>
      ) : null}

      {role !== "DIPENDENTE" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr] animate-fade-in-up [animation-delay:200ms] opacity-0" style={{ animationFillMode: "forwards" }}>
          <Card className="border-none relative overflow-hidden">
            <div className="mb-5 flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">{attendanceTitle}</h2>
              </div>
              <Badge tone="gold">Live</Badge>
            </div>
            <LiveAttendance
              role={role}
              initialLogs={recentAttendance.map((log) => ({ id: log.id, employee: log.user.name, location: log.location.name, device: log.device.device_name, type: log.type, time: log.time, timestamp: log.timestamp.toISOString() }))}
            />
          </Card>
          <Card className="border-none relative overflow-hidden">
            <div className="mb-5 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <ShieldCheck className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">{requestsTitle}</h2>
            </div>
            <RequestList role={role} requests={recentRequests} />
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/60 dark:bg-white/5 px-4 py-3 border border-black/5 dark:border-white/5">
      <span className="text-black/50 dark:text-white/40">{label}</span>
      <span className="font-semibold text-right text-[color:var(--text)]">{value}</span>
    </div>
  );
}

function shiftTime(shift: ScheduleWithCategory | null) {
  const startTime = shift?.start_time ?? shift?.category.start_time;
  const endTime = shift?.end_time ?? shift?.category.end_time;
  if (!startTime || !endTime) return "--:-- - --:--";
  return `${startTime} - ${endTime}`;
}

interface PanelHeaderProps {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

function PanelHeader({ title, href, icon: Icon }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3 mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />}
        <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">{title}</h2>
      </div>
      <InstantLink href={href} className="rounded-full bg-paradise-softPink/40 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#B85B68] dark:text-paradise-pink transition hover:bg-paradise-softPink/60" activeClassName="">Vedi tutto</InstantLink>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="mt-4 text-sm text-black/50 dark:text-white/45">{text}</p>;
}

function moneyValue(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function CashClosingTodayDashboard({ responses, statusToday }: { responses: any[], statusToday: Date }) {
  const totalWithdrawn = responses.reduce((sum, response) => sum + moneyValue(response.answers?.[CASH_CLOSING_FIELD_IDS.withdrawn]), 0);
  const differentFundCount = responses.filter((response) => Math.abs(moneyValue(response.answers?.[CASH_CLOSING_FIELD_IDS.fund]) - 50) > 0.009).length;

  return (
    <Card className="mb-8 overflow-hidden border-none p-0 bg-gradient-to-br from-[#2D1B4E] to-[#1A0B2E] text-white relative shadow-[0_20px_50px_rgba(45,27,78,0.25)]">
      {/* Decorative premium blobs */}
      <div className="absolute -top-24 -right-24 size-64 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute top-10 right-1/4 size-2 rounded-full bg-white/40 blur-[1px]" />
      <div className="absolute bottom-1/4 right-10 size-1.5 rounded-full bg-white/30 blur-[1px]" />
      <div className="absolute top-1/3 left-1/3 size-3 rounded-full bg-purple-400/30 blur-[2px]" />

      <div className="flex flex-col gap-6 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-[20px] bg-white/10 text-white backdrop-blur-md shadow-inner border border-white/10">
            <Calculator className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Controllo Cassa</p>
            <h2 className="text-xl font-black text-white">Chiusure cassa (Ultime 48h)</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[380px]">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Chiusure</p>
            <p className="mt-1.5 text-2xl font-black text-white">{responses.length}</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Prelevato</p>
            <p className="mt-1.5 text-lg font-black text-purple-300">{formatMoney(totalWithdrawn)}</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Fondi != 50</p>
            <p className="mt-1.5 text-2xl font-black text-white">{differentFundCount}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        {responses.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-white/60">Nessuna chiusura cassa registrata nelle ultime 48 ore.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {responses.map((response) => {
              const answers = response.answers ?? {};
              const signature = answers._signature;
              const fund = moneyValue(answers[CASH_CLOSING_FIELD_IDS.fund]);
              const fundDifferent = Math.abs(fund - 50) > 0.009;
              return (
                <div key={response.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-base font-black text-white">{response.user_location_name || response.user?.location?.name || "Sede non indicata"}</p>
                    <p className="mt-1.5 text-xs text-white/50">
                      Firmata da <strong className="text-white/90">{signature?.user_name || response.user?.name || "Dipendente"}</strong> · <span className={new Date(response.created_at) >= statusToday ? "text-purple-300 font-bold" : "text-white/40"}>{new Date(response.created_at) >= statusToday ? "Oggi" : "Ieri"}</span> alle {new Date(response.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {answers[CASH_CLOSING_FIELD_IDS.notes] ? (
                      <p className="mt-3 rounded-xl bg-black/20 px-4 py-2.5 text-xs text-white/70 border border-white/5">{String(answers[CASH_CLOSING_FIELD_IDS.notes])}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-right sm:min-w-[280px]">
                    <div className="rounded-[18px] bg-white/5 border border-white/5 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Prelevato</p>
                      <p className="font-black text-white mt-0.5">{formatMoney(moneyValue(answers[CASH_CLOSING_FIELD_IDS.withdrawn]))}</p>
                    </div>
                    <div className={cn("rounded-[18px] p-3.5 border", fundDifferent ? "bg-red-500/20 border-red-500/30 text-red-200" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-200")}>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Fondo</p>
                      <p className="font-black mt-0.5">{formatMoney(fund)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function TodayClockList({ logs }: { logs: Array<{ type: AttendanceType; timestamp: Date; time: string }> }) {
  if (logs.length === 0) {
    return <EmptyText text="Nessuna timbratura registrata oggi." />;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-white/5 overflow-hidden">
      {logs.map((log, index) => (
        <div 
          key={`${log.type}-${log.timestamp.toISOString()}-${index}`} 
          className="flex items-center justify-between px-4 py-3 bg-white/30 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
        >
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">{attendanceNames[log.type]}</p>
            <p className="text-[11px] text-black/45 dark:text-white/40">{shortDate(log.timestamp)}</p>
          </div>
          <Badge tone={log.type === "PAUSA" ? "gold" : log.type === "USCITA" ? "dark" : "green"}>{log.time}</Badge>
        </div>
      ))}
    </div>
  );
}

function EmployeeScheduleMonth({ month, rows }: { month: Date; rows: PersonalDayHours[] }) {
  const entriesByDay = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const days = monthDays(month);
  const plannedHours = rows.reduce((total, row) => total + row.plannedHours, 0);
  const workedHours = rows.reduce((total, row) => total + row.workedHours, 0);
  const recordedDays = rows.filter((row) => row.workedHours > 0).length;
  const relevantMobileRows = rows.filter((row) => row.schedule || row.workedHours > 0).slice(0, 6);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-paradise-noir p-4 text-white sm:p-5">
        <div>
          <p className="text-2xl font-semibold sm:text-3xl">{plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} <span className="text-sm font-medium text-white/70">h</span></p>
          <p className="mt-1 text-xs text-white/55">Previste da planning</p>
        </div>
        <div>
          <p className="text-2xl font-semibold sm:text-3xl">{workedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} <span className="text-sm font-medium text-white/70">h</span></p>
          <p className="mt-1 text-xs text-white/55">Lavorate in {recordedDays} giorni</p>
        </div>
      </div>
      <div className="space-y-2 lg:hidden">
        {relevantMobileRows.length === 0 ? <p className="rounded-xl bg-paradise-nude p-3 text-sm text-black/50 dark:text-white/45">Nessun turno inserito per questo mese.</p> : null}
        {relevantMobileRows.map((row) => (
          <div key={row.date.toISOString()} className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/5 p-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text)]">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(row.date)}</p>
              <p className="text-xs text-black/50 dark:text-white/45">
                {row.schedule?.category.name ?? "Timbratura"} {(row.schedule?.start_time ?? row.schedule?.category.start_time) ? `${row.schedule?.start_time ?? row.schedule?.category.start_time}-${row.schedule?.end_time ?? row.schedule?.category.end_time}` : ""}
              </p>
            </div>
            <p className="text-sm font-semibold text-[color:var(--text)]">{row.workedHours || row.plannedHours} h</p>
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-black/45 dark:text-white/40 sm:grid">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 hidden grid-cols-7 gap-1 sm:grid">
        {Array.from({ length: mondayOffset(month) }, (_, index) => <div key={`empty-${index}`} />)}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const row = entriesByDay.get(key);
          const category = row?.schedule?.category;
          const label = category?.code ?? (row?.workedHours ? "OK" : "--");
          const style = category ? { backgroundColor: category.color, color: category.text_color } : undefined;
          return (
            <div key={key} className="min-h-16 rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 p-2 text-left">
              <p className="text-xs font-semibold text-black/50 dark:text-white/40">{day.getDate()}</p>
              <span className="mt-5 inline-block rounded-md bg-paradise-nude dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black/45 dark:text-white/40" style={style}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonalDocuments({ documents }: { documents: PersonalDocument[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/45">Nessun contratto o busta paga caricata.</p>;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
      {documents.map((document) => (
        <a 
          key={document.id} 
          href={document.storage_path ? `/api/documents/${document.id}/download` : document.file_url} 
          target="_blank" 
          rel="noreferrer" 
          className="flex items-center justify-between gap-3 px-4 py-3 bg-white/30 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
        >
          <div>
            <p className="font-semibold text-sm text-[color:var(--text)]">{document.title}</p>
            <p className="text-xs text-black/45 dark:text-white/40">{document.type}{document.month && document.year ? ` • ${document.month}/${document.year}` : ""}</p>
          </div>
          <Badge tone="gold">Scarica</Badge>
        </a>
      ))}
    </div>
  );
}

function categoryDuration(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  return Math.max(0, (endHours * 60 + endMinutes - startHours * 60 - startMinutes) / 60);
}

function QuickActionsPanel({ role }: { role: Role }) {
  let actions: Array<{ label: string; href: string; icon: any; description: string }> = [];

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    actions = [
      {
        label: "Nuovo Dipendente",
        href: "/employees",
        icon: UserPlus,
        description: "Aggiungi e configura account staff",
      },
      {
        label: "Planning Turni",
        href: "/schedules",
        icon: CalendarDays,
        description: "Gestisci orari e turni mensili",
      },
      {
        label: "Registro Timbrature",
        href: "/attendance",
        icon: Clock3,
        description: "Controlla le timbrature live staff",
      },
      {
        label: "Ferie e Permessi",
        href: "/requests",
        icon: ShieldCheck,
        description: "Gestisci richieste e assenze",
      },
      {
        label: "Calcolo Ore Staff",
        href: "/work-hours",
        icon: Calculator,
        description: "Riepilogo ore, straordinari e break",
      },
      {
        label: "Impostazioni Hub",
        href: "/settings",
        icon: Settings,
        description: "Configura sedi, regole e tablet",
      },
    ];
  } else if (role === "RESPONSABILE") {
    actions = [
      {
        label: "Planning Sede",
        href: "/schedules",
        icon: CalendarDays,
        description: "Gestisci i turni del tuo salone",
      },
      {
        label: "Richieste Ferie",
        href: "/requests",
        icon: ShieldCheck,
        description: "Approva permessi e ferie staff",
      },
      {
        label: "Stato Live Team",
        href: "/team",
        icon: Users,
        description: "Visualizza chi è attivo in salone",
      },
      {
        label: "Timbrature Sede",
        href: "/attendance",
        icon: Clock3,
        description: "Registro ingressi e uscite della sede",
      },
    ];
  } else {
    actions = [
      {
        label: "Richiedi Ferie/Permesso",
        href: "/requests",
        icon: ShieldCheck,
        description: "Invia richiesta all'amministrazione",
      },
      {
        label: "I Miei Turni",
        href: "/my-shifts",
        icon: CalendarDays,
        description: "Dettaglio orario e ore lavorate",
      },
      {
        label: "Documenti & Buste Paga",
        href: "/documents",
        icon: FileText,
        description: "Visualizza e scarica i tuoi file",
      },
      {
        label: "Notifiche & Avvisi",
        href: "/notifications",
        icon: BellRing,
        description: "Leggi le comunicazioni di salone",
      },
    ];
  }

  return (
    <Card className="border-none relative overflow-hidden p-5 md:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4 border-b border-black/5 dark:border-white/5 pb-3">
        <Activity className="size-5 text-[#B85B68] dark:text-paradise-pink animate-pulse" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Azioni Rapide</h2>
          <p className="text-[10px] text-black/45 dark:text-white/45">Scorciatoie operative per la gestione quotidiana</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link 
              key={act.label} 
              href={act.href} 
              className="flex flex-col p-4 rounded-[20px] border border-white/50 bg-white/60 backdrop-blur-sm shadow-sm dark:bg-white/5 dark:border-white/10 hover:border-white/80 hover:bg-white/90 hover:shadow-md transition-all duration-300 group hover:-translate-y-1"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-paradise-softPink dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink group-hover:scale-105 transition-transform duration-300">
                <Icon className="size-5" />
              </div>
              <p className="mt-3 font-semibold text-xs text-black/80 dark:text-white/90 group-hover:text-[#B85B68] dark:group-hover:text-paradise-pink transition-colors duration-200">{act.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-black/40 dark:text-white/40">{act.description}</p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function RequestList({ role, requests }: { role: Role; requests: RequestWithUser[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/45 p-4">Nessuna richiesta presente.</p>;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-white/5 overflow-hidden">
      {requests.map((request) => (
        <div 
          key={request.id} 
          className="px-4 py-3 bg-white/30 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sm text-[color:var(--text)]">{role === "DIPENDENTE" ? requestNames[request.type] : request.user.name}</p>
            <Badge tone={request.status === "APPROVED" ? "green" : request.status === "FLAGGED" ? "gold" : "pink"}>{statusLabels[request.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-black/50 dark:text-white/45">
            {role === "DIPENDENTE" ? "" : `${requestNames[request.type]} • `}
            {shortDate(request.start_date)} - {shortDate(request.end_date)}
          </p>
        </div>
      ))}
    </div>
  );
}

function AbsenceList({ absences }: { absences: RequestWithUser[] }) {
  if (absences.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/45 p-4">Nessuna assenza attiva oggi.</p>;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-white/5 overflow-hidden">
      {absences.map((absence) => (
        <div 
          key={absence.id} 
          className="px-4 py-3 bg-white/30 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sm text-[color:var(--text)]">{absence.user.name}</p>
            <Badge tone={absence.type === "MALATTIA" ? "dark" : "pink"}>{requestNames[absence.type]}</Badge>
          </div>
          <p className="mt-1 text-xs text-black/50 dark:text-white/45">{formatDate(absence.start_date)} - {formatDate(absence.end_date)}</p>
        </div>
      ))}
    </div>
  );
}

function ContractList({ users }: { users: UserWithLocation[] }) {
  if (users.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/45 p-4">Nessuna scadenza contratto impostata.</p>;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-white/40 bg-white/50 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-white/5 overflow-hidden">
      {users.map((user) => {
        const days = daysUntil(user.contract_end);
        return (
          <div 
            key={user.id} 
            className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 px-4 py-3 bg-white/30 dark:bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
          >
            <div>
              <p className="font-semibold text-sm text-[color:var(--text)]">{user.name}</p>
              <p className="text-xs text-black/50 dark:text-white/45">{user.location?.name ?? "Nessun salone"} • scade {formatDate(user.contract_end)}</p>
            </div>
            <Badge tone={days !== null && days <= 7 ? "pink" : "gold"}>{days === null ? "Da impostare" : `${days} giorni`}</Badge>
          </div>
        );
      })}
    </div>
  );
}
