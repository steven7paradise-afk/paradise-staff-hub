"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { remainingAgendaAppointments, agendaGroup, WAIT_REASONS, type AgendaNotes, type AgendaReport } from "@/lib/shift-agenda";
export type AgendaSummary = { complete: boolean; planned: number; completed: number; unresolved: number };
export function ShiftAgendaPanel({ day, onSummary }: { day: string; onSummary: (summary: AgendaSummary | null) => void }) {
  const [group, setGroup] = useState<ReturnType<typeof agendaGroup>>("review");
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [report, setReport] = useState<AgendaReport | null>(null);
  const [notes, setNotes] = useState<AgendaNotes>({ outcomes: {}, waits: [] });
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    if (dirtyRef.current) return;
    try {
      const response = await fetch(`/api/shift-agenda?day=${day}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      // Never replace edits made while the request was in flight.
      if (dirtyRef.current) return;
      setReport(data); setNotes(data.notes); setError("");
      const unresolved = data.appointments.filter((a: AgendaReport["appointments"][number]) => agendaGroup(a, data.updatedAt) === "review").length;
      onSummary({ complete: unresolved === 0, planned: data.totals.planned, completed: data.totals.completed, unresolved });
    } catch (e) { setError(e instanceof Error ? e.message : "Dati non disponibili"); onSummary(null); }
  }, [day, onSummary]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 60000); return () => window.clearInterval(timer); }, [refresh]);
  function edit(next: AgendaNotes) { dirtyRef.current = true; setDirty(true); setNotes(next); setMessage(""); }
  async function save() {
    if (!report) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shift-agenda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, version: report.version, notes }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setReport(current => current ? { ...current, version: result.version } : current);
      dirtyRef.current = false; setDirty(false); setMessage("Agenda salvata"); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Salvataggio non riuscito"); }
    finally { setBusy(false); }
  }
  const unresolved = report?.appointments.filter(a => agendaGroup(a, report.updatedAt) === group) || [];
  const field = "min-h-11 min-w-0 rounded-xl border border-[#d4a4b8] bg-white px-3 py-2 text-sm text-[#392936]";
  return <section className="space-y-5 py-5" aria-label="Numeri e controlli automatici Agenda">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#392936]">Numeri del giorno</h2><p className="mt-1 text-xs text-neutral-500">Dal calendario Buenos Aires e dalle schede cliente · aggiornamento ogni minuto</p></div><button type="button" disabled={busy || dirty} onClick={() => void refresh()} className={`${field} disabled:opacity-40`}>Aggiorna dati</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!report ? <p role="status" className="py-6 text-sm text-neutral-500">{error ? "Conteggi non disponibili" : "Caricamento calendario e schede…"}</p> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[
        [remainingAgendaAppointments(report.appointments), "Appuntamenti rimanenti"], [report.totals.completed, "Fatti · note inserite"], [report.totals.cancelled, "Annullati"], [report.totals.noShow, "No-show"], [report.totals.moved, "Spostati"], [report.totals.flash, "Posti lampo creati oggi"],
      ].map(([count, label]) => <div key={label} className="rounded-2xl bg-[#f6f0f4] p-4"><strong className="block text-3xl tabular-nums text-[#392936]">{count}</strong><span className="mt-2 block text-xs text-neutral-600">{label}</span></div>)}</div>
      <p className="text-xs text-neutral-500">Il contatore rimanenti scende fino a zero: esclude note già inserite, no-show, annullati e spostati. I posti lampo contano gli appuntamenti di oggi creati oggi. Fatti conta gli appuntamenti con note del servizio salvate dal personale, senza richiedere “Controllato”.</p>
      <div className="space-y-3"><h3 className="font-bold text-[#963b62]">Appuntamenti del salone · tutte le lavoratrici</h3>
        <p className="text-sm text-neutral-600">Da verificare: appuntamenti con orario terminato e senza note del servizio salvate. Non significa che il servizio sia stato eseguito.</p>
        <div className="shift-team-panel flex flex-wrap gap-2">{([['review','Da verificare'],['progress','In corso'],['upcoming','Da iniziare'],['resolved','No-show / annullati / spostati'],['completed','Note inserite']] as const).map(([key,label])=><button type="button" key={key} className="team-button" aria-pressed={group===key} onClick={()=>{setGroup(key);setShowAllAppointments(false);}}>{label} · {report.appointments.filter(a=>agendaGroup(a,report.updatedAt)===key).length}</button>)}</div>
        {unresolved.length === 0 && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Nessun appuntamento in questa categoria.</p>}
        {(showAllAppointments ? unresolved : unresolved.slice(0, 3)).map(a => <article key={a.id} className="rounded-2xl border border-[#cc7296] p-4">
          <p className="text-sm font-semibold text-[#392936]">{a.time} · {a.name}</p><p className="mt-1 text-sm text-neutral-600">{a.service} · {a.staff}</p>
          {agendaGroup(a, report.updatedAt) === "upcoming" && <p className="mt-1 text-xs text-neutral-500">Appuntamento non ancora iniziato</p>}
          {a.confirmed && <p className="mt-3 text-sm font-semibold text-emerald-800">Note del servizio inserite</p>}
          {['No-show', 'Spostato', 'Annullato'].includes(a.outcome) && <p className="mt-3 inline-block rounded-full bg-[#f0edef] px-3 py-1 text-xs font-semibold">{a.outcome} · {a.automaticOutcome ? 'dal calendario' : 'dal verbale'}</p>}
        </article>)}
        {unresolved.length > 3 && <button type="button" aria-expanded={showAllAppointments} onClick={() => setShowAllAppointments(value => !value)} className="min-h-11 rounded-xl border border-[#d4a4b8] bg-[#faf3f7] px-4 py-2 text-sm font-semibold text-[#963b62]">{showAllAppointments ? "Mostra solo 3" : `Vedi altri (${unresolved.length - 3})`}</button>}
      </div>
      <section className="space-y-3 rounded-2xl border border-[#cc7296] p-4"><h3 className="font-bold text-[#392936]">Clienti che hanno aspettato più di 10 minuti</h3><p className="text-xs text-neutral-500">Da compilare dalla responsabile, solo quando c’è stata un’attesa.</p>
        {notes.waits.map((wait, index) => <div key={index} className="grid gap-2 rounded-xl bg-[#faf4f7] p-3 sm:grid-cols-2">
          <select disabled={busy} aria-label={`Cliente in attesa ${index + 1}`} className={field} value={wait.bookingId} onChange={e => edit({ ...notes, waits: notes.waits.map((w, i) => i === index ? { ...w, bookingId: e.target.value } : w) })}><option value="">Seleziona cliente…</option>{report.appointments.map(a => <option key={a.id} value={a.id}>{a.time} · {a.name}</option>)}</select>
          <input disabled={busy} type="number" min={11} max={600} aria-label={`Minuti di attesa ${index + 1}`} className={field} value={wait.minutes || ""} placeholder="Minuti di attesa" onChange={e => edit({ ...notes, waits: notes.waits.map((w, i) => i === index ? { ...w, minutes: Number(e.target.value) } : w) })} />
          <select disabled={busy} aria-label={`Motivo attesa ${index + 1}`} className={field} value={wait.reason} onChange={e => edit({ ...notes, waits: notes.waits.map((w, i) => i === index ? { ...w, reason: e.target.value } : w) })}><option value="">Seleziona motivo…</option>{WAIT_REASONS.map(reason => <option key={reason}>{reason}</option>)}</select>
          <input disabled={busy} maxLength={1000} aria-label={`Nota attesa ${index + 1}`} placeholder={wait.reason === "Altro" ? "Descrivi il motivo (obbligatorio)" : "Nota facoltativa"} className={field} value={wait.note} onChange={e => edit({ ...notes, waits: notes.waits.map((w, i) => i === index ? { ...w, note: e.target.value } : w) })} />
          <button type="button" disabled={busy} className="justify-self-start p-2 text-xs font-semibold text-[#963b62]" onClick={() => edit({ ...notes, waits: notes.waits.filter((_, i) => i !== index) })}>Rimuovi attesa</button>
        </div>)}
        <button type="button" disabled={busy} onClick={() => edit({ ...notes, waits: [...notes.waits, { bookingId: "", minutes: 15, reason: "", note: "" }] })} className="min-h-11 text-sm font-bold text-[#963b62]">+ Aggiungi cliente in attesa</button>
      </section>
      <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !dirty} onClick={() => void save()} className="min-h-12 rounded-xl bg-[#963b62] px-6 text-sm font-bold text-white disabled:opacity-40">{busy ? "Salvataggio…" : "Salva agenda"}</button>{dirty && <button type="button" disabled={busy} onClick={() => { dirtyRef.current = false; setDirty(false); setNotes(report.notes); void refresh(); }} className="min-h-11 px-3 text-sm">Annulla modifiche e aggiorna</button>}<p role="status" className="text-sm text-emerald-800">{message}</p></div>
    </>}
  </section>;
}
