"use client";

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
type WorkerPointItem = {
  id: string;
  name: string;
  points: number;
  availablePoints?: number;
};

type Props = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    photo_url?: string | null;
    locationName?: string | null;
    sedeId?: string | null;
  };
  workerGoal?: number;
  currentWorkerPoints?: number;
  allWorkerPoints?: WorkerPointItem[];
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
  todayLateMinutes?: number;
  workerRequests?: WorkerRequest[];
  todayIsRest?: boolean;
  nextWorkDayLabel?: string | null;
  greeting?: string;
  [key: string]: unknown;
};

const statusLabels: Record<string, string> = {
  PENDING: "In attesa",
  APPROVED: "Approvata",
  FLAGGED: "In verifica",
};

export function DashboardRedesignClient({
  currentUser,
  workerGoal = 100,
  currentWorkerPoints = 0,
  communications = [],
  unreadCommunications = [],
  unreadNotifications = 0,
  todayShiftTime = "Nessun turno oggi",
  workedHoursFormatted = "00:00",
  recentLogs = [],
  weeklyShifts = [],
  monthlyLateCount = 0,
  todayLateMinutes = 0,
  workerRequests = [],
  todayIsRest = false,
  nextWorkDayLabel = null,
  greeting = "Ciao",
}: Props) {
  const [communicationsOpen, setCommunicationsOpen] = useState(false);
  const [activeComms, setActiveComms] = useState(unreadCommunications);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  // Il primo render deve essere identico tra server e browser. Il tempo live
  // parte soltanto dopo l'hydration, evitando differenze di un secondo.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setActiveComms(unreadCommunications), [unreadCommunications]);
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
  const objectivePercent = Math.min(100, Math.round((currentWorkerPoints / Math.max(workerGoal, 1)) * 100));
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
    <div className="worker-dashboard min-h-screen bg-transparent text-[#171717] dark:text-white">
      <main className="mx-auto w-full max-w-[1420px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="worker-dashboard-enter relative isolate overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#7d294f] text-white shadow-[0_18px_45px_rgba(72,24,47,0.18)]">
          <img src="/beta-login-hero.png" alt="" className="absolute inset-0 size-full object-cover object-[56%_center] sm:object-center" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(35,8,21,0.88)_0%,rgba(78,20,48,0.62)_52%,rgba(66,14,39,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(24,6,15,0.32),transparent_65%)]" />
          <div className="relative flex min-h-48 flex-col justify-end gap-5 px-5 py-6 sm:min-h-56 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/90 font-black text-[#7d294f] shadow-xl sm:size-20">
              {currentUser.photo_url ? <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={userName} className="size-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffc3dc]">{todayIsRest ? "Giornata di riposo" : "La mia giornata"}</p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-[-0.04em] sm:text-5xl">{todayIsRest ? `Buon riposo, ${firstName}` : `${greeting}, ${firstName}`}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/70"><MapPin className="size-3.5 text-[#ffc3dc]" />{currentUser.locationName || "Sede non indicata"}</p>
              {todayIsRest && <p className="mt-2 text-xs font-black text-[#ffc3dc]">Ci vediamo {nextWorkDayLabel || "al prossimo turno"}.</p>}
            </div>
          </div>
          <button type="button" onClick={() => setCommunicationsOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/12 px-5 text-xs font-black uppercase text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Bell className="size-4" /> Comunicazioni
            {communicationCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#8f2857]">{communicationCount}</span>}
          </button>
          </div>
        </header>

        <section className="worker-dashboard-enter worker-dashboard-enter-delay-1 mt-5 grid overflow-hidden rounded-[28px] border border-[#ecc6dc] bg-white shadow-[0_14px_38px_rgba(59,24,42,0.06)] lg:grid-cols-[1.35fr_0.65fr]">
          <div className="border-b border-[#ecc6dc] p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Turno di oggi</p>
                <p className="mt-2 text-3xl font-black sm:text-4xl">{todayShiftTime}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn("inline-flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase", attendance.status === "TURNO" ? "bg-emerald-50 text-emerald-700" : attendance.status === "PAUSA" ? "bg-amber-50 text-amber-700" : "bg-black/5 text-black/50")}>
                    <span className={cn("size-2 rounded-full", attendance.status === "TURNO" ? "bg-emerald-500" : attendance.status === "PAUSA" ? "bg-amber-500" : "bg-black/25")} />
                    {attendance.status === "TURNO" ? "In turno" : attendance.status === "PAUSA" ? "In pausa" : "Fuori turno"}
                  </span>
                  {todayLateMinutes > 10 && <span className="inline-flex items-center gap-2 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase text-rose-700"><ClockAlert className="size-3.5" />Ritardo {todayLateMinutes} min</span>}
                </div>
              </div>
              <div className="min-w-[220px] rounded-[18px] bg-black px-5 py-4 text-white dark:bg-[#111114]">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/50"><Timer className="size-4 text-[#f5c1e2]" />Tempo trascorso</p>
                <p className="mt-3 font-mono text-3xl font-black">{formatDuration(attendance.status === "PAUSA" ? attendance.breakSeconds : attendance.workedSeconds)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase text-white/45">{attendance.status === "PAUSA" ? "Pausa corrente" : `Registrato oggi ${workedHoursFormatted}`}</p>
              </div>
            </div>
            {todayLateMinutes > 10 && <div className="mt-6 border-l-4 border-rose-500 bg-rose-50 px-4 py-3"><p className="text-sm font-black text-rose-800">Oggi sei entrato con {todayLateMinutes} minuti di ritardo.</p><p className="mt-1 text-xs text-rose-700">Presta attenzione all'orario di inizio dei prossimi turni.</p></div>}
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[#ecd5e1] lg:grid-cols-1 lg:divide-x-0">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/40">Obiettivo personale</p><Target className="size-4 text-[#c66170]" /></div>
              <p className="mt-3 text-3xl font-black">{currentWorkerPoints}<span className="ml-1 text-xs text-black/35">/ {workerGoal}</span></p>
              <div className="mt-4 h-2 bg-[#f7e5ef]"><div className="h-full bg-[#c66170]" style={{ width: `${objectivePercent}%` }} /></div>
              <p className="mt-2 text-[10px] font-black uppercase text-black/40">{objectivePercent}% raggiunto</p>
            </div>
            <div className={cn("p-5 sm:p-6", monthlyLateCount > 0 ? "bg-[#fff9f3]" : "bg-emerald-50/40")}>
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/40">Ritardi del mese</p><ClockAlert className={cn("size-4", monthlyLateCount > 0 ? "text-amber-600" : "text-emerald-600")} /></div>
              <p className="mt-3 text-3xl font-black">{monthlyLateCount}</p>
              <p className="mt-2 text-[10px] font-black uppercase text-black/40">Oltre 10 minuti</p>
            </div>
          </div>
        </section>

        <section className="worker-dashboard-enter worker-dashboard-enter-delay-2 mt-5 overflow-hidden rounded-[28px] border border-[#ecc6dc] bg-white shadow-[0_14px_38px_rgba(59,24,42,0.06)]">
          <div className="flex items-center justify-between border-b border-[#ecc6dc] bg-[#f5c1e2] px-5 py-4 sm:px-6">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Planning personale</p><h2 className="mt-1 text-xl font-black">Turni di questa settimana</h2></div>
            <Link href="/my-shifts" className="inline-flex items-center gap-2 text-[10px] font-black uppercase">Calendario <ArrowRight className="size-4" /></Link>
          </div>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-7 lg:gap-0 lg:overflow-visible lg:p-0">
            {weeklyShifts.map((shift) => <div key={shift.date} className={cn("min-h-32 w-[132px] shrink-0 snap-start rounded-[18px] border border-[#ecd5e1] p-4 lg:w-auto lg:rounded-none lg:border-b-0 lg:border-l-0 lg:border-t-0", shift.isToday && !shift.isRest && "border-[#b63870] bg-[linear-gradient(145deg,#8e2957,#c6477e)] text-white", shift.isRest && "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100") }>
              <div className="flex items-start justify-between"><p className={cn("text-[10px] font-black uppercase", shift.isToday && !shift.isRest ? "text-white/70" : shift.isRest ? "text-emerald-700 dark:text-emerald-300" : "text-black/40")}>{shift.dayLabel}</p><p className="text-xl font-black">{shift.dayNumber}</p></div>
              <p className="mt-5 text-xs font-black uppercase">{shift.isRest ? "Riposo" : shift.categoryName}</p>
              <p className={cn("mt-1 text-xs font-bold", shift.isToday && !shift.isRest ? "text-white/65" : shift.isRest ? "text-emerald-700 dark:text-emerald-300" : "text-black/45")}>{shift.isRest ? "Giornata libera" : shift.time}</p>
            </div>)}
          </div>
        </section>

        <section className="worker-dashboard-enter worker-dashboard-enter-delay-3 mt-5 grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          <div className="overflow-hidden rounded-[26px] border border-[#ecc6dc] bg-white shadow-[0_14px_38px_rgba(59,24,42,0.05)]">
            <div className="flex items-center justify-between border-b border-[#ecc6dc] px-5 py-4 sm:px-6"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#bd527f]">Assenze personali</p><h2 className="mt-1 text-xl font-black">Permessi e prossime ferie</h2></div><Umbrella className="size-5 text-[#c66170]" /></div>
            <div className="divide-y divide-[#f0dde7]">
              {requestPreview.length > 0 ? requestPreview.map((request) => <div key={request.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black uppercase">{request.type}</p><span className={cn("px-2 py-1 text-[9px] font-black uppercase", request.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{statusLabels[request.status] || request.status}</span></div><p className="mt-1 text-xs font-bold text-black/45">{request.period}{request.reason ? ` · ${request.reason}` : ""}</p></div><CalendarDays className="size-4 shrink-0 text-[#c66170]" /></div>) : <div className="px-5 py-8 text-sm font-bold text-black/40 sm:px-6">Nessuna richiesta o assenza programmata.</div>}
            </div>
            <div className="border-t border-[#ecc6dc] p-4"><Link href="/requests" className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-black px-4 text-xs font-black uppercase text-white">Gestisci richieste <ArrowRight className="size-4" /></Link></div>
          </div>

          <button type="button" onClick={() => setCommunicationsOpen(true)} className="group flex min-h-56 flex-col justify-between rounded-[26px] border border-[#ecc6dc] bg-[#fff0f8] p-6 text-left shadow-[0_14px_38px_rgba(59,24,42,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f5c1e2]">
            <div className="flex items-center justify-between"><Bell className="size-6 text-[#bd527f]" /><span className="grid min-w-8 place-items-center rounded-full bg-black px-2 py-1 text-xs font-black text-white">{communicationCount}</span></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#bd527f]">Bacheca personale</p><h2 className="mt-2 text-2xl font-black">Comunicazioni</h2><p className="mt-2 text-sm leading-6 text-black/55">Avvisi e messaggi della direzione in un unico spazio.</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase">Apri bacheca <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></div>
          </button>
        </section>
      </main>

      {communicationsOpen && <div className="fixed inset-0 z-[80] bg-black/35" onClick={() => setCommunicationsOpen(false)} />}
      <aside className={cn("fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.16)] transition-transform duration-300 dark:bg-[#1c1c21] dark:text-white", communicationsOpen ? "translate-x-0" : "translate-x-full")} aria-hidden={!communicationsOpen}>
        <div className="flex items-center justify-between border-b border-[#ecc6dc] bg-[#f5c1e2] px-5 py-5"><div><p className="text-[10px] font-black uppercase tracking-[0.16em]">Bacheca</p><h2 className="mt-1 text-2xl font-black">Comunicazioni</h2></div><button type="button" onClick={() => setCommunicationsOpen(false)} className="grid size-11 place-items-center rounded-full bg-white" aria-label="Chiudi comunicazioni"><X className="size-5" /></button></div>
        <div className="flex-1 overflow-y-auto">
          {activeComms.length > 0 && <div className="divide-y divide-[#f0dde7] border-b border-[#ecc6dc]">{activeComms.map((comm) => <article key={comm.id} className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#bd527f]">Da leggere</p><h3 className="mt-2 text-base font-black">{comm.title}</h3><p className="mt-2 text-sm leading-6 text-black/60">{comm.message}</p><button type="button" disabled={claimingId === comm.id} onClick={() => handleClaimPoint(comm.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 bg-black px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"><Check className="size-4" />Ho compreso</button></article>)}</div>}
          {configuredCommunications.length > 0 ? <div className="divide-y divide-[#f0dde7]">{configuredCommunications.map((comm) => <article key={comm.id} className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">{comm.tag || "Direzione"}</p><h3 className="mt-2 text-base font-black">{comm.title}</h3><p className="mt-2 text-sm leading-6 text-black/60">{comm.detail}</p></article>)}</div> : activeComms.length === 0 && <div className="grid min-h-64 place-items-center p-8 text-center"><div><Bell className="mx-auto size-7 text-black/20" /><p className="mt-3 text-sm font-bold text-black/40">Nessuna comunicazione disponibile.</p></div></div>}
        </div>
        <div className="border-t border-[#ecc6dc] p-4"><Link href="/notifications" onClick={() => setCommunicationsOpen(false)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-black text-xs font-black uppercase text-white"><Menu className="size-4" />Tutte le notifiche</Link></div>
      </aside>
    </div>
  );
}
