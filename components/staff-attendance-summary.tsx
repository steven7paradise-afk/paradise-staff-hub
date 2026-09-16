"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Download, Eye, Search, Clock3, ShieldCheck, UserX, Info } from "lucide-react";
import styles from "./staff-attendance-summary.module.css";
import type { StaffSummaryRow } from "@/lib/staff-attendance-summary";

const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))));
export function StaffAttendanceSummary({ rows, month, year, currentYear, label, generatedAt }: { rows: StaffSummaryRow[]; month: number; year: number; currentYear: number; label: string; generatedAt: string }) {
  const [search, setSearch] = useState(""); const [location, setLocation] = useState(""); const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const matched = rows.filter((row) => row.name.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it")) && (!location || row.location === location) && (status === "all" || row.active === (status === "active")));
  const filtered = matched.filter(row => view === "all" || (view === "late" ? row.late > 0 : view === "unjustified" ? row.unjustified > 0 : row.missing > 0)).sort((a,b) => b.lateMinutes - a.lateMinutes || b.unjustified - a.unjustified || b.missing - a.missing || a.name.localeCompare(b.name, "it"));
  const total = (field: "late" | "lateMinutes" | "unjustified" | "missing" | "sickness" | "holidays" | "other") => matched.reduce((sum,row) => sum + (row[field] || 0), 0);
  async function pdf(download: boolean) {
    const preview = download ? null : window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    setBusy(true); setError("");
    try {
      const { createStaffSummaryPdf } = await import("@/lib/staff-summary-pdf");
      const { loadStaffReportPhoto } = await import("@/lib/staff-report-photo");
      const photos = new Map<string, string | null>();
      for (let i = 0; i < filtered.length; i += 4) await Promise.all(filtered.slice(i, i + 4).map(async row => photos.set(row.id, await loadStaffReportPhoto(row))));
      const doc = createStaffSummaryPdf(filtered, label, `Sede: ${location || "Tutte"} | Stato: ${status === "all" ? "Tutti" : status === "active" ? "Attivi" : "Archiviati"} | Elenco: ${view === "all" ? "Tutti" : view === "late" ? "Ritardi" : view === "unjustified" ? "Senza giustifica" : "Timbrature mancanti"}${search ? ` | Ricerca: ${search}` : ""}`, generatedAt, photos);
      const missing = filtered.filter(row => row.photoUrl && !photos.get(row.id)).length;
      if (missing) setError(`${missing} foto non disponibili: nel PDF sono presenti le iniziali.`);
      if (download) doc.save(`riepilogo-staff-${year}-${String(month).padStart(2, "0")}.pdf`);
      else if (preview) {
        const url = URL.createObjectURL(doc.output("blob")); preview.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 300000);
      } else setError("Il browser ha bloccato l’anteprima. Consenti le finestre popup oppure usa Scarica PDF.");
    } catch { preview?.close(); setError("Non è stato possibile creare il PDF. Riprova."); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <div className={styles.heading}>
      <div><Link href="/staff" className={styles.back}><ArrowLeft size={15}/> Staff</Link><h1>Riepilogo presenze</h1><p className={styles.period}>{label}</p></div>
      <div className={styles.actions}><button aria-label="Anteprima PDF" className={styles.button} disabled={busy || !filtered.length} onClick={() => void pdf(false)}><Eye size={16}/><span>Anteprima</span></button><button className={`${styles.button} ${styles.primary}`} disabled={busy || !filtered.length} onClick={() => void pdf(true)}><Download size={16}/>{busy ? "Preparazione…" : "Scarica PDF"}</button></div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.filters} aria-label="Filtri del riepilogo">
      <form action="/staff/riepilogo" method="get" className={styles.dateForm} onSubmit={() => setBusy(true)}>
        <label>Mese<select name="month" defaultValue={month}>{months.map((name,index) => <option key={name} value={index+1}>{name}</option>)}</select></label>
        <label>Anno<input name="year" type="number" min={2000} max={currentYear+1} defaultValue={year} required/></label>
        <button className={styles.button} disabled={busy} type="submit">Applica</button>
      </form>
      <div className={styles.peopleFilters}>
        <label className={styles.search}><span className={styles.srOnly}>Dipendente</span><Search size={17}/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cerca lavoratore…"/></label>
        <label><span className={styles.srOnly}>Sede</span><select value={location} onChange={event=>setLocation(event.target.value)}><option value="">Tutte le sedi</option>{[...new Set(rows.map(row=>row.location))].sort().map(name=><option key={name}>{name}</option>)}</select></label>
        <label><span className={styles.srOnly}>Stato dipendente</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="active">Attivi</option><option value="archived">Archiviati</option><option value="all">Tutti</option></select></label>
      </div>
    </section>
    <div className={styles.stats}>
      {[
        {name:"Ritardi",value:total("late"),detail:`${total("lateMinutes")} min complessivi`,icon:Clock3,tone:"amber"},
        {name:"Senza giustifica",value:total("unjustified"),detail:"Giorni registrati",icon:UserX,tone:"red"},
        {name:"Giustificati",value:total("sickness")+total("holidays")+total("other"),detail:"Giorni autorizzati",icon:ShieldCheck,tone:"blue"},
        {name:"Mancate timbrature",value:total("missing"),detail:"Da verificare",icon:Info,tone:"neutral"},
      ].map(item=><div key={item.name} className={styles.stat}><span className={styles.statTitle}><item.icon size={16} data-tone={item.tone}/>{item.name}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}
    </div>
    <section className={styles.list} aria-label="Presenze dei lavoratori">
      <div className={styles.listBar}><div className={styles.tabs}>{[["all","Tutti"],["late","Ritardi"],["unjustified","Senza giustifica"],["missing","Timbrature"]].map(([value,name])=><button key={value} type="button" aria-pressed={view===value} className={view===value?styles.selected:""} onClick={()=>setView(value)}>{name}</button>)}</div><span className={styles.count}>{filtered.length} {filtered.length===1?"lavoratore":"lavoratori"}</span></div>
      <div className={styles.columns}><span>Lavoratore</span><span>Ritardi</span><span>Giustificati</span><span>Senza giustifica</span><span>Timbrature mancanti</span><span/></div>
      {!filtered.length ? <div className={styles.empty}><Search size={23}/><h2>Nessun lavoratore trovato</h2><p>Modifica la ricerca o i filtri.</p><button className={styles.button} onClick={()=>{setSearch("");setLocation("");setStatus("active");setView("all");}}>Azzera filtri</button></div> : filtered.map(row=><details key={row.id} className={styles.worker}>
        <summary className={styles.row}>
          <span className={styles.identity}>{row.photoUrl ? <img src={row.photoUrl} alt=""/> : <span className={styles.avatar}>{row.name.split(" ").slice(0,2).map(n=>n[0]).join("")}</span>}<span><strong>{row.name}</strong><small>{row.location}{!row.active?" · Archiviato":""}</small></span></span>
          <span className={styles.metric}><small>Ritardi</small><strong data-tone={row.late?"amber":undefined}>{row.late || "—"}</strong>{row.late>0&&<em>{row.lateMinutes} min</em>}</span>
          <span className={styles.metric}><small>Giustificati</small><strong>{row.sickness+row.holidays+row.other || "—"}</strong></span>
          <span className={styles.metric}><small>Senza giustifica</small><strong data-tone={row.unjustified?"red":undefined}>{row.unjustified || "—"}</strong></span>
          <span className={styles.metric}><small>Timbrature mancanti</small><strong>{row.missing || "—"}</strong></span>
          <ChevronDown size={17} className={styles.chevron}/>
        </summary>
        <div className={styles.detail}>
          <div className={styles.leaveSummary}>{[["Malattia",row.sickness],["Ferie",row.holidays],["Permessi",row.permits],["Riposi",row.rest],["Altre assenze",row.other],["In attesa",row.pending]].map(([name,value])=><span key={name}><small>{name}</small><strong>{value}</strong></span>)}</div>
          <h3>Eventi del mese <span>{row.events.length}</span></h3>
          {!row.events.length?<p className={styles.muted}>Nessun evento registrato.</p>:<ol className={styles.timeline}>{row.events.map((event,index)=><li key={`${event.date}:${index}`}><time dateTime={event.date}>{new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(`${event.date}T00:00:00Z`))}</time><div><strong>{event.label}</strong><small>{event.status}</small></div>{event.minutes>0&&<span className={styles.delay}>+{event.minutes} min</span>}</li>)}</ol>}
        </div>
      </details>)}
    </section>
    <details className={styles.help}><summary>Come vengono conteggiati i dati</summary><p>I ritardi sono calcolati oltre la tolleranza. Le mancate timbrature richiedono verifica e non sono assenze ingiustificate confermate. I giorni autorizzati includono malattia, ferie e altre assenze approvate, anche programmate nel mese. I permessi sono separati e possono essere parziali. Il PDF include i lavoratori dei filtri selezionati.</p></details>
  </div>;
}
