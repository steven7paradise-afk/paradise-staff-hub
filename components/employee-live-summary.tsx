"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Coffee, Users, type LucideIcon } from "lucide-react";
import { InstantLink } from "@/components/instant-link";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type TodayLog = {
  id?: string;
  type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA";
  timestamp: string;
  time?: string;
};

type ShiftSummaryProps = {
  plannedTime: string;
  shiftName: string;
  pendingRequests: number;
  colleaguesToday: number;
  initialLogs: TodayLog[];
  breakDurationMinutes: number;
  startTime?: string | null;
  assignedHours?: number;
};

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

function totals(logs: TodayLog[], now: number) {
  let workStart: number | null = null;
  let pauseStart: number | null = null;
  let worked = 0;
  let paused = 0;

  logs.forEach((log) => {
    const at = new Date(log.timestamp).getTime();
    if (log.type === "ENTRATA" || log.type === "RIENTRO") {
      if (pauseStart !== null) {
        paused += Math.max(0, at - pauseStart);
        pauseStart = null;
      }
      workStart = at;
    }
    if (log.type === "PAUSA") {
      if (workStart !== null) {
        worked += Math.max(0, at - workStart);
        workStart = null;
      }
      pauseStart = at;
    }
    if (log.type === "USCITA") {
      if (workStart !== null) worked += Math.max(0, at - workStart);
      if (pauseStart !== null) paused += Math.max(0, at - pauseStart);
      workStart = null;
      pauseStart = null;
    }
  });

  if (workStart !== null) worked += Math.max(0, now - workStart);
  if (pauseStart !== null) paused += Math.max(0, now - pauseStart);

  const lastType = logs[logs.length - 1]?.type;
  const activePauseStart = pauseStart;
  return {
    worked,
    paused,
    activePauseStart,
    activePauseElapsed: activePauseStart === null ? 0 : Math.max(0, now - activePauseStart),
    isWorking: lastType === "ENTRATA" || lastType === "RIENTRO",
    isPaused: lastType === "PAUSA",
  };
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function EmployeeLiveSummary({
  plannedTime,
  shiftName,
  pendingRequests,
  colleaguesToday,
  initialLogs,
  breakDurationMinutes,
  startTime,
  assignedHours,
}: ShiftSummaryProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [now, setNow] = useState(Date.now());
  const notifiedPauseKey = useRef<string | null>(null);
  const clock = useMemo(() => totals(logs, now), [logs, now]);
  const pauseRemainingMs = clock.activePauseStart === null ? 0 : clock.activePauseStart + breakDurationMinutes * 60000 - now;
  const isPauseWarning = clock.isPaused && pauseRemainingMs > 0 && pauseRemainingMs <= 5 * 60 * 1000;
  const pauseValue = clock.isPaused ? formatCountdown(pauseRemainingMs) : formatElapsed(clock.paused);
  const pauseHint = clock.isPaused ? "al rientro" : "totale oggi";

  useEffect(() => {
    let mounted = true;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(async () => {
      const response = await fetch("/api/attendance/my-today", { cache: "no-store" });
      if (mounted && response.ok) setLogs(await response.json());
    }, 4000);
    return () => {
      mounted = false;
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (!clock.isPaused || !clock.activePauseStart) {
      notifiedPauseKey.current = null;
      return;
    }

    const pauseKey = String(clock.activePauseStart);
    if (!isPauseWarning || notifiedPauseKey.current === pauseKey) return;
    notifiedPauseKey.current = pauseKey;

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Fine pausa tra 5 minuti", {
        body: "Preparati a timbrare il rientro pausa.",
        tag: `pause-ending-${pauseKey}`,
        icon: "/favicon.png",
      });
    }
  }, [clock.activePauseStart, clock.isPaused, isPauseWarning]);

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-[1.5fr_1fr]">
      <InstantLink className="rounded-[24px]" href="/my-shifts" activeClassName="">
        <Card className={`h-full p-5 sm:p-6 transition-all duration-500 ${
          clock.isWorking 
            ? "border-emerald-300 dark:border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.12)] animate-pulse-green bg-emerald-50/5 dark:bg-emerald-950/5" 
            : clock.isPaused 
              ? "border-amber-300 dark:border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)] animate-pulse-gold bg-amber-50/5 dark:bg-amber-950/5" 
              : "hover:border-black/10 dark:hover:border-white/20"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <CalendarDays className={`size-6 transition-transform duration-500 ${clock.isWorking ? "text-emerald-500 scale-105" : clock.isPaused ? "text-amber-500" : "text-[#B85B68]"}`} />
            <ArrowRight className="size-4 text-black/35 dark:text-white/35 transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
          <p className="mt-4 text-xs font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">Ore lavorate oggi</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="tabular-nums text-3xl font-bold sm:text-4xl tracking-tight text-[color:var(--text)]">{formatElapsed(clock.worked)}</p>
            {clock.isWorking && (
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">Turno previsto: <span className="font-semibold">{plannedTime}</span> - {shiftName}</p>
          <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${
            clock.isWorking 
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-900" 
              : clock.isPaused 
                ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-900" 
                : "bg-black/5 text-black/50 border border-black/5 dark:bg-white/5 dark:text-white/40 dark:border-white/5"
          }`}>
            <span className={`size-1.5 rounded-full ${clock.isWorking ? "bg-emerald-500" : clock.isPaused ? "bg-amber-500" : "bg-black/40 dark:bg-white/40"}`} />
            {clock.isWorking ? "In turno" : clock.isPaused ? "In pausa" : "Fuori turno"}
          </p>
        </Card>
      </InstantLink>
      <CompactLiveStatus
        icon={Coffee}
        label="Pausa"
        value={pauseValue}
        hint={pauseHint}
        href="/my-shifts"
        active={clock.isPaused}
        danger={isPauseWarning}
      />
    </div>
  );
}

