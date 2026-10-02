"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  User, 
  Mail, 
  CalendarDays, 
  Fingerprint, 
  Briefcase, 
  ShieldAlert, 
  MapPin, 
  ChevronLeft,
  ChevronRight, 
  FileText, 
  Download,
  FileCheck,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  CalendarCheck2,
  Plus,
  Send,
  X,
} from "lucide-react";
import type { ProfilePerformance } from "@/lib/profile-performance";
import profileStyles from "./profile.module.css";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";


type ClientProfileProps = {
  performance?: ProfilePerformance | null;
  user: {
    id: string;
    name: string;
    email: string;
    birthDateLabel: string;
    fiscalCode: string;
    contractStartLabel: string;
    contractEndLabel: string;
    photoUrl: string | null;
    coverUrl: string | null;
    locationName: string;
    role: string;
    mansione: string | null;
  };
  colleagues: Array<{
    id: string;
    name: string;
    photo_url: string | null;
  }>;
  stats: {
    plannedHours: number;
    workedHours: number;
    openRequests: number;
    documents: number;
    taskInProgress: number;
  };
  unreadNotifications: number;
  shiftWeeks: Array<{
    key: string;
    label: string;
    rangeLabel: string;
    days: Array<{
      dateKey: string;
      dayName: string;
      dayNumber: string;
      monthName: string;
      fullDateLabel: string;
      isToday: boolean;
      shiftName: string;
      startTime: string | null;
      endTime: string | null;
      note: string | null;
      categoryColor: string | null;
      categoryTextColor: string | null;
      attendance: Array<{ type: string; time: string; timestamp: string; minutes: number }>;
    }>;
  }>;
  holidayRequests: Array<{
    id: string;
    type: "FERIE" | "PERMESSO" | "MALATTIA";
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
    reason: string | null;
    adminNote: string | null;
    medicalCode: string | null;
    createdAt: string;
  }>;
  documentsList?: Array<{
    id: string;
    title: string;
    fileUrl: string;
    type: string;
    month: number | null;
    year: number | null;
    createdAt: string;
  }>;

};

type ShiftAttendance = { type: string; time: string; timestamp: string; minutes: number };

function romeWallClockMilliseconds() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return ((read("hour") * 60 + read("minute")) * 60 + read("second")) * 1000;
}

function workedTimeState(logs: ShiftAttendance[], now: number) {
  let workedMilliseconds = 0;
  let breakMilliseconds = 0;
  let activeSince: number | null = null;
  let pauseSince: number | null = null;
  const ordered = [...logs].sort((left, right) => left.minutes - right.minutes);

  for (const log of ordered) {
    const timestamp = log.minutes * 60 * 1000;
    if (!Number.isFinite(timestamp)) continue;
    if (log.type === "ENTRATA" || log.type === "RIENTRO") {
      if (pauseSince !== null) breakMilliseconds += Math.max(0, timestamp - pauseSince);
      pauseSince = null;
      if (activeSince === null) activeSince = timestamp;
    }
    if (log.type === "PAUSA") {
      if (activeSince !== null) {
        workedMilliseconds += Math.max(0, timestamp - activeSince);
        activeSince = null;
      }
      pauseSince = timestamp;
    }
    if (log.type === "USCITA") {
      if (pauseSince !== null) breakMilliseconds += Math.max(0, timestamp - pauseSince);
      pauseSince = null;
      if (activeSince !== null) {
      workedMilliseconds += Math.max(0, timestamp - activeSince);
      activeSince = null;
      }
    }
  }

  if (activeSince !== null) workedMilliseconds += Math.max(0, now - activeSince);
  if (pauseSince !== null) breakMilliseconds += Math.max(0, now - pauseSince);
  const latest = ordered.at(-1) || null;
  const status = activeSince !== null
    ? "WORKING"
    : latest?.type === "PAUSA"
      ? "BREAK"
      : latest?.type === "USCITA"
        ? "FINISHED"
        : "NOT_CLOCKED";
  return { workedMilliseconds, breakMilliseconds, status, latest, firstEntry: ordered.find((log) => log.type === "ENTRATA") || null };
}

