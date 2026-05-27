import Link from "next/link";
import { Activity, ArrowRight, BellRing, Building2, CalendarDays, Clock3, FileCheck2, FileText, UserCheck, Users } from "lucide-react";
import type { AttendanceType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeeLiveSummary } from "@/components/employee-live-summary";
import { LiveAttendance } from "@/components/live-attendance";
import { LiveTeamStatus } from "@/components/live-team-status";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { monthlyPersonalHours, type PersonalDayHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

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
    role !== "DIPENDENTE"
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
    nextShift = futureEntries.find((entry) => Boolean(entry.category.start_time && entry.category.end_time)) ?? null;
    colleaguesToday = todaySalonEntries.filter((entry) => Boolean(entry.category.start_time && entry.category.end_time)).length;
    pendingPersonalRequests = openRequests;
    unreadCommunications = unread;
    personalTodayLogs = todayLogs;
    subtitle = `Ecco cosa c'e di importante oggi${currentUser.location ? ` in ${currentUser.location.name}` : ""}.`;
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
      { label: "Turni mese", value: scheduleItems, icon: CalendarDays, trend: "Inseriti nel planning" },
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
      {role !== "DIPENDENTE" ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-black/50">{metric.label}</p>
                <Icon className="size-5 text-paradise-noir/55" />
              </div>
              <p className="mt-5 text-3xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-xs text-black/45">{metric.trend}</p>
            </Card>
          );
        })}
      </section> : null}

      {role === "DIPENDENTE" ? (
        <section className="min-w-0 grid gap-5">
          <EmployeeLiveSummary
            plannedTime={shiftTime(todayShift)}
            shiftName={todayShift?.category.name ?? "Nessun turno assegnato"}
            pendingRequests={pendingPersonalRequests}
            colleaguesToday={colleaguesToday}
            initialLogs={personalTodayLogs.map((log) => ({ type: log.type, timestamp: log.timestamp.toISOString(), time: log.time }))}
          />
          <div className="grid gap-5 xl:grid-cols-3">
            <Card>
              <PanelHeader title="Il mio prossimo turno" href="/my-shifts" />
              {nextShift ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-black/5 bg-paradise-nude p-4">
                  <div className="min-w-14 rounded-xl bg-white p-2 text-center">
                    <p className="text-xs font-semibold uppercase text-black/45">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(nextShift.date)}</p>
                    <p className="text-2xl font-semibold">{nextShift.date.getDate()}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{shiftTime(nextShift)}</p>
                    <p className="mt-1 text-sm text-black/55">{nextShift.category.name}</p>
                    <p className="mt-1 text-xs text-black/45">{currentUser.location?.name ?? "Salone"}</p>
                  </div>
                </div>
              ) : <EmptyText text="Nessun prossimo turno programmato." />}
            </Card>
            <Card>
              <PanelHeader title="Timbrature di oggi" href="/my-shifts" />
              <TodayClockList logs={personalTodayLogs} />
            </Card>
            <Card>
              <PanelHeader title="Le mie richieste" href="/requests" />
              <div className="mt-3"><RequestList role={role} requests={recentRequests.slice(0, 2)} /></div>
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <Card>
              <PanelHeader title="Il mio profilo" href="/profile" />
              <div className="mt-4 flex items-center gap-3">
                <div className="grid size-14 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-xl font-semibold">
                  {currentUser.photo_url ? <img src={currentUser.photo_url} alt={currentUser.name} className="size-full object-cover" /> : currentUser.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-semibold">{currentUser.name}</p>
                  <p className="text-xs text-black/50">{currentUser.location?.name ?? "Nessun salone"}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Info label="Codice fiscale" value={currentUser.fiscal_code ?? "Non impostato"} />
                <Info label="Contratto fino al" value={formatDate(currentUser.contract_end)} />
              </div>
            </Card>
            <Card>
              <PanelHeader title="Documenti recenti" href="/documents" />
              <div className="mt-3"><PersonalDocuments documents={personalDocuments.slice(0, 3)} /></div>
            </Card>
          </div>
          <Card id="calendario">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">I miei turni e ore lavorate</h2>
              <Badge tone="gold">{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(month)}</Badge>
            </div>
            <EmployeeScheduleMonth month={month} rows={personalHourDays} />
            <Link href="/my-shifts" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#B85B68]">
              Apri dettaglio turni e timbrature <ArrowRight className="size-4" />
            </Link>
          </Card>
          <Card className="overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Turni del mio salone</h2>
              <Badge tone="green">{currentUser.location?.name ?? "Sede"}</Badge>
            </div>
            <SalonScheduleTable month={month} workers={salonWorkers} entries={salonSchedule} currentUserId={currentUser.id} />
          </Card>
        </section>
      ) : null}

      {role === "RESPONSABILE" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Andamento turno sede</h2>
              <Link href="/schedules" className="text-sm font-semibold text-black/55">Modifica orario</Link>
            </div>
            <LiveTeamStatus initialWorkers={liveTeamWorkers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", breakDurationMinutes: parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes, lastLog: worker.attendance_logs[0] ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() } : null }))} />
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Assenze e malattie attive</h2>
            <AbsenceList absences={activeAbsences} />
          </Card>
          <Card className="xl:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Contratti da controllare</h2>
            <ContractList users={contractDeadlines} />
          </Card>
        </section>
      ) : null}

      {role === "ADMIN" || role === "SUPER_ADMIN" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Personale per sede</h2>
              <Link href="/locations" className="text-sm font-semibold text-black/55">Apri saloni</Link>
            </div>
            <div className="space-y-3">
              {locationsOverview.map((location) => (
                <Link key={location.id} href={`/locations?salon=${location.id}`} className="block rounded-2xl bg-paradise-nude/60 p-4 transition hover:bg-paradise-nude">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{location.name}</p>
                    <Badge tone="gold">{location.users.length} attivi</Badge>
                  </div>
                  <p className="mt-2 text-sm text-black/50">{location.users.map((user) => user.name).join(", ") || "Nessun lavoratore assegnato"}</p>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Contratti in scadenza</h2>
            <ContractList users={contractDeadlines} />
          </Card>
          <Card className="xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Stato personale in tempo reale</h2>
              <Badge tone="green">Online</Badge>
            </div>
            <LiveTeamStatus initialWorkers={liveTeamWorkers.map((worker) => ({ id: worker.id, name: worker.name, location: worker.location?.name ?? "Nessun salone", breakDurationMinutes: parseClockRule(liveClockSettings.find((setting) => setting.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes, lastLog: worker.attendance_logs[0] ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() } : null }))} />
          </Card>
        </section>
      ) : null}

      {role !== "DIPENDENTE" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{attendanceTitle}</h2>
              <Badge tone="gold">Live</Badge>
            </div>
            <LiveAttendance
              role={role}
              initialLogs={recentAttendance.map((log) => ({ id: log.id, employee: log.user.name, location: log.location.name, device: log.device.device_name, type: log.type, time: log.time, timestamp: log.timestamp.toISOString() }))}
            />
          </Card>
          <Card>
            <h2 className="mb-5 text-lg font-semibold">{requestsTitle}</h2>
            <RequestList role={role} requests={recentRequests} />
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3">
      <span className="text-black/50">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}

function shiftTime(shift: ScheduleWithCategory | null) {
  if (!shift?.category.start_time || !shift.category.end_time) return "--:-- - --:--";
  return `${shift.category.start_time} - ${shift.category.end_time}`;
}

function PortalMetric({ icon: Icon, label, value, hint, href, className = "", featured = false }: { icon: typeof Activity; label: string; value: string; hint: string; href?: string; className?: string; featured?: boolean }) {
  const content = (
    <Card className={featured ? "h-full p-5 sm:p-6" : "h-full p-5"}>
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-6 text-[#B85B68]" />
        {href ? <ArrowRight className="size-4 text-black/35" /> : null}
      </div>
      <p className="mt-4 text-xs font-medium text-black/50">{label}</p>
      <p className={featured ? "mt-1 text-2xl font-semibold sm:text-3xl" : "mt-1 text-xl font-semibold"}>{value}</p>
      <p className="mt-1 text-xs text-black/50">{hint}</p>
    </Card>
  );
  return href ? <Link className={className} href={href}>{content}</Link> : <div className={className}>{content}</div>;
}

function CompactStatus({ icon: Icon, label, value, hint, href, className = "" }: { icon: typeof Activity; label: string; value: string; hint: string; href?: string; className?: string }) {
  const content = (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-paradise-nude">
        <Icon className="size-5 text-[#B85B68]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-black/45">{label}</p>
        <p className="text-lg font-semibold leading-tight">{value} <span className="text-xs font-normal text-black/45">{hint}</span></p>
      </div>
      {href ? <ArrowRight className="ml-auto size-4 text-black/30" /> : null}
    </div>
  );
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function PanelHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-3">
      <h2 className="font-semibold">{title}</h2>
      <Link href={href} className="text-xs font-semibold text-[#B85B68]">Vedi tutto</Link>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="mt-4 text-sm text-black/50">{text}</p>;
}

function TodayClockList({ logs }: { logs: Array<{ type: AttendanceType; timestamp: Date; time: string }> }) {
  return (
    <div className="mt-3 space-y-2">
      {logs.length === 0 ? <EmptyText text="Nessuna timbratura registrata oggi." /> : null}
      {logs.map((log, index) => (
        <div key={`${log.type}-${log.timestamp.toISOString()}-${index}`} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{attendanceNames[log.type]}</p>
            <p className="text-xs text-black/45">{shortDate(log.timestamp)}</p>
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
        {relevantMobileRows.length === 0 ? <p className="rounded-xl bg-paradise-nude p-3 text-sm text-black/50">Nessun turno inserito per questo mese.</p> : null}
        {relevantMobileRows.map((row) => (
          <div key={row.date.toISOString()} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
            <div>
              <p className="text-sm font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(row.date)}</p>
              <p className="text-xs text-black/50">{row.schedule?.category.name ?? "Timbratura"} {row.schedule?.category.start_time ? `${row.schedule.category.start_time}-${row.schedule.category.end_time}` : ""}</p>
            </div>
            <p className="text-sm font-semibold">{row.workedHours || row.plannedHours} h</p>
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-black/45 sm:grid">
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
            <div key={key} className="min-h-16 rounded-xl border border-black/5 bg-white/70 p-2 text-left">
              <p className="text-xs font-semibold text-black/50">{day.getDate()}</p>
              <span className="mt-5 inline-block rounded-md bg-paradise-nude px-1.5 py-0.5 text-[10px] font-bold uppercase text-black/45" style={style}>
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
  return (
    <div className="space-y-3">
      {documents.length === 0 ? <p className="rounded-2xl bg-paradise-nude/60 p-4 text-sm text-black/50">Nessun contratto o busta paga caricata.</p> : null}
      {documents.map((document) => (
        <a key={document.id} href={document.storage_path ? `/api/documents/${document.id}/download` : document.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 transition hover:bg-paradise-nude">
          <div>
            <p className="font-semibold">{document.title}</p>
            <p className="text-xs text-black/45">{document.type}{document.month && document.year ? ` - ${document.month}/${document.year}` : ""}</p>
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
          const shifts = days.map((day) => entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`)).filter((entry) => entry?.category.start_time && entry.category.end_time);
          const absences = days.map((day) => entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`)).filter((entry) => entry && !entry.category.start_time);
          const scheduledHours = shifts.reduce((total, entry) => {
            if (!entry) return total;
            return total + (entry.category.paid_hours ?? categoryDuration(entry.category.start_time, entry.category.end_time));
          }, 0);
          return (
            <div key={worker.id} className={worker.id === currentUserId ? "rounded-xl border border-[#e8b1bf] bg-paradise-softPink/30 p-3" : "rounded-xl border border-black/5 bg-white p-3"}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{worker.id === currentUserId ? `${worker.name} (tu)` : worker.name}</p>
                <p className="text-sm font-semibold">{scheduledHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</p>
              </div>
              <p className="mt-1 text-xs text-black/50">{shifts.length} turni programmati{absences.length ? ` - ${absences.length} assenze/riposi` : ""}</p>
            </div>
          );
        })}
      </div>
      <div className="schedule-scroll hidden max-w-full overflow-x-auto rounded-2xl border border-black/5 bg-white/70 lg:block">
        <table className="min-w-[1040px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paradise-nude/70">
              <th className="sticky left-0 z-10 w-36 border-r border-black/5 bg-paradise-nude/95 px-3 py-3 text-left">Staff</th>
              {days.map((day) => (
                <th key={day.toISOString()} className="w-8 border-r border-black/5 px-1 py-2 text-center">
                  <span className="block font-semibold">{day.getDate()}</span>
                  <span className="block text-[10px] uppercase text-black/45">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day).slice(0, 1)}</span>
                </th>
              ))}
              <th className="w-16 px-2 py-2 text-center">Ore</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              let scheduledHours = 0;
              return (
                <tr key={worker.id} className={worker.id === currentUserId ? "bg-paradise-softPink/25" : undefined}>
                  <th className="sticky left-0 z-10 border-r border-t border-black/5 bg-white px-3 py-2 text-left font-semibold">
                    {worker.id === currentUserId ? `${worker.name} (tu)` : worker.name}
                  </th>
                  {days.map((day) => {
                    const entry = entriesByWorkerDay.get(`${worker.id}-${day.toISOString().slice(0, 10)}`);
                    const code = entry?.category.code.toUpperCase() ?? "";
                    if (entry?.category.start_time && entry.category.end_time) scheduledHours += entry.category.paid_hours ?? categoryDuration(entry.category.start_time, entry.category.end_time);
                    return (
                      <td key={day.toISOString()} className="h-8 border-r border-t border-black/5 text-center text-xs font-bold" style={entry ? { backgroundColor: entry.category.color, color: entry.category.text_color } : undefined}>
                        {code}
                      </td>
                    );
                  })}
                  <td className="border-t border-black/5 px-2 text-center font-semibold">{scheduledHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td>
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
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold">
      <span className="grid size-5 place-items-center rounded-md border border-black/5 text-[10px]" style={{ backgroundColor: color }}>{code}</span>
      {label}
    </span>
  );
}

function AttendanceList({ role, logs }: { role: Role; logs: AttendanceWithRelations[] }) {
  return (
    <div className="space-y-3">
      {logs.length === 0 ? <p className="rounded-2xl bg-paradise-nude/60 p-4 text-sm text-black/50">Nessuna timbratura registrata.</p> : null}
      {logs.map((log) => (
        <div key={log.id} className="grid gap-2 rounded-2xl bg-paradise-nude/60 p-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-semibold">{role === "DIPENDENTE" ? attendanceNames[log.type] : log.user.name}</p>
            <p className="text-sm text-black/50">{log.location.name} - {log.device.device_name}</p>
          </div>
          <div className="text-left sm:text-right">
            {role !== "DIPENDENTE" ? <Badge>{attendanceNames[log.type]}</Badge> : null}
            <p className="mt-2 text-sm text-black/50">{shortDate(log.timestamp)}, {log.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestList({ role, requests }: { role: Role; requests: RequestWithUser[] }) {
  return (
    <div className="space-y-3">
      {requests.length === 0 ? <p className="rounded-2xl border border-black/5 bg-white/60 p-4 text-sm text-black/50">Nessuna richiesta presente.</p> : null}
      {requests.map((request) => (
        <div key={request.id} className="rounded-2xl border border-black/5 bg-white/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{role === "DIPENDENTE" ? requestNames[request.type] : request.user.name}</p>
            <Badge tone={request.status === "APPROVED" ? "green" : request.status === "FLAGGED" ? "gold" : "pink"}>{statusLabels[request.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-black/50">
            {role === "DIPENDENTE" ? "" : `${requestNames[request.type]} - `}
            {shortDate(request.start_date)} - {shortDate(request.end_date)}
          </p>
        </div>
      ))}
    </div>
  );
}

function AbsenceList({ absences }: { absences: RequestWithUser[] }) {
  return (
    <div className="space-y-3">
      {absences.length === 0 ? <p className="rounded-2xl bg-paradise-nude/60 p-4 text-sm text-black/50">Nessuna assenza attiva oggi.</p> : null}
      {absences.map((absence) => (
        <div key={absence.id} className="rounded-2xl bg-paradise-nude/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{absence.user.name}</p>
            <Badge tone={absence.type === "MALATTIA" ? "dark" : "pink"}>{requestNames[absence.type]}</Badge>
          </div>
          <p className="mt-2 text-sm text-black/50">{formatDate(absence.start_date)} - {formatDate(absence.end_date)}</p>
        </div>
      ))}
    </div>
  );
}

function ContractList({ users }: { users: UserWithLocation[] }) {
  return (
    <div className="space-y-3">
      {users.length === 0 ? <p className="rounded-2xl bg-paradise-nude/60 p-4 text-sm text-black/50">Nessuna scadenza contratto impostata.</p> : null}
      {users.map((user) => {
        const days = daysUntil(user.contract_end);
        return (
          <div key={user.id} className="grid gap-3 rounded-2xl bg-white/60 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-black/50">{user.location?.name ?? "Nessun salone"} - scade {formatDate(user.contract_end)}</p>
            </div>
            <Badge tone={days !== null && days <= 7 ? "pink" : "gold"}>{days === null ? "Da impostare" : `${days} giorni`}</Badge>
          </div>
        );
      })}
    </div>
  );
}
