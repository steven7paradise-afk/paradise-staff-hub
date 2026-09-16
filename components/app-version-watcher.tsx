"use client";

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 60_000;

export function AppVersionWatcher({ currentVersion }: { currentVersion: string }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let checking = false;
    let updatePending = false;

    async function checkForUpdate() {
      if (cancelled || checking || updatePending || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(`/api/app-version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (!cancelled && data.version && data.version !== "unknown" && data.version !== currentVersion) {
          updatePending = true;
          setUpdateAvailable(true);
        }
      } catch {
        // A temporary connection problem must not interrupt the app.
      } finally {
        checking = false;
      }
    }

    const firstCheck = window.setTimeout(checkForUpdate, 10_000);
    const versionCheck = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    const checkWhenActive = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", checkWhenActive);
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("online", checkWhenActive);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheck);
      window.clearInterval(versionCheck);
      document.removeEventListener("visibilitychange", checkWhenActive);
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("online", checkWhenActive);
    };
  }, [currentVersion]);

  if (!updateAvailable || dismissed) return null;
  return (
    <aside role="status" className="fixed right-3 top-3 z-[90] w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-lg">
      <p className="text-sm font-semibold">Aggiornamento disponibile</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600">Puoi continuare a lavorare. Salva prima di aggiornare.</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-lg px-3 text-sm">Più tardi</button>
        <button type="button" onClick={() => {
          if (window.confirm("Hai salvato il lavoro? Aggiornando, i dati non salvati nella pagina potrebbero andare persi.")) window.location.reload();
        }} className="min-h-11 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white">Aggiorna</button>
      </div>
    </aside>
  );
}
