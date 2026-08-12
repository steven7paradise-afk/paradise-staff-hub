"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileWarning,
  HeartPulse,
  LineChart,
  Loader2,
  TrendingUp,
  RefreshCw,
  Umbrella,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type StaffRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  location: string;
  firstEntry: string;
  shiftStart: string | null;
  status: "IN" | "BREAK" | "OUT";
  lateMinutes: number;
};

type LeaveRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  location: string;
  type: "FERIE" | "MALATTIA" | "RIPOSO";
  periodLabel: string;
};

type AnalyticsDay = {
  day: number;
  valid: boolean;
  controls: number;
  revenue: number;
  services: Array<{ name: string; count: number }>;
};

type AnalyticsMonth = {
  key: string;
  label: string;
  daysInMonth: number;
  controls: number;
  revenue: number;
  days: AnalyticsDay[];
};

type AnalyticsWorker = {
  id: string;
  name: string;
  photoUrl: string | null;
  controls: number;
  revenue: number;
  averageRevenue: number;
  months: AnalyticsMonth[];
};

type DashboardAnalytics = {
  months: Array<{ key: string; label: string; daysInMonth: number }>;
  workers: AnalyticsWorker[];
  ranking: Array<Omit<AnalyticsWorker, "months">>;
  totals: { controls: number; revenue: number };
};

export type ManagementDashboardData = {
  viewerName: string;
  scopeLabel: string;
  updatedAt: string;
  presentNow: number;
  clockedToday: StaffRow[];
  lateStaff: StaffRow[];
  leaves: LeaveRow[];
  clientsToday: number;
  hourlyClients: Array<{ hour: string; count: number; locations: Array<{ name: string; count: number }> }>;
  yesterdayCashClosings: number;
  availableCash: number;
  monthDeposits: number;
  monthWithdrawals: number;
  monthExpenses: number;
  monthRevenue: number;
  financialPeriodLabel: string;
  missingPayslips: Array<{ id: string; name: string; photoUrl: string | null; location: string }>;
  payrollMonthLabel: string;
};

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl: string | null; size?: number }) {
  const src = resolveDrivePhotoUrl(photoUrl);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-[#eadde3] bg-[#f8edf2]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8c3f60]">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function Metric({ label, value, note, icon: Icon, tone = "pink", active = false, controls, onClick }: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  tone?: "pink" | "green" | "gold" | "red";
  active?: boolean;
  controls: string;
  onClick: () => void;
}) {
  const colors = {
    pink: "bg-[#f9dbe8] text-[#9f2f60]",
    green: "bg-[#daf4e8] text-[#137653]",
    gold: "bg-[#f6ecd2] text-[#80621c]",
    red: "bg-[#fde3e3] text-[#a83636]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-expanded={active}
      aria-controls={controls}
      className={`group min-h-28 min-w-0 border-r border-white/10 px-4 py-3 text-left transition duration-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0a0c3] motion-reduce:transition-none last:border-r-0 ${active ? "bg-white/[0.09] shadow-[inset_0_-3px_0_#ee86b3]" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase text-white/60">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full transition duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none ${colors}`}><Icon size={16} aria-hidden="true" /></span>
        {label}
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-white/70">{note}<ChevronRight className="size-3 transition group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" /></p>
    </button>
  );
}

