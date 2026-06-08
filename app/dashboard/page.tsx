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
import { SalonDayCalendar } from "@/components/salon-day-calendar";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
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
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } });
  if (!currentUser) redirect("/login");

  const { start, end, month, nextMonth } = dayRange();
  const statusToday = romeDate();
  const statusTomorrow = new Date(statusToday);
  statusTomorrow.setUTCDate(statusTomorrow.getUTCDate() + 1);
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
    prisma.attendanceLog.findMany({ where: attendanceWhere, include: { user: true, location: true, device: true }, orderBy: { timestamp: "desc" }, take: 5 }),
    prisma.leaveRequest.findMany({ where: requestWhere, include: { user: true }, orderBy: { created_at: "desc" }, take: 5 }),
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

  const [personalSchedule, personalMonthLogs, personalHourRecords, salonSchedule, salonWorkers, personalDocuments, personalNotifications, liveTeamWorkers, activeAbsences, locationsOverview, contractDeadlines, liveClockSettings] = await Promise.all([
    role === "DIPENDENTE"
      ? prisma.scheduleEntry.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } }, include: { category: true }, orderBy: { date: "asc" } })
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? prisma.attendanceLog.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } })
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? prisma.workHourRecord.findMany({ where: { user_id: currentUser.id, date: { gte: month, lt: nextMonth } } })
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? prisma.scheduleEntry.findMany({
          where: { user: { sede_id: currentUser.sede_id ?? undefined }, date: { gte: month, lt: nextMonth } },
          include: { user: true, category: true },
          orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
        })
      : Promise.resolve([]),
    role === "DIPENDENTE"
      ? prisma.user.findMany({ where: { active: true, sede_id: currentUser.sede_id, role: { not: "SUPER_ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as WorkerRow[]),
    role === "DIPENDENTE"
      ? prisma.document.findMany({ where: { user_id: currentUser.id }, select: { id: true, title: true, file_url: true, storage_path: true, type: true, month: true, year: true }, orderBy: { created_at: "desc" }, take: 5 })
      : Promise.resolve([] as PersonalDocument[]),
    prisma.notification.findMany({ where: { user_id: currentUser.id }, orderBy: { created_at: "desc" }, take: 5 }),
    role !== "DIPENDENTE"
      ? prisma.user.findMany({
          where: {
            active: true,
            role: { not: "SUPER_ADMIN" },
            ...(role === "RESPONSABILE" ? { sede_id: currentUser.sede_id } : {}),
          },
          include: { location: true, attendance_logs: { where: { date: { gte: statusToday, lt: statusTomorrow } }, orderBy: { timestamp: "desc" }, take: 1 } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    role !== "DIPENDENTE"
      ? prisma.leaveRequest.findMany({
          where: {
            ...(role === "RESPONSABILE" ? { user: { sede_id: currentUser.sede_id ?? undefined } } : {}),
            status: "APPROVED",
            start_date: { lte: end },
            end_date: { gte: start },
          },
          include: { user: true },
          orderBy: { start_date: "asc" },
        })
      : Promise.resolve([]),
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? prisma.location.findMany({ where: { active: true }, include: { users: { where: { active: true, role: { not: "SUPER_ADMIN" } }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    role !== "DIPENDENTE"
      ? prisma.user.findMany({
          where: {
            active: true,
            role: { not: "SUPER_ADMIN" },
            ...(role === "RESPONSABILE" ? { sede_id: currentUser.sede_id } : {}),
            contract_end: { not: null },
          },
          include: { location: true },
          orderBy: { contract_end: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    role === "DIPENDENTE" && currentUser.sede_id
      ? prisma.setting.findMany({ where: { key: clockRuleKey(currentUser.sede_id) } })
      : role !== "DIPENDENTE"
      ? prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } })
      : Promise.resolve([]),
  ]);
  const personalHourDays = role === "DIPENDENTE"
    ? monthlyPersonalHours(month.getFullYear(), month.getMonth(), personalSchedule, personalMonthLogs, personalHourRecords)
    : [];

  if (role === "DIPENDENTE") {
    const today = romeDate();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const [todayEntry, futureEntries, todaySalonEntries, openRequests, unread, todayLogs] = await Promise.all([
      prisma.scheduleEntry.findFirst({ where: { user_id: currentUser.id, date: { gte: today, lt: tomorrow } }, include: { category: true } }),
      prisma.scheduleEntry.findMany({ where: { user_id: currentUser.id, date: { gte: tomorrow } }, include: { category: true }, orderBy: { date: "asc" }, take: 24 }),
      prisma.scheduleEntry.findMany({ where: { location_id: currentUser.sede_id ?? undefined, date: { gte: today, lt: tomorrow } }, include: { category: true } }),
      prisma.leaveRequest.count({ where: { user_id: currentUser.id, status: "PENDING" } }),
      prisma.notification.count({ where: { user_id: currentUser.id, read: false, type: "COMUNICAZIONE" } }),
      prisma.attendanceLog.findMany({ where: { user_id: currentUser.id, date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true, time: true }, orderBy: { timestamp: "asc" } }),
    ]);
    todayShift = todayEntry;
    nextShift = futureEntries.find((entry) => Boolean((entry.start_time ?? entry.category.start_time) && (entry.end_time ?? entry.category.end_time))) ?? null;
    colleaguesToday = todaySalonEntries.filter((entry) => Boolean((entry.start_time ?? entry.category.start_time) && (entry.end_time ?? entry.category.end_time))).length;
    pendingPersonalRequests = openRequests;
    unreadCommunications = unread;
    personalTodayLogs = todayLogs;
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
      prisma.user.count({ where: { sede_id: currentUser.sede_id, active: true, role: { not: "SUPER_ADMIN" } } }),
      prisma.attendanceLog.count({ where: { location_id: currentUser.sede_id ?? undefined, date: { gte: start, lt: end } } }),
      prisma.leaveRequest.count({ where: { user: { sede_id: currentUser.sede_id ?? undefined }, status: "PENDING" } }),
      prisma.scheduleEntry.count({ where: { location_id: currentUser.sede_id ?? undefined, date: { gte: month } } }),
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
      prisma.user.count({ where: { active: true, role: "DIPENDENTE" } }),
      prisma.attendanceLog.count({ where: { date: { gte: start, lt: end } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.document.count(),
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
      prisma.location.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true, role: { not: "SUPER_ADMIN" } } }),
      prisma.device.count({ where: { status: "ACTIVE", archived_at: null, NOT: { device_id: { startsWith: "ADMIN-MANUAL-" } } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    ]);
    metrics = [
      { label: "Sedi attive", value: locations, icon: Building2, trend: "Configurate nel sistema" },
      { label: "Utenti attivi", value: staff, icon: Users, trend: "Tutti i ruoli" },
      { label: "Tablet attivi", value: devices, icon: UserCheck, trend: "Autorizzati a timbrare" },
      { label: "Richieste aperte", value: openRequests, icon: FileCheck2, trend: "Da gestire" },
    ];
  }

  return (
    <AppShell title={role === "DIPENDENTE" ? `Ciao, ${currentUser.name.split(" ")[0]}` : "Dashboard"} subtitle={subtitle} role={role}>
      {role !== "DIPENDENTE" ? (
        <section 
          className="flex gap-3 overflow-x-auto pb-3 snap-x md:grid md:gap-4 md:grid-cols-2 xl:grid-cols-4 md:pb-0 animate-fade-in-up opacity-0 mb-6" 
          style={{ animationFillMode: "forwards" }}
        >
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            const borderColors = [
              "border-l-4 border-l-paradise-pink",
              "border-l-4 border-l-[#d4af37]",
              "border-l-4 border-l-emerald-500",
              "border-l-4 border-l-[#C66170]"
            ];
            const borderColor = borderColors[idx % borderColors.length];
            return (
              <Card 
                key={metric.label} 
                className={cn("p-4 md:p-6 min-w-[170px] shrink-0 snap-start flex-1 md:min-w-0 border border-black/5 dark:border-white/10 shadow-sm", borderColor)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{metric.label}</p>
                  <div className="grid size-8 place-items-center rounded-lg bg-paradise-softPink/40 dark:bg-white/5 text-[#B85B68] dark:text-paradise-pink">
                    <Icon className="size-4.5" />
                  </div>
                </div>
                <p className="mt-4 md:mt-5 text-2xl md:text-3xl font-bold tracking-tight text-[color:var(--text)]">{metric.value}</p>
                <p className="mt-2 text-[10px] md:text-xs text-black/45 dark:text-white/45">{metric.trend}</p>
              </Card>
            );
          })}
        </section>
      ) : null}

      {/* Quick Actions Panel */}
      <QuickActionsPanel role={role} />

      {role === "DIPENDENTE" ? (
        <section className="min-w-0 grid gap-5 animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
          <EmployeeLiveSummary
            plannedTime={shiftTime(todayShift)}
            shiftName={todayShift?.category.name ?? "Nessun turno assegnato"}
            pendingRequests={pendingPersonalRequests}
            colleaguesToday={colleaguesToday}
            initialLogs={personalTodayLogs.map((log) => ({ type: log.type, timestamp: log.timestamp.toISOString(), time: log.time }))}
            breakDurationMinutes={parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(currentUser.sede_id ?? ""))?.value).breakDurationMinutes}
          />
          <div className="grid gap-5 xl:grid-cols-3 animate-fade-in-up [animation-delay:100ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <Card>
              <PanelHeader title="Il mio prossimo turno" href="/my-shifts" icon={CalendarDays} />
              {nextShift ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-black/5 bg-paradise-nude dark:bg-white/5 p-4 transition-all duration-300 hover:scale-[1.01]">
                  <div className="min-w-14 rounded-xl bg-white dark:bg-white/10 p-2 text-center shadow-sm">
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
            <Card>
              <PanelHeader title="Timbrature di oggi" href="/my-shifts" icon={Clock3} />
              <TodayClockList logs={personalTodayLogs} />
            </Card>
            <Card>
              <PanelHeader title="Le mie richieste" href="/requests" icon={ShieldCheck} />
              <div className="mt-3"><RequestList role={role} requests={recentRequests.slice(0, 2)} /></div>
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr] animate-fade-in-up [animation-delay:200ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <Card>
              <PanelHeader title="Il mio profilo" href="/profile" icon={UserRound} />
              <div className="mt-4 flex items-center gap-3">
                <div className="relative grid size-14 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-xl font-bold shadow-soft">
                  {currentUser.photo_url ? <img src={currentUser.photo_url} alt={currentUser.name} className="size-full object-cover" /> : currentUser.name.slice(0, 1)}
                  <span className="absolute -right-0.5 top-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse-green" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{currentUser.name}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">{currentUser.location?.name ?? "Nessun salone"}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Info label="Codice fiscale" value={currentUser.fiscal_code ?? "Non impostato"} />
                <Info label="Contratto fino al" value={formatDate(currentUser.contract_end)} />
              </div>
            </Card>
            <Card>
              <PanelHeader title="Documenti recenti" href="/documents" icon={FileText} />
              <div className="mt-3"><PersonalDocuments documents={personalDocuments.slice(0, 3)} /></div>
            </Card>
          </div>
          <Card id="calendario" className="animate-fade-in-up [animation-delay:300ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">I miei turni e ore lavorate</h2>
              <Badge tone="gold">{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(month)}</Badge>
            </div>
            <EmployeeScheduleMonth month={month} rows={personalHourDays} />
            <Link href="/my-shifts" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#B85B68] transition hover:translate-x-1 duration-200">
              Apri dettaglio turni e timbrature <ArrowRight className="size-4" />
            </Link>
          </Card>
          <Card className="overflow-hidden animate-fade-in-up [animation-delay:400ms] opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Turni del mio salone</h2>
              <Badge tone="green">{currentUser.location?.name ?? "Sede"}</Badge>
            </div>
            <SalonDayCalendar
              month={month.toISOString()}
              entries={salonSchedule.map((entry) => ({
                id: entry.id,
                userId: entry.user_id,
                userName: entry.user.name,
                date: entry.date.toISOString(),
                categoryName: entry.category.name,
                categoryCode: entry.category.code,
                color: entry.category.color,
                textColor: entry.category.text_color,
                startTime: entry.start_time ?? entry.category.start_time,
                endTime: entry.end_time ?? entry.category.end_time,
              }))}
            />
            <SalonScheduleTable month={month} workers={salonWorkers} entries={salonSchedule} currentUserId={currentUser.id} />
          </Card>
        </section>
      ) : null}

      {role === "RESPONSABILE" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr] animate-fade-in-up [animation-delay:100ms] opacity-0" style={{ animationFillMode: "forwards" }}>
          <Card className="border-l-4 border-l-paradise-pink">
            <div className="mb-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Andamento turno sede</h2>
              </div>
              <Link href="/schedules" className="rounded-full bg-paradise-softPink/40 px-3 py-1 text-[11px] font-semibold text-[#B85B68] transition hover:bg-paradise-softPink/60 dark:text-[#F4A3C4]">Modifica orario</Link>
            </div>
            <LiveTeamStatus initialWorkers={liveTeamWorkers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", breakDurationMinutes: parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes, lastLog: worker.attendance_logs[0] ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() } : null }))} />
          </Card>
          <Card className="border-l-4 border-l-[#A370F4]">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <ShieldCheck className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Assenze e malattie attive</h2>
            </div>
            <AbsenceList absences={activeAbsences} />
          </Card>
          <Card className="xl:col-span-2 border-l-4 border-l-amber-500">
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
          <Card className="p-0 overflow-hidden border-l-4 border-l-paradise-pink">
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
          <Card className="border-l-4 border-l-amber-500">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <FileText className="size-4.5 text-[#B85B68] dark:text-paradise-pink" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Contratti in scadenza</h2>
            </div>
            <ContractList users={contractDeadlines} />
          </Card>
          <Card className="xl:col-span-2 border-l-4 border-l-emerald-500">
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
          <Card className="border-l-4 border-l-paradise-pink">
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
          <Card className="border-l-4 border-l-emerald-500">
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

function TodayClockList({ logs }: { logs: Array<{ type: AttendanceType; timestamp: Date; time: string }> }) {
  if (logs.length === 0) {
    return <EmptyText text="Nessuna timbratura registrata oggi." />;
  }
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
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

function SalonScheduleTable({ month, workers, entries, currentUserId }: { month: Date; workers: WorkerRow[]; entries: ScheduleWithUserCategory[]; currentUserId: string }) {
  const days = monthDays(month);
  const entriesByWorkerDay = new Map(entries.map((entry) => [`${entry.user_id}-${entry.date.toISOString().slice(0, 10)}`, entry]));

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap gap-2">
        <Legend label="Presente" code="" color="#FFFFFF" />
        <Legend label="Riposo" code="R" color="#BCE8C8" />
        <Legend label="Ferie" code="F" color="#B9D7F3" />
        <Legend label="Malattia" code="M" color="#F3B5BB" />
        <Legend label="Permesso" code="P" color="#F6E4A6" />
        <Legend label="Chiusura" code="C" color="#D5C7F2" />
      </div>
      <div className="space-y-2 sm:hidden">
        {workers.map((worker) => {
          const shifts = days.map((day) => entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`)).filter((entry) => (entry?.start_time ?? entry?.category.start_time) && (entry?.end_time ?? entry?.category.end_time));
          const absences = days.map((day) => entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`)).filter((entry) => entry && !(entry.start_time ?? entry.category.start_time));
          const scheduledHours = shifts.reduce((total, entry) => {
            if (!entry) return total;
            return total + (entry.category.paid_hours ?? categoryDuration(entry.start_time ?? entry.category.start_time, entry.end_time ?? entry.category.end_time));
          }, 0);
          return (
            <div key={worker.id} className={worker.id === currentUserId ? "rounded-xl border border-[#e8b1bf] bg-paradise-softPink/30 p-3" : "rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/5 p-3"}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--text)]">{worker.id === currentUserId ? `${worker.name} (tu)` : worker.name}</p>
                <p className="text-sm font-semibold text-[color:var(--text)]">{scheduledHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</p>
              </div>
              <p className="mt-1 text-xs text-black/50 dark:text-white/45">{shifts.length} turni programmati{absences.length ? ` - ${absences.length} assenze/riposi` : ""}</p>
            </div>
          );
        })}
      </div>
      <div className="schedule-scroll hidden max-w-full overflow-x-auto rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 lg:block">
        <table className="min-w-[1040px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paradise-nude/70 dark:bg-white/5">
              <th className="sticky left-0 z-10 w-36 border-r border-black/5 dark:border-white/10 bg-paradise-nude/95 dark:bg-neutral-900 px-3 py-3 text-left">Staff</th>
              {days.map((day) => (
                <th key={day.toISOString()} className="w-8 border-r border-black/5 dark:border-white/10 px-1 py-2 text-center">
                  <span className="block font-semibold text-[color:var(--text)]">{day.getDate()}</span>
                  <span className="block text-[10px] uppercase text-black/45 dark:text-white/40">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day).slice(0, 1)}</span>
                </th>
              ))}
              <th className="w-16 px-2 py-2 text-center text-[color:var(--text)]">Ore</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              let scheduledHours = 0;
              return (
                <tr key={worker.id} className={worker.id === currentUserId ? "bg-paradise-softPink/25 dark:bg-white/10" : undefined}>
                  <th className="sticky left-0 z-10 border-r border-t border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 text-left font-semibold text-[color:var(--text)]">
                    {worker.id === currentUserId ? `${worker.name} (tu)` : worker.name}
                  </th>
                  {days.map((day) => {
                    const entry = entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`);
                    const code = entry?.category.code.toUpperCase() ?? "";
                    if ((entry?.start_time ?? entry?.category.start_time) && (entry?.end_time ?? entry?.category.end_time)) scheduledHours += entry.category.paid_hours ?? categoryDuration(entry.start_time ?? entry.category.start_time, entry.end_time ?? entry.category.end_time);
                    return (
                      <td key={day.toISOString()} className="h-8 border-r border-t border-black/5 dark:border-white/10 text-center text-xs font-bold" style={entry ? { backgroundColor: entry.category.color, color: entry.category.text_color } : undefined}>
                        {code}
                      </td>
                    );
                  })}
                  <td className="border-t border-black/5 dark:border-white/10 px-2 text-center font-semibold text-[color:var(--text)]">{scheduledHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function categoryDuration(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  return Math.max(0, (endHours * 60 + endMinutes - startHours * 60 - startMinutes) / 60);
}

function Legend({ label, code, color }: { label: string; code: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs font-semibold text-[color:var(--text)]">
      <span className="grid size-5 place-items-center rounded-md border border-black/5 dark:border-white/5 text-[10px]" style={{ backgroundColor: color }}>{code}</span>
      {label}
    </span>
  );
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
    <Card className="border-l-4 border-l-paradise-pink p-5 md:p-6 mb-6">
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
              className="flex flex-col p-4 rounded-xl border border-black/5 bg-white/50 dark:bg-white/5 dark:border-white/10 hover:border-paradise-pink/40 hover:bg-paradise-nude dark:hover:bg-white/10 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-sm"
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
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
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
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
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
    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
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
