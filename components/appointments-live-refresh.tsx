"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AppointmentsLiveRefresh({
  revision,
  from,
  to,
  paused = false,
  cashier = false,
  acknowledgedRevisions,
  onRosterChange,
}: {
  revision: string | null;
  from: string;
  to: string;
  paused?: boolean;
  cashier?: boolean;
  acknowledgedRevisions?: ReadonlySet<string>;
  onRosterChange?: (revision: string) => void;
}) {
  const router = useRouter();
  const [nextRevision, setNextRevision] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const lastRequested = useRef<{ fromRevision: string; toRevision: string } | null>(null);
  const enabled = revision !== null;
  const receiveRevision = useEffectEvent((incoming: string) => {
    setNextRevision(incoming === revision ? null : incoming);
  });
  const updateRoster = useEffectEvent((rosterRevision: string) => {
    onRosterChange?.(rosterRevision);
  });

  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams({ from, to });
    if (cashier) params.set("scope", "cashier");
    let stream: EventSource | undefined;
    let retry: number | undefined;
    let delay = 2000;

    function connect() {
      const source = new EventSource(`/api/appointments/events?${params}`);
      stream = source;
      source.addEventListener("open", () => { delay = 2000; });
      source.addEventListener("appointments.changed", (event: MessageEvent<string>) => {
        if (event.data) receiveRevision(event.data);
      });
      source.addEventListener("roster.changed", (event: MessageEvent<string>) => {
        if (event.data) updateRoster(event.data);
      });
      source.addEventListener("error", () => {
        // Native EventSource reconnects after a dropped stream. Reopen only
        // when a failed HTTP response closed it permanently.
        if (source.readyState !== EventSource.CLOSED) return;
        source.close();
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 60_000);
      });
    }

    setNextRevision(null);
    lastRequested.current = null;
    connect();
    return () => {
      window.clearTimeout(retry);
      stream?.close();
    };
  }, [cashier, enabled, from, to]);

  useEffect(() => {
    if (!revision || paused || refreshing || !nextRevision || nextRevision === revision || acknowledgedRevisions?.has(nextRevision)) return;
    if (lastRequested.current?.fromRevision === revision &&
        lastRequested.current.toRevision === nextRevision) return;
    let timer: number | undefined;
    const refreshIfVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.hidden) return;
        lastRequested.current = { fromRevision: revision, toRevision: nextRevision };
        startTransition(() => router.refresh());
      }, 250);
    };

    refreshIfVisible();
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [acknowledgedRevisions, nextRevision, paused, refreshing, revision, router, startTransition]);

  return null;
}
