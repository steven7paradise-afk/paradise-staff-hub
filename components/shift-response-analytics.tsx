"use client";
import { StaffIdentity } from "@/components/shift-staff-identity";
import { shiftAnswerDistribution } from "@/lib/shift-response-analytics";
import type { ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";

type Row = { day: string; values: Record<string, string>; state: string; assigned?: { id: string; name: string }; progress: { percent: number } };
export function ShiftResponseAnalytics({ rows, today, questions, onDay }: { rows: Row[]; today: string; questions: ShiftResponsibleQuestion[]; onDay: (day: string) => void }) {
  const due = rows.filter(row => row.day <= today);
  const complete = due.filter(row => row.state === "Completato").length;
  const people = [...new Set(due.map(row => row.assigned?.id || "unassigned"))].map(id => {
    const turns = due.filter(row => (row.assigned?.id || "unassigned") === id);
    return { id, name: turns[0].assigned?.name || "Non assegnato", total: turns.length, completed: turns.filter(row => row.state === "Completato").length };
  }).sort((a, b) => b.completed - a.completed);
  return <section className="space-y-5" aria-label="Analisi delle risposte">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Turni fino a oggi", value: due.length, note: "Giornate del periodo selezionato" }, { label: "Completati", value: complete, note: `${due.length ? Math.round(complete / due.length * 100) : 0}% dei turni fino a oggi` }, { label: "Da completare", value: due.length - complete, note: "Include i turni di oggi ancora aperti" }, { label: "Programmati", value: rows.length - due.length, note: "Turni futuri, esclusi dal completamento" }].map(card => <div key={card.label} className="rounded-2xl border border-black/5 bg-white p-5"><p className="text-xs font-semibold text-neutral-500">{card.label}</p><p className="mt-2 text-3xl font-bold text-[#99345F]">{card.value}</p><p className="mt-2 text-xs text-neutral-500">{card.note}</p></div>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-black/5 bg-white p-5"><h3 className="text-lg font-bold">Andamento del mese</h3><p className="mt-1 text-xs text-neutral-500">Ogni riquadro è un turno. Clicca per leggere le risposte.</p><div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{rows.slice().reverse().map(row => <button key={row.day} onClick={() => onDay(row.day)} title={`${row.day} · ${row.state}`} className={`rounded-xl border p-2 text-center ${row.state === "Completato" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : row.state === "Programmato" ? "border-neutral-200 bg-neutral-50 text-neutral-600" : "border-amber-200 bg-amber-50 text-amber-900"}`}><span className="block font-bold">{row.day.slice(8)}</span><span className="block text-[10px]">{row.state === "Programmato" ? "Previsto" : `${row.progress.percent}%`}</span></button>)}</div>{!rows.length && <p className="mt-4 text-sm text-neutral-500">Nessun turno nel mese selezionato.</p>}<p className="mt-3 text-xs text-neutral-500">Verde: completato · Ambra: da completare · Grigio: futuro</p></section>
      <section className="rounded-2xl border border-black/5 bg-white p-5"><h3 className="text-lg font-bold">Per responsabile assegnato</h3><p className="mt-1 text-xs text-neutral-500">Completamento dei turni assegnati, non valutazione delle persone.</p><div className="mt-4 space-y-4">{people.map(person => <div key={person.id}><div className="flex justify-between gap-3 text-sm"><StaffIdentity name={person.name} /><span>{person.completed}/{person.total} completi</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-pink-50"><div className="h-full rounded-full bg-[#b74779]" style={{ width: `${person.completed / person.total * 100}%` }} /></div><p className="mt-1 text-xs text-neutral-500">{person.total - person.completed} da completare</p></div>)}</div></section>
    </div>
    <section className="rounded-2xl border border-black/5 bg-white p-5"><h3 className="text-lg font-bold">Cosa emerge dalle risposte</h3><p className="mt-1 text-xs text-neutral-500">Percentuali sulle giornate che hanno risposto alla domanda. Le risposte mancanti sono indicate separatamente. “No” non significa automaticamente un problema.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{questions.map(question => {
      const result = shiftAnswerDistribution(question, due.map(row => row.values));
      return <article key={question.id} className="rounded-xl border border-neutral-100 p-4"><h4 className="text-sm font-semibold">{question.title}</h4><p className="mt-1 text-xs text-neutral-500">{result.answered}/{result.total} giornate con risposta · {result.missing} senza risposta</p><div className="mt-3 space-y-2">{result.options.map(option => <div key={option.label}><div className="flex justify-between gap-3 text-xs"><span className="break-words">{option.label}</span><span className="shrink-0">{option.count} · {option.percent}%</span></div><div className="mt-1 h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-[#b74779]" style={{width: `${option.percent}%`}} /></div></div>)}</div>{!result.options.length && <p className="mt-3 text-xs text-neutral-500">{result.answered ? "Risposte di dettaglio: apri una giornata per leggere note e segnalazioni." : "Nessuna risposta disponibile."}</p>}</article>;
    })}</div></section>
  </section>;
}
