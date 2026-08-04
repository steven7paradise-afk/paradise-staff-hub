"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error captured by boundary:", error);
  }, [error]);

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
          Impossibile caricare i dati in questo momento. Riprova tra qualche istante.
        </p>
        {error?.message ? (
          <div className="rounded-xl bg-red-50 p-3 text-[11px] font-mono text-red-800 break-words text-left max-h-32 overflow-auto">
            {error.message}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition active:scale-95 hover:bg-neutral-800"
        >
          <RefreshCw className="size-4" />
          Ricarica pagina
        </button>
      </section>
    </main>
  );
}
