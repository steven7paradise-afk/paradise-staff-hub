"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import type { Role } from "@/lib/roles";

type LiveLog = {
  id: string;
  employee: string;
  location: string;
  device: string;
  type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA";
  time: string;
  timestamp: string;
};

const attendanceNames = { ENTRATA: "Entrata", PAUSA: "Pausa", RIENTRO: "Rientro", USCITA: "Uscita" };

export function LiveAttendance({ role, initialLogs }: { role: Role; initialLogs: LiveLog[] }) {
  const [logs, setLogs] = useState(initialLogs);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const response = await fetch("/api/attendance/recent", { cache: "no-store" });
      if (!mounted || !response.ok) return;
      setLogs(await response.json());
    };
    const timer = window.setInterval(refresh, 4000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-3">
      {logs.length === 0 ? <p className="rounded-2xl bg-paradise-nude p-4 text-sm text-black/50">Nessuna timbratura registrata.</p> : null}
      {logs.map((log) => (
        <div key={log.id} className="grid gap-2 rounded-2xl border border-black/5 bg-white p-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-semibold">{role === "DIPENDENTE" ? attendanceNames[log.type] : log.employee}</p>
            <p className="text-sm text-black/50">{log.location} - {log.device}</p>
          </div>
          <div className="text-left sm:text-right">
            {role !== "DIPENDENTE" ? <Badge>{attendanceNames[log.type]}</Badge> : null}
            <p className="mt-2 text-sm text-black/50">
              {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(new Date(log.timestamp))}, {log.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
