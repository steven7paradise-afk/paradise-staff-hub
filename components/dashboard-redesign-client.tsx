"use client";
import dashboardStyles from "./dashboard-redesign.module.css";
import { formatDelayCount } from "@/lib/dashboard-delay-summary";
import type { AssignedDailyAppointment } from "@/lib/daily-personal-goal";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Clock,
  ClockAlert,
  FileText,
  MapPin,
  Menu,
  Target,
  Timer,
  Umbrella,
  X,
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import {
  MONTHLY_LATE_WARNING_DURATION_MS,
  MONTHLY_LATE_WARNING_THRESHOLD,
  shouldShowMonthlyLateWarning,
} from "@/lib/monthly-late-warning";
import { cn } from "@/lib/utils";

type Communication = { id: string; title: string; detail: string; tag: string };
type WeeklyShift = {
  date: string;
  dayLabel: string;
  dayNumber: string;
  categoryName: string;
  time: string;
  isToday: boolean;
  isRest: boolean;
};
type WorkerRequest = {
  id: string;
  type: string;
  status: string;
  period: string;
  reason?: string | null;
};
type Props = {
  officeMode?: boolean;
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    photo_url?: string | null;
    locationName?: string | null;
    sedeId?: string | null;
  };
  assignedAppointments?: AssignedDailyAppointment[] | null;
  performedServices?: Array<{ service: string; count: number }> | null;
  monthlyReworks?: { monthLabel: string; performed: { reviewed: number; pending: number; rows: Array<{ id: string; date: string; reference: string }> } } | null;
  monthlyIncompleteCount?: number | null;
  workerGoal?: number | null;
  professionalLevel?: string;
  currentWorkerPoints?: number | null;
  communications?: Communication[];
  unreadCommunications?: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    createdAt: string;
  }>;
  unreadNotifications?: number;
  todayShiftTime?: string;
  workedHoursFormatted?: string;
  recentLogs?: Array<{ type: string; timestamp: Date | string; time?: string | null }>;
  todayShiftStartTime?: string | null;
  weeklyShifts?: WeeklyShift[];
  monthlyLateCount?: number;
  monthlyDelays?: { entryMinutes: number; breakMinutes: number; totalMinutes: number; entryCount: number; breakCount: number; totalCount: number };
  todayLateMinutes?: number;
  workerRequests?: WorkerRequest[];
  todayIsRest?: boolean;
  nextWorkDayLabel?: string | null;
  greeting?: string;
  [key: string]: unknown;
};

const EMPTY_COMMUNICATIONS: NonNullable<Props["unreadCommunications"]> = [];

const statusLabels: Record<string, string> = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  FLAGGED: "In verifica",
};

