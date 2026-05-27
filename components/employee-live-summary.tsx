"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Coffee, FileCheck2, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";

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
  return {
    worked,
    paused,
    isWorking: lastType === "ENTRATA" || lastType === "RIENTRO",
    isPaused: lastType === "PAUSA",
  };
}

export function EmployeeLiveSummary({ plannedTime, shiftName, pendingRequests, colleaguesToday, initialLogs }: ShiftSummaryProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [now, setNow] = useState(Date.now());
  const clock = useMemo(() => totals(logs, now), [logs, now]);

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

  return (
    <div className="grid gap-3 md:grid-cols-[1.45fr_1fr] xl:grid-cols-[1.35fr_1fr_1fr]">
      <Link className="md:row-span-2 xl:row-span-1" href="/my-shifts">
        <Card className="h-full p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <CalendarDays className="size-6 text-[#B85B68]" />
            <ArrowRight className="size-4 text-black/35" />
          </div>
          <p className="mt-4 text-xs font-medium text-black/50">Ore lavorate oggi</p>
          <p className="mt-1 tabular-nums text-3xl font-semibold sm:text-4xl">{formatElapsed(clock.worked)}</p>
          <p className="mt-2 text-xs text-black/50">Turno previsto: {plannedTime} - {shiftName}</p>
          <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${clock.isWorking ? "bg-emerald-100 text-emerald-800" : clock.isPaused ? "bg-amber-100 text-amber-800" : "bg-black/5 text-black/50"}`}>
            {clock.isWorking ? "In turno" : clock.isPaused ? "In pausa" : "Fuori turno"}
          </p>
        </Card>
      </Link>
      <CompactLiveStatus icon={FileCheck2} label="Richieste" value={String(pendingRequests)} hint="in attesa" href="/requests" />
      <CompactLiveStatus
        icon={Coffee}
        label="Pausa"
        value={clock.isPaused || clock.paused > 0 ? formatElapsed(clock.paused) : "--:--:--"}
        hint={clock.isPaused ? "in corso" : clock.paused > 0 ? "totale oggi" : "non iniziata"}
        active={clock.isPaused}
      />
      <CompactLiveStatus className="xl:hidden" icon={Users} label="Colleghi oggi" value={String(colleaguesToday)} hint="in servizio" />
    </div>
  );
}

function CompactLiveStatus({ icon: Icon, label, value, hint, href, className = "", active = false }: { icon: LucideIcon; label: string; value: string; hint: string; href?: string; className?: string; active?: boolean }) {
  const content = (
    <div className={`flex h-full items-center gap-3 rounded-2xl border px-4 py-3 ${active ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white"}`}>
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-amber-100" : "bg-paradise-nude"}`}>
        <Icon className={`size-5 ${active ? "text-amber-700" : "text-[#B85B68]"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-black/45">{label}</p>
        <p className="tabular-nums text-lg font-semibold leading-tight">{value} <span className="text-xs font-normal text-black/45">{hint}</span></p>
      </div>
      {href ? <ArrowRight className="ml-auto size-4 text-black/30" /> : null}
    </div>
  );
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}
