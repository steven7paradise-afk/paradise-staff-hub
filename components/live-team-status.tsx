"use client";

import { useEffect, useMemo, useState } from "react";
import { Coffee, Timer, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui";

type TeamStatus = {
  id: string;
  name: string;
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

export function LiveTeamStatus({ initialWorkers }: { initialWorkers: TeamStatus[] }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [now, setNow] = useState(Date.now());

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

  const activeCount = useMemo(() => workers.filter((worker) => worker.lastLog && worker.lastLog.type !== "USCITA").length, [workers]);
  const breakCount = useMemo(() => workers.filter((worker) => worker.lastLog?.type === "PAUSA").length, [workers]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><UserRoundCheck className="size-4" /> {activeCount} in servizio</div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><Coffee className="size-4" /> {breakCount} in pausa</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {workers.length === 0 ? <p className="rounded-2xl bg-paradise-nude p-4 text-sm text-black/50">Nessun lavoratore attivo.</p> : null}
        {workers.map((worker) => {
          const state = worker.lastLog ? labels[worker.lastLog.type] : { status: "Non entrato", tone: "dark" as const };
          const isActive = worker.lastLog?.type === "ENTRATA" || worker.lastLog?.type === "RIENTRO";
          const isBreak = worker.lastLog?.type === "PAUSA";
          return (
            <div key={worker.id} className="rounded-2xl border border-black/5 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{worker.name}</p>
                  <p className="text-xs text-black/45">{worker.location}</p>
                </div>
                <Badge tone={state.tone}>{state.status}</Badge>
              </div>
              {worker.lastLog ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-black/60">
                  <Timer className="size-4" />
                  {isBreak ? `Pausa dalle ${worker.lastLog.time} - ${remainingBreak(worker.lastLog.timestamp, worker.breakDurationMinutes, now)}` : isActive ? `In turno dalle ${worker.lastLog.time} - ${elapsedSince(worker.lastLog.timestamp, now)}` : `Uscita alle ${worker.lastLog.time}`}
                </p>
              ) : <p className="mt-3 text-sm text-black/45">Nessuna entrata registrata oggi.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
