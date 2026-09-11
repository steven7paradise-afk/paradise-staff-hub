"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60_000;
const REQUIRED_IDLE_MS = 10 * 60_000;
const IDLE_CHECK_INTERVAL_MS = 5_000;

export function AppVersionWatcher({ currentVersion }: { currentVersion: string }) {
  useEffect(() => {
    let cancelled = false;
    let checking = false;
    let updatePending = false;
    let reloading = false;
    let lastActivityAt = Date.now();

    const recordActivity = () => {
      lastActivityAt = Date.now();
    };

    const reloadWhenIdle = () => {
      if (
        cancelled ||
        reloading ||
        !updatePending ||
        Date.now() - lastActivityAt < REQUIRED_IDLE_MS
      ) return;

      reloading = true;
      window.location.reload();
    };

    async function checkForUpdate() {
      if (cancelled || reloading || checking || updatePending || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(`/api/app-version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (data.version && data.version !== "unknown" && data.version !== currentVersion) {
          updatePending = true;
          reloadWhenIdle();
        }
      } catch {
        // A temporary connection problem must not interrupt the app.
      } finally {
        checking = false;
      }
    }

    const firstCheck = window.setTimeout(checkForUpdate, 10_000);
    const versionCheck = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    const idleCheck = window.setInterval(reloadWhenIdle, IDLE_CHECK_INTERVAL_MS);
    const checkWhenActive = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkWhenActive);
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("online", checkWhenActive);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheck);
      window.clearInterval(versionCheck);
      window.clearInterval(idleCheck);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", checkWhenActive);
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("online", checkWhenActive);
    };
  }, [currentVersion]);

  return null;
}
