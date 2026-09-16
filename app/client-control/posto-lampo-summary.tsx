"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import type { PostoLampoReport } from "@/lib/posto-lampo-report";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function amountLabel(value: number | null) {
  return value === null ? "Non indicato" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export function PostoLampoSummary({ month, year, salon, dateFilter, hourFilter, revision }: { month: number; year: number; salon: string; dateFilter: "today" | null; hourFilter: string | null; revision: string }) {
  const [report, setReport] = useState<PostoLampoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const requestKey = `${year}-${month}-${salon}-${dateFilter}-${hourFilter}-${revision}-${attempt}`;
  const [loadedKey, setLoadedKey] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setReport(null);
    const params = new URLSearchParams({ month: String(month), year: String(year), salon });
    if (dateFilter) params.set("date", dateFilter);
    if (hourFilter) params.set("hour", hourFilter);
    void fetch(`/api/client-control/posto-lampo?${params}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Riepilogo non disponibile.");
      if (controller.signal.aborted) return;
      setReport(data); setLoadedKey(requestKey);
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Riepilogo non disponibile."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, year, salon, dateFilter, hourFilter, revision, attempt, requestKey]);
  const ready = !loading && !error && report && loadedKey === requestKey;
  const scope = `${salon === "Tutti" ? "Tutti i saloni" : salon}${dateFilter ? " · Solo oggi" : ""}${hourFilter ? ` · Ore ${hourFilter}:00` : ""}`;
  const table = (print = false) => report ? <table className={print ? "" : "w-full min-w-[760px] text-left text-xs"}>
    <thead><tr>{["Data e ora", "Cliente", "Sede", "Esito", "Personale", "Pagato", "Ordine"].map(label => <th key={label} className="border-b border-black/10 px-3 py-3 font-bold">{label}</th>)}</tr></thead>
    <tbody>{report.rows.map(row => <tr key={row.id} className="border-b border-black/5 align-top"><td className="px-3 py-3">{dateLabel(row.date)}</td><td className="px-3 py-3 font-bold">{row.client}</td><td className="px-3 py-3">{row.salon}</td><td className="px-3 py-3">{row.result}<span className="block text-[10px] text-black/50">{row.status}</span></td><td className="px-3 py-3">{row.staff.join(", ") || "Non indicato"}</td><td className="whitespace-nowrap px-3 py-3">{amountLabel(row.paid)}</td><td className="px-3 py-3">{row.order || "—"}</td></tr>)}</tbody>
  </table> : null;
  return <>
    <section aria-labelledby="posto-lampo-title" className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="posto-lampo-title" className="text-xl font-black">Posto Lampo</h2><p className="mt-1 text-sm text-black/60">{ready ? report.monthLabel : `${String(month).padStart(2, "0")}/${year}`} · {scope}</p></div>
        <button type="button" disabled={!ready} onClick={() => window.print()} className="flex min-h-11 items-center gap-2 rounded-md bg-[#111114] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Printer className="size-4" />Stampa riepilogo A4</button>
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading || (!error && !ready) ? <p className="mt-5 flex items-center gap-2 text-sm text-black/60"><Loader2 className="size-4 animate-spin" />Caricamento appuntamenti…</p> : error ? <div className="mt-5 flex flex-wrap items-center gap-3"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => setAttempt(a => a + 1)} className="flex min-h-11 items-center gap-2 rounded-md border border-black/15 px-3 text-sm font-bold"><RotateCcw className="size-4" />Riprova</button></div> : ready ? <>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Appuntamenti", report.totals.appointments], ["Completati", report.totals.completed], ["Da verificare", report.totals.toVerify], ["Non effettuati", report.totals.notPerformed]].map(([label, value]) => <div key={label}><dt className="text-xs text-black/60">{label}</dt><dd className="mt-1 text-2xl font-black">{value}</dd></div>)}</dl>
          <p className="mt-4 text-xs leading-5 text-black/60">Completati: stato completato o controllo cliente inviato, non in bozza né in errore. Annullati e non presentati sono esclusi. Le sole menzioni nelle note non sono conteggiate.</p>
          {report.rows.length ? <><button type="button" aria-expanded={expanded} aria-controls="posto-lampo-list" onClick={() => setExpanded(e => !e)} className="mt-3 min-h-11 text-sm font-bold underline underline-offset-4">{expanded ? "Nascondi" : "Mostra"} i {report.rows.length} appuntamenti</button>{expanded ? <div id="posto-lampo-list" tabIndex={0} role="region" aria-label="Elenco appuntamenti Posto Lampo" className="mt-3 overflow-x-auto">{table()}</div> : null}</> : <p className="mt-4 text-sm text-black/60">Nessun Posto Lampo nel periodo e nella sede selezionati.</p>}
        </> : null}
      </div>
    </section>
    {mounted && ready ? createPortal(<div id="posto-lampo-print-root">
      <style>{`
        #posto-lampo-print-root { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body > :not(#posto-lampo-print-root) { display: none !important; }
          html, body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          #posto-lampo-print-root { display: block !important; font: 10pt Arial, sans-serif; }
          #posto-lampo-print-root h1 { font-size: 18pt; margin: 0 0 4mm; }
          #posto-lampo-print-root p { margin: 0 0 3mm; }
          #posto-lampo-print-root table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8pt; }
          #posto-lampo-print-root th, #posto-lampo-print-root td { padding: 2mm; border-bottom: 0.2mm solid #ccc; text-align: left; overflow-wrap: anywhere; color: black !important; }
          #posto-lampo-print-root th:nth-child(1) { width: 12%; }
          #posto-lampo-print-root th:nth-child(2) { width: 17%; }
          #posto-lampo-print-root th:nth-child(3) { width: 14%; }
          #posto-lampo-print-root th:nth-child(4) { width: 14%; }
          #posto-lampo-print-root th:nth-child(5) { width: 22%; }
          #posto-lampo-print-root th:nth-child(6) { width: 11%; }
          #posto-lampo-print-root th:nth-child(7) { width: 10%; }
          #posto-lampo-print-root thead { display: table-header-group; }
          #posto-lampo-print-root tr { break-inside: avoid; }
          #posto-lampo-print-root .print-note { font-size: 8pt; margin-top: 4mm; }
        }
      `}</style>
      <h1>Posto Lampo — {report.monthLabel}</h1><p>{scope}</p>
      <p>{report.totals.appointments} appuntamenti · {report.totals.completed} completati · {report.totals.toVerify} da verificare · {report.totals.notPerformed} non effettuati</p>
      {report.rows.length ? table(true) : <p>Nessun appuntamento.</p>}
      <p className="print-note">Date degli appuntamenti e orari Europe/Rome. Completato = stato completato o controllo non in bozza né in errore; no-show e annullati esclusi. Importi dal controllo cliente, non dal prezzo di prenotazione. Fonte: calendario e Controllo Cliente. Aggiornato: {dateLabel(report.generatedAt)}.</p>
    </div>, document.body) : null}
  </>;
}
