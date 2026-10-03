"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ArrowUpRight, CheckCheck, FileWarning, Users, Search, X, Download } from "lucide-react";
import { clientControlWorkerCounts, workerCalendarDays, type AnalyticsAbsence, type AnalyticsDelay, type AnalyticsStaff, type AnalyticsCategory, type AnalyticsRow } from "@/lib/client-control-analytics";
import styles from "./analytics.module.css";

const categories: { id: AnalyticsCategory; label: string }[] = [
  { id: "completed", label: "Completate con nota" }, { id: "missing", label: "Completate · nota mancante" },
  { id: "pending", label: "Da completare" }, { id: "cancelled", label: "Annullate / non presentate" }, { id: "inconsistent", label: "Da verificare" },
];
export function ClientControlAnalytics({ month, rows, warning, staff, delays, delayWarning, absences, absenceWarning }: { month: string; rows: AnalyticsRow[]; warning: string; staff: AnalyticsStaff[]; delays: AnalyticsDelay[]; delayWarning: string; absences: AnalyticsAbsence[]; absenceWarning: string }) {
  const router = useRouter();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const downloadMonthlyPdf = async () => {
    setPdfBusy(true); setPdfError("");
    try {
      const response = await fetch(`/api/client-control/monthly-pdf?month=${month}`);
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Download non riuscito."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = `report-personale-buenos-aires-${month}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setPdfError(error instanceof Error ? error.message : "Impossibile scaricare il PDF."); }
    finally { setPdfBusy(false); }
  };
  const minutesLabel = (value: number) => value < 60 ? `${value} min` : `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}`;
  const [calendarWorker, setCalendarWorker] = useState<AnalyticsStaff | null>(null);
  const [calendarDay, setCalendarDay] = useState("");
  const calendarRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLElement>(null);
  const [category, setCategory] = useState<AnalyticsCategory>("completed");
  const [salon, setSalon] = useState(""); const [worker, setWorker] = useState(""); const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AnalyticsRow | null>(null);
  const salons = [...new Set([...rows.map(r => r.salon), ...staff.filter(s => s.active).map(s => s.salon || "Sede non indicata")])].sort();
  const allWorkers = staff.filter(s => s.active === true && /buenos|corso/i.test(s.salon || "")).sort((a, b) => a.name.localeCompare(b.name));
  const filtered = useMemo(() => rows.filter(r => (!salon || r.salon === salon) && (!worker || r.primary?.id === worker || r.secondary.some(s => s.id === worker)) && (!search || `${r.client} ${r.order} ${r.primary?.name || ""}`.toLowerCase().includes(search.toLowerCase()))), [rows, salon, worker, search]);
  const workerTotals = clientControlWorkerCounts(filtered);
  const workers = allWorkers.filter(w => (!worker || worker === w.id) && (!salon || w.salon === salon || filtered.some(r => r.primary?.id === w.id || r.secondary.some(s => s.id === w.id)))).map(w => ({ ...w, primary: workerTotals.find(t => t.id === w.id)?.primary || 0, secondary: workerTotals.find(t => t.id === w.id)?.secondary || 0 }));
  const visibleAbsences = absences.filter(person => (!worker || person.id === worker) && (!salon || person.salon === salon));
  const visibleDelays = delays.filter(person => (!worker || person.id === worker) && (!salon || person.salon === salon));
  const calendarRows = rows.filter(r => !salon || r.salon === salon);
  const calendarDays = calendarWorker ? workerCalendarDays(month, calendarRows, calendarWorker.id) : [];
  const firstWeekday = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const selectWorkerCalendar = (w: AnalyticsStaff) => { setCalendarWorker(w); setCalendarDay(""); requestAnimationFrame(() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const totalPrimary = workerTotals.reduce((n, w) => n + w.primary, 0); const totalSecondary = workerTotals.reduce((n, w) => n + w.secondary, 0);
  const counts = Object.fromEntries(categories.map(c => [c.id, filtered.filter(r => r.category === c.id).length]));
  const visible = filtered.filter(r => r.category === category);
  const days = [...new Set(filtered.map(r => r.date))].sort().map(day => ({ day, count: filtered.filter(r => r.date === day && r.category === "completed").length }));
  const peak = Math.max(1, ...days.map(d => d.count));
  const completedRows = filtered.filter(r => r.category === "completed");
  const qualityMetrics = [
    { key: "before" as const, label: "Foto/video prima" },
    { key: "after" as const, label: "Foto/video dopo" },
    { key: "review" as const, label: "Recensione" },
  ].map(metric => ({ ...metric, count: completedRows.filter(r => r.checks[metric.key]).length }));
  const discoveryCounts = new Map<string, { label: string; count: number }>();
  for (const row of completedRows) {
    const key = row.discovery.toLocaleLowerCase("it");
    const item = discoveryCounts.get(key) || { label: row.discovery, count: 0 };
    item.count++; discoveryCounts.set(key, item);
  }
  const channels = [...discoveryCounts.values()].sort((a, b) => b.count - a.count);
  const percentage = (count: number) => completedRows.length ? `${Math.round(count / completedRows.length * 100)}%` : "—";
  const exportCsv = () => {
    const cells = (values: unknown[]) => values.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";");
    const text = [cells(["Data", "Cliente", "Stato", "Principale", "Nota principale", "Note secondarie", "Ordine", "Foto/video prima", "Foto/video dopo", "Recensione", "Come ci hai conosciuto", "Dettaglio canale", "Verifica"]), ...visible.map(r => cells([r.date, r.client, categories.find(c => c.id === r.category)?.label, r.primary?.name, r.primaryNote ? 1 : 0, r.secondaryNotes.map(s => s.name).join(", "), r.order, r.checks.before ? "Sì" : "Non segnato", r.checks.after ? "Sì" : "Non segnato", r.checks.review ? "Sì" : "Non segnato", r.discovery, r.discoveryDetail, r.reason]))].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `controllo-cliente-${month}-${category}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>QUALITÀ DEL SERVIZIO</span><h1>Controllo cliente</h1><p>Le schede, le note e il lavoro di ogni collaboratore.</p></div><div className={styles.headerActions}><button className={styles.pdfButton} disabled={pdfBusy} onClick={downloadMonthlyPdf}><Download size={16}/>{pdfBusy ? "Generazione PDF…" : "Scarica report PDF"}</button><Link className={styles.archive} href="/client-control?view=archive">Gestisci schede <ArrowUpRight size={16} /></Link></div></header>
    <p className={styles.reportHint}>Report mensile · Corso Buenos Aires · si aggiorna con il mese selezionato, indipendentemente dagli altri filtri.</p>
    {pdfError && <p role="alert" className={styles.warning}>{pdfError}</p>}
    {warning && <p role="status" className={styles.warning}>{warning}</p>}
    <div className={styles.filters}>
      <label>Mese<input aria-label="Mese analisi" type="month" value={month} onChange={e => e.target.value && router.push(`/client-control?month=${e.target.value}`)} /></label>
      <label>Salone<select value={salon} onChange={e => setSalon(e.target.value)}><option value="">Tutti i saloni</option>{salons.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Collaboratore<select value={worker} onChange={e => setWorker(e.target.value)}><option value="">Tutti i collaboratori</option>{allWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className={styles.search}>Cerca cliente o ordine<div><Search size={16}/><input aria-label="Cerca cliente o ordine" placeholder="Nome o numero ordine" value={search} onChange={e => setSearch(e.target.value)} /></div></label>
    </div>
    <div className={styles.filterSummary}><span>{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))} · {filtered.length} appuntamenti e schede</span>{(salon || worker || search) && <button onClick={() => { setSalon(""); setWorker(""); setSearch(""); }}>Azzera filtri <X size={13}/></button>}</div>
    <div className={styles.kpis}>
      <article><CheckCheck size={20}/><span>Schede completate con nota</span><strong>{counts.completed}</strong><small>Una sola scheda per appuntamento</small></article>
      <article><Users size={20}/><span>Note · principale</span><strong>{totalPrimary}</strong><small>Attribuite al collaboratore principale</small></article>
      <article><Users size={20}/><span>Note · secondario</span><strong>{totalSecondary}</strong><small>Solo collaboratori diversi dal principale</small></article>
      <button className={styles.alertCard} onClick={() => { setCategory("missing"); cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><FileWarning size={20}/><span>Completate senza nota</span><strong>{counts.missing}</strong><small>Apri le schede da controllare →</small></button>
    </div>
    <details className={styles.method}><summary>Come vengono conteggiate le note</summary><p className={styles.rule}>Chi svolge entrambi i servizi conta una sola volta come principale. Chi salva o conferma la scheda non riceve automaticamente il conteggio.</p></details>
    <div className={styles.analysis}>
      <div className={styles.analysisRight}>
      <section className={`${styles.panel} ${styles.workersPanel}`}><h2>Lavoratori attivi · Corso Buenos Aires</h2><p>Clicca un nome per aprire il calendario. I conteggi mostrano solo le note completate.</p><div className={styles.scroll}><table><thead><tr><th>Collaboratore</th><th>Principale</th><th>Secondario</th></tr></thead><tbody>{workers.map(w => <tr key={w.id}><td><button className={styles.workerButton} onClick={() => selectWorkerCalendar(w)}><span className={styles.staffAvatar}>{w.photoUrl ? <img src={w.photoUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} /> : null}<span aria-hidden="true">{w.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("")}</span></span><span>{w.name}</span> <ArrowUpRight size={13}/></button></td><td><b>{w.primary}</b></td><td>{w.secondary}</td></tr>)}</tbody></table></div>{!workers.length && <p>Nessun lavoratore attivo di Corso Buenos Aires corrisponde ai filtri selezionati.</p>}</section>

      </div>
      <div className={styles.analysisRight}>
      <section className={styles.panel}><h2>Andamento del mese</h2><p>Schede completate con nota, per giorno.</p><div className={styles.chart} aria-label="Schede completate per giorno">{days.map(d => <div key={d.day} title={`${d.day}: ${d.count} schede`}><b>{d.count || ""}</b><span style={{ height: `${Math.max(2, d.count / peak * 100)}px` }}/><small>{d.day.slice(-2)}</small></div>)}</div><p className={styles.rule}>Data dell’appuntamento; se non collegato, data di creazione della scheda. Le note storiche non separate sono attribuite solo al principale.</p></section>
    <section className={`${styles.panel} ${styles.qualityPanel}`}>
      <h2>Foto, recensioni e provenienza clienti</h2>
      <p>Su {completedRows.length} schede completate con nota, con i filtri selezionati. Ogni scheda conta una volta.</p>
      <div className={styles.qualityGrid}>{qualityMetrics.map(metric => <article key={metric.key}><span>{metric.label}</span><strong>{metric.count} <small>/ {completedRows.length}</small></strong><progress aria-label={metric.label} value={metric.count} max={Math.max(1, completedRows.length)} /><p>{percentage(metric.count)} segnato · {completedRows.length - metric.count} non segnato</p></article>)}</div>
      <h3>Come ci hanno conosciuto</h3>
      <div className={styles.channelList}>{channels.map(channel => <div key={channel.label}><span>{channel.label}</span><progress aria-label={channel.label} value={channel.count} max={Math.max(1, completedRows.length)} /><b>{channel.count}</b><small>{percentage(channel.count)}</small></div>)}</div>
      {!completedRows.length && <p>Nessuna scheda completata da analizzare nel periodo selezionato.</p>}
      <p className={styles.rule}>Foto e recensioni indicano quanto dichiarato nella scheda. “Non segnato” non significa necessariamente “non fatto”. I canali mancanti rimangono visibili come “Non indicato”.</p>
    </section>
      </div>
    </div>
    <section className={`${styles.panel} ${styles.absencesPanel}`}>
      <details className={styles.absenceDisclosure}><summary><h2>Assenze e giustificazioni del mese</h2><span>{absenceWarning ? "—" : `${visibleAbsences.length} richieste`}</span><ChevronDown size={18}/></summary><div className={styles.absenceContent}>
      <p>Personale attivo · Corso Buenos Aires · richieste registrate nel periodo selezionato.</p>
      {absenceWarning ? <p role="status" className={styles.warning}>{absenceWarning}</p> : <div className={styles.absenceColumns}>
        {[{ id: "approved", title: "Assenze approvate" }, { id: "unjustified", title: "Senza giustificazione / da giustificare" }].map(group => {
          const items = visibleAbsences.filter(a => group.id === "approved" ? a.category === "approved" : a.category === "unjustified");
          return <div key={group.id} className={group.id === "unjustified" ? styles.unjustified : undefined}><div className={styles.sectionHeader}><h3>{group.title}</h3><b>{items.length} richieste</b></div>{items.map(person => <div key={person.requestId} className={styles.absenceItem}><span className={styles.staffAvatar}>{person.photoUrl && <img src={person.photoUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }}/>}<span aria-hidden="true">{person.name.split(/\s+/).slice(0,2).map(n => n[0]).join("")}</span></span><div><b>{person.name}</b><p>{person.type} · {person.from.split("-").reverse().join("/")}{person.to !== person.from ? ` – ${person.to.split("-").reverse().join("/")}` : ""}</p><small>{person.time} · {person.label}</small></div></div>)}{!items.length && <p>Nessuna richiesta in questa categoria.</p>}</div>;
        })}
      </div>}
      {!absenceWarning && visibleAbsences.some(a => a.category === "pending") && <details className={styles.pendingAbsences}><summary>In attesa / da verificare · {visibleAbsences.filter(a => a.category === "pending").length} richieste</summary>{visibleAbsences.filter(a => a.category === "pending").map(person => <p key={person.requestId}><b>{person.name}</b> · {person.type} · {person.from.split("-").reverse().join("/")}{person.to !== person.from ? ` – ${person.to.split("-").reverse().join("/")}` : ""} · {person.time} · {person.label}</p>)}</details>}
      <p className={styles.rule}>Una richiesta può coprire più giorni; le date mostrate sono limitate al mese selezionato. Le timbrature mancanti in attesa di verifica non vengono classificate automaticamente come assenze ingiustificate. La ricerca cliente non modifica questa sezione.</p></div></details>
    </section>
      <section className={`${styles.panel} ${styles.delaysPanel}`}>
        <details className={styles.delayDisclosure}><summary><h2>Ritardi del mese</h2><span className={styles.delayTotal}>{delayWarning ? "—" : minutesLabel(visibleDelays.reduce((sum, person) => sum + person.totalMinutes, 0))}</span><ChevronDown size={18}/></summary><div className={styles.delayContent}>
        <p>Corso Buenos Aires · {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))}</p>
        {delayWarning ? <p role="status" className={styles.warning}>{delayWarning}</p> : visibleDelays.length ? <div className={styles.delayList}>{visibleDelays.map(person => <details key={person.id}><summary><span className={styles.delayPerson}><span className={styles.staffAvatar}>{person.photoUrl && <img src={person.photoUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }}/>}<span aria-hidden="true">{person.name.split(/\s+/).slice(0, 2).map(p => p[0]).join("")}</span></span><span><b>{person.name}</b><small>Ingresso {minutesLabel(person.entryMinutes)} · Pausa {minutesLabel(person.breakMinutes)}</small></span></span><strong>{minutesLabel(person.totalMinutes)}</strong></summary><div className={styles.delayDays}>{person.days.map(day => <div key={day.date}><b>{day.date.split("-").reverse().join("/")}</b><span>Ingresso: {minutesLabel(day.entryMinutes)}</span><span>Pausa: {minutesLabel(day.breakMinutes)}</span></div>)}</div></details>)}</div> : <p>Nessun ritardo registrato nel mese per i lavoratori selezionati.</p>}
        <p className={styles.rule}>Ritardi calcolati da turni e timbrature, con le tolleranze già previste dal sistema. Apri un nome per vedere le giornate. La ricerca cliente non modifica questo elenco.</p></div></details>
      </section>
    {calendarWorker && <section ref={calendarRef} className={`${styles.panel} ${styles.calendarPanel}`}>
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>CALENDARIO PERSONALE</span><h2>{calendarWorker.name} · {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))}</h2></div><button aria-label="Chiudi calendario" onClick={() => setCalendarWorker(null)}><X size={18}/></button></div>
      <p>Appuntamenti con nota principale completata. Le note secondarie sono indicate separatamente e non cambiano il colore.</p>
      <div className={styles.legend}><span data-tone="orange">Meno di 5</span><span data-tone="green">5 appuntamenti</span><span data-tone="red">Più di 5</span><span>Giorni futuri: neutri</span></div>
      <div className={styles.calendarGrid}>{["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => <div className={styles.weekday} key={d}>{d}</div>)}{Array.from({ length: firstWeekday }, (_, i) => <div key={`space-${i}`} />)}{calendarDays.map(d => <button key={d.date} data-tone={d.tone} aria-pressed={calendarDay === d.date} aria-label={`${d.date}: ${d.count} note principali, ${d.secondary} secondarie`} onClick={() => setCalendarDay(d.date)}><span>{Number(d.date.slice(-2))}</span><strong>{d.count}</strong><small>principali</small>{d.secondary > 0 && <small>+ {d.secondary} secondarie</small>}</button>)}</div>
      <p className={styles.rule}>I giorni a zero sono arancioni anche se non lavorativi: il colore indica soltanto il conteggio, non una valutazione di presenza o una penalità. Questo calendario non usa il filtro di ricerca del cliente.</p>
      {calendarDay && <div><h3>{calendarDay.split("-").reverse().join("/")} · Dettaglio note conteggiate</h3>{calendarRows.filter(r => r.date === calendarDay && ((r.primaryNote && r.primary?.id === calendarWorker.id) || r.secondaryNotes.some(s => s.id === calendarWorker.id))).map(r => <button className={styles.dayItem} key={r.id} onClick={() => setSelected(r)}>{r.client}<small>{r.primary?.id === calendarWorker.id ? "Principale" : "Secondario"}</small></button>)}{!calendarRows.some(r => r.date === calendarDay && ((r.primaryNote && r.primary?.id === calendarWorker.id) || r.secondaryNotes.some(s => s.id === calendarWorker.id))) && <p>Nessuna nota conteggiata in questa giornata.</p>}</div>}
    </section>}
    <section ref={cardsRef} className={`${styles.panel} ${styles.cardsPanel}`}><div className={styles.sectionHeader}><div><h2>Schede del periodo</h2><p>{visible.length} risultati · {categories.find(c => c.id === category)?.label}</p></div><button onClick={exportCsv}><Download size={15}/> Esporta elenco</button></div>
      <div className={styles.tabs} aria-label="Categorie schede">{categories.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}<b>{counts[c.id]}</b></button>)}</div>
      <div className={styles.scroll}><table><thead><tr><th>Cliente / data</th><th>Principale</th><th>Note secondarie</th><th>Servizi</th><th>Ordine</th><th/></tr></thead><tbody>{visible.map(r => <tr key={r.id}><td><b>{r.client}</b><small>{r.date.split("-").reverse().join("/")}{r.dateSource === "created" ? " · creazione scheda" : ""}</small></td><td>{r.primary?.name || "Non assegnato"}</td><td>{r.secondaryNotes.map(s => s.name).join(", ") || "—"}</td><td>{r.services.join(", ") || "—"}</td><td>{r.order ? `#${r.order.replace(/^#/, "")}` : "—"}</td><td><button aria-label={`Dettagli di ${r.client}`} onClick={() => setSelected(r)}>Dettagli <ArrowUpRight size={13}/></button></td></tr>)}</tbody></table></div>
      {!visible.length && <p className={styles.empty}>Nessuna scheda in questa categoria con i filtri selezionati.</p>}
    </section>
    {selected && <div className={styles.overlay} onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-label={`Scheda ${selected.client}`} className={styles.dialog} onClick={e => e.stopPropagation()}><div className={styles.sectionHeader}><h2>{selected.client}</h2><button autoFocus aria-label="Chiudi dettagli" onClick={() => setSelected(null)}><X size={20}/></button></div><p>{selected.reason}</p><p><b>Principale:</b> {selected.primary?.name || "Non assegnato"}<br/><b>Secondari conteggiati:</b> {selected.secondaryNotes.map(s => s.name).join(", ") || "Nessuno"}</p>{selected.duplicates > 0 && <p className={styles.warning}>{selected.duplicates} schede duplicate escluse dal conteggio. È stata preferita la scheda confermata.</p>}<h3>Nota salvata</h3><pre>{selected.note || "Nessun testo salvato."}</pre><h3>Come ci ha conosciuto</h3><p>{selected.discovery}{selected.discoveryDetail ? ` · ${selected.discoveryDetail}` : ""}</p><h3>Verifiche dichiarate</h3><p>Prima foto/video: {selected.checks.before ? "Sì" : "Non segnato"} · Dopo foto/video: {selected.checks.after ? "Sì" : "Non segnato"}<br/>Prodotti: {selected.checks.products ? "Sì" : "Non segnato"} · Recensione: {selected.checks.review ? "Sì" : "Non segnato"}</p><Link href={`/appointments?view=day&focus=${selected.date}&from=${selected.date}&to=${selected.date}`}>Apri agenda del giorno →</Link></section></div>}
  </div>;
}
