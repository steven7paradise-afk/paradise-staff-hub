"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronDown, MoreVertical, X, Calendar, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// 1. Month Selector Dropdown
export function MonthSelector({ currentMonth, currentYear }: { currentMonth: number; currentYear: number }) {
  const router = useRouter();
  
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  
  const handleSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [m, y] = e.target.value.split("-");
    router.push(`/my-shifts?month=${m}&year=${y}&weekOffset=0`);
  };

  const options = [];
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const endYear = now.getFullYear() + 2;
  
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      options.push({
        value: `${m}-${y}`,
        label: `${months[m - 1]} ${y}`
      });
    }
  }

  return (
    <div className="relative inline-flex items-center gap-1 cursor-pointer bg-white/50 border border-black/5 rounded-full px-3 py-1.5 hover:bg-white transition-all shadow-sm">
      <span className="text-xs font-bold text-paradise-noir tracking-wide uppercase">
        {months[currentMonth]} {currentYear}
      </span>
      <ChevronDown className="size-3.5 text-black/60" />
      <select
        value={`${currentMonth + 1}-${currentYear}`}
        onChange={handleSelection}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// 2. Currently At Work Card with Live Timer
export function CurrentlyAtWork({ activeClockInTime }: { activeClockInTime: string | null }) {
  const [elapsed, setElapsed] = useState("0h 0m");

  useEffect(() => {
    if (!activeClockInTime) return;
    const clockInDate = new Date(activeClockInTime);

    const updateTimer = () => {
      const diff = Date.now() - clockInDate.getTime();
      if (diff <= 0) {
        setElapsed("0h 0m");
        return;
      }
      const totalMinutes = Math.floor(diff / 60000);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setElapsed(`${hrs}h ${mins}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [activeClockInTime]);

  if (!activeClockInTime) {
    return (
      <div className="rounded-[24px] border border-[#FFA8DD]/30 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-neutral-300 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Non al lavoro</span>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 bg-neutral-50 shadow-sm">
            <Clock className="size-4.5" />
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs text-neutral-500 font-medium">Nessun turno attivo rilevato al momento.</p>
        </div>

        <Link
          href="/dashboard"
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200/80 py-3 text-xs font-bold text-neutral-700 border border-neutral-200/50 shadow-sm transition active:scale-[0.98]"
        >
          Vai alla Dashboard per timbrare
        </Link>
      </div>
    );
  }

  const clockInLabel = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome"
  }).format(new Date(activeClockInTime));

  return (
    <div className="rounded-[24px] border border-[#FFA8DD]/25 bg-gradient-to-br from-white via-white to-paradise-softPink/10 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider text-[#B85B68] uppercase">Attualmente al lavoro</span>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full border-2 border-paradise-pink/20 text-[#B85B68] bg-[#FFF0F3] shadow-sm">
          <Clock className="size-4.5" />
        </div>
      </div>

      <div className="mt-3.5 flex gap-10">
        <div>
          <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider">Entrata</p>
          <p className="text-base font-extrabold text-paradise-noir mt-0.5">{clockInLabel}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider">Tempo trascorso</p>
          <p className="text-base font-extrabold text-[#B85B68] mt-0.5">{elapsed}</p>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-paradise-pink text-white font-bold py-3 text-xs shadow-soft transition-all duration-200 hover:scale-[1.01] hover:bg-[#F2A3CC] active:scale-[0.99]"
      >
        Vedi timbratura
      </Link>
    </div>
  );
}

// 3. Shared Details Modal Component (using React Portal)
type DailyDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dayNum: string;
  monthName: string;
  dayName: string;
  shiftName: string;
  shiftTime: string;
  firstEntry: string | null;
  lastExit: string | null;
  workedHours: number;
  plannedHours: number;
  note?: string;
  categoryColor?: string | null;
};

export function DailyDetailModal(props: DailyDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!props.isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-start sm:px-4 sm:pb-8 sm:pt-8 lg:pt-10">
      <div 
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-black/5 bg-white shadow-luxury animate-in fade-in slide-in-from-bottom-4 duration-200 sm:max-h-[calc(100dvh-4rem)] sm:rounded-3xl sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 bg-[#FCF8F9] px-4 py-3.5 sm:px-6 sm:py-4.5">
          <div className="flex items-center gap-2.5">
            <Calendar className="size-5 text-[#B85B68]" />
            <div>
              <h3 className="font-extrabold text-paradise-noir text-sm">
                Dettaglio del {props.dayNum} {props.monthName}
              </h3>
              <p className="text-[10px] text-black/40 font-semibold uppercase tracking-wider">
                {props.dayName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="grid size-8 place-items-center rounded-xl bg-black/[0.04] text-black/50 hover:bg-black/[0.08] active:scale-95 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-sm sm:p-6">
          {/* Turno */}
          <div className="rounded-2xl border border-black/5 bg-[#FCF8F9] p-4">
            <p className="text-[9px] font-bold text-black/40 uppercase tracking-wider">Turno Assegnato</p>
            <div className="flex items-center gap-2 mt-1">
              {props.categoryColor && (
                <span className="size-2.5 rounded-full" style={{ backgroundColor: props.categoryColor }} />
              )}
              <span className="font-extrabold text-paradise-noir">{props.shiftName}</span>
            </div>
            <p className="text-xs text-black/50 mt-1">Orario programmato: <strong className="text-black/80">{props.shiftTime}</strong></p>
          </div>

          {/* Timbratura */}
          <div className="rounded-2xl border border-black/5 bg-[#FCF8F9] p-4">
            <p className="text-[9px] font-bold text-black/40 uppercase tracking-wider">Timbrature Presenza</p>
            {props.firstEntry ? (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 font-bold text-emerald-700">
                  Entrata: {props.firstEntry}
                </span>
                <span className="text-black/30">→</span>
                {props.lastExit ? (
                  <span className="inline-flex items-center rounded-lg bg-neutral-200/50 border border-neutral-300 px-2.5 py-1 font-bold text-neutral-700">
                    Uscita: {props.lastExit}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 font-bold text-amber-700 animate-pulse">
                    In corso
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-black/35 font-medium mt-1">Nessuna timbratura registrata in questa data.</p>
            )}
          </div>

          {/* Ore lavorate e calcolo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-black/5 bg-[#FCF8F9] p-3 text-center">
              <p className="text-[9px] font-bold text-black/40 uppercase">Previste</p>
              <p className="text-sm font-extrabold text-paradise-noir mt-0.5">
                {props.plannedHours > 0 ? `${props.plannedHours.toLocaleString("it-IT")} h` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-[#FCF8F9] p-3 text-center">
              <p className="text-[9px] font-bold text-black/40 uppercase">Lavorate</p>
              <p className="text-sm font-extrabold text-paradise-noir mt-0.5">
                {props.workedHours > 0 ? `${props.workedHours.toLocaleString("it-IT")} h` : "0 h"}
              </p>
            </div>
          </div>

          {/* Note */}
          {props.note && (
            <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 flex gap-2.5 items-start">
              <FileText className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Note di Modifica</p>
                <p className="text-xs text-amber-800 font-medium italic mt-0.5">{props.note}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-black/5 bg-[#FCF8F9] px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl bg-paradise-pink text-white font-bold px-5 py-2.5 text-xs shadow-soft transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// 4. Interactive Daily Card
type DailyCardProps = {
  dateIso: string;
  dayName: string;
  dayNum: string;
  monthName: string;
  shiftName: string;
  shiftTime: string;
  firstEntry: string | null;
  lastExit: string | null;
  workedHours: number;
  plannedHours: number;
  note?: string;
  categoryColor?: string | null;
  statusLabel: string;
  statusType: "completed" | "absent" | "inprogress" | "unprogrammed";
};

export function DailyDetailCard(props: DailyCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:border-paradise-pink/20 hover:shadow-soft"
      >
        {/* Sidebar category color bar */}
        {props.categoryColor && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: props.categoryColor }}
          />
        )}

        <div className="flex items-start justify-between gap-3 pl-2">
          {/* Left: Date Box */}
          <div className="flex flex-col items-center justify-center size-14 rounded-xl border border-[#FFE3E8] bg-[#FFF2F5] font-bold shadow-sm shrink-0">
            <span className="text-[8px] uppercase font-bold text-[#E0529C] leading-none mb-0.5">
              {props.dayName}
            </span>
            <span className="text-lg font-extrabold text-paradise-noir leading-none">
              {props.dayNum}
            </span>
            <span className="text-[8px] uppercase font-bold text-black/35 leading-none mt-0.5">
              {props.monthName}
            </span>
          </div>

          {/* Center: Shift Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-black/40">Turno:</span>
                <span className="text-xs font-bold text-paradise-noir truncate">
                  {props.shiftName} <span className="font-semibold text-black/45">({props.shiftTime})</span>
                </span>
              </div>

              {/* Timbratura Row */}
              <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                <span className="font-semibold text-black/40">Timbratura:</span>
                {props.firstEntry ? (
                  <div className="flex items-center gap-1">
                    <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 border border-emerald-500/10">
                      {props.firstEntry}
                    </span>
                    <span className="text-black/30">→</span>
                    {props.lastExit ? (
                      <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-neutral-600 border border-neutral-200/50">
                        {props.lastExit}
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 border border-amber-500/20 animate-pulse">
                        In corso
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-black/30 font-medium">—</span>
                )}
              </div>

              {/* Hours summary row */}
              <div className="flex items-center justify-between mt-3 text-[10px] text-black/45">
                <div>
                  <span>Ore: </span>
                  <span className="font-bold text-paradise-noir">
                    {props.workedHours > 0 ? `${props.workedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })}h` : "0h"}
                  </span>
                  <span className="text-black/30"> / </span>
                  <span className="font-semibold">
                    {props.plannedHours > 0 ? `${props.plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })}h` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Badge & Menu Icon */}
          <div className="flex flex-col items-end justify-between h-14 shrink-0">
            {/* Status badge */}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-sm",
              props.statusType === "completed" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
              props.statusType === "absent" && "bg-rose-500/10 text-[#E0529C] border-rose-500/20",
              props.statusType === "inprogress" && "bg-amber-500/10 text-amber-700 border-amber-500/20 animate-pulse",
              props.statusType === "unprogrammed" && "bg-neutral-50 text-neutral-400 border-neutral-200"
            )}>
              {props.statusLabel}
            </span>
            <MoreVertical className="size-4 text-black/30" />
          </div>
        </div>

        {props.note && (
          <p className="mt-2.5 text-[10px] text-amber-600 font-medium italic pl-2 border-l-2 border-amber-300">
            Nota: {props.note}
          </p>
        )}
      </div>

      <DailyDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dayNum={props.dayNum}
        monthName={props.monthName}
        dayName={props.dayName}
        shiftName={props.shiftName}
        shiftTime={props.shiftTime}
        firstEntry={props.firstEntry}
        lastExit={props.lastExit}
        workedHours={props.workedHours}
        plannedHours={props.plannedHours}
        note={props.note}
        categoryColor={props.categoryColor}
      />
    </>
  );
}

// 5. Interactive Daily Table Row
type DailyTableRowProps = {
  dateIso: string;
  dayName: string;
  dayNum: string;
  monthName: string;
  shiftName: string;
  shiftTime: string;
  firstEntry: string | null;
  lastExit: string | null;
  workedHours: number;
  plannedHours: number;
  note?: string;
  categoryColor?: string | null;
  categoryTextColor?: string | null;
  statusLabel: string;
  statusType: "completed" | "absent" | "inprogress" | "unprogrammed";
  isWeekend: boolean;
};

export function DailyTableRow(props: DailyTableRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const matches = props.workedHours >= props.plannedHours && props.plannedHours > 0;

  return (
    <>
      <tr 
        onClick={() => setIsModalOpen(true)}
        className="border-t border-black/5 hover:bg-paradise-nude/20 transition-all duration-150 cursor-pointer"
      >
        <td className="whitespace-nowrap px-6 py-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex flex-col items-center justify-center size-10 rounded-xl font-bold border text-xs shadow-sm",
              props.isWeekend
                ? "bg-paradise-gold/15 border-paradise-gold/30 text-[#9E7A3B]"
                : "bg-paradise-nude/40 border-black/5 text-paradise-noir"
            )}>
              <span className="text-[9px] uppercase font-bold text-black/40 leading-none mb-0.5">
                {props.dayName}
              </span>
              <span className="text-sm font-extrabold leading-tight">
                {props.dayNum}
              </span>
            </div>
          </div>
        </td>
        <td className="px-6 py-3">
          {props.shiftName !== "Non programmato" ? (
            <div className="flex items-center gap-2">
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide shadow-sm"
                style={{ 
                  backgroundColor: props.categoryColor ? props.categoryColor + '15' : 'rgba(255, 168, 221, 0.15)',
                  color: props.categoryTextColor || props.categoryColor || '#B85B68',
                  border: `1px solid ${props.categoryColor ? props.categoryColor + '30' : 'rgba(255, 168, 221, 0.3)'}`
                }}
              >
                <span 
                  className="size-2 rounded-full" 
                  style={{ 
                    backgroundColor: props.categoryColor || '#FFA8DD',
                    border: props.categoryColor === '#ffffff' ? '1px solid rgba(0,0,0,0.15)' : undefined
                  }} 
                />
                {props.shiftName}
              </span>
              <span className="text-xs font-semibold text-black/40">
                {props.shiftTime}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-neutral-100 text-neutral-400 border border-neutral-200/50">
              Nessun turno pianificato
            </span>
          )}
        </td>
        <td className="px-6 py-3">
          {props.firstEntry ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-500/20">
                {props.firstEntry}
              </span>
              <span className="text-black/30">→</span>
              {props.lastExit ? (
                <span className="inline-flex items-center rounded-lg bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-600 border border-neutral-200">
                  {props.lastExit}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-extrabold text-amber-700 border border-amber-500/30 animate-pulse">
                  In corso
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-black/35">—</span>
          )}
        </td>
        <td className="px-6 py-3 text-right text-black/60 font-semibold">
          {props.plannedHours > 0 ? `${props.plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h` : "—"}
        </td>
        <td className="px-6 py-3 text-right">
          <span className={cn(
            "font-extrabold text-sm",
            props.workedHours > 0 
              ? (matches ? "text-emerald-600" : "text-paradise-noir") 
              : "text-black/30"
          )}>
            {props.workedHours > 0 ? `${props.workedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h` : "—"}
          </span>
          {props.note && (
            <p className="text-[10px] text-amber-600 font-medium italic mt-0.5 truncate max-w-[150px] ml-auto" title={props.note}>
              {props.note}
            </p>
          )}
        </td>
      </tr>

      <DailyDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dayNum={props.dayNum}
        monthName={props.monthName}
        dayName={props.dayName}
        shiftName={props.shiftName}
        shiftTime={props.shiftTime}
        firstEntry={props.firstEntry}
        lastExit={props.lastExit}
        workedHours={props.workedHours}
        plannedHours={props.plannedHours}
        note={props.note}
        categoryColor={props.categoryColor}
      />
    </>
  );
}

