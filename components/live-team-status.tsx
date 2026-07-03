"use client";

import { useEffect, useMemo, useState } from "react";
import { Coffee, Timer, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui";

type TeamStatus = {
  id: string;
  name: string;
  photo_url?: string | null;
  location: string;
  lastLog: { type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA"; timestamp: string; time: string } | null;
  breakDurationMinutes: number;
};

const labels = {
  ENTRATA: { status: "In turno", tone: "green" as const },
  RIENTRO: { status: "In turno", tone: "green" as const },
  PAUSA: { status: "In pausa", tone: "gold" as const },
  USCITA: { status: "Fuori turno", tone: "dark" as const },
};

function elapsedSince(timestamp: string, now: number) {
  const elapsed = Math.max(0, now - new Date(timestamp).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
}

function remainingBreak(timestamp: string, durationMinutes: number, now: number) {
  const remainingMinutes = Math.ceil((new Date(timestamp).getTime() + durationMinutes * 60_000 - now) / 60_000);
  if (remainingMinutes < 0) return `oltre il limite di ${Math.abs(remainingMinutes)} min`;
  if (remainingMinutes === 0) return "termina ora";
  return `${remainingMinutes} min rimanenti`;
}

function isBreakOverLimit(timestamp: string, durationMinutes: number, now: number) {
  return new Date(timestamp).getTime() + durationMinutes * 60_000 < now;
}

export function LiveTeamStatus({ initialWorkers }: { initialWorkers: TeamStatus[] }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [now, setNow] = useState(Date.now());
  const [selectedLocation, setSelectedLocation] = useState<string>("Tutti");

  useEffect(() => {
    let mounted = true;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(async () => {
      const response = await fetch("/api/attendance/team-status", { cache: "no-store" });
      if (mounted && response.ok) setWorkers(await response.json());
    }, 4000);
    return () => {
      mounted = false;
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, []);

  const locations = useMemo(() => {
    const locs = Array.from(new Set(workers.map((w) => w.location).filter(Boolean)));
    return ["Tutti", ...locs.sort()];
  }, [workers]);

  useEffect(() => {
    if (!locations.includes(selectedLocation)) {
      setSelectedLocation("Tutti");
    }
  }, [locations, selectedLocation]);

  const filteredWorkers = useMemo(() => {
    if (selectedLocation === "Tutti") return workers;
    return workers.filter((worker) => worker.location === selectedLocation);
  }, [workers, selectedLocation]);

  const activeCount = useMemo(() => filteredWorkers.filter((worker) => worker.lastLog && worker.lastLog.type !== "USCITA").length, [filteredWorkers]);
  const breakCount = useMemo(() => filteredWorkers.filter((worker) => worker.lastLog?.type === "PAUSA").length, [filteredWorkers]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <UserRoundCheck className="size-3.5" />
            {activeCount} in servizio
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <Coffee className="size-3.5" />
            {breakCount} in pausa
          </div>
        </div>

        {locations.length > 2 && (
          <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1 dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            {locations.map((loc) => {
              const isSelected = selectedLocation === loc;
              return (
                <button
                  key={loc}
                  onClick={() => setSelectedLocation(loc)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? "bg-white text-paradise-noir shadow-sm border border-black/5 dark:bg-white/10 dark:text-white dark:border-white/5"
                      : "text-black/50 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredWorkers.length === 0 ? <p className="rounded-2xl bg-paradise-nude/40 p-4 text-sm text-black/50 dark:text-white/40">Nessun lavoratore attivo.</p> : null}
        {filteredWorkers.map((worker) => {
          const state = worker.lastLog ? labels[worker.lastLog.type] : { status: "Non entrato", tone: "dark" as const };
          const isActive = worker.lastLog?.type === "ENTRATA" || worker.lastLog?.type === "RIENTRO";
          const isBreak = worker.lastLog?.type === "PAUSA";
          const breakOverLimit = Boolean(isBreak && worker.lastLog && isBreakOverLimit(worker.lastLog.timestamp, worker.breakDurationMinutes, now));
          const initials = worker.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

          return (
            <div 
              key={worker.id} 
              className={`rounded-[22px] border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                breakOverLimit 
                  ? "border-red-300 bg-red-50/70 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse-danger dark:border-red-950/60 dark:bg-red-950/15" 
                  : isActive 
                    ? "border-emerald-200/80 bg-white/95 dark:border-emerald-950/60 dark:bg-[color:var(--card)]/90" 
                    : isBreak 
                      ? "border-amber-200/80 bg-white/95 dark:border-amber-950/60 dark:bg-[color:var(--card)]/90" 
                      : "border-black/5 bg-white/90 dark:border-white/5 dark:bg-[color:var(--card)]/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`relative grid size-10 shrink-0 place-items-center rounded-full bg-paradise-nude text-xs font-bold text-paradise-noir transition-all duration-300 dark:bg-white/5 dark:text-white/80 overflow-hidden ${
                    isActive 
                      ? "ring-2 ring-emerald-400/60 ring-offset-2 dark:ring-offset-slate-900" 
                      : isBreak 
                        ? "ring-2 ring-amber-400/60 ring-offset-2 dark:ring-offset-slate-900" 
                        : ""
                  }`}>
                    {worker.photo_url ? (
                      <img src={worker.photo_url} alt={worker.name} className="size-full object-cover" />
                    ) : (
                      initials
                    )}
                    {isActive && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                    {isBreak && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[color:var(--text)]">{worker.name}</p>
                    <p className="text-xs text-black/45 dark:text-white/45">{worker.location}</p>
                  </div>
                </div>
                <Badge tone={breakOverLimit ? "pink" : state.tone}>{breakOverLimit ? "Pausa oltre limite" : state.status}</Badge>
              </div>
              {worker.lastLog ? (
                <p className={`mt-4 flex items-center gap-2 text-xs font-medium tracking-wide ${
                  breakOverLimit 
                    ? "text-red-700 dark:text-red-400 font-bold" 
                    : isBreak 
                      ? "text-amber-700 dark:text-amber-400" 
                      : isActive 
                        ? "text-emerald-700 dark:text-emerald-400" 
                        : "text-black/55 dark:text-white/50"
                }`}>
                  <Timer className={`size-3.5 ${breakOverLimit ? "animate-spin" : isActive ? "animate-pulse" : ""}`} />
                  {isBreak 
                    ? `Pausa dalle ${worker.lastLog.time} - ${remainingBreak(worker.lastLog.timestamp, worker.breakDurationMinutes, now)}` 
                    : isActive 
                      ? `In turno dalle ${worker.lastLog.time} - ${elapsedSince(worker.lastLog.timestamp, now)}` 
                      : `Uscita alle ${worker.lastLog.time}`
                  }
                </p>
              ) : <p className="mt-4 text-xs font-medium text-black/45 dark:text-white/40">Nessuna entrata registrata oggi.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