export function ManagementDashboard({ data }: { data: ManagementDashboardData }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [personnelView, setPersonnelView] = useState<"PRESENT" | "HOLIDAYS" | "SICKNESS" | "LATE" | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedAnalyticsDay, setSelectedAnalyticsDay] = useState<{ monthKey: string; day: number } | null>(null);
  const [dayTooltip, setDayTooltip] = useState<{ x: number; y: number; month: AnalyticsMonth; day: AnalyticsDay } | null>(null);
  const hourlyChartItems = useMemo(() => {
    const byHour = new Map(data.hourlyClients.map((item) => [item.hour, item]));
    const standardHours = Array.from({ length: 11 }, (_, index) => `${String(index + 10).padStart(2, "0")}:00`);
    const hours = [...new Set([...standardHours, ...data.hourlyClients.map((item) => item.hour)])].sort();
    return hours.map((hour) => byHour.get(hour) || { hour, count: 0, locations: [] });
  }, [data.hourlyClients]);
  const maxHourly = useMemo(() => Math.max(1, ...hourlyChartItems.map((item) => item.count)), [hourlyChartItems]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/client-control/dashboard-analytics", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || "Analisi non disponibile");
        return payload as DashboardAnalytics;
      })
      .then((payload) => {
        if (!active) return;
        setAnalytics(payload);
        setSelectedWorkerId((current) => current || payload.workers[0]?.id || null);
      })
      .catch((error) => console.error("Dashboard client analytics unavailable:", error))
      .finally(() => active && setAnalyticsLoading(false));
    return () => { active = false; };
  }, []);

  const selectedWorker = analytics?.workers.find((worker) => worker.id === selectedWorkerId) || analytics?.workers[0] || null;
  const selectedDayDetails = selectedWorker && selectedAnalyticsDay
    ? selectedWorker.months.find((month) => month.key === selectedAnalyticsDay.monthKey)?.days.find((day) => day.day === selectedAnalyticsDay.day) || null
    : null;
  const selectedDayMonth = selectedWorker && selectedAnalyticsDay
    ? selectedWorker.months.find((month) => month.key === selectedAnalyticsDay.monthKey) || null
    : null;
  const attributionPeriod = analytics?.months.length
    ? (() => {
        const first = new Date(`${analytics.months[0].key}-01T12:00:00`);
        const lastMonth = analytics.months[analytics.months.length - 1];
        const today = new Date();
        const todayParts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).formatToParts(today);
        const currentMonthKey = `${todayParts.find((part) => part.type === "year")?.value}-${todayParts.find((part) => part.type === "month")?.value}`;
        const last = lastMonth.key === currentMonthKey
          ? today
          : new Date(`${lastMonth.key}-${String(lastMonth.daysInMonth).padStart(2, "0")}T12:00:00`);
        const formatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
        return `${formatter.format(first)} – ${formatter.format(last)}`;
      })()
    : "";

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 700);
  };

  const holidays = data.leaves.filter((item) => item.type === "FERIE");
  const sickness = data.leaves.filter((item) => item.type === "MALATTIA");
  const visibleStaff = personnelView === "LATE"
    ? data.lateStaff
    : personnelView === "PRESENT"
      ? data.clockedToday.filter((item) => item.status === "IN" || item.status === "BREAK")
      : data.clockedToday;
  const visibleLeaves = personnelView === "HOLIDAYS"
    ? holidays
    : personnelView === "SICKNESS"
      ? sickness
      : data.leaves;
  const financialItems = [
    { label: "Disponibilità", value: data.availableCash, color: "#d75489", soft: "bg-[#fff0f6]", text: "text-[#a92f63]" },
    { label: "Versamenti", value: data.monthDeposits, color: "#28a37a", soft: "bg-emerald-50", text: "text-emerald-700" },
    { label: "Prelievi", value: data.monthWithdrawals, color: "#d69a32", soft: "bg-amber-50", text: "text-amber-700" },
    { label: "Spese", value: data.monthExpenses, color: "#e05b62", soft: "bg-red-50", text: "text-red-700" },
  ];
  const financialMax = Math.max(1, ...financialItems.map((item) => Math.abs(item.value)));
  const movementSum = data.monthDeposits + data.monthWithdrawals + data.monthExpenses;
  const movementTotal = Math.max(1, movementSum);
  const depositEnd = data.monthDeposits / movementTotal * 100;
  const withdrawalEnd = depositEnd + data.monthWithdrawals / movementTotal * 100;

  function showPersonnelSection(view: "PRESENT" | "HOLIDAYS" | "SICKNESS" | "LATE") {
    const shouldOpen = personnelView !== view;
    setPersonnelView(shouldOpen ? view : null);
    if (!shouldOpen) return;
    const sectionId = view === "HOLIDAYS" || view === "SICKNESS" ? "assenze-attive" : "personale-oggi";
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(sectionId)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    }));
  }

  return (
    <div className="management-dashboard-liquid w-full max-w-none space-y-6 rounded-[32px] p-4 pb-12 font-sans antialiased sm:p-6">
      <section className="overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(145deg,rgba(31,27,38,0.98),rgba(17,16,24,0.98))] text-white shadow-[0_20px_60px_rgba(20,11,16,0.18)] backdrop-blur-2xl">
        <div className="flex flex-col gap-5 border-b border-white/10 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-[11px] font-black uppercase text-[#ee86b3]">Direzione operativa</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Buongiorno, {data.viewerName.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-white/70">Stato in tempo reale · {data.scopeLabel}</p>
          </div>
          <button onClick={refresh} aria-label="Aggiorna i dati della dashboard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-xs font-bold uppercase transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a0c3] motion-reduce:transition-none">
            <RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} /> Aggiorna
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <Metric label="Presenti ora" value={String(data.presentNow)} note={`${data.clockedToday.length} timbrature oggi`} icon={Users} tone="green" active={personnelView === "PRESENT"} controls="personale-oggi" onClick={() => showPersonnelSection("PRESENT")} />
          <Metric label="In ferie" value={String(holidays.length)} note="assenze approvate" icon={Umbrella} tone="gold" active={personnelView === "HOLIDAYS"} controls="assenze-attive" onClick={() => showPersonnelSection("HOLIDAYS")} />
          <Metric label="In malattia" value={String(sickness.length)} note="assenze registrate" icon={HeartPulse} tone="red" active={personnelView === "SICKNESS"} controls="assenze-attive" onClick={() => showPersonnelSection("SICKNESS")} />
          <Metric label="Ritardi" value={String(data.lateStaff.length)} note="oltre 10 minuti" icon={Clock3} active={personnelView === "LATE"} controls="personale-oggi" onClick={() => showPersonnelSection("LATE")} />
        </div>
      </section>

      {data.missingPayslips.length > 0 && (
        <section className="flex flex-col gap-4 rounded-[20px] border border-[#efb2ca] bg-white/75 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 shrink-0 text-[#b92f68]" size={22} />
            <div>
              <p className="font-black text-[#341522]">Buste paga da inviare: {data.missingPayslips.length}</p>
              <p className="mt-1 text-sm text-[#775563]">Mancano i documenti di {data.payrollMonthLabel}: {data.missingPayslips.slice(0, 4).map((item) => item.name).join(", ")}{data.missingPayslips.length > 4 ? "…" : ""}</p>
            </div>
          </div>
          <Link href="/cedolini" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#17131a] px-5 text-xs font-black uppercase text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none">Apri cedolini</Link>
        </section>
      )}

      {personnelView === "PRESENT" || personnelView === "LATE" ? (
        <section id="personale-oggi" className="scroll-mt-6 overflow-hidden rounded-[24px] border border-white/80 bg-white/80 shadow-[0_12px_40px_rgba(69,38,52,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[#eee3e8] px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#c4467d]">Personale oggi</p>
              <h2 className="mt-1 text-xl font-black text-[#19151a]">{personnelView === "LATE" ? "Personale in ritardo" : personnelView === "PRESENT" ? "Personale presente ora" : "Presenze e puntualità"}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/attendance" className="hidden min-h-11 items-center rounded-full px-4 text-xs font-black uppercase text-[#9d315f] transition hover:bg-[#fff0f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none sm:inline-flex">Apri presenze</Link>
              <button type="button" onClick={() => setPersonnelView(null)} className="grid size-11 place-items-center rounded-full text-[#9d315f] transition hover:bg-[#fff0f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none" aria-label="Nascondi dettaglio personale" title="Nascondi"><X className="size-5" aria-hidden="true" /></button>
            </div>
          </div>
          <div className="divide-y divide-[#f0e7eb]">
            {visibleStaff.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#8d8589]">Nessuna persona in questa sezione.</p>
            ) : visibleStaff.map((staff) => (
              <div key={staff.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 sm:grid-cols-[minmax(220px,1fr)_130px_130px]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={staff.name} photoUrl={staff.photoUrl} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#241d21]">{staff.name}</p>
                    <p className="truncate text-xs text-[#6f676b]">{staff.location}</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold uppercase text-[#756d71]">Entrata</p>
                  <p className="mt-1 font-black text-[#252025]">{staff.firstEntry}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${staff.status === "IN" ? "bg-[#dcf5e9] text-[#147553]" : staff.status === "BREAK" ? "bg-[#fff0ce] text-[#8a6310]" : "bg-[#eee9eb] text-[#655b60]"}`}>
                    {staff.status === "IN" ? "Al lavoro" : staff.status === "BREAK" ? "In pausa" : "Uscito"}
                  </span>
                  {staff.lateMinutes > 10 && <p className="mt-1 text-[11px] font-bold text-[#bd3b45]">+{staff.lateMinutes} min</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {personnelView === "HOLIDAYS" || personnelView === "SICKNESS" ? (
        <section id="assenze-attive" className="scroll-mt-6 rounded-[24px] border border-white/80 bg-white/72 p-5 shadow-[0_12px_40px_rgba(69,38,52,0.07)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#c4467d]">Assenze attive</p>
              <h2 className="mt-1 text-xl font-black">{personnelView === "HOLIDAYS" ? "Personale in ferie" : "Personale in malattia"}</h2>
            </div>
            <button type="button" onClick={() => setPersonnelView(null)} className="grid size-11 shrink-0 place-items-center rounded-full text-[#9d315f] transition hover:bg-[#fff0f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none" aria-label="Nascondi dettaglio assenze" title="Nascondi"><X className="size-5" aria-hidden="true" /></button>
          </div>
          <div className="mt-4 space-y-3">
            {visibleLeaves.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-[#e9e2e5] bg-white p-4 text-sm text-[#6f666a]"><CheckCircle2 size={19} className="text-[#16805a]" /> Nessuna assenza registrata oggi.</div>
            ) : visibleLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center gap-3 rounded-md border border-[#e9e2e5] bg-white p-3">
                <Avatar name={leave.name} photoUrl={leave.photoUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{leave.name}</p>
                  <p className="text-xs text-[#6f676b]">{leave.location} · {leave.periodLabel}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${leave.type === "FERIE" ? "bg-[#f8ebca] text-[#7e5d11]" : leave.type === "MALATTIA" ? "bg-[#fde2e2] text-[#a3323b]" : "bg-[#e8edf7] text-[#405981]"}`}>{leave.type}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-white/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(250,244,255,0.76))] p-5 shadow-[0_20px_70px_rgba(69,38,52,0.10)] backdrop-blur-2xl lg:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-[#c4467d]">Andamento saloni</p>
            <button type="button" onClick={() => router.push("/client-control?date=today")} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg text-left text-xl font-black transition hover:text-[#9d315f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none"><TrendingUp className="size-5 text-[#eb5da3]" /> Controlli cliente completati per ora</button>
          </div>
          <button type="button" onClick={() => router.push("/client-control?date=today")} aria-label={`Apri tutte le ${data.clientsToday} schede Controllo Cliente completate oggi`} className="min-h-11 rounded-xl px-3 text-left transition hover:bg-[#fff0f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f] motion-reduce:transition-none sm:text-right"><strong className="text-3xl font-black">{data.clientsToday}</strong><p className="text-xs text-[#6f676b]">schede oggi · apri controlli</p></button>
        </div>
        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex min-w-[720px] items-end gap-4 border-b border-[#dfd5dd] px-3 pt-8">
            {hourlyChartItems.map((item) => (
              <button key={item.hour} type="button" onClick={() => router.push(`/client-control?date=today&hour=${encodeURIComponent(item.hour.slice(0, 2))}`)} aria-label={`Apri ${item.count} schede completate alle ${item.hour}`} className="group flex min-h-36 min-w-16 flex-1 flex-col items-center justify-end rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d315f]">
                <strong className="mb-2 text-sm tabular-nums">{item.count}</strong>
                <span className="w-full max-w-16 rounded-t-xl bg-[linear-gradient(180deg,#f15ba6,#f8afd1_65%,rgba(248,175,209,0.20))] shadow-[0_0_25px_rgba(235,93,163,0.24)] transition group-hover:brightness-105" style={{ height: `${Math.max(28, item.count / maxHourly * 108)}px` }} />
                <span className="py-3 text-xs font-black">{item.hour}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/15 bg-[linear-gradient(145deg,#101725,#07131f)] text-white shadow-[0_24px_80px_rgba(6,15,28,0.20)]">
        <div className="flex flex-col gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-end sm:justify-between lg:p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f080b7]">Performance Buenos Aires</p>
            <h2 className="mt-2 text-2xl font-black">Confronto ultimi 3 mesi</h2>
            <p className="mt-1 text-sm text-white/60">Schede cliente, servizi e fatturazione attribuita · giorni 1–31</p>
          </div>
          {analytics ? <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-right"><strong className="text-2xl tabular-nums">{analytics.totals.controls}</strong><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">schede nei 3 mesi</p></div> : null}
        </div>

        {analyticsLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-bold text-white/65"><Loader2 className="size-5 animate-spin text-[#f080b7]" /> Preparazione confronto...</div>
        ) : !analytics || !analytics.workers.length ? (
          <div className="p-8 text-sm text-white/60">Nessuna scheda valida trovata per il salone Buenos Aires.</div>
        ) : (
          <div className="space-y-7 p-5 lg:p-8">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {analytics.ranking.map((worker, index) => (
                <button key={worker.id} type="button" onClick={() => { setSelectedWorkerId(worker.id); setSelectedAnalyticsDay(null); setDayTooltip(null); }} aria-pressed={selectedWorker?.id === worker.id} className={`flex min-h-24 min-w-52 items-center gap-3 rounded-[20px] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f080b7] ${selectedWorker?.id === worker.id ? "border-[#f080b7] bg-[#f080b7]/15" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"}`}>
                  <span className="text-sm font-black text-[#f3a0c8]">#{index + 1}</span>
                  <Avatar name={worker.name} photoUrl={worker.photoUrl} size={48} />
                  <span className="min-w-0"><span className="block truncate text-sm font-black">{worker.name}</span><span className="mt-1 block text-xs text-white/55">{worker.controls} schede</span></span>
                </button>
              ))}
            </div>

            {selectedWorker ? (
              <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-white/15 bg-[#172131] p-5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
                  <div className="flex items-center gap-3"><Avatar name={selectedWorker.name} photoUrl={selectedWorker.photoUrl} size={58} /><div><h3 className="text-lg font-black">{selectedWorker.name}</h3><p className="text-xs text-white/50">Vista personale · 3 mesi</p></div></div>
                  <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-1">
                    <div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-[10px] font-bold uppercase text-white/50">Clienti svolti</p><strong className="mt-1 block text-2xl tabular-nums">{selectedWorker.controls}</strong></div>
                    <div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-[10px] font-bold uppercase text-white/50">Media per cliente</p><strong className="mt-1 block text-xl tabular-nums text-emerald-300">{money.format(selectedWorker.averageRevenue)}</strong></div>
                    <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.07] p-4 xl:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">{selectedDayDetails ? "Fatturazione del giorno" : "Fatturazione attribuita"}</p>
                      <strong className="mt-1 block text-xl tabular-nums text-emerald-300">{money.format(selectedDayDetails?.revenue ?? selectedWorker.revenue)}</strong>
                      <p className="mt-2 text-[10px] font-semibold leading-4 text-white/50">{selectedDayDetails && selectedDayMonth ? `${selectedDayDetails.day} ${selectedDayMonth.label} · ${selectedDayDetails.controls} clienti` : attributionPeriod}</p>
                      {selectedDayDetails ? <button type="button" onClick={() => setSelectedAnalyticsDay(null)} className="mt-3 min-h-11 rounded-xl border border-white/15 px-3 text-[10px] font-black uppercase text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f080b7]">Mostra totale periodo</button> : <p className="mt-2 text-[10px] font-semibold text-[#f3a0c8]">Tocca un giorno per vedere il ricavo</p>}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                  <div className="flex items-center gap-2"><LineChart className="size-5 text-[#f080b7]" /><h3 className="font-black">Attività giornaliera</h3><span className="ml-auto text-[10px] font-bold uppercase text-white/45">Passa il mouse sui giorni</span></div>
                  <div className="mt-5 overflow-x-auto pb-2">
                    <div className="min-w-[1580px] space-y-4 pb-2">
                      {selectedWorker.months.map((month) => {
                        const max = Math.max(1, ...month.days.map((day) => day.controls));
                        return <div key={month.key} className="grid grid-cols-[120px_repeat(31,44px)] items-center gap-1.5">
                          <div className="pr-3"><p className="truncate text-xs font-black capitalize">{month.label}</p><p className="mt-1 text-[10px] text-white/45">{month.controls} schede · {money.format(month.revenue)}</p></div>
                          {month.days.map((day) => (
                            <div key={day.day} className="relative">
                              <button
                                type="button"
                                disabled={!day.valid}
                                aria-pressed={selectedAnalyticsDay?.monthKey === month.key && selectedAnalyticsDay.day === day.day}
                                aria-label={`${day.day} ${month.label}: ${day.controls} schede, ${money.format(day.revenue)} attribuiti`}
                                onClick={() => day.valid && setSelectedAnalyticsDay({ monthKey: month.key, day: day.day })}
                                onMouseEnter={(event) => {
                                  if (!day.valid || day.controls < 1) return;
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  setDayTooltip({ x: rect.left + rect.width / 2, y: rect.top - 10, month, day });
                                }}
                                onMouseLeave={() => setDayTooltip(null)}
                                onFocus={(event) => {
                                  if (!day.valid || day.controls < 1) return;
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  setDayTooltip({ x: rect.left + rect.width / 2, y: rect.top - 10, month, day });
                                }}
                                onBlur={() => setDayTooltip(null)}
                                className={`grid size-11 place-items-end rounded-[9px] border pb-1 text-[9px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f8b0d0] ${!day.valid ? "border-transparent bg-transparent text-transparent" : selectedAnalyticsDay?.monthKey === month.key && selectedAnalyticsDay.day === day.day ? "border-white bg-[#f080b7] text-white shadow-[0_0_0_3px_rgba(240,128,183,0.25)]" : day.controls ? "border-[#f080b7]/30 bg-[#f080b7] text-white hover:brightness-110" : "border-white/[0.08] bg-white/[0.055] text-white/45 hover:bg-white/10"}`}
                                style={day.valid && day.controls && !(selectedAnalyticsDay?.monthKey === month.key && selectedAnalyticsDay.day === day.day) ? { opacity: 0.42 + day.controls / max * 0.58 } : undefined}
                              ><span>{day.day}</span></button>
                            </div>
                          ))}
                        </div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {dayTooltip ? <div className="pointer-events-none fixed z-[200] w-72 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/15 bg-[#101725]/[0.98] p-4 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,0.52)] backdrop-blur-xl" style={{ left: dayTooltip.x, top: dayTooltip.y }}><div className="flex justify-between gap-3"><strong className="text-xs capitalize">{dayTooltip.day.day} {dayTooltip.month.label}</strong><span className="text-xs font-black text-[#f3a0c8]">{dayTooltip.day.controls} schede</span></div><p className="mt-1 text-sm font-black text-emerald-300">{money.format(dayTooltip.day.revenue)} attribuiti</p><div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">{dayTooltip.day.services.slice(0, 6).map((service) => <p key={service.name} className="flex justify-between gap-3 text-[10px] text-white/75"><span className="truncate">{service.name}</span><strong>×{service.count}</strong></p>)}</div></div> : null}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(145deg,rgba(31,27,38,0.98),rgba(17,16,24,0.98))] text-white shadow-[0_20px_60px_rgba(20,11,16,0.16)] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ee86b3]">Controllo economico</p>
            <h2 className="mt-1 text-xl font-black">Andamento finanziario</h2>
            <p className="mt-1 text-xs font-semibold capitalize text-white/70">{data.financialPeriodLabel} · disponibilità e movimenti reali</p>
          </div>
          <Link href="/cash" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-xs font-black uppercase transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a0c3] motion-reduce:transition-none">Apri cassa <ChevronRight className="size-4" aria-hidden="true" /></Link>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-7">
          <Link href="/cash" aria-label={`Apri cassa. Disponibilità attuale ${money.format(data.availableCash)}`} className="group relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-white/15 bg-white/[0.055] p-6 transition duration-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a0c3] motion-reduce:transition-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(215,84,137,0.16),transparent_42%)]" />
            <div
              className="relative grid size-48 place-items-center rounded-full p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
              style={{ background: movementSum > 0 ? `conic-gradient(#28a37a 0 ${depositEnd}%, #d69a32 ${depositEnd}% ${withdrawalEnd}%, #e05b62 ${withdrawalEnd}% 100%)` : "conic-gradient(#35313c 0 100%)" }}
            >
              <div className="grid size-full place-items-center rounded-full border border-white/10 bg-[#17151e] text-center shadow-inner">
                <div>
                  <WalletCards className="mx-auto size-5 text-[#ee86b3]" />
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">Disponibilità</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{money.format(data.availableCash)}</p>
                </div>
              </div>
            </div>
            <div className="relative mt-5 flex items-center gap-2 text-xs font-bold text-white/70">
              Totale ricavato nel mese
              <span className="rounded-full bg-emerald-400/15 px-2 py-1 font-black text-emerald-300">{money.format(data.monthRevenue)}</span>
            </div>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2">
            {financialItems.map((item) => (
              <Link key={item.label} href="/cash" aria-label={`Apri cassa. ${item.label}: ${money.format(item.value)}`} className="group min-h-44 rounded-[20px] border border-white/15 bg-white/[0.055] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a0c3] motion-reduce:transform-none motion-reduce:transition-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">{item.label}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">{money.format(item.value)}</p>
                  </div>
                  <span className={`grid size-9 place-items-center rounded-full ${item.soft} ${item.text}`}><Banknote className="size-4" /></span>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-700 motion-reduce:transition-none" style={{ width: `${Math.max(item.value > 0 ? 7 : 0, Math.abs(item.value) / financialMax * 100)}%`, backgroundColor: item.color }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-white/65">
                  <span>{item.label === "Disponibilità" ? "Saldo attuale" : "Totale del mese"}</span>
                  <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex min-h-11 items-center justify-between border-t border-white/10 px-6 py-3 text-[10px] font-bold uppercase text-white/65 lg:px-8">
          <span>Chiusure cassa ieri</span>
          <strong className="text-sm text-white">{money.format(data.yesterdayCashClosings)}</strong>
        </div>
      </section>

      <p className="flex items-center justify-end gap-2 text-[11px] font-medium text-[#6f676b]"><CalendarDays size={14} aria-hidden="true" /> Aggiornato {data.updatedAt} · aggiornamento automatico ogni minuto</p>
    </div>
  );
}
