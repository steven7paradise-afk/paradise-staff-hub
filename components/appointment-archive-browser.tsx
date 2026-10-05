"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { appointmentDateKey } from "@/lib/appointment-date";

export function AppointmentArchiveBrowser({ rows, month, query, page, count, ready }: {
  rows: Array<{ id: string; startDate: string; customerName: string; service: string; orderName: string }>;
  month: string; query: string; page: number; count: number; ready: boolean;
}) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [search, setSearch] = useState(query); const [pending, startTransition] = useTransition();
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("refresh");
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    startTransition(() => router.push(`${pathname}?${next}`, { scroll: false }));
  }
  return <section className="m-4 space-y-5 rounded-3xl border border-pink-100 bg-white p-5 sm:p-8" aria-busy={pending}>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">Archivio appuntamenti</h1><Link className="text-[#99345F] underline" href={pathname}>Agenda di oggi</Link></div>
    <p className="text-sm text-neutral-600">Cerca nel mese selezionato per cliente, telefono, email o numero ordine. 100 risultati per pagina.</p>
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); navigate({ q: search, page: "1" }); }}>
      <input type="month" aria-label="Mese archivio" value={month} className="rounded-xl border p-3" onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) navigate({ focus: `${e.target.value}-01`, page: "1" }); }} />
      <input aria-label="Cerca nello storico" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, telefono, email, ordine…" className="min-w-48 flex-1 rounded-xl border p-3" maxLength={120} />
      <button className="rounded-xl bg-[#99345F] px-5 py-3 font-semibold text-white" disabled={pending}>{pending ? "Ricerca…" : "Cerca"}</button>
      <button type="button" className="rounded-xl border px-4 py-3" disabled={pending} onClick={() => navigate({ refresh: "true" })}>Sincronizza mese</button>
    </form>
    <p className="text-sm">{count} risultati salvati{!ready ? " · importazione in corso" : ""}</p>
    <div className="divide-y divide-pink-100">{rows.map(row => {
      const date = appointmentDateKey(new Date(row.startDate));
      const target = new URLSearchParams(params.toString());
      ["scope", "q", "page", "refresh"].forEach(k => target.delete(k));
      target.set("from", date); target.set("to", date); target.set("focus", date); target.set("view", "day"); target.set("booking", row.id);
      return <Link key={row.id} href={`${pathname}?${target}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-pink-50">
        <div><p className="font-semibold">{row.customerName}</p><p className="text-sm text-neutral-600">{row.service} {row.orderName && `· ${row.orderName}`}</p></div>
        <span className="text-sm">{new Date(row.startDate).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} →</span>
      </Link>;
    })}</div>
    {!rows.length ? <p>{ready ? "Nessun risultato per questa ricerca." : "Sto recuperando gli appuntamenti del mese. Puoi continuare a navigare."}</p> : null}
    <nav aria-label="Pagine archivio" className="flex items-center justify-between gap-3">
      <button disabled={page <= 1 || pending} onClick={() => navigate({ page: String(page - 1) })} className="rounded-xl border px-4 py-2 disabled:opacity-40">Precedente</button>
      <span>Pagina {page} di {Math.max(1, Math.ceil(count / 100))}</span>
      <button disabled={page * 100 >= count || pending} onClick={() => navigate({ page: String(page + 1) })} className="rounded-xl border px-4 py-2 disabled:opacity-40">Successiva</button>
    </nav>
  </section>;
}
