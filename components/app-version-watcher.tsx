"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60_000;

export function AppVersionWatcher({ currentVersion }: { currentVersion: string }) {
  useEffect(() => {
    let cancelled = false;
    let reloading = false;
    let checking = false;

    async function checkForUpdate() {
      if (cancelled || reloading || checking || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(`/api/app-version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (data.version && data.version !== "unknown" && data.version !== currentVersion) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        // A temporary connection problem must not interrupt the app.
      } finally {
        checking = false;
      }
    }

    const firstCheck = window.setTimeout(checkForUpdate, 10_000);
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    const checkWhenActive = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };

    document.addEventListener("visibilitychange", checkWhenActive);
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("online", checkWhenActive);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenActive);
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("online", checkWhenActive);
    };
  }, [currentVersion]);

  return null;
}
