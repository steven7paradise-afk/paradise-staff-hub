"use client";

import { useEffect } from "react";
import { AppointmentIdleSession } from "@/lib/appointment-idle-session";
import { endAppointmentWorkerSession } from "@/lib/appointment-logout";

export function AppointmentIdleSessionGuard({ redirectTo }: { redirectTo: string }) {
  useEffect(() => {
    const session = new AppointmentIdleSession(Date.now());
    let stopped = false;
    let dirty = true;
    let lastRenewal = 0;
    let pending: Promise<void> | null = null;
    const controller = new AbortController();
    const stop = () => { stopped = true; controller.abort(); };
    const lock = async () => {
      if (stopped) return;
      stopped = true;
      // Finish any renewal before deleting the cookie, so it cannot undo logout.
      await pending;
      let destination: string | null = null;
      try { destination = await endAppointmentWorkerSession(); } catch { /* The PIN gate still hides the workspace. */ }
      window.location.replace(destination || redirectTo);
    };
    const renew = () => {
      if (stopped || pending || !dirty || document.visibilityState !== "visible" || Date.now() - lastRenewal < 10000) return;
      if (session.expired(Date.now())) { void lock(); return; }
      dirty = false;
      lastRenewal = Date.now();
      pending = fetch("/api/appointments/pc/activity", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityAgeMs: session.age(Date.now()) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      }).then(response => {
        if (response.status === 401 || response.status === 403) {
          // Schedule after this promise settles to avoid waiting on ourselves.
          window.setTimeout(() => void lock(), 0);
        } else if (!response.ok) dirty = true;
      }).catch(() => { dirty = true; }).finally(() => { pending = null; });
    };
    const activity = (event: Event) => {
      if (stopped || !event.isTrusted || document.visibilityState !== "visible") return;
      if (!session.interact(Date.now())) { void lock(); return; }
      dirty = true;
    };
    const check = () => {
      if (session.expired(Date.now())) void lock();
      else renew();
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
    events.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("appointments:session-ending", stop);
    const timer = window.setInterval(check, 1000);
    renew();
    return () => {
      stop();
      window.clearInterval(timer);
      events.forEach(name => window.removeEventListener(name, activity, true));
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("appointments:session-ending", stop);
    };
  }, [redirectTo]);
  return null;
}
