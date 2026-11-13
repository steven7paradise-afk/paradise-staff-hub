"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AppointmentsLiveRefresh({
  revision,
  from,
  to,
  paused = false,
}: {
  revision: string | null;
  from: string;
  to: string;
  paused?: boolean;
}) {
  const router = useRouter();
  const [nextRevision, setNextRevision] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const lastRequested = useRef<string | null>(null);
  const enabled = revision !== null;

  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams({ from, to });
    let stream: EventSource | undefined;
    let retry: number | undefined;
    let delay = 2000;

    function connect() {
      const source = new EventSource(`/api/appointments/events?${params}`);
      stream = source;
      source.addEventListener("open", () => { delay = 2000; });
      source.addEventListener("appointments.changed", (event: MessageEvent<string>) => {
        if (event.data) setNextRevision(event.data);
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
  }, [enabled, from, to]);

  useEffect(() => {
    if (!enabled || paused || refreshing || !nextRevision ||
        nextRevision === revision || nextRevision === lastRequested.current) return;
    let timer: number | undefined;
    const refreshIfVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.hidden) return;
        lastRequested.current = nextRevision;
        startTransition(() => router.refresh());
      }, 250);
    };

    refreshIfVisible();
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [enabled, nextRevision, paused, refreshing, revision, router, startTransition]);

  return null;
}