function CompactLiveStatus({ icon: Icon, label, value, hint, href, className = "", active = false, danger = false }: { icon: LucideIcon; label: string; value: string; hint: string; href?: string; className?: string; active?: boolean; danger?: boolean }) {
  const content = (
    <div className={`flex h-full items-center gap-4 rounded-[20px] border px-4 py-3.5 transition-all duration-300 ${
      danger 
        ? "border-red-300 bg-red-50/70 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse-danger dark:border-red-900/60 dark:bg-red-950/15" 
        : active 
          ? "border-amber-300 bg-amber-50/70 shadow-[0_0_15px_rgba(245,158,11,0.1)] dark:border-amber-900/60 dark:bg-amber-950/15" 
          : "border-black/5 bg-white/95 dark:border-white/10 dark:bg-[color:var(--card)]/80 hover:border-black/10 dark:hover:border-white/20 hover:shadow-sm"
    }`}>
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 ${
        danger 
          ? "bg-red-100 dark:bg-red-900/30" 
          : active 
            ? "bg-amber-100 dark:bg-amber-900/30" 
            : "bg-paradise-nude dark:bg-white/5"
      }`}>
        <Icon className={`size-5 transition-transform duration-300 ${danger ? "text-red-600 animate-bounce" : active ? "text-amber-600 animate-pulse" : "text-[#B85B68]"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-black/45 dark:text-white/45 uppercase tracking-wide">{label}</p>
        <p className={`tabular-nums text-lg font-bold leading-tight text-[color:var(--text)] ${danger ? "text-red-700 dark:text-red-400" : ""}`}>
          {value} <span className={`text-xs font-medium lowercase ${danger ? "text-red-600 dark:text-red-400" : "text-black/45 dark:text-white/45"}`}>{hint}</span>
        </p>
      </div>
      {href ? <ArrowRight className="ml-auto size-4 text-black/35 dark:text-white/35 transition-transform duration-300 group-hover:translate-x-0.5" /> : null}
    </div>
  );
  return href ? (
    <InstantLink href={href} className={cn("group rounded-[20px] transition-all duration-300 hover:-translate-y-0.5", className)} activeClassName="">
      {content}
    </InstantLink>
  ) : (
    <div className={cn("transition-all duration-300", className)}>{content}</div>
  );
}
