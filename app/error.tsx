"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { isRecoverableClientLoadError } from "@/lib/client-load-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const recoverableLoadError = isRecoverableClientLoadError(error?.message || "");

  useEffect(() => {
    console.error("App error captured by boundary:", error);
    if (!recoverableLoadError) return;

    const storageKey = "paradise:last-client-load-reload";
    const previousReload = Number(window.sessionStorage.getItem(storageKey) || 0);
    if (Date.now() - previousReload < 30_000) return;
    window.sessionStorage.setItem(storageKey, String(Date.now()));
    const reloadTimer = window.setTimeout(() => window.location.reload(), 1_500);
    return () => window.clearTimeout(reloadTimer);
  }, [error, recoverableLoadError]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFBF6] p-6 text-center text-neutral-900">
      <section className="w-full max-w-md rounded-[28px] border border-[#E6CEC4] bg-white p-8 shadow-2xl space-y-4">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="size-7" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-neutral-950">
          Si è verificato un problema
        </h1>
        <p className="text-xs font-semibold text-neutral-500 leading-relaxed">
          {recoverableLoadError
            ? "Il sito si sta aggiornando. La pagina verrà ricaricata automaticamente e i dati non saranno modificati."
            : "Impossibile caricare i dati in questo momento. Riprova tra qualche istante."}
        </p>
        {error?.message && !recoverableLoadError ? (
          <div className="rounded-xl bg-red-50 p-3 text-[11px] font-mono text-red-800 break-words text-left max-h-32 overflow-auto">
            {error.message}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => recoverableLoadError ? window.location.reload() : reset()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition active:scale-95 hover:bg-neutral-800"
        >
          <RefreshCw className="size-4" />
          {recoverableLoadError ? "Aggiorna e continua" : "Ricarica pagina"}
        </button>
      </section>
    </main>
  );
}
