"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronDown, MoreVertical, X, Calendar, FileText, CheckCircle2, Coffee, TimerReset } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TodayLog = {
  id?: string;
  type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA";
  timestamp: string;
  time?: string;
};

type TodayCountdownProps = {
  shiftName: string;
  shiftTime: string;
  startTime: string | null;
  endTime: string | null;
  breakDurationMinutes: number;
  initialLogs: TodayLog[];
};

// 1. Month Selector Dropdown
type AllowedMonth = { month: number; year: number };

export function MonthSelector({
  currentMonth,
  currentYear,
  allowedMonths,
}: {
  currentMonth: number;
  currentYear: number;
  allowedMonths?: AllowedMonth[];
}) {
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

  if (allowedMonths?.length) {
    allowedMonths.forEach((item) => {
      options.push({
        value: `${item.month + 1}-${item.year}`,
        label: `${months[item.month]} ${item.year}`
      });
    });
  } else {
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        options.push({
          value: `${m}-${y}`,
          label: `${months[m - 1]} ${y}`
        });
      }
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

function parseLocalTarget(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  return target;
}

function formatCountdown(milliseconds: number) {
  const safe = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}g ${hours}h ${minutes}m`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatElapsed(milliseconds: number) {
  const safe = Math.max(0, milliseconds);
  const totalMinutes = Math.floor(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function TodayShiftCountdown({
  shiftName,
  shiftTime,
  startTime,
  endTime,
  breakDurationMinutes,
  initialLogs,
}: TodayCountdownProps) {
  const [logs, setLogs] = useState<TodayLog[]>(initialLogs);
  const [now, setNow] = useState(() => new Date());

  // Notification states
  const [notified5Min, setNotified5Min] = useState(false);
  const [notifiedExceeded, setNotifiedExceeded] = useState(false);

  // Request notification permissions on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sendClientNotification = (title: string, body: string) => {
    // 1. Play premium ascending beep alarm (C5 -> E5 -> G5)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, duration: number, delay: number) => {
        setTimeout(() => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        }, delay);
      };
      playBeep(523.25, 0.15, 0);     // C5
      playBeep(659.25, 0.15, 120);   // E5
      playBeep(783.99, 0.25, 240);   // G5
    } catch (e) {
      console.warn("Failed to play notification audio:", e);
    }

    // 2. Native HTML5 Browser Notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/manifest.webmanifest", requireInteraction: true });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, { body, icon: "/manifest.webmanifest", requireInteraction: true });
          }
        });
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(async () => {
      const response = await fetch("/api/attendance/my-today", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null);
      if (Array.isArray(data)) setLogs(data);
    }, 30000);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, []);

  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const latest = sortedLogs.at(-1) ?? null;
  const lastEntry = [...sortedLogs].reverse().find((log) => log.type === "ENTRATA" || log.type === "RIENTRO") ?? null;
  const start = parseLocalTarget(startTime);
  const end = parseLocalTarget(endTime);
  const hasShift = Boolean(start && end && shiftName !== "Non programmato");

  // Determine remaining break time if currently on break
  let remainingBreakMs = 0;
  const isPause = latest?.type === "PAUSA";

  if (isPause && latest) {
    const pauseStart = new Date(latest.timestamp);
    const pauseEnd = new Date(pauseStart.getTime() + breakDurationMinutes * 60000);
    remainingBreakMs = pauseEnd.getTime() - now.getTime();
  }

  // Trigger client notifications
  useEffect(() => {
    if (!isPause) {
      setNotified5Min(false);
      setNotifiedExceeded(false);
      return;
    }

    // 5 minutes remaining (300,000 ms)
    if (remainingBreakMs <= 300000 && remainingBreakMs > 0 && !notified5Min) {
      setNotified5Min(true);
      sendClientNotification("Fine pausa imminente", "Mancano 5 minuti al termine della tua pausa.");
    }

    // Exceeded (<= 0)
    if (remainingBreakMs <= 0 && !notifiedExceeded) {
      setNotifiedExceeded(true);
      sendClientNotification("Pausa superata", "Hai superato il limite massimo della pausa.");
    }
  }, [remainingBreakMs, isPause, notified5Min, notifiedExceeded]);

  let status = "Fuori turno";
  let title = "Nessun turno attivo";
  let countdownLabel = "Contatore";
  let countdown = "—";
  let subtext = hasShift ? `Turno previsto ${shiftTime}` : "Nessun turno programmato oggi.";
  let progress = 0;
  let tone: "idle" | "work" | "pause" | "late" | "done" = "idle";

  if (hasShift && start && end) {
    const total = Math.max(1, end.getTime() - start.getTime());
    progress = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100));

    if (latest?.type === "PAUSA") {
      const pauseStart = new Date(latest.timestamp);
      const pauseEnd = new Date(pauseStart.getTime() + breakDurationMinutes * 60000);
      const remaining = pauseEnd.getTime() - now.getTime();
      status = remaining > 0 ? "In pausa" : "Pausa superata";
      title = remaining > 0 ? "Rientro pausa tra" : "Pausa oltre il limite";
      countdownLabel = `Pausa ${breakDurationMinutes} min`;
      countdown = remaining > 0 ? formatCountdown(remaining) : `+${formatElapsed(Math.abs(remaining))}`;
      subtext = `Pausa iniziata alle ${latest.time ?? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(pauseStart)}. Il timer lavoro resta fermo.`;
      tone = remaining > 0 ? "pause" : "late";
    } else if (latest?.type === "ENTRATA" || latest?.type === "RIENTRO") {
      const remaining = end.getTime() - now.getTime();
      status = "In turno";
      title = remaining > 0 ? "Fine turno tra" : "Turno oltre orario";
      countdownLabel = "Tempo rimanente";
      countdown = remaining > 0 ? formatCountdown(remaining) : `+${formatElapsed(Math.abs(remaining))}`;
      subtext = lastEntry ? `Timer avviato dalla timbratura delle ${lastEntry.time ?? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastEntry.timestamp))}.` : `Turno previsto ${shiftTime}`;
      tone = remaining > 0 ? "work" : "late";
    } else if (latest?.type === "USCITA") {
      status = "Turno chiuso";
      title = "Uscita registrata";
      countdownLabel = "Giornata";
      countdown = latest.time ?? "Completata";
      subtext = `Ultima uscita alle ${latest.time ?? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(latest.timestamp))}.`;
      progress = 100;
      tone = "done";
    } else if (now < start) {
      status = "Fuori turno";
      title = "Inizio turno tra";
      countdownLabel = "Prossimo turno";
      countdown = formatCountdown(start.getTime() - now.getTime());
      subtext = `${shiftName} · ${shiftTime}`;
      tone = "idle";
    } else if (now <= end) {
      status = "Turno previsto";
      title = "Turno iniziato da";
      countdownLabel = "Da timbrare";
      countdown = formatElapsed(now.getTime() - start.getTime());
      subtext = "Se sei in salone, ricordati di timbrare l'entrata.";
      tone = "late";
    } else {
      status = "Fuori turno";
      title = "Turno previsto finito";
      countdownLabel = "Orario";
      countdown = shiftTime;
      subtext = "Non risultano timbrature attive per questo turno.";
      progress = 100;
      tone = "done";
    }
  }

  const isBreakWarning = tone === "pause" && remainingBreakMs > 0 && remainingBreakMs <= 300000;

  const toneClass = {
    idle: "from-white via-white to-paradise-softPink/10 border-paradise-pink/25",
    work: "from-emerald-50 via-white to-paradise-softPink/15 border-emerald-500/20",
    pause: isBreakWarning
      ? "from-red-100/90 via-white to-red-50/70 border-red-500/45 shadow-red-100/40"
      : "from-amber-50 via-white to-paradise-softPink/15 border-amber-500/20",
    late: "from-rose-100/90 via-white to-rose-50/70 border-rose-500/40 shadow-rose-100/40",
    done: "from-white via-white to-neutral-50 border-black/5",
  }[tone];

  return (
    <div className={cn("rounded-[26px] border bg-gradient-to-br p-5 shadow-soft transition-all duration-300", toneClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "size-2.5 rounded-full transition-colors duration-300",
              tone === "work" && "bg-emerald-500 animate-pulse",
              tone === "pause" && (isBreakWarning ? "bg-red-600 animate-ping" : "bg-amber-500 animate-pulse"),
              tone === "late" && "bg-rose-600 animate-ping",
              tone === "done" && "bg-neutral-300",
              tone === "idle" && "bg-paradise-pink"
            )} />
            <p className={cn(
              "text-[10px] font-black uppercase tracking-[0.18em] transition-colors duration-300",
              tone === "late"
                ? "text-rose-600"
                : isBreakWarning
                  ? "text-red-600"
                  : "text-[#B85B68]"
            )}>{status}</p>
          </div>
          <h2 className={cn(
            "mt-3 text-xl font-black transition-colors duration-300",
            tone === "late" ? "text-rose-950" : isBreakWarning ? "text-red-950" : "text-paradise-noir"
          )}>{title}</h2>
          <p className="mt-1 text-sm leading-5 text-black/55">{subtext}</p>
        </div>
        <div className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl shadow-sm ring-1 ring-black/5 transition-all duration-300",
          tone === "late"
            ? "bg-rose-500 text-white"
            : isBreakWarning
              ? "bg-red-500 text-white"
              : "bg-white text-[#B85B68]"
        )}>
          {tone === "pause" || tone === "late" ? <Coffee className="size-5" /> : <TimerReset className="size-5" />}
        </div>
      </div>

      <div className={cn(
        "mt-5 rounded-[22px] p-4 ring-1 transition-all duration-300",
        tone === "late"
          ? "bg-rose-50/70 border border-rose-200/50 ring-rose-500/10"
          : isBreakWarning
            ? "bg-red-50/70 border border-red-200/50 ring-red-500/10 animate-pulse"
            : "bg-white/80 ring-black/5"
      )}>
        <p className={cn(
          "text-[9px] font-black uppercase tracking-[0.16em] transition-colors duration-300",
          tone === "late"
            ? "text-rose-600"
            : isBreakWarning
              ? "text-red-600"
              : "text-black/35"
        )}>{countdownLabel}</p>
        <p className={cn(
          "mt-1 font-mono text-4xl font-black tracking-tight transition-colors duration-300",
          tone === "late"
            ? "text-rose-600"
            : isBreakWarning
              ? "text-red-600"
              : "text-paradise-noir"
        )}>{countdown}</p>
      </div>

      {hasShift ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
            <span>{startTime}</span>
            <span>{shiftName}</span>
            <span>{endTime}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-paradise-pink to-[#E0529C] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <Link
        href="/dashboard"
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-paradise-pink py-3 text-xs font-black text-white shadow-soft transition active:scale-[0.98]"
      >
        Apri timbratura
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
  firstPause?: string | null;
  lastReturn?: string | null;
  lastExit: string | null;
  workedHours: number;
  grossHours?: number;
  plannedGrossHours?: number;
  plannedHours: number;
  breakHours?: number;
  paidBreak?: boolean;
  note?: string;
  categoryColor?: string | null;
};

export function DailyDetailModal(props: DailyDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!props.isOpen || !mounted) return null;

  const difference = props.workedHours - props.plannedHours;
  const plannedGrossHours = props.plannedGrossHours ?? props.plannedHours;
  const plannedBreakHours = Math.max(0, plannedGrossHours - props.plannedHours);
  const grossHours = props.grossHours ?? props.workedHours + (props.breakHours ?? 0);
  const countedBreakHours = props.paidBreak ? 0 : (props.breakHours ?? 0);
  const hasDifference = props.plannedHours > 0 || props.workedHours > 0;
  const formattedDifference = `${difference > 0 ? "+" : ""}${difference.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
  const differenceLabel = Math.abs(difference) < 0.01 ? "In linea" : difference > 0 ? "Ore in più" : "Ore mancanti";
  const differenceTone = Math.abs(difference) < 0.01
    ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-700"
    : difference > 0
      ? "border-sky-500/15 bg-sky-500/5 text-sky-700"
      : "border-rose-500/15 bg-rose-500/5 text-rose-700";

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
            <div className="mt-3 rounded-xl border border-black/5 bg-white p-3 text-xs font-semibold text-black/55">
              <div className="flex items-center justify-between gap-3">
                <span>Totale turno</span>
                <strong className="text-black/80">{plannedGrossHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Pausa standard non pagata</span>
                <strong className="text-black/80">-{plannedBreakHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-2">
                <span className="font-black text-black/65">Ore previste pagate</span>
                <strong className="text-paradise-noir">{props.plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
              </div>
            </div>
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
            <div className="mt-3 rounded-xl border border-black/5 bg-white p-3 text-xs font-semibold text-black/55">
              <div className="flex items-center justify-between gap-3">
                <span>Tempo tra entrata e uscita</span>
                <strong className="text-black/80">{grossHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Inizio pausa</span>
                <strong className="text-amber-700">{props.firstPause ?? "--"}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Fine pausa / rientro</span>
                <strong className="text-sky-700">{props.lastReturn ?? "--"}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>{props.paidBreak ? "Pausa pagata" : "Pausa non pagata"}</span>
                <strong className={props.paidBreak ? "text-emerald-700" : "text-rose-700"}>
                  {props.paidBreak ? "non toglie ore" : `-${countedBreakHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`}
                </strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-2">
                <span className="font-black text-black/65">Ore conteggiate</span>
                <strong className="text-paradise-noir">{props.workedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h</strong>
              </div>
            </div>
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
            <div className={cn("rounded-xl border p-3 text-center", differenceTone)}>
              <p className="text-[9px] font-bold uppercase opacity-70">{differenceLabel}</p>
              <p className="mt-0.5 text-sm font-extrabold">
                {hasDifference ? formattedDifference : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-[#FCF8F9] p-3 text-center">
              <p className="text-[9px] font-bold text-black/40 uppercase">{props.paidBreak ? "Pausa pagata" : "Pausa tolta"}</p>
              <p className="text-sm font-extrabold text-paradise-noir mt-0.5">
                {props.breakHours && props.breakHours > 0 ? `${props.breakHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h` : "0 h"}
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

export type MonthlyCalendarDay = {
  dateIso: string;
  dayName: string;
  dayNum: string;
  monthName: string;
  shiftName: string;
  shiftTime: string;
  firstEntry: string | null;
  firstPause: string | null;
  lastReturn: string | null;
  lastExit: string | null;
  workedHours: number;
  grossHours: number;
  plannedGrossHours: number;
  plannedHours: number;
  breakHours: number;
  paidBreak: boolean;
  note?: string;
  categoryColor?: string | null;
  categoryTextColor?: string | null;
};

function compactHours(value: number) {
  if (!value) return "0";
  return value.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

function getCalendarDayState(day: MonthlyCalendarDay) {
  const isRest = day.shiftName.toLowerCase().includes("riposo");
  if (day.workedHours > 0 && day.plannedHours > 0 && day.workedHours >= day.plannedHours) return "complete";
  if (day.workedHours > 0) return "worked";
  if (day.plannedHours > 0 && !isRest) return "planned";
  if (isRest) return "rest";
  return "empty";
}

function alphaColor(color: string | null | undefined, alpha = "18") {
  if (!color) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${alpha}`;
  return color;
}

// 4. Monthly interactive calendar
export function MonthlyWorkCalendar({ monthLabel, days }: { monthLabel: string; days: MonthlyCalendarDay[] }) {
  const [selectedDay, setSelectedDay] = useState<MonthlyCalendarDay | null>(null);
  const firstDate = days[0] ? new Date(days[0].dateIso) : null;
  const leadingBlanks = firstDate ? (firstDate.getUTCDay() + 6) % 7 : 0;
  const totalWorked = days.reduce((total, day) => total + day.workedHours, 0);
  const totalPlanned = days.reduce((total, day) => total + day.plannedHours, 0);
  const difference = totalWorked - totalPlanned;

  return (
    <>
      <div className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-gradient-to-r from-white via-paradise-softPink/10 to-white px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B85B68]">Calendario lavorato</p>
            <h2 className="text-lg font-black text-paradise-noir">{monthLabel}</h2>
            <p className="text-xs text-black/45">Clicca un giorno per vedere quello che hai lavorato e quello che era previsto.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-black/35">Lavorate</p>
              <p className="text-sm font-black text-paradise-noir">{compactHours(totalWorked)} h</p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-black/35">Previste</p>
              <p className="text-sm font-black text-paradise-noir">{compactHours(totalPlanned)} h</p>
            </div>
            <div className="rounded-2xl bg-[#FFF2F7] px-3 py-2 ring-1 ring-paradise-pink/20">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#B85B68]">Saldo</p>
              <p className="text-sm font-black text-[#B85B68]">{difference > 0 ? "+" : ""}{compactHours(difference)} h</p>
            </div>
          </div>
        </div>

        <div className="border-b border-black/5 bg-white px-5 py-3">
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-black/40">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" /> Completo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
              <span className="size-2 rounded-full bg-sky-500" /> Ore extra
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
              <span className="size-2 rounded-full bg-rose-500" /> Mancano ore
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">
              <span className="size-2 rounded-full bg-neutral-300" /> Riposo / vuoto
            </span>
          </div>
        </div>

        <div className="hidden grid-cols-7 border-b border-black/5 bg-[#FCF8F9] text-center sm:grid">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((weekday) => (
            <div key={weekday} className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-black/35">
              {weekday}
            </div>
          ))}
        </div>

        <div className="hidden grid-cols-7 bg-white sm:grid">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <div key={`blank-${index}`} className="min-h-[92px] border-b border-r border-black/[0.04] bg-neutral-50/60" />
          ))}

          {days.map((day) => {
            const state = getCalendarDayState(day);
            const diff = day.workedHours - day.plannedHours;
            const background = day.categoryColor ? alphaColor(day.categoryColor, "18") : undefined;
            const borderColor = day.categoryColor ? alphaColor(day.categoryColor, "55") : undefined;
            return (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "min-h-[112px] border-b border-r border-black/[0.04] bg-white p-3 text-left transition hover:z-10 hover:scale-[1.01] hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-paradise-pink/45",
                  !day.categoryColor && state === "rest" && "bg-neutral-50",
                  !day.categoryColor && state === "empty" && "bg-white"
                )}
                style={{ backgroundColor: background, borderColor }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-white/80 text-sm font-black text-paradise-noir shadow-sm ring-1 ring-black/5">
                    {day.dayNum}
                  </span>
                  {day.categoryColor ? (
                    <span
                      className="rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] shadow-sm ring-1 ring-black/5"
                      style={{
                        backgroundColor: day.categoryColor,
                        color: day.categoryTextColor || "#111111",
                      }}
                    >
                      {day.shiftName.slice(0, 10)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="truncate text-sm font-black text-paradise-noir">{day.shiftName}</p>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-black/45">{day.shiftTime}</p>
                </div>
                {(day.workedHours > 0 || day.plannedHours > 0) ? (
                  <p className={cn("mt-3 inline-flex rounded-full bg-white/80 px-2 py-1 text-[10px] font-black shadow-sm ring-1 ring-black/[0.04]", Math.abs(diff) < 0.01 ? "text-emerald-600" : diff > 0 ? "text-sky-600" : "text-rose-600")}>
                    {Math.abs(diff) < 0.01 ? "OK" : `${diff > 0 ? "+" : ""}${compactHours(diff)}h`}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 bg-white p-3 sm:hidden">
          {days.map((day) => {
            const state = getCalendarDayState(day);
            const diff = day.workedHours - day.plannedHours;
            const diffLabel = Math.abs(diff) < 0.01
              ? "In linea"
              : diff > 0
                ? `+${compactHours(diff)}h extra`
                : `${compactHours(diff)}h mancanti`;
            const diffClass = Math.abs(diff) < 0.01
              ? "bg-emerald-50 text-emerald-700"
              : diff > 0
                ? "bg-sky-50 text-sky-700"
                : "bg-rose-50 text-rose-700";
            const background = day.categoryColor ? alphaColor(day.categoryColor, "18") : undefined;
            const borderColor = day.categoryColor ? alphaColor(day.categoryColor, "55") : undefined;

            return (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "w-full rounded-2xl border border-black/5 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]",
                  !day.categoryColor && state === "rest" && "bg-neutral-50"
                )}
                style={{ backgroundColor: background, borderColor }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white font-black text-paradise-noir shadow-sm ring-1 ring-black/5">
                      <span>{day.dayNum}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">{day.dayName}</p>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        {day.categoryColor ? (
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: day.categoryColor }} />
                        ) : null}
                        <p className="truncate text-sm font-black text-paradise-noir">{day.shiftName}</p>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-black/45">{day.shiftTime}</p>
                      {(day.workedHours > 0 || day.plannedHours > 0) ? (
                        <p className="mt-1 text-[11px] font-bold text-black/35">
                          Prev. {compactHours(day.plannedHours)}h · Lav. {compactHours(day.workedHours)}h
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black", diffClass)}>
                    {day.workedHours > 0 || day.plannedHours > 0 ? diffLabel : "Vuoto"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <DailyDetailModal
          isOpen={Boolean(selectedDay)}
          onClose={() => setSelectedDay(null)}
          dayNum={selectedDay.dayNum}
          monthName={selectedDay.monthName}
          dayName={selectedDay.dayName}
          shiftName={selectedDay.shiftName}
          shiftTime={selectedDay.shiftTime}
          firstEntry={selectedDay.firstEntry}
          firstPause={selectedDay.firstPause}
          lastReturn={selectedDay.lastReturn}
          lastExit={selectedDay.lastExit}
          workedHours={selectedDay.workedHours}
          grossHours={selectedDay.grossHours}
          plannedGrossHours={selectedDay.plannedGrossHours}
          plannedHours={selectedDay.plannedHours}
          breakHours={selectedDay.breakHours}
          paidBreak={selectedDay.paidBreak}
          note={selectedDay.note}
          categoryColor={selectedDay.categoryColor}
        />
      ) : null}
    </>
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
  breakHours?: number;
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
        breakHours={props.breakHours}
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
  breakHours?: number;
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
        breakHours={props.breakHours}
        note={props.note}
        categoryColor={props.categoryColor}
      />
    </>
  );
}
