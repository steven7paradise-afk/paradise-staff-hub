"use client";
import { useEffect, useTransition, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function AppointmentArchiveStatus({ ready, failed, updatedAt, stale }: { ready: boolean; failed: boolean; updatedAt: string | null; stale: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const requestedAt = useRef(params.get("refresh") === "true" ? Date.now() : 0);
  const waiting = stale || !ready || !updatedAt || new Date(updatedAt).getTime() < requestedAt.current;
  useEffect(() => {
    if (params.get("refresh") !== "true") return;
    requestedAt.current = Date.now();
    const next = new URLSearchParams(params.toString()); next.delete("refresh");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [params, pathname, router]);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!waiting || failed) return;
    let attempts = 0;
    const timer = setInterval(() => { if (!document.hidden) { if (++attempts > 60) { clearInterval(timer); return; } startTransition(() => router.refresh()); } }, 5000);
    return () => clearInterval(timer);
  }, [waiting, failed, router]);
  return <div role="status" className="mx-4 my-3 rounded-xl border border-pink-100 bg-white px-4 py-3 text-sm text-neutral-700">
    {failed ? "Sincronizzazione non riuscita. I dati già salvati restano disponibili." : !ready ? "Importazione dello storico in corso. I risultati possono essere ancora incompleti." : waiting ? "Aggiornamento in background. Puoi usare i dati già salvati." : "Agenda salvata nel database."}
    {updatedAt ? <span className="ml-2">Ultimo aggiornamento: {new Date(updatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}.</span> : null}
    <button className="ml-3 font-semibold text-[#99345F] underline" onClick={() => startTransition(() => router.refresh())}>Aggiorna vista</button>
  </div>;
}
