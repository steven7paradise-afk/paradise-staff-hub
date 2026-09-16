"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search, ShieldCheck, UserX, X } from "lucide-react";
import "./daily-register.css";
export type RegisterRow = { id: string; name: string; photoUrl: string | null; location: string; shift: string; entry: string; exit: string; pause: string; lateMinutes: number; status: "ON_TIME" | "LATE" | "JUSTIFIED" | "ABSENT" | "WAITING" | "REST" | "UNPLANNED"; detail: string };
type Filter = "ALL" | "LATE" | "ABSENT" | "ON_TIME" | "JUSTIFIED" | "WAITING";
const states = {
  LATE: { label: "In ritardo", color: "bg-amber-50 text-amber-800", icon: Clock3 },
  ABSENT: { label: "Senza giustifica", color: "bg-red-50 text-red-800", icon: UserX },
  ON_TIME: { label: "Puntuali", color: "bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  JUSTIFIED: { label: "Giustificati", color: "bg-blue-50 text-blue-800", icon: ShieldCheck },
  WAITING: { label: "In attesa", color: "bg-slate-100 text-slate-600", icon: Clock3 },
  REST: { label: "Riposo", color: "bg-slate-100 text-slate-600", icon: Clock3 },
  UNPLANNED: { label: "Orario non disponibile", color: "bg-slate-100 text-slate-600", icon: Clock3 },
};
const summary = ["LATE", "ABSENT", "ON_TIME", "JUSTIFIED"] as const;
const filters: Filter[] = ["ALL", ...summary, "WAITING"];
function Photo({ row }: { row: RegisterRow }) {
  const [failed, setFailed] = useState(false);
  return row.photoUrl && !failed ? <img src={row.photoUrl} alt="" onError={() => setFailed(true)} className="register-photo" /> : <span aria-hidden="true" className="register-photo grid place-items-center bg-slate-100 text-xs font-semibold">{row.name.split(" ").map(p=>p[0]).slice(0,2).join("")}</span>;
}
function Badge({ row }: { row: RegisterRow }) {
  const label = row.status === "LATE" ? `In ritardo · +${row.lateMinutes} min` : row.status === "ON_TIME" ? "Puntuale" : row.status === "JUSTIFIED" ? "Giustificato" : states[row.status].label;
  return <span className={`register-badge ${states[row.status].color}`}>{label}</span>;
}
export function DailyRegister({ date, rows, updatedAt }: { date: string; rows: RegisterRow[]; updatedAt: string }) {
  const router = useRouter();
  const [pending, transition] = useTransition();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const working = rows.filter(r=>r.status !== "REST");
  const locations = [...new Set(working.map(r=>r.location))].sort();
  const scoped = working.filter(r=>!location || r.location===location);
  const count = (key: Filter) => key === "ALL" ? scoped.length : scoped.filter(r=>r.status===key).length;
  const visible = scoped.filter(r=>(filter==="ALL" || r.status===filter) && `${r.name} ${r.location}`.toLocaleLowerCase("it").includes(query.trim().toLocaleLowerCase("it"))).sort((a,b)=>Number(b.status==="LATE")-Number(a.status==="LATE") || Number(b.status==="ABSENT")-Number(a.status==="ABSENT") || b.lateMinutes-a.lateMinutes || a.name.localeCompare(b.name,"it"));
  const activeFilters = filter !== "ALL" || Boolean(query || location);
  function reset() { setFilter("ALL"); setQuery(""); setLocation(""); }
  function navigate(day: string) { if(day) transition(()=>router.push(`/registro-giornaliero?date=${day}`)); }
  function move(offset: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+offset); navigate(next.toISOString().slice(0,10)); }
  return <div className="daily-register mx-auto max-w-[1440px] text-slate-900" aria-busy={pending}>
    <header className="register-header"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#b53b74]">Presenze del personale</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Registro giornaliero</h1></div><div className="register-date-controls">
      <button disabled={pending} onClick={()=>move(-1)} aria-label="Giorno precedente" className="register-icon-button"><ChevronLeft className="size-4"/></button>
      <label className="sr-only" htmlFor="register-day">Data del registro</label><input id="register-day" type="date" value={date} disabled={pending} onChange={e=>navigate(e.target.value)} className="register-date"/>
      <button disabled={pending} onClick={()=>move(1)} aria-label="Giorno successivo" className="register-icon-button"><ChevronRight className="size-4"/></button>
      <button disabled={pending} onClick={()=>transition(()=>router.push("/registro-giornaliero"))} className="register-today">Oggi</button>
      <button disabled={pending} onClick={()=>transition(()=>router.refresh())} aria-label="Aggiorna registro" className="register-icon-button"><RefreshCw className={`size-4 ${pending?"animate-spin motion-reduce:animate-none":""}`}/></button>
    </div></header>
    <div className="register-context"><p className="capitalize">{new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Rome"}).format(new Date(`${date}T12:00:00Z`))}</p><p role="status">{pending?"Aggiornamento in corso…":`Aggiornato alle ${new Intl.DateTimeFormat("it-IT",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Rome"}).format(new Date(updatedAt))} · riposi esclusi`}</p></div>
    <div className="register-summary">{summary.map(key=>{const state=states[key];const Icon=state.icon;return <button key={key} onClick={()=>setFilter(filter===key?"ALL":key)} aria-pressed={filter===key} className={`register-summary-button ${filter===key?"is-selected":""}`}><span className={`register-summary-icon ${state.color}`}><Icon className="size-4"/></span><span className="register-summary-label">{state.label}</span><strong className="register-summary-count">{count(key)}</strong><span className="register-summary-detail">{key==="LATE"?`${scoped.filter(r=>r.status===key).reduce((sum,r)=>sum+r.lateMinutes,0)} min complessivi`:"Lavoratori"}</span></button>;})}</div>
    <section className="register-workbench" aria-label="Elenco delle presenze"><div className="register-filters"><div className="register-tabs" role="group" aria-label="Filtra per stato">{filters.map(key=><button key={key} onClick={()=>setFilter(key)} aria-pressed={filter===key} className={`register-tab ${filter===key?"is-selected":""}`}>{key==="ALL"?"Tutti":states[key].label}<span>{count(key)}</span></button>)}</div><div className="register-search-tools"><label className="sr-only" htmlFor="register-location">Filtra per sede</label><select id="register-location" value={location} onChange={e=>setLocation(e.target.value)}><option value="">Tutte le sedi</option>{locations.map(l=><option key={l}>{l}</option>)}</select><div className="register-search"><Search className="size-4 shrink-0 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca lavoratore…" aria-label="Cerca lavoratore"/>{query&&<button onClick={()=>setQuery("")} aria-label="Cancella ricerca" className="grid size-9 shrink-0 place-items-center"><X className="size-4"/></button>}</div></div></div>
      <div className="register-results"><p aria-live="polite">{visible.length} di {working.length} lavoratori · {filter==="ALL"?"ritardi per primi":states[filter].label.toLowerCase()}</p>{activeFilters&&<button onClick={reset}>Azzera filtri</button>}</div>
      {!visible.length?<div className="register-empty"><h2 className="font-semibold">{working.length?"Nessun risultato":"Nessuna presenza da mostrare"}</h2><p className="mt-2 text-sm text-slate-500">{activeFilters?"Prova un altro nome oppure rimuovi i filtri.":"Controlla un’altra giornata. I lavoratori di riposo sono esclusi."}</p>{activeFilters&&<button onClick={reset} className="mt-4 min-h-11 rounded-lg border border-slate-200 px-4 text-sm">Mostra tutti</button>}</div>:<>
        <div className="register-mobile-list">{visible.map(r=><article key={r.id} className={`register-mobile-row ${r.status==="LATE"?"is-late":""}`}><div className="register-worker"><Photo row={r}/><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{r.name}</h2><p className="mt-1 text-xs text-slate-500">{r.location}</p></div></div><div className="mt-3"><Badge row={r}/></div><dl className="register-clock-grid">{[["Turno",r.shift],["Entrata",r.entry],["Uscita",r.exit]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><dl className="mb-3 text-xs"><dt className="text-slate-500">Pausa e rientro</dt><dd className="mt-1 whitespace-pre-line font-medium tabular-nums">{r.pause}</dd></dl><p className="text-xs leading-5 text-slate-500">{r.detail}</p></article>)}</div>
        <div className="register-table-wrap"><table className="register-table"><thead><tr>{["Lavoratore","Sede","Turno previsto","Entrata","Pausa / Rientro","Uscita","Stato"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id} className={r.status==="LATE"?"is-late":""}><td><div className="register-worker"><Photo row={r}/><span className="font-medium">{r.name}</span></div></td><td className="text-slate-500">{r.location}</td><td className="tabular-nums">{r.shift}</td><td className="font-medium tabular-nums">{r.entry}</td><td className="whitespace-pre-line text-xs leading-5 tabular-nums">{r.pause}</td><td className="tabular-nums">{r.exit}</td><td><Badge row={r}/><p className="mt-1.5 max-w-64 text-xs leading-5 text-slate-500">{r.detail}</p></td></tr>)}</tbody></table></div>
      </>}
    </section>
    <details className="register-help"><summary>Come vengono calcolati gli stati?</summary><p>I ritardi rispettano la tolleranza prevista. Le assenze senza giustifica indicano un turno iniziato senza entrata né assenza approvata registrata: non sono una valutazione disciplinare. I permessi parziali e gli orari mancanti richiedono un controllo.</p></details>
  </div>;
}