export function DashboardRedesignClient({
  currentUser,
  officeMode = false,
  assignedAppointments = null,
  performedServices = null,
  monthlyReworks = null,
  monthlyIncompleteCount = null,
  workerGoal = null,
  professionalLevel = "",
  currentWorkerPoints = 0,
  communications = [],
  unreadCommunications = EMPTY_COMMUNICATIONS,
  unreadNotifications = 0,
  todayShiftTime = "Nessun turno oggi",
  workedHoursFormatted = "00:00",
  recentLogs = [],
  weeklyShifts = [],
  monthlyLateCount = 0,
  monthlyDelays = { entryMinutes: 0, breakMinutes: 0, totalMinutes: 0, entryCount: 0, breakCount: 0, totalCount: 0 },
  todayLateMinutes = 0,
  workerRequests = [],
  todayIsRest = false,
  nextWorkDayLabel = null,
  greeting = "Ciao",
}: Props) {
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [appointmentsOpen, setAppointmentsOpen] = useState(true);
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const incompleteCount = assignedAppointments?.filter(item => !item.noteCompleted).length ?? null;
  const visibleAppointments = assignedAppointments?.filter(item => !showIncompleteOnly || !item.noteCompleted);
  const [communicationsOpen, setCommunicationsOpen] = useState(false);
  const [activeComms, setActiveComms] = useState(unreadCommunications);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [lateWarningOpen, setLateWarningOpen] = useState(() => shouldShowMonthlyLateWarning(monthlyLateCount));
  // Il primo render deve essere identico tra server e browser. Il tempo live
  // parte soltanto dopo l'hydration, evitando differenze di un secondo.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setActiveComms(unreadCommunications), [unreadCommunications]);
  useEffect(() => {
    if (!shouldShowMonthlyLateWarning(monthlyLateCount)) {
      setLateWarningOpen(false);
      return;
    }

    setLateWarningOpen(true);
    const timer = window.setTimeout(() => setLateWarningOpen(false), MONTHLY_LATE_WARNING_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [monthlyLateCount]);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const attendance = useMemo(() => {
    const logs = [...recentLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    let workedMs = 0;
    let breakMs = 0;
    let entryAt: number | null = null;
    let pauseAt: number | null = null;

    for (const log of logs) {
      const timestamp = new Date(log.timestamp).getTime();
      if (log.type === "ENTRATA" || log.type === "RIENTRO") {
        if (pauseAt !== null) breakMs += timestamp - pauseAt;
        pauseAt = null;
        entryAt = timestamp;
      } else if (log.type === "PAUSA") {
        if (entryAt !== null) workedMs += timestamp - entryAt;
        entryAt = null;
        pauseAt = timestamp;
      } else if (log.type === "USCITA") {
        if (entryAt !== null) workedMs += timestamp - entryAt;
        entryAt = null;
      }
    }

    const last = logs.at(-1);
    const status = last?.type === "PAUSA"
      ? "PAUSA"
      : last?.type === "ENTRATA" || last?.type === "RIENTRO"
        ? "TURNO"
        : "FUORI";
    if (now !== null && status === "TURNO" && entryAt !== null) workedMs += now - entryAt;
    if (now !== null && status === "PAUSA" && pauseAt !== null) breakMs += now - pauseAt;
    return { status, workedSeconds: Math.max(0, Math.floor(workedMs / 1000)), breakSeconds: Math.max(0, Math.floor(breakMs / 1000)) };
  }, [recentLogs, now]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const userName = currentUser.name || "Paradise Staff";
  const firstName = userName.split(" ")[0];
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const objectivePercent = workerGoal && currentWorkerPoints !== null ? Math.min(100, Math.round((currentWorkerPoints / workerGoal) * 100)) : 0;
  const goalReached = workerGoal !== null && currentWorkerPoints !== null && currentWorkerPoints >= workerGoal;
  const requestPreview = workerRequests.slice(0, 4);
  const configuredCommunications = communications.filter((item) => item?.title?.trim());
  const communicationCount = activeComms.length || configuredCommunications.length || unreadNotifications;

  const handleClaimPoint = async (id: string) => {
    setClaimingId(id);
    try {
      const response = await fetch(`/api/notifications/${id}/claim-point`, { method: "POST" });
      if (response.ok) setActiveComms((items) => items.filter((item) => item.id !== id));
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className={cn(dashboardStyles.canvas, "worker-dashboard text-[#171717] dark:text-white")}>
      <main className={cn(dashboardStyles.frame, officeMode && dashboardStyles.office, "mx-auto w-full max-w-[1440px]")}>
        <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.eyebrow}>Paradise · Area personale</p><h2>La tua giornata, in ordine.</h2></div></div>
        <div className={dashboardStyles.welcomeRow}>
<header className="worker-dashboard-enter relative isolate overflow-hidden rounded-2xl border border-black/[0.06] bg-[#7d294f] text-white shadow-sm">
          <img src="/beta-login-hero.png" alt="" className="absolute inset-0 size-full object-cover object-[56%_center] sm:object-center" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(35,8,21,0.88)_0%,rgba(78,20,48,0.62)_52%,rgba(66,14,39,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(24,6,15,0.32),transparent_65%)]" />
          <div className="relative flex min-h-28 flex-col justify-center gap-5 px-5 py-5 sm:min-h-32 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/90 font-black text-[#7d294f] shadow-sm sm:size-16">
              {currentUser.photo_url ? <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={userName} className="size-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffc3dc]">{todayIsRest ? "Giornata di riposo" : "La mia giornata"}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-2xl">{todayIsRest ? `Buon riposo, ${firstName}` : `${greeting}, ${firstName}`}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/70"><MapPin className="size-3.5 text-[#ffc3dc]" />{currentUser.locationName || "Sede non indicata"}</p>
              {todayIsRest && <p className="mt-2 text-xs font-black text-[#ffc3dc]">Ci vediamo {nextWorkDayLabel || "al prossimo turno"}.</p>}
            </div>
          </div>

          </div>
        </header>          {!officeMode && <button type="button" disabled={incompleteCount === null} aria-controls="daily-assigned-appointments" aria-pressed={showIncompleteOnly} onClick={() => {setShowIncompleteOnly(true); setAppointmentsOpen(true); document.getElementById("daily-assigned-appointments")?.focus({preventScroll:true}); document.getElementById("daily-assigned-appointments")?.scrollIntoView({behavior:"smooth",block:"start"});}} className={dashboardStyles.priority}>
            <div className={dashboardStyles.metricTop}><div><p className={dashboardStyles.label}>Schede da completare</p><p className={dashboardStyles.value}>{incompleteCount ?? "—"}<span className="ml-2 text-xs font-normal text-neutral-400">oggi</span></p></div><span className={dashboardStyles.icon}><FileText className="size-5" /></span></div>
            <p className="mt-3 text-xs text-neutral-500">Nel mese <strong className="text-neutral-800">{monthlyIncompleteCount ?? "—"}</strong><span className="float-right font-semibold text-teal-700">Apri schede →</span></p>
            <p className="mt-1 text-[10px] text-neutral-400">Dal primo del mese a oggi</p>
          </button>}
        </div>
        <div className={dashboardStyles.workspace}>
          {!officeMode && <div className={dashboardStyles.primaryColumn}>

<section id="daily-assigned-appointments" tabIndex={-1} className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm outline-none sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold tracking-tight">{showIncompleteOnly ? "Schede da completare" : "Appuntamenti di oggi"}{visibleAppointments ? ` · ${visibleAppointments.length}` : ""}</h2></div>
          <p className="mt-2 text-xs text-slate-400">Clienti assegnati e avanzamento delle schede di oggi</p>
          {assignedAppointments !== null && <div className={dashboardStyles.appointmentStats}>
            {[
              {color: "#3b82f6", background: "#eff6ff", label: "Assegnati", value: assignedAppointments.length, ratio: assignedAppointments.length ? 100 : 0, icon: CalendarDays},
              {color: "#059669", background: "#ecfdf5", label: "Schede complete", value: assignedAppointments.length - (incompleteCount || 0), ratio: assignedAppointments.length ? (assignedAppointments.length - (incompleteCount || 0)) / assignedAppointments.length * 100 : 0, icon: Check},
              {color: "#d97706", background: "#fffbeb", label: "Da completare", value: incompleteCount || 0, ratio: assignedAppointments.length ? (incompleteCount || 0) / assignedAppointments.length * 100 : 0, icon: FileText},
              {color: "#7c3aed", background: "#f5f3ff", label: "Completamento", value: `${assignedAppointments.length ? Math.round((assignedAppointments.length - (incompleteCount || 0)) / assignedAppointments.length * 100) : 0}%`, ratio: assignedAppointments.length ? (assignedAppointments.length - (incompleteCount || 0)) / assignedAppointments.length * 100 : 0, icon: Target},
            ].map(stat => <div key={stat.label} className={dashboardStyles.appointmentStat}><div className="flex items-center gap-2"><span className={dashboardStyles.statIcon}><stat.icon className="size-3.5" aria-hidden="true" /></span><span className="text-[11px] font-semibold text-slate-600">{stat.label}</span></div><p className="mt-2 text-xl font-semibold tabular-nums text-slate-700">{stat.value}</p><div aria-hidden="true" className="mt-2 h-[3px] max-w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{width: `${stat.ratio}%`, backgroundColor: stat.color}} /></div></div>)}
          </div>}
          <button type="button" aria-expanded={appointmentsOpen} aria-controls="appointment-list-panel" onClick={() => setAppointmentsOpen(value => !value)} className="flex min-h-10 w-full items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><span>{appointmentsOpen ? "Nascondi appuntamenti" : "Vedi appuntamenti"}</span><ArrowRight className={cn("size-4 transition-transform", appointmentsOpen && "rotate-90")} /></button>
          <div id="appointment-list-panel" hidden={!appointmentsOpen}>
          {assignedAppointments !== null && <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Mostra schede cliente">
            <button type="button" aria-pressed={!showIncompleteOnly} onClick={() => setShowIncompleteOnly(false)} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", !showIncompleteOnly ? "border-teal-200 bg-teal-50 text-teal-700" : "border-neutral-200")}>Tutte · {assignedAppointments.length}</button>
            <button type="button" aria-pressed={showIncompleteOnly} onClick={() => setShowIncompleteOnly(true)} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", showIncompleteOnly ? "border-teal-200 bg-teal-50 text-teal-700" : "border-neutral-200")}>Da completare · {incompleteCount}</button>
          </div>}
          {assignedAppointments === null ? <p className="mt-3 text-sm text-black/50">Appuntamenti momentaneamente non disponibili.</p> : <>
            <p className="mt-3 text-xs leading-5 text-neutral-500">Apri un appuntamento per consultare i dettagli e completare la scheda al termine del servizio.</p>
            {!visibleAppointments?.length && <p className="mt-3 text-sm text-black/50">{showIncompleteOnly ? "Nessuna nota da completare per oggi." : "Nessun appuntamento assegnato oggi."}</p>}
            <div aria-hidden="true" className="mt-5 hidden grid-cols-[60px_1fr_130px_16px] gap-5 border-b border-neutral-100 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid"><span>Ora</span><span>Cliente / servizio</span><span>Scheda cliente</span><span /></div>
            <div className="divide-y divide-neutral-100">{(showAllAppointments ? visibleAppointments : visibleAppointments?.slice(0, 3))?.map(item => <Link key={item.id} href={`/appointments?booking=${encodeURIComponent(item.id)}&focus=${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(item.start))}`} className="group flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-[#fcf8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#98516d] sm:gap-5">
              <time dateTime={item.start} className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-3 text-sm font-semibold tabular-nums text-neutral-700">{new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(item.start))}</time>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-neutral-900 sm:text-base">{item.client}</p><p className="mt-1 break-words text-xs leading-5 text-neutral-500">{item.service}</p><span className={cn("mt-1 inline-block text-xs sm:hidden", item.noteCompleted ? "text-emerald-700" : "text-teal-700")}>{item.noteCompleted ? "Completata" : "Da compilare"}</span></div>
              <span className={cn("hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium sm:inline-flex", item.noteCompleted ? "bg-emerald-50 text-emerald-700" : "bg-teal-50 text-teal-700")}>{item.noteCompleted ? <><Check className="size-3.5" />Completata</> : "Compila scheda"}</span><ArrowRight className="size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
            </Link>)}</div>
            {!!visibleAppointments && visibleAppointments.length > 3 && <button type="button" onClick={() => setShowAllAppointments(value => !value)} aria-expanded={showAllAppointments} className={dashboardStyles.moreAppointments}>{showAllAppointments ? "Mostra meno" : `Vedi altri ${visibleAppointments.length - 3} appuntamenti`} <ArrowRight className="size-4" /></button>}
          </>}
          </div>
        </section>


          </div>}
          <aside className={dashboardStyles.secondaryColumn} aria-label="Il tuo riepilogo">

<section aria-label="Riepilogo personale" className={dashboardStyles.metrics}>
          <article className={dashboardStyles.metric}>
            <div className={dashboardStyles.metricTop}><div><p className={dashboardStyles.label}>{officeMode ? "La mia giornata" : "Turno di oggi"}</p><p className={dashboardStyles.value}>{todayShiftTime}</p></div><span className={dashboardStyles.icon}><Clock className="size-5" /></span></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className={attendance.status === "TURNO" ? "text-emerald-700" : attendance.status === "PAUSA" ? "text-amber-700" : "text-neutral-500"}>{attendance.status === "TURNO" ? "In turno" : attendance.status === "PAUSA" ? "In pausa" : "Fuori turno"}</span><span className="font-mono tabular-nums">{formatDuration(attendance.status === "PAUSA" ? attendance.breakSeconds : attendance.workedSeconds)}</span></div>
            <p className="mt-1 text-[10px] text-neutral-500">{attendance.status === "PAUSA" ? "Durata della pausa corrente" : `Tempo lavorato · registrato ${workedHoursFormatted}`}</p>
            {todayLateMinutes > 10 && <p className="mt-2 text-xs font-semibold text-red-700">Ingresso in ritardo di {todayLateMinutes} min</p>}
          </article>
{!officeMode &&           <article className={dashboardStyles.metric}>
            <div className={dashboardStyles.metricTop}><div><p className={dashboardStyles.label}>Obiettivo di oggi</p><p className={dashboardStyles.value}>{currentWorkerPoints ?? "—"}<span className="ml-1 text-sm text-neutral-400">/ {workerGoal ?? "—"}</span></p></div><span className={dashboardStyles.icon}><Target className="size-5" /></span></div>
            {currentWorkerPoints !== null && workerGoal !== null && <div role="progressbar" aria-label="Obiettivo personale di oggi" aria-valuemin={0} aria-valuemax={workerGoal} aria-valuenow={Math.min(currentWorkerPoints, workerGoal)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-teal-500" style={{width: `${objectivePercent}%`}} /></div>}
            <p className="mt-2 text-[11px] leading-4 text-neutral-500">{goalReached ? "Brava, obiettivo raggiunto! Continua così." : "Schede completate · completa e supera il tuo obiettivo."}</p>
          </article>}
          <article className={cn(dashboardStyles.metric, monthlyDelays.totalCount > 0 && dashboardStyles.alert)}>
            <div className={dashboardStyles.metricTop}><div><p className={dashboardStyles.label}>{officeMode ? "I miei ritardi del mese" : "Ritardi del mese"}</p><p className={dashboardStyles.value}>{formatDelayCount(monthlyDelays.totalCount)}</p></div><span className={dashboardStyles.icon}><ClockAlert className="size-5" /></span></div>
            <details className="mt-3 text-xs"><summary className="min-h-7 cursor-pointer text-neutral-500">Ingresso e pausa</summary><dl className="mt-2 space-y-1"><div className="flex justify-between"><dt>Ingresso</dt><dd>{formatDelayCount(monthlyDelays.entryCount)}</dd></div><div className="flex justify-between"><dt>Rientro dalla pausa</dt><dd>{formatDelayCount(monthlyDelays.breakCount)}</dd></div></dl></details>
          </article>

        </section>{!officeMode && <><section aria-label="Servizi eseguiti oggi" className="flex flex-col rounded-2xl border border-white/80 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Servizi eseguiti oggi</h2><p className="mt-1 text-xs text-neutral-500">Il tuo lavoro nelle schede completate</p></div><strong className="text-2xl font-semibold tabular-nums">{performedServices ? performedServices.reduce((sum, row) => sum + row.count, 0) : "—"}</strong></div>
          {performedServices === null ? <p className="mt-5 text-xs text-neutral-500">Servizi momentaneamente non disponibili.</p> : performedServices.length ? <ul id="performed-services-list" className="mt-5 space-y-4">
            {(showAllServices ? performedServices : performedServices.slice(0, 3)).map(row => <li key={row.service}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-medium">{row.service}</span><strong className="tabular-nums">{row.count}</strong></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[#f6edf2]"><div className="h-full rounded-full bg-[#a14c73]" style={{width: `${row.count / Math.max(...performedServices.map(item => item.count)) * 100}%`}} /></div></li>)}
          </ul> : <p className="my-auto py-6 text-sm text-neutral-500">Nessun servizio ancora registrato nelle tue schede completate di oggi.</p>}
          {performedServices && performedServices.length > 3 && <button type="button" aria-expanded={showAllServices} aria-controls="performed-services-list" onClick={() => setShowAllServices(value => !value)} className="mt-3 min-h-11 self-start rounded-lg px-2 text-xs font-semibold text-[#793752] transition hover:bg-[#fcf8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#98516d]">{showAllServices ? "Mostra meno" : `Vedi altri (${performedServices.length - 3})`}</button>}
          <p className="mt-4 border-t border-neutral-100 pt-3 text-[10px] leading-4 text-neutral-500">Ogni servizio conta una volta per appuntamento. Una scheda può includere più servizi.</p>
        </section><section aria-label="Sistemazione fasce del mese" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Sistemazione fasce</h2>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Check className="size-4" aria-hidden="true" /></span>
            </div>
            <p className="mt-1 text-xs capitalize text-neutral-500">{monthlyReworks?.monthLabel || "Questo mese"}</p>
            {monthlyReworks ? <>
              <div className="mt-5 flex items-baseline gap-3">
                <strong className="text-4xl font-semibold tracking-tight tabular-nums text-teal-700">{monthlyReworks.performed.reviewed}</strong>
                <span className="text-sm text-neutral-600">{monthlyReworks.performed.reviewed === 1 ? "eseguita da te" : "eseguite da te"}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">{monthlyReworks.performed.reviewed > 0 ? "Verificate dall’ufficio" : "Nessun intervento verificato questo mese"}</p>
              {monthlyReworks.performed.pending > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><span>In attesa di verifica</span><strong className="tabular-nums">{monthlyReworks.performed.pending}</strong></div>}
            </> : <p role="status" className="mt-4 text-xs text-neutral-500">Conteggio momentaneamente non disponibile.</p>}
          </div>
          {monthlyReworks && monthlyReworks.performed.rows.length > 0 && <details className="group border-t border-neutral-100">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-semibold text-teal-700 transition hover:bg-[#fcf8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#98516d] [&::-webkit-details-marker]:hidden">
              <span>Dettaglio ordini <span className="ml-1 text-neutral-400">({monthlyReworks.performed.reviewed})</span></span>
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="px-5 pb-3"><div className="flex justify-between border-b border-neutral-100 pb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400"><span>Ordine</span><span>Inserimento</span></div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-neutral-100">{monthlyReworks.performed.rows.map(row => <li key={row.id} className="flex justify-between gap-3 py-3 text-xs"><span className="min-w-0 break-words font-medium">{row.reference.startsWith("Riga ") ? "Senza numero ordine" : row.reference}</span><time dateTime={row.date} className="shrink-0 tabular-nums text-neutral-500">{row.date.slice(8, 10)}/{row.date.slice(5, 7)}</time></li>)}</ul>
            </div>
          </details>}
        </section></>}
          </aside>
        </div>
<section className={cn(dashboardStyles.supportCards, "grid gap-4 sm:grid-cols-2")}>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_14px_38px_rgba(59,24,42,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">Assenze personali</p><h2 className="mt-1 text-base font-semibold">Permessi e prossime ferie</h2></div><Umbrella className="size-5 text-teal-600" /></div>
            <div className="divide-y divide-slate-100">
              {requestPreview.length > 0 ? requestPreview.map((request) => <div key={request.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{request.type}</p><span className={cn("px-2 py-1 text-[9px] font-black uppercase", request.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{statusLabels[request.status] || request.status}</span></div><p className="mt-1 text-xs text-slate-400">{request.period}{request.reason ? ` · ${request.reason}` : ""}</p></div><CalendarDays className="size-4 shrink-0 text-teal-600" /></div>) : <div className="px-5 py-8 text-sm text-slate-400 sm:px-6">Nessuna richiesta o assenza programmata.</div>}
            </div>
            <div className="border-t border-slate-100 p-4"><Link href="/requests" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-50 px-4 text-xs font-semibold text-teal-700">Gestisci richieste <ArrowRight className="size-4" /></Link></div>
          </div>

          <button type="button" onClick={() => setCommunicationsOpen(true)} className="group flex flex-col justify-between rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            <div className="flex items-center gap-3"><span className={dashboardStyles.icon}><Bell className="size-5" /></span><div><h2 className="text-base font-semibold">Comunicazioni</h2><p className="mt-1 text-xs text-slate-400">La bacheca della direzione</p></div><span className="ml-auto rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700">{communicationCount}</span></div>
            <p className="my-4 text-sm text-slate-500">{communicationCount > 0 ? "Consulta gli avvisi e i messaggi per il personale." : "Nessuna nuova comunicazione."}</p><span className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-teal-700">Apri bacheca <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </button>
        </section>
<section className={dashboardStyles.schedule}>
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">I miei orari</h2><p className="mt-1 text-xs text-slate-400">Turni e giornate di riposo</p></div><Link href="/my-shifts" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-teal-700">Calendario <ArrowRight className="size-4" /></Link></div>
          <div className={dashboardStyles.weekGrid}>
            {weeklyShifts.map(shift => <div key={shift.date} aria-current={shift.isToday ? "date" : undefined} className={cn(dashboardStyles.weekDay, "min-w-0 rounded-xl border p-3", shift.isToday ? "border-[#913956] bg-[#fdf0f6] ring-2 ring-[#913956]/20" : shift.isRest ? "border-slate-200 bg-slate-50" : "border-[#d7eee9] bg-[#f1faf7]")}>
              <div className="flex items-center gap-2"><span className={cn("grid size-7 shrink-0 place-items-center rounded-md",shift.isToday ? "bg-[#913956] text-white" : shift.isRest ? "bg-slate-100 text-slate-400" : "bg-[#3ac8bc] text-white")}><CalendarDays className="size-3.5" aria-hidden="true" /></span><span className="text-[11px] font-semibold uppercase text-slate-400">{shift.dayLabel}</span>{shift.isToday && <span className="ml-auto text-[10px] font-semibold text-[#913956]">{!shift.isRest && attendance.status === "TURNO" ? "In corso" : "Oggi"}</span>}</div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-slate-700">{shift.dayNumber}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">{shift.isRest ? "Riposo" : shift.categoryName}</p>
              <p className="mt-1 text-[11px] tabular-nums text-slate-400">{shift.isRest ? "Giornata libera" : shift.time}</p>
              <div aria-hidden="true" className={cn("mt-3 h-[3px] rounded-full",shift.isToday ? "bg-[#913956]" : shift.isRest ? "bg-slate-200" : "bg-[#3ac8bc]")} />
            </div>)}
          </div>

        </section>
      </main>

      {shouldShowMonthlyLateWarning(monthlyLateCount) ? (
        <aside
          role="status"
          aria-live="polite"
          aria-label="Avviso ritardi della Direzione"
          className={cn(
            "fixed bottom-4 right-3 z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-[26px] border border-rose-200 bg-[#7d294f] text-white shadow-[-12px_18px_55px_rgba(65,18,42,0.30)] transition duration-500 sm:bottom-6 sm:right-6",
            lateWarningOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[115%] opacity-0",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/15 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12">
                <ClockAlert className="size-5 text-[#ffc3dc]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#ffc3dc]">Avviso della Direzione</p>
                <p className="mt-1 text-sm font-black">Puntualità del mese</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLateWarningOpen(false)}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Chiudi avviso ritardi"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]">
            <p className="text-lg font-black leading-snug">
              Hai superato {MONTHLY_LATE_WARNING_THRESHOLD} ritardi nel mese. Fai attenzione, per favore.
            </p>
            <p className="mt-4 text-sm font-semibold leading-6 text-white/80">
              La Direzione ti chiede di organizzarti al meglio per rispettare l’orario di lavoro e arrivare puntuale.
            </p>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[#ffc3dc]">
              Ritardi registrati: {monthlyLateCount}
            </p>
          </div>
        </aside>
      ) : null}

      {communicationsOpen && <div className="fixed inset-0 z-[80] bg-black/35" onClick={() => setCommunicationsOpen(false)} />}
      <aside className={cn("fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.16)] transition-transform duration-300 dark:bg-[#1c1c21] dark:text-white", communicationsOpen ? "translate-x-0" : "translate-x-full")} aria-hidden={!communicationsOpen} inert={!communicationsOpen}>
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-5"><div><p className="text-[10px] font-black uppercase tracking-[0.16em]">Bacheca</p><h2 className="mt-1 text-xl font-semibold">Comunicazioni</h2></div><button type="button" onClick={() => setCommunicationsOpen(false)} className="grid size-11 place-items-center rounded-full bg-white" aria-label="Chiudi comunicazioni"><X className="size-5" /></button></div>
        <div className="flex-1 overflow-y-auto">
          {activeComms.length > 0 && <div className="divide-y divide-slate-100 border-b border-slate-100">{activeComms.map((comm) => <article key={comm.id} className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">Da leggere</p><h3 className="mt-2 text-base font-semibold">{comm.title}</h3><p className="mt-2 text-sm leading-6 text-black/60">{comm.message}</p><button type="button" disabled={claimingId === comm.id} onClick={() => handleClaimPoint(comm.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white disabled:opacity-50"><Check className="size-4" />Ho compreso</button></article>)}</div>}
          {configuredCommunications.length > 0 ? <div className="divide-y divide-slate-100">{configuredCommunications.map((comm) => <article key={comm.id} className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">{comm.tag || "Direzione"}</p><h3 className="mt-2 text-base font-semibold">{comm.title}</h3><p className="mt-2 text-sm leading-6 text-black/60">{comm.detail}</p></article>)}</div> : activeComms.length === 0 && <div className="grid min-h-64 place-items-center p-8 text-center"><div><Bell className="mx-auto size-7 text-black/20" /><p className="mt-3 text-sm font-bold text-black/40">Nessuna comunicazione disponibile.</p></div></div>}
        </div>
        <div className="border-t border-slate-100 p-4"><Link href="/notifications" onClick={() => setCommunicationsOpen(false)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 text-xs font-semibold text-white"><Menu className="size-4" />Tutte le notifiche</Link></div>
      </aside>
    </div>
  );
}