function elapsedLabel(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ClientProfile({
  performance = null,
  user,
  colleagues,
  stats,
  unreadNotifications,
  shiftWeeks,
  holidayRequests,
  documentsList = [],
}: ClientProfileProps) {
  const [userPhoto, setUserPhoto] = useState(user.photoUrl);
  const [activeTab, setActiveTab] = useState<"overview" | "info" | "performance">("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [visibleShiftWeekIndex, setVisibleShiftWeekIndex] = useState(0);
  const [selectedShiftDate, setSelectedShiftDate] = useState(() => shiftWeeks[0]?.days.find((day) => day.isToday)?.dateKey || shiftWeeks[0]?.days[0]?.dateKey || "");
  const [visibleHolidayRequests, setVisibleHolidayRequests] = useState(holidayRequests);
  const [showAllHolidayRequests, setShowAllHolidayRequests] = useState(false);
  const [holidayFormOpen, setHolidayFormOpen] = useState(false);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState("");
  const [holidayForm, setHolidayForm] = useState(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    return { type: "FERIE" as "FERIE" | "PERMESSO" | "MALATTIA", startDate: today, endDate: today, startTime: "", endTime: "", reason: "", medicalCode: "" };
  });

  useEffect(() => {
    setUserPhoto(user.photoUrl);
  }, [user.photoUrl]);

  useEffect(() => {
    const handlePhotoChange = (e: any) => {
      setUserPhoto(e.detail);
    };
    window.addEventListener("photo-change", handlePhotoChange);
    return () => {
      window.removeEventListener("photo-change", handlePhotoChange);
    };
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const visibleShiftWeek = shiftWeeks[visibleShiftWeekIndex] || shiftWeeks[0];
  const selectedShift = visibleShiftWeek?.days.find((day) => day.dateKey === selectedShiftDate) || visibleShiftWeek?.days[0];
  const todayShift = shiftWeeks.flatMap((week) => week.days).find((day) => day.isToday);
  const [workedTimerNow, setWorkedTimerNow] = useState(0);
  const todayWorkState = workedTimeState(todayShift?.attendance || [], workedTimerNow);

  useEffect(() => {
    setWorkedTimerNow(romeWallClockMilliseconds());
    const latestType = todayShift?.attendance.at(-1)?.type;
    if (latestType !== "ENTRATA" && latestType !== "RIENTRO" && latestType !== "PAUSA") return;
    const timer = window.setInterval(() => setWorkedTimerNow(romeWallClockMilliseconds()), 1000);
    return () => window.clearInterval(timer);
  }, [todayShift?.attendance]);

  const changeShiftWeek = (nextIndex: number) => {
    const nextWeek = shiftWeeks[nextIndex];
    if (!nextWeek) return;
    setVisibleShiftWeekIndex(nextIndex);
    setSelectedShiftDate(nextWeek.days.find((day) => day.isToday)?.dateKey || nextWeek.days[0]?.dateKey || "");
  };

  const attendanceLabel = (type: string) => {
    if (type === "ENTRATA") return "Entrata";
    if (type === "PAUSA") return "Inizio pausa";
    if (type === "RIENTRO") return "Rientro";
    if (type === "USCITA") return "Uscita";
    return type;
  };

  const holidayStatus = (status: ClientProfileProps["holidayRequests"][number]["status"]) => {
    if (status === "APPROVED") return { label: "Approvata", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    if (status === "REJECTED") return { label: "Rifiutata", className: "border-red-200 bg-red-50 text-red-700" };
    if (status === "FLAGGED") return { label: "Da verificare", className: "border-amber-200 bg-amber-50 text-amber-700" };
    return { label: "In attesa", className: "border-neutral-300 bg-neutral-50 text-neutral-700" };
  };

  const holidayDate = (value: string) => new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

  const submitHolidayRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!holidayForm.startDate || !holidayForm.endDate || holidayForm.endDate < holidayForm.startDate) {
      setHolidayMessage("Controlla le date inserite.");
      return;
    }
    if ((holidayForm.startTime || holidayForm.endTime) && (!holidayForm.startTime || !holidayForm.endTime)) {
      setHolidayMessage("Inserisci sia l’ora iniziale sia quella finale.");
      return;
    }
    if (holidayForm.startDate === holidayForm.endDate && holidayForm.startTime && holidayForm.endTime <= holidayForm.startTime) {
      setHolidayMessage("L’orario finale deve essere dopo quello iniziale.");
      return;
    }

    setHolidaySaving(true);
    setHolidayMessage("");
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: holidayForm.type,
          startDate: holidayForm.startDate,
          endDate: holidayForm.endDate,
          startTime: holidayForm.type === "PERMESSO" ? holidayForm.startTime || undefined : undefined,
          endTime: holidayForm.type === "PERMESSO" ? holidayForm.endTime || undefined : undefined,
          reason: holidayForm.reason.trim() || undefined,
          medicalCode: holidayForm.type === "MALATTIA" ? holidayForm.medicalCode.trim() || undefined : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Richiesta non inviata.");

      const saved = data.leaveRequest ?? data;
      setVisibleHolidayRequests((current) => [{
        id: saved.id,
        type: saved.type,
        startDate: saved.start_date,
        endDate: saved.end_date,
        startTime: saved.start_time ?? null,
        endTime: saved.end_time ?? null,
        status: saved.status,
        reason: saved.reason ?? null,
        adminNote: saved.admin_note ?? null,
        medicalCode: saved.medical_code ?? null,
        createdAt: saved.created_at,
      }, ...current]);
      setHolidayFormOpen(false);
      setHolidayMessage("Richiesta inviata correttamente.");
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
      setHolidayForm({ type: "FERIE", startDate: today, endDate: today, startTime: "", endTime: "", reason: "", medicalCode: "" });
    } catch (error) {
      setHolidayMessage(error instanceof Error ? error.message : "Richiesta non inviata.");
    } finally {
      setHolidaySaving(false);
    }
  };

  const isEmployee = user.role === "DIPENDENTE";

  const details = [
    { label: "Nome e Cognome", value: user.name, icon: User },
    { label: "Email di Servizio", value: user.email, icon: Mail, copyable: true },
    { label: "Data di Nascita", value: user.birthDateLabel, icon: CalendarDays },
    { label: "Codice Fiscale / ID", value: user.fiscalCode, icon: Fingerprint, copyable: true },
    { label: "Inizio Contratto", value: user.contractStartLabel, icon: Briefcase },
    { label: "Scadenza Contratto", value: user.contractEndLabel, icon: ShieldAlert },
    { label: "Salone Primario", value: user.locationName, icon: MapPin },
  ];
  const roleLabel = user.mansione?.trim() || (isEmployee ? "Collaboratore" : user.role.replaceAll("_", " "));
  const formatHours = (value: number) => value.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  const profileSummary = [
    { label: "Ore pianificate", value: `${formatHours(stats.plannedHours)}h`, icon: CalendarDays },
    { label: "Ore lavorate", value: `${formatHours(stats.workedHours)}h`, icon: Clock },
    { label: "Richieste aperte", value: String(stats.openRequests), icon: CalendarCheck2 },
    { label: "Documenti", value: String(stats.documents), icon: FileText },
    { label: "Task in corso", value: String(stats.taskInProgress), icon: FileCheck },
  ];
  const workedPercent = Math.min(100, Math.round((stats.workedHours / Math.max(1, stats.plannedHours)) * 100));

  return (
    <div className={`${profileStyles.page} profile-liquid-page relative isolate min-h-dvh w-full space-y-3 overflow-hidden px-2.5 pb-16 pt-0 font-sans text-neutral-900 antialiased selection:bg-neutral-200 sm:space-y-4 sm:px-6 sm:pb-20 lg:px-8 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0 lg:pt-12`}>
      
      <header className={`${profileStyles.identity} overflow-hidden rounded-3xl border border-neutral-200 bg-white lg:col-span-2 lg:row-start-1`}>
        <div className="relative h-48 overflow-hidden sm:h-64 lg:h-72">
          <img src={user.coverUrl ? resolveDrivePhotoUrl(user.coverUrl) : "/beta-login-hero.png"} alt="" className="size-full object-cover object-center" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <Link href="/dashboard" aria-label="Torna alla dashboard" className="absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-white/90 text-neutral-800 shadow-sm hover:bg-white"><ChevronLeft className="size-5" /></Link>
        </div>
        <div className="relative flex flex-col gap-4 px-5 pb-6 sm:px-8 lg:flex-row lg:items-start lg:gap-6">
          <div className="-mt-16 grid size-32 shrink-0 place-items-center overflow-hidden rounded-full border-[5px] border-white bg-[#f6e8ee] text-3xl font-semibold text-[#7d294f] shadow-sm lg:-mt-14 lg:size-40">
            {userPhoto ? <img src={resolveDrivePhotoUrl(userPhoto)} alt={user.name} className="size-full object-cover" /> : user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 lg:pt-5">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">{user.name}</h1>
            <p className="mt-2 text-sm font-semibold text-[#96365f]">{roleLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <p className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0" />{user.locationName}</p>
              <p className="flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" /><span>Data di nascita: {user.birthDateLabel}</span></p>
              <p className="hidden items-center gap-1.5 lg:flex"><Fingerprint className="size-4 shrink-0" /><span>Codice fiscale: {user.fiscalCode}</span><button type="button" onClick={() => handleCopy(user.fiscalCode, "Codice Fiscale / ID")} aria-label="Copia codice fiscale" className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#96365f] hover:bg-[#faf0f5]">{copiedField === "Codice Fiscale / ID" ? "Copiato" : "Copia"}</button></p>
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {details.filter(item => ["Email di Servizio", "Codice Fiscale / ID"].includes(item.label)).map(({ label, value, icon: Icon, copyable }) => <div key={label} className={cn("min-w-0", label === "Codice Fiscale / ID" && "lg:hidden")}>
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"><Icon className="size-3.5" />{label}</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-neutral-800"><span className="break-all">{value}</span>{copyable && <button type="button" onClick={() => handleCopy(value, label)} aria-label={`Copia ${label}`} className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-[#96365f] hover:bg-[#faf0f5]">{copiedField === label ? "Copiato" : "Copia"}</button>}</dd>
              </div>)}
            </dl>
          </div>
          <Link href="/profile/settings" className="flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl lg:mt-6 bg-[#96365f] px-5 text-sm font-semibold text-white transition hover:bg-[#792b4c]">Gestisci il tuo profilo<ChevronRight className="size-4" /></Link>
        </div>
      <section aria-label="Periodo contrattuale" className="px-5 pb-6 sm:px-8 lg:pl-[216px]">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-[#232329] sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-700"><Briefcase className="size-4 text-[#96365f]" />Periodo contrattuale</div>
          <dl className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#96365f] dark:bg-white/10"><CalendarCheck2 className="size-5" /></span><div><dt className="text-xs text-neutral-500">Data di inizio</dt><dd className="mt-1 text-base font-semibold text-neutral-900">{user.contractStartLabel}</dd></div></div>
            <div aria-hidden="true" className="hidden items-center gap-2 text-neutral-300 sm:flex"><span className="h-px w-6 bg-neutral-200" /><ChevronRight className="size-4" /><span className="h-px w-6 bg-neutral-200" /></div>
            <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-neutral-500 dark:bg-white/10"><CalendarDays className="size-5" /></span><div><dt className="text-xs text-neutral-500">Data di scadenza</dt><dd className="mt-1 text-base font-semibold text-neutral-900">{user.contractEndLabel}</dd></div></div>
          </dl>
        </div>
      </section>
      </header>
        <div id="profile-navigation" className="scroll-mt-6 profile-glass-section profile-page-enter profile-page-enter-delay-2 grid grid-cols-3 gap-1 rounded-[16px] border border-neutral-200 bg-white p-1 sm:flex sm:items-center sm:gap-8 sm:overflow-x-auto sm:px-5 sm:pb-px sm:pt-0 lg:col-span-2 lg:row-start-2">
          {[
            { id: "overview", label: "La mia attività", mobileLabel: "Attività" },
            { id: "performance", label: "Performance", mobileLabel: "Performance" },
            { id: "info", label: "Documenti", mobileLabel: "Documenti" },

          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "min-h-11 rounded-xl border text-[9px] font-bold uppercase tracking-[0.08em] transition duration-200 sm:-mb-px sm:whitespace-nowrap sm:rounded-none sm:border-x-0 sm:border-t-0 sm:py-4 sm:text-xs sm:tracking-[0.25em]",
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white font-black sm:bg-transparent sm:text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                )}
              >
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>



      {activeTab === "overview" && <section className={`${profileStyles.summary} lg:col-span-2 lg:row-start-3`} aria-label="Riepilogo del mese">
        <div><p className={profileStyles.eyebrow}>Riepilogo personale</p><h2 className={profileStyles.sectionTitle}>Questo mese</h2>
          <div className={profileStyles.metrics}>{profileSummary.map(({ label, value, icon: Icon }) => <div key={label}><div className={profileStyles.metricLabel}>{label}<Icon size={15} /></div><strong>{value}</strong></div>)}</div>
        </div>
        <aside className={profileStyles.monthCard}>
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Presenza mensile</h3><Clock className="size-5 text-[#96365f]" /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{formatHours(stats.workedHours)}<span className="ml-1 text-sm font-normal text-neutral-500">/ {formatHours(stats.plannedHours)} ore</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5" role="progressbar" aria-label="Ore lavorate rispetto alle ore pianificate" aria-valuenow={workedPercent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#96365f]" style={{width: `${workedPercent}%`}} /></div>
          <p className="mt-3 text-xs text-neutral-600">{workedPercent}% delle ore pianificate nel mese</p>
        </aside>
      </section>}

      {activeTab === "performance" && <section className={`${profileStyles.performance} profile-glass-section rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 lg:col-span-2 lg:row-start-4`} aria-label="Performance appuntamenti">
        <h2 className="text-lg font-semibold tracking-tight">Appuntamenti completati</h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{performance?.monthLabel || "Mese corrente"} · Dal primo del mese a oggi. Solo appuntamenti segnati come completati in agenda.</p>
        {!performance ? <p role="status" className="mt-6 text-sm">Dati momentaneamente non disponibili. Riprova più tardi.</p> : <>
          <div className="mt-4 grid grid-cols-3 gap-2">{[{label:"Appuntamenti completati",value:performance.total},{label:"Giorni attivi",value:performance.activeDays},{label:"Media per giorno attivo",value:performance.activeDays ? (performance.total / performance.activeDays).toLocaleString("it-IT",{maximumFractionDigits:1}) : "—"}].map(item => <div key={item.label} className="rounded-xl border border-neutral-200 p-3"><p className="text-xs text-neutral-500">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p></div>)}</div>
          <h3 className="mt-5 text-sm font-semibold">Andamento giornaliero</h3>
          {performance.total === 0 && <p className="mt-1 text-xs leading-5 text-neutral-500">Nessun appuntamento completato nel mese finora.</p>}
          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 p-3"><div className="flex h-32 items-end gap-1.5" style={{minWidth: Math.max(260, performance.daily.length * 24)}}>{performance.daily.map(day => <div key={day.date} className="flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ${day.count} appuntamenti completati`}><span className="text-xs tabular-nums">{day.count}</span><div className="w-full max-w-8 rounded-t bg-[#96365f]" style={{height: day.count ? `${day.count / Math.max(1,...performance.daily.map(item => item.count)) * 80}px` : "2px",opacity:day.count ? 1 : .15}} /><span className="text-[10px] text-neutral-500">{day.date.slice(-2)}</span></div>)}</div></div>
          <h3 className="mt-5 text-sm font-semibold">Servizi degli appuntamenti completati</h3>
          <div className="mt-3 divide-y divide-neutral-100">{performance.services.map(service => <div key={service.name} className="flex items-center justify-between gap-3 py-2.5 text-xs leading-5"><span>{service.name}</span><strong className="tabular-nums">{service.count}</strong></div>)}</div>
        </>}
      </section>}

      {/* TAB 1: RIEPILOGO OPERATIVO */}
      {activeTab === "overview" && (
        <div className={`${profileStyles.activity} profile-page-enter flex flex-col gap-6 lg:col-span-2 lg:row-start-4`}>
          {/* WEEKLY PERSONAL SHIFTS */}
          <div className={`${profileStyles.workPanel} profile-glass-section order-1 flex flex-col gap-4 rounded-[20px] border border-neutral-200 bg-white p-4 shadow-2xs sm:gap-5 sm:p-6`}>
            <div className="order-1 flex flex-col gap-3 border-b border-neutral-100 pb-4 text-left sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#b63870] dark:text-[#f080b7]">I MIEI TURNI</span>
                <h2 className="mt-1 text-lg font-serif font-light uppercase text-neutral-900">Turni lavorativi</h2>
                <p className="mt-1 text-xs font-medium text-neutral-500">Orari programmati e timbrature effettive, giorno per giorno.</p>
              </div>
              <Link href="/my-shifts" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-900 hover:text-white sm:w-auto">
                Calendario completo <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="order-2 space-y-3">
              <div className="overflow-hidden rounded-[20px] border border-[#b63870]/30 bg-neutral-50 dark:border-[#f080b7]/25 dark:bg-[#232329]">
                <div className="flex flex-col gap-4 bg-[linear-gradient(135deg,#71304e,#96365f)] p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/20">
                      <Clock className="size-5" aria-hidden="true" />
                      {todayWorkState.status === "WORKING" ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-[#8f2a57]" /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/65">Stato di oggi</p>
                      <p className="mt-1 text-sm font-black">{todayWorkState.status === "WORKING" ? "Attualmente al lavoro" : todayWorkState.status === "BREAK" ? "Pausa in corso" : todayWorkState.status === "FINISHED" ? "Turno terminato" : "Non ancora timbrato"}</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-3xl font-black tabular-nums tracking-tight">{elapsedLabel(todayWorkState.status === "BREAK" ? todayWorkState.breakMilliseconds : todayWorkState.workedMilliseconds)}</p>
                    <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/60">{todayWorkState.status === "BREAK" ? "Tempo in pausa" : "Tempo lavorato"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/10">
                  <div className="p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-neutral-500">Turno previsto</p><p className="mt-2 text-base font-black tabular-nums text-neutral-900">{todayShift?.startTime && todayShift?.endTime ? `${todayShift.startTime} – ${todayShift.endTime}` : "Non programmato"}</p></div>
                  <div className="p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-neutral-500">Prima entrata</p><p className="mt-2 text-base font-black tabular-nums text-neutral-900">{todayWorkState.firstEntry?.time || "Non registrata"}</p></div>
                  <div className="p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-neutral-500">Ultima attività</p><p className="mt-2 text-base font-black tabular-nums text-neutral-900">{todayWorkState.latest ? `${attendanceLabel(todayWorkState.latest.type)} · ${todayWorkState.latest.time}` : "Nessuna"}</p></div>
                </div>
                <p className="border-t border-neutral-200 px-4 py-2.5 text-[9px] font-bold capitalize text-neutral-500 dark:border-white/10">{todayShift?.fullDateLabel || "Oggi"}</p>
              </div>
            </div>

            {visibleShiftWeek ? (
              <div className="order-3 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => changeShiftWeek(visibleShiftWeekIndex - 1)} disabled={visibleShiftWeekIndex === 0} className="grid size-11 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana precedente"><ChevronLeft className="size-4" /></button>
                  <div className="text-center"><p className="text-xs font-black uppercase tracking-wider text-neutral-900">{visibleShiftWeek.label}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{visibleShiftWeek.rangeLabel}</p></div>
                  <button type="button" onClick={() => changeShiftWeek(visibleShiftWeekIndex + 1)} disabled={visibleShiftWeekIndex >= shiftWeeks.length - 1} className="grid size-11 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana successiva"><ChevronRight className="size-4" /></button>
                </div>

                <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-7">
                  {visibleShiftWeek.days.map((day) => {
                    const selected = selectedShift?.dateKey === day.dateKey;
                    const hasShift = Boolean(day.startTime && day.endTime);
                    return (
                      <button key={day.dateKey} type="button" onClick={() => setSelectedShiftDate(day.dateKey)} aria-pressed={selected} className={cn("relative min-h-28 w-[104px] shrink-0 snap-start rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d85a91] sm:w-auto", selected ? hasShift ? "border-[#b63870] bg-[linear-gradient(145deg,#8e2957,#c6477e)] text-white shadow-[0_12px_28px_rgba(182,56,112,0.22)]" : "border-emerald-600 bg-[linear-gradient(145deg,#176b50,#29956e)] text-white shadow-[0_12px_28px_rgba(31,129,94,0.2)]" : hasShift ? "border-neutral-200 bg-neutral-50 text-neutral-900 hover:-translate-y-0.5 hover:border-[#d85a91]/40 hover:bg-white hover:shadow-md dark:hover:bg-white/5" : "border-emerald-200 bg-emerald-50 text-emerald-950 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100")}>
                        {day.isToday ? <span className={cn("absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider", selected ? hasShift ? "bg-white text-[#9f2f60]" : "bg-white text-emerald-700" : hasShift ? "bg-[#f8dce8] text-[#9f2f60]" : "bg-emerald-600 text-white")} aria-label="Oggi">Oggi</span> : null}
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.18em]", selected ? "text-white/65" : "text-neutral-500")}>{day.dayName}</p>
                        <p className="mt-1 text-2xl font-serif">{day.dayNumber}</p>
                        <p className={cn("mt-2 line-clamp-1 text-[9px] font-black uppercase leading-4", selected ? "text-white/85" : hasShift ? "text-neutral-700" : "text-emerald-800 dark:text-emerald-200")}>{hasShift ? day.shiftName : "Riposo"}</p>
                        <p className={cn("mt-1 text-[9px] font-bold tabular-nums", selected ? "text-white/70" : hasShift ? "text-[#a12d61] dark:text-[#f080b7]" : "text-emerald-700 dark:text-emerald-300")}>{hasShift ? `${day.startTime}–${day.endTime}` : "Giornata libera"}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedShift ? (
                  <div className="grid gap-4 rounded-[18px] border border-neutral-200 bg-neutral-50 p-4 text-left sm:p-5 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">{selectedShift.fullDateLabel}</p>
                      <div className="mt-3 flex items-start gap-3">
                        <span className="mt-0.5 size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: selectedShift.startTime && selectedShift.endTime ? selectedShift.categoryColor || "#d4d4d4" : "#28a276" }} />
                        <div><h3 className={cn("text-base font-black", selectedShift.startTime && selectedShift.endTime ? "text-neutral-900" : "text-emerald-700 dark:text-emerald-300")}>{selectedShift.startTime && selectedShift.endTime ? selectedShift.shiftName : "Riposo"}</h3><p className="mt-1 text-sm font-bold text-neutral-600">{selectedShift.startTime && selectedShift.endTime ? `${selectedShift.startTime} – ${selectedShift.endTime}` : "Giornata libera · nessun turno programmato"}</p>{selectedShift.note ? <p className="mt-2 text-xs text-neutral-500">{selectedShift.note}</p> : null}</div>
                      </div>
                    </div>

                    <div className="border-t border-neutral-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                      <div className="flex items-center gap-2"><Clock className="size-4 text-neutral-500" /><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Timbrature</p></div>
                      {selectedShift.attendance.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {selectedShift.attendance.map((entry, index) => (
                            <div key={`${entry.type}-${entry.time}-${index}`} className="rounded-xl border border-neutral-200 bg-white p-3">
                              <div className="flex items-center gap-2 text-neutral-400">{entry.type === "ENTRATA" || entry.type === "RIENTRO" ? <LogIn className="size-3.5" /> : entry.type === "PAUSA" ? <Coffee className="size-3.5" /> : <LogOut className="size-3.5" />}<span className="text-[8px] font-black uppercase tracking-wider">{attendanceLabel(entry.type)}</span></div>
                              <p className="mt-2 text-base font-black tabular-nums text-neutral-900">{entry.time}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-xs font-semibold text-neutral-400">Nessuna timbratura registrata per questo giorno.</p>}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-xs font-bold text-neutral-400">Turni non disponibili.</p>}
          </div>

          {/* PERSONAL HOLIDAYS */}
          <div className={`${profileStyles.requestsPanel} profile-glass-section order-2 space-y-4 rounded-[20px] border border-neutral-200 bg-white p-4 shadow-2xs sm:space-y-5 sm:p-6`}>
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 text-left sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">LE MIE RICHIESTE</span>
                <h2 className="mt-1 text-lg font-serif font-light uppercase text-neutral-900">Ferie, permessi e malattia</h2>
                <p className="mt-1 text-xs font-medium text-neutral-400">Invia una richiesta e controllane date e stato.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button type="button" onClick={() => { setHolidayFormOpen(true); setHolidayMessage(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-neutral-700">
                  <Plus className="size-3.5" /> Nuova richiesta
                </button>
                <Link href="/requests" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
                  Tutte le richieste <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {holidayMessage ? <p role="status" className={cn("rounded-xl border px-4 py-3 text-xs font-bold", holidayMessage.includes("correttamente") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>{holidayMessage}</p> : null}

            {visibleHolidayRequests.length ? (
              <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
                {(showAllHolidayRequests ? visibleHolidayRequests : visibleHolidayRequests.slice(0, 3)).map((request) => {
                  const status = holidayStatus(request.status);
                  return (
                    <article key={request.id} className="profile-glass-inset w-[82vw] max-w-sm shrink-0 snap-start rounded-[18px] border border-neutral-200 bg-neutral-50 p-4 text-left sm:p-5 md:w-auto md:max-w-none">
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white"><CalendarCheck2 className="size-4" /></span>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider", status.className)}>{status.label}</span>
                      </div>
                      <p className="mt-5 text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400">{request.type === "FERIE" ? "Ferie" : request.type === "PERMESSO" ? "Permesso" : "Malattia"}</p>
                      <p className="mt-1 text-base font-black text-neutral-900">{holidayDate(request.startDate)} – {holidayDate(request.endDate)}</p>
                      {request.startTime && request.endTime ? <p className="mt-1 text-xs font-bold text-neutral-500">Orario: {request.startTime} – {request.endTime}</p> : <p className="mt-1 text-xs font-bold text-neutral-500">Giornata intera</p>}
                      {request.reason ? <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">{request.reason}</p> : null}
                      {request.type === "MALATTIA" && request.medicalCode ? <p className="mt-2 text-[10px] font-bold text-neutral-600">Protocollo: {request.medicalCode}</p> : null}
                      {request.adminNote ? <p className="mt-2 text-[10px] font-bold text-neutral-600">Nota: {request.adminNote}</p> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                <CalendarCheck2 className="mx-auto size-6 text-neutral-300" />
                <p className="mt-3 text-xs font-black uppercase tracking-wider text-neutral-700">Nessuna richiesta registrata</p>
                <p className="mt-1 text-[11px] font-medium text-neutral-400">Ferie, permessi e malattie appariranno qui appena vengono inseriti.</p>
              </div>
            )}
            {visibleHolidayRequests.length > 3 ? (
              <div className="flex justify-center border-t border-neutral-100 pt-4">
                <button type="button" onClick={() => setShowAllHolidayRequests((current) => !current)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
                  {showAllHolidayRequests ? "Mostra meno" : `Vedi altre (${visibleHolidayRequests.length - 3})`}
                  <ChevronRight className={cn("size-3.5 transition-transform", showAllHolidayRequests && "rotate-90")} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {holidayFormOpen ? (
        <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="holiday-request-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !holidaySaving) setHolidayFormOpen(false); }}>
          <form onSubmit={submitHolidayRequest} className="my-auto w-full max-w-lg rounded-[26px] border border-white/15 bg-neutral-950 p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/45">Nuova richiesta</p>
                <h2 id="holiday-request-title" className="mt-1 text-2xl font-serif uppercase">Nuova richiesta</h2>
                <p className="mt-1 text-xs font-medium text-white/55">La richiesta verrà inviata direttamente all’amministrazione.</p>
              </div>
              <button type="button" onClick={() => setHolidayFormOpen(false)} disabled={holidaySaving} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white hover:text-black disabled:opacity-40" aria-label="Chiudi richiesta ferie"><X className="size-4" /></button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Tipo di richiesta</span>
                <select value={holidayForm.type} onChange={(event) => setHolidayForm((current) => ({ ...current, type: event.target.value as typeof current.type, startTime: "", endTime: "", medicalCode: "" }))} className="min-h-12 w-full rounded-xl border border-white/15 bg-neutral-900 px-3 text-sm font-bold text-white outline-none transition focus:border-white/50">
                  <option value="FERIE">Ferie</option>
                  <option value="PERMESSO">Permesso</option>
                  <option value="MALATTIA">Malattia</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Dal</span>
                <input required type="date" value={holidayForm.startDate} onChange={(event) => setHolidayForm((current) => ({ ...current, startDate: event.target.value, endDate: current.endDate < event.target.value ? event.target.value : current.endDate }))} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/50" />
              </label>
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Al</span>
                <input required type="date" min={holidayForm.startDate} value={holidayForm.endDate} onChange={(event) => setHolidayForm((current) => ({ ...current, endDate: event.target.value }))} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/50" />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Motivo o nota (facoltativo)</span>
                <textarea rows={3} maxLength={500} value={holidayForm.reason} onChange={(event) => setHolidayForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Scrivi una nota per l’amministrazione..." className="w-full resize-none rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-white/50" />
              </label>
              {holidayForm.type === "PERMESSO" ? (
                <>
                  <label className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Ora inizio (facoltativa)</span>
                    <input type="time" value={holidayForm.startTime} onChange={(event) => setHolidayForm((current) => ({ ...current, startTime: event.target.value }))} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/50" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Ora fine (facoltativa)</span>
                    <input type="time" value={holidayForm.endTime} onChange={(event) => setHolidayForm((current) => ({ ...current, endTime: event.target.value }))} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/50" />
                  </label>
                </>
              ) : null}
              {holidayForm.type === "MALATTIA" ? (
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/55">Numero protocollo medico</span>
                  <input value={holidayForm.medicalCode} onChange={(event) => setHolidayForm((current) => ({ ...current, medicalCode: event.target.value }))} placeholder="Inserisci il numero di protocollo" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-white/50" />
                  <p className="text-[10px] font-medium text-white/40">Se non è ancora disponibile, la malattia resterà da giustificare.</p>
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setHolidayFormOpen(false)} disabled={holidaySaving} className="min-h-12 rounded-xl border border-white/15 px-5 text-[10px] font-black uppercase tracking-wider text-white/70 transition hover:bg-white/10 disabled:opacity-40">Annulla</button>
              <button type="submit" disabled={holidaySaving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[10px] font-black uppercase tracking-wider text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-60"><Send className="size-3.5" />{holidaySaving ? "Invio..." : "Invia richiesta"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* TAB 2: DOCUMENTI PROPRI */}
      {activeTab === "info" && (
        <div className="profile-page-enter profile-page-enter-delay-3 lg:col-span-2 lg:row-start-4">
          <div className="profile-glass-section space-y-6 rounded-[28px] border border-neutral-200 bg-white p-5 text-left shadow-2xs sm:p-8">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">ARCHIVIO UFFICIALE</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                I Miei Documenti Propri
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-medium">
                Visualizza e scarica i tuoi cedolini, contratti e altri documenti emessi.
              </p>
            </div>

            {documentsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 border-b border-neutral-100">
                      <th className="py-3 pr-4">Titolo Documento</th>
                      <th className="py-3 px-4">Tipologia</th>
                      <th className="py-3 px-4">Periodo</th>
                      <th className="py-3 px-4">Data Emissione</th>
                      <th className="py-3 pl-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                    {documentsList.map((doc) => {
                      const isCedolino = doc.type === "CEDOLINO";
                      const isContratto = doc.type === "CONTRATTO";

                      // Month Label mapping
                      const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
                      const periodLabel = isCedolino && doc.month !== null && doc.year
                        ? `${months[doc.month - 1]} ${doc.year}`
                        : "—";

                      return (
                        <tr key={doc.id} className="hover:bg-neutral-50/50 transition duration-150">
                          <td className="py-4 pr-4 font-bold text-neutral-900 flex items-center gap-2.5">
                            {isContratto ? (
                              <FileCheck size={15} className="text-neutral-400 shrink-0" />
                            ) : (
                              <FileText size={15} className="text-neutral-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[180px] sm:max-w-xs">{doc.title}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              isContratto && "bg-neutral-900 border-neutral-900 text-white",
                              isCedolino && "bg-zinc-50 border-neutral-300 text-neutral-700",
                              !isContratto && !isCedolino && "bg-neutral-50 border-neutral-200 text-neutral-400"
                            )}>
                              {doc.type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-neutral-500 font-mono text-[11px]">{periodLabel}</td>
                          <td className="py-4 px-4 text-neutral-400">
                            {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(doc.createdAt))}
                          </td>
                          <td className="py-4 pl-4 text-right">
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              className="inline-flex size-8 items-center justify-center rounded-full border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition duration-200 text-neutral-500 active:scale-95"
                              title="Scarica documento"
                              download
                            >
                              <Download size={13} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-6">
                <FileText size={24} className="text-neutral-300 mb-2" />
                <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Nessun documento disponibile</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                  Quando l'amministrazione caricherà i tuoi contratti o cedolini, appariranno in questo elenco.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔒 TAB 3: IMPOSTAZIONI & SICUREZZA */}


    </div>
  );
}
