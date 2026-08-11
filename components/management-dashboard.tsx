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
  RefreshCw,
  Umbrella,
  Users,
  WalletCards,
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

function Metric({ label, value, note, icon: Icon, tone = "pink", active = false, onClick }: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  tone?: "pink" | "green" | "gold" | "red";
  active?: boolean;
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
      className={`group min-w-0 border-r border-white/10 px-4 py-2 text-left transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ee86b3] last:border-r-0 ${active ? "bg-white/[0.09] shadow-[inset_0_-3px_0_#ee86b3]" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase text-white/60">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full transition group-hover:scale-110 ${colors}`}><Icon size={16} /></span>
        {label}
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-white/55">{note}<ChevronRight className="size-3 transition group-hover:translate-x-0.5" /></p>
    </button>
  );
}

export function ManagementDashboard({ data }: { data: ManagementDashboardData }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [personnelView, setPersonnelView] = useState<"PRESENT" | "HOLIDAYS" | "SICKNESS" | "LATE" | null>(null);
  const maxHourly = useMemo(() => Math.max(1, ...data.hourlyClients.map((item) => item.count)), [data.hourlyClients]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

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
  const netMovement = data.monthDeposits - data.monthWithdrawals - data.monthExpenses;

  function showPersonnelSection(view: "PRESENT" | "HOLIDAYS" | "SICKNESS" | "LATE") {
    setPersonnelView(view);
    const sectionId = view === "HOLIDAYS" || view === "SICKNESS" ? "assenze-attive" : "personale-oggi";
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 pb-10">
      <section className="overflow-hidden rounded-lg bg-[#111018] text-white shadow-[0_18px_45px_rgba(20,11,16,0.15)]">
        <div className="flex flex-col gap-5 border-b border-white/10 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-[11px] font-black uppercase text-[#ee86b3]">Direzione operativa</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Buongiorno, {data.viewerName.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-white/60">Stato in tempo reale · {data.scopeLabel}</p>
          </div>
          <button onClick={refresh} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 px-4 text-xs font-bold uppercase hover:bg-white/10">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Aggiorna
          </button>
        </div>
        <div className="grid grid-cols-2 gap-y-4 py-4 md:grid-cols-4">
          <Metric label="Presenti ora" value={String(data.presentNow)} note={`${data.clockedToday.length} timbrature oggi`} icon={Users} tone="green" active={personnelView === "PRESENT"} onClick={() => showPersonnelSection("PRESENT")} />
          <Metric label="In ferie" value={String(holidays.length)} note="assenze approvate" icon={Umbrella} tone="gold" active={personnelView === "HOLIDAYS"} onClick={() => showPersonnelSection("HOLIDAYS")} />
          <Metric label="In malattia" value={String(sickness.length)} note="assenze registrate" icon={HeartPulse} tone="red" active={personnelView === "SICKNESS"} onClick={() => showPersonnelSection("SICKNESS")} />
          <Metric label="Ritardi" value={String(data.lateStaff.length)} note="oltre 10 minuti" icon={Clock3} active={personnelView === "LATE"} onClick={() => showPersonnelSection("LATE")} />
        </div>
      </section>

      {data.missingPayslips.length > 0 && (
        <section className="flex flex-col gap-4 rounded-lg border border-[#efb2ca] bg-[#fff0f6] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 shrink-0 text-[#b92f68]" size={22} />
            <div>
              <p className="font-black text-[#341522]">Buste paga da inviare: {data.missingPayslips.length}</p>
              <p className="mt-1 text-sm text-[#775563]">Mancano i documenti di {data.payrollMonthLabel}: {data.missingPayslips.slice(0, 4).map((item) => item.name).join(", ")}{data.missingPayslips.length > 4 ? "…" : ""}</p>
            </div>
          </div>
          <Link href="/cedolini" className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#17131a] px-5 text-xs font-black uppercase text-white">Apri cedolini</Link>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <section id="personale-oggi" className="scroll-mt-5 rounded-lg border border-[#eadde3] bg-white">
          <div className="flex items-center justify-between border-b border-[#eee3e8] px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#c4467d]">Personale oggi</p>
              <h2 className="mt-1 text-xl font-black text-[#19151a]">{personnelView === "LATE" ? "Personale in ritardo" : personnelView === "PRESENT" ? "Personale presente ora" : "Presenze e puntualità"}</h2>
            </div>
            <Link href="/attendance" className="text-xs font-black uppercase text-[#9d315f]">Apri presenze</Link>
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
                    <p className="truncate text-xs text-[#8a7e84]">{staff.location}</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold uppercase text-[#a49ba0]">Entrata</p>
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

        <section id="assenze-attive" className="scroll-mt-5 rounded-lg border border-[#eadde3] bg-[#fcfafb] p-5">
          <p className="text-[10px] font-black uppercase text-[#c4467d]">Assenze attive</p>
          <h2 className="mt-1 text-xl font-black">{personnelView === "HOLIDAYS" ? "Personale in ferie" : personnelView === "SICKNESS" ? "Personale in malattia" : "Ferie, malattia e riposo"}</h2>
          <div className="mt-4 space-y-3">
            {visibleLeaves.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-[#e9e2e5] bg-white p-4 text-sm text-[#6f666a]"><CheckCircle2 size={19} className="text-[#16805a]" /> Nessuna assenza registrata oggi.</div>
            ) : visibleLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center gap-3 rounded-md border border-[#e9e2e5] bg-white p-3">
                <Avatar name={leave.name} photoUrl={leave.photoUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{leave.name}</p>
                  <p className="text-xs text-[#8d8388]">{leave.location} · {leave.periodLabel}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${leave.type === "FERIE" ? "bg-[#f8ebca] text-[#7e5d11]" : leave.type === "MALATTIA" ? "bg-[#fde2e2] text-[#a3323b]" : "bg-[#e8edf7] text-[#405981]"}`}>{leave.type}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#eadde3] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-[#c4467d]">Andamento saloni</p>
            <button type="button" onClick={() => router.push("/orders?status=COMPLETED")} className="mt-1 text-left text-xl font-black transition hover:text-[#9d315f] hover:underline">Clienti completati per ora</button>
          </div>
          <button type="button" onClick={() => router.push("/orders?status=COMPLETED")} className="rounded-md text-left transition hover:bg-[#fff0f6] sm:p-2 sm:text-right"><strong className="text-3xl font-black">{data.clientsToday}</strong><p className="text-xs text-[#8b8186]">clienti oggi · apri ordini</p></button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.hourlyClients.length === 0 ? <p className="text-sm text-[#8d8589]">Nessun controllo cliente completato oggi.</p> : data.hourlyClients.map((item) => (
            <button key={item.hour} type="button" onClick={() => router.push("/orders?status=COMPLETED")} className="rounded-md border border-[#eee4e8] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#d75489] hover:bg-[#fff8fb] hover:shadow-sm">
              <div className="flex items-center justify-between"><span className="font-black">{item.hour}</span><strong>{item.count}</strong></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f2e9ed]"><div className="h-full rounded-full bg-[#d75489]" style={{ width: `${Math.max(8, item.count / maxHourly * 100)}%` }} /></div>
              <p className="mt-2 truncate text-[10px] text-[#8d8388]">{item.locations.map((loc) => `${loc.name} ${loc.count}`).join(" · ")}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#2a2631] bg-[#111018] text-white shadow-[0_18px_45px_rgba(20,11,16,0.12)]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ee86b3]">Controllo economico</p>
            <h2 className="mt-1 text-xl font-black">Andamento finanziario</h2>
            <p className="mt-1 text-xs font-semibold capitalize text-white/45">{data.financialPeriodLabel} · disponibilità e movimenti reali</p>
          </div>
          <Link href="/cash" className="inline-flex items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-xs font-black uppercase transition hover:bg-white/10">Apri cassa <ChevronRight className="size-4" /></Link>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-7">
          <Link href="/cash" className="group relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(215,84,137,0.16),transparent_42%)]" />
            <div
              className="relative grid size-48 place-items-center rounded-full p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
              style={{ background: movementSum > 0 ? `conic-gradient(#28a37a 0 ${depositEnd}%, #d69a32 ${depositEnd}% ${withdrawalEnd}%, #e05b62 ${withdrawalEnd}% 100%)` : "conic-gradient(#35313c 0 100%)" }}
            >
              <div className="grid size-full place-items-center rounded-full border border-white/10 bg-[#17151e] text-center shadow-inner">
                <div>
                  <WalletCards className="mx-auto size-5 text-[#ee86b3]" />
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Disponibilità</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{money.format(data.availableCash)}</p>
                </div>
              </div>
            </div>
            <div className="relative mt-5 flex items-center gap-2 text-xs font-bold text-white/55">
              Movimento netto mese
              <span className={`rounded-full px-2 py-1 font-black ${netMovement >= 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>{netMovement >= 0 ? "+" : ""}{money.format(netMovement)}</span>
            </div>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2">
            {financialItems.map((item) => (
              <Link key={item.label} href="/cash" className="group rounded-lg border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{item.label}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">{money.format(item.value)}</p>
                  </div>
                  <span className={`grid size-9 place-items-center rounded-full ${item.soft} ${item.text}`}><Banknote className="size-4" /></span>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(item.value > 0 ? 7 : 0, Math.abs(item.value) / financialMax * 100)}%`, backgroundColor: item.color }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-white/35">
                  <span>{item.label === "Disponibilità" ? "Saldo attuale" : "Totale del mese"}</span>
                  <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-[10px] font-bold uppercase text-white/35 lg:px-7">
          <span>Chiusure cassa ieri</span>
          <strong className="text-sm text-white">{money.format(data.yesterdayCashClosings)}</strong>
        </div>
      </section>

      <p className="flex items-center justify-end gap-2 text-[10px] uppercase text-[#9b9296]"><CalendarDays size={13} /> Aggiornato {data.updatedAt} · aggiornamento automatico ogni minuto</p>
    </div>
  );
}
