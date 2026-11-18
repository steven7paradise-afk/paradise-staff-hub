"use client";

import { useEffect, useState } from "react";
import { endAppointmentWorkerSession } from "@/lib/appointment-logout";

/** A fixed calendar-day deadline; interaction never extends Reception access. */
export function AppointmentReceptionSessionGuard({ expiresAt, redirectTo }: { expiresAt: number; redirectTo: string }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let stopped = false;
    const check = () => {
      if (stopped || Date.now() < expiresAt) return;
      stopped = true;
      setExpired(true);
      void endAppointmentWorkerSession().catch(() => null).then(destination => {
        window.location.replace(destination || redirectTo);
      });
    };
    const timer = window.setTimeout(check, Math.max(0, expiresAt - Date.now()));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    check();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [expiresAt, redirectTo]);
  return expired ? <div role="status" className="fixed inset-0 z-[100] grid place-items-center bg-white p-6 text-center text-neutral-900">È iniziata una nuova giornata. Inserisci di nuovo il PIN personale.</div> : null;
}
