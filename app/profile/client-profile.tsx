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
  LockKeyhole, 
  Download,
  FileCheck,
  Clock,
  LogIn,
  LogOut,
  Coffee
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

type ClientProfileProps = {
  user: {
    id: string;
    name: string;
    email: string;
    birthDateLabel: string;
    fiscalCode: string;
    contractStartLabel: string;
    contractEndLabel: string;
    photoUrl: string | null;
    locationName: string;
    role: string;
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
  pointsStats?: {
    schedeCount: number;
    workerGoal: number;
    salonSchedeCount: number;
    salonGoal: number;
    salonEarned: boolean;
    workerEarned: boolean;
    manualBonusPoints: number;
    redeemedPoints: number;
    availablePoints: number;
    totalEarnedPoints: number;
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
      attendance: Array<{ type: string; time: string }>;
    }>;
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
  settingsNode: React.ReactNode;
};

export function ClientProfile({
  user,
  colleagues,
  stats,
  pointsStats,
  unreadNotifications,
  shiftWeeks,
  documentsList = [],
  settingsNode
}: ClientProfileProps) {
  const [userPhoto, setUserPhoto] = useState(user.photoUrl);
  const [activeTab, setActiveTab] = useState<"points" | "info" | "security">("points");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [visibleShiftWeekIndex, setVisibleShiftWeekIndex] = useState(0);
  const [selectedShiftDate, setSelectedShiftDate] = useState(() => shiftWeeks[0]?.days.find((day) => day.isToday)?.dateKey || shiftWeeks[0]?.days[0]?.dateKey || "");

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

  const availablePoints = pointsStats?.availablePoints ?? 0;
  const schedeCount = pointsStats?.schedeCount ?? 0;
  const workerGoal = pointsStats?.workerGoal ?? 150; // default is 150 based on mockup "72 / 150 SCHEDE"
  const salonSchedeCount = pointsStats?.salonSchedeCount ?? 0;
  const salonGoal = pointsStats?.salonGoal ?? 500;

  const workerPercent = Math.min(100, Math.round((schedeCount / (workerGoal || 1)) * 100));
  const salonPercent = Math.min(100, Math.round((salonSchedeCount / (salonGoal || 1)) * 100));
  const visibleShiftWeek = shiftWeeks[visibleShiftWeekIndex] || shiftWeeks[0];
  const selectedShift = visibleShiftWeek?.days.find((day) => day.dateKey === selectedShiftDate) || visibleShiftWeek?.days[0];

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

  return (
    <div className="profile-liquid-page relative isolate min-h-dvh w-full space-y-5 overflow-hidden px-3 pb-16 pt-[calc(env(safe-area-inset-top)+80px)] font-sans text-neutral-900 antialiased selection:bg-neutral-200 sm:space-y-8 sm:px-6 sm:pb-20 lg:px-10 xl:pt-24">
      
      {/* 🖤 DIOR ESTHETIQUE HERO CONTAINER */}
      <div className="profile-identity-glass profile-glass-hero mx-auto max-w-none space-y-6 rounded-[28px] border border-white/55 bg-white/75 p-5 shadow-[0_24px_80px_rgba(44,24,15,0.18)] backdrop-blur-2xl sm:space-y-8 md:rounded-[36px] md:p-10">
        <div className="flex flex-col items-center justify-between gap-5 md:flex-row md:items-start md:gap-8">
          
          {/* Left Side: Avatar & Name */}
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:gap-6 md:text-left">
            <div className="relative group shrink-0">
              <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-[26px] border border-white/70 bg-white/40 text-3xl font-serif text-neutral-800 shadow-[0_16px_40px_rgba(35,18,10,0.16)] sm:size-28 md:size-36 md:rounded-[38px] md:text-4xl">
                {userPhoto ? (
                  <img src={resolveDrivePhotoUrl(userPhoto)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 bg-neutral-100 border border-neutral-200/60 px-3 py-1 rounded-full">
                  {isEmployee ? "Collaboratore" : user.role.replace("_", " ")}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 bg-neutral-50 border border-neutral-200/60 px-3 py-1 rounded-full flex items-center gap-1">
                  <MapPin size={9} className="text-neutral-400" />
                  {user.locationName}
                </span>
              </div>

              <h1 className="break-words text-2xl font-serif font-light uppercase tracking-wide text-neutral-900 sm:text-3xl md:text-4xl">
                {user.name}
              </h1>

              <p className="break-all text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 sm:text-[11px] sm:tracking-[0.2em]">
                {user.email}
              </p>
            </div>
          </div>

          {/* Right Side: Luxury Points Display */}
          <Link href="/points" className="flex flex-col items-center md:items-end justify-center gap-1 border-t md:border-t-0 pt-6 md:pt-0 w-full md:w-auto shrink-0 md:pl-8 border-neutral-100 group">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400 group-hover:text-neutral-600 transition">SALDO PUNTI PREMIUM</span>
            <span className="text-4xl md:text-5xl font-serif font-light text-neutral-900 mt-1 group-hover:underline decoration-neutral-300">
              {availablePoints} <span className="text-xs font-sans font-bold tracking-[0.2em] text-neutral-500 uppercase ml-1">Punti</span>
            </span>
            <div className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase mt-1 flex items-center gap-1 group-hover:text-neutral-600 transition">
              <span>Disponibili per il riscatto</span>
              <span className="underline font-black text-[9px] tracking-wide ml-1">DETTAGLIO</span>
            </div>
          </Link>
        </div>

        {/* Premium Underlined Navigation Tabs (Dior Style) */}
        <div className="flex items-center gap-5 overflow-x-auto border-b border-neutral-200 pb-px sm:gap-8">
          {[
            { id: "points", label: "Punti & Traguardi" },
            { id: "info", label: "Informazioni & Documenti" },
            { id: "security", label: "Impostazioni & Sicurezza" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "min-h-11 py-3 text-[10px] font-bold uppercase tracking-[0.18em] border-b-2 transition duration-200 whitespace-nowrap -mb-px sm:py-4 sm:text-xs sm:tracking-[0.25em]",
                  isActive 
                    ? "border-neutral-900 text-neutral-900 font-black" 
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 🔴 TAB 1: PUNTI & TRAGUARDI */}
      {activeTab === "points" && (
        <div className="space-y-5 animate-in fade-in duration-200 sm:space-y-8">
          
          {/* Target Progress Section */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
              <div className="space-y-1.5 text-left">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">OBIETTIVI MENSILI</span>
                <h2 className="text-xl font-serif font-light text-neutral-900 uppercase">
                  Andamento & Premi
                </h2>
              </div>
              
              <div className="text-xs font-bold text-neutral-400 tracking-[0.1em] uppercase flex flex-wrap gap-4">
                <span>Bonus Extra: <strong className="text-neutral-900 font-extrabold">+{pointsStats?.manualBonusPoints ?? 0}P</strong></span>
                <span className="opacity-50">|</span>
                <span>Riscattati: <strong className="text-neutral-900 font-extrabold">-{pointsStats?.redeemedPoints ?? 0}P</strong></span>
              </div>
            </div>

            {/* Target Progress Cards */}
            <div className={cn("grid gap-4 md:gap-8", isEmployee ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
              
              {/* OBIETTIVO PERSONALE */}
              <div className="profile-glass-inset p-5 sm:p-6 bg-neutral-50 border border-neutral-200 rounded-[22px] space-y-4 text-left">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400 block">DIPENDENTE</span>
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                      Obiettivo Personale ({user.name.split(" ")[0]})
                    </span>
                  </div>
                  <span className="text-sm font-serif font-light text-neutral-900">
                    {schedeCount} / {workerGoal} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-500 uppercase">Schede</span>
                  </span>
                </div>

                {/* Sleek Minimalist Black Progress Bar */}
                <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-900 transition-all duration-700"
                    style={{ width: `${workerPercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                  <span className="text-neutral-400">{workerPercent}% RAGGIUNTO</span>
                  <span className={pointsStats?.workerEarned ? "text-neutral-900 font-black" : "text-amber-700"}>
                    {pointsStats?.workerEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                  </span>
                </div>
              </div>

              {/* OBIETTIVO SALONE - ONLY visible for non-employees (e.g. admins) */}
              {!isEmployee && (
                <div className="profile-glass-inset p-5 sm:p-6 bg-neutral-50 border border-neutral-200 rounded-[22px] space-y-4 text-left">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400 block">STRUTTURA</span>
                      <span className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                        Obiettivo Salone
                      </span>
                    </div>
                    <span className="text-sm font-serif font-light text-neutral-900">
                      {salonSchedeCount} / {salonGoal} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-500 uppercase">Schede</span>
                    </span>
                  </div>

                  {/* Sleek Minimalist Progress Bar */}
                  <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-500 transition-all duration-700"
                      style={{ width: `${salonPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                    <span className="text-neutral-400">{salonPercent}% RAGGIUNTO</span>
                    <span className={pointsStats?.salonEarned ? "text-neutral-900 font-black" : "text-amber-700"}>
                      {pointsStats?.salonEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Redeem Action Row */}
            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              {availablePoints >= 10 ? (
                <Link
                  href="/requests"
                  className="w-full md:w-auto bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-[0.2em] px-8 py-4 rounded-xl shadow-xs transition duration-200 text-center active:scale-98"
                >
                  Riscatta Premio (10 Punti)
                </Link>
              ) : (
                <div className="w-full md:w-auto text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 bg-neutral-50 border border-neutral-200 px-6 py-3 rounded-xl text-center">
                  Raggiungi 10 punti per riscattare un premio
                </div>
              )}
            </div>
          </div>

          {/* WEEKLY PERSONAL SHIFTS */}
          <div className="profile-glass-section space-y-6 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-2xs sm:p-8">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 text-left sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">I MIEI TURNI</span>
                <h2 className="mt-1 text-xl font-serif font-light uppercase text-neutral-900">Calendario settimanale</h2>
                <p className="mt-1 text-xs font-medium text-neutral-400">Seleziona un giorno per vedere orario e timbrature.</p>
              </div>
              <Link href="/my-shifts" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-[10px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
                Calendario completo <ChevronRight className="size-3.5" />
              </Link>
            </div>

            {visibleShiftWeek ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => changeShiftWeek(visibleShiftWeekIndex - 1)} disabled={visibleShiftWeekIndex === 0} className="grid size-11 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana precedente"><ChevronLeft className="size-4" /></button>
                  <div className="text-center"><p className="text-xs font-black uppercase tracking-wider text-neutral-900">{visibleShiftWeek.label}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{visibleShiftWeek.rangeLabel}</p></div>
                  <button type="button" onClick={() => changeShiftWeek(visibleShiftWeekIndex + 1)} disabled={visibleShiftWeekIndex >= shiftWeeks.length - 1} className="grid size-11 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana successiva"><ChevronRight className="size-4" /></button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {visibleShiftWeek.days.map((day) => {
                    const selected = selectedShift?.dateKey === day.dateKey;
                    const hasShift = Boolean(day.startTime && day.endTime);
                    return (
                      <button key={day.dateKey} type="button" onClick={() => setSelectedShiftDate(day.dateKey)} aria-pressed={selected} className={cn("relative min-h-28 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900", selected ? "border-neutral-900 bg-neutral-900 text-white shadow-lg" : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:-translate-y-0.5 hover:bg-white hover:shadow-md")}>
                        {day.isToday ? <span className={cn("absolute right-2 top-2 size-2 rounded-full", selected ? "bg-white" : "bg-neutral-900")} aria-label="Oggi" /> : null}
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.18em]", selected ? "text-white/55" : "text-neutral-400")}>{day.dayName}</p>
                        <p className="mt-1 text-2xl font-serif">{day.dayNumber}</p>
                        <p className={cn("mt-3 line-clamp-2 text-[10px] font-black uppercase leading-4", selected ? "text-white/80" : hasShift ? "text-neutral-700" : "text-neutral-400")}>{day.shiftName}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedShift ? (
                  <div className="grid gap-4 rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 text-left lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">{selectedShift.fullDateLabel}</p>
                      <div className="mt-3 flex items-start gap-3">
                        <span className="mt-0.5 size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: selectedShift.categoryColor || "#d4d4d4" }} />
                        <div><h3 className="text-base font-black text-neutral-900">{selectedShift.shiftName}</h3><p className="mt-1 text-sm font-bold text-neutral-600">{selectedShift.startTime && selectedShift.endTime ? `${selectedShift.startTime} – ${selectedShift.endTime}` : "Nessun orario programmato"}</p>{selectedShift.note ? <p className="mt-2 text-xs text-neutral-500">{selectedShift.note}</p> : null}</div>
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
              </>
            ) : <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-xs font-bold text-neutral-400">Turni non disponibili.</p>}
          </div>
        </div>
      )}

      {/* 👤 TAB 2: INFORMAZIONI PERSONALI & DOCUMENTI PROPRI */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
          
          {/* Personal Info Column (1/3) */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 lg:col-span-1 h-fit text-left">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">DATI REGISTRATI</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                Dati Anagrafici
              </h2>
            </div>

            <div className="space-y-5">
              {details.map(({ label, value, copyable }) => (
                <div key={label} className="group border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
                    {copyable && (
                      <button
                        onClick={() => handleCopy(value, label)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors p-1"
                        title="Copia"
                      >
                        {copiedField === label ? <span className="text-[8px] font-black text-emerald-600 tracking-wider">COPIATO</span> : <span className="text-[9px] hover:underline">COPIA</span>}
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800 block mt-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Column (2/3) */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 lg:col-span-2 text-left">
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
      {activeTab === "security" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 text-left">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">PREFERENZE</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                Sicurezza & Account
              </h2>
            </div>

            {settingsNode}

            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <LogoutButton className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-[0.2em] px-8 py-3.5 rounded-xl transition duration-200 text-center active:scale-98" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
