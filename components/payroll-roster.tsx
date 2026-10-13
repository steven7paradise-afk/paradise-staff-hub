"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Search, X } from "lucide-react";
import { buildPayrollRoster, type PayrollWorker } from "@/lib/payroll-roster";
import type { DocumentRecord } from "./documents-viewer";
import styles from "./payroll-roster.module.css";

const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const labels = { uploaded: "Caricato", missing: "Da caricare", review: "Da verificare" };

export function PayrollRoster({ workers, documents, month, year, onPeriodChange, onOpenWorker }: {
  workers: PayrollWorker[]; documents: DocumentRecord[]; month: number; year: number;
  onPeriodChange: (month: number, year: number) => void;
  onOpenWorker: (workerId: string, documentId?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [activity, setActivity] = useState("all");
  const roster = useMemo(() => buildPayrollRoster(workers, documents, month, year), [workers, documents, month, year]);
  const visible = roster.filter(worker => worker.name.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it"))
    && (status === "all" || worker.status === status)
    && (activity === "all" || (activity === "active" ? worker.active !== false : worker.active === false)));
  const years = Array.from(new Set([year, new Date().getFullYear(), ...documents.map(doc => doc.year).filter((value): value is number => value !== null)])).sort((a, b) => b - a);
  const moveMonth = (step: number) => {
    const next = new Date(year, month - 1 + step, 1);
    onPeriodChange(next.getMonth() + 1, next.getFullYear());
  };
  return <section className={styles.roster} aria-label="Cedolini di tutti i collaboratori">
    <header className={styles.header}>
      <div><h2>Il personale, tutto in un posto.</h2><p>Trova ogni collaboratore e controlla i documenti del mese.</p></div>
      <div className={styles.period}>
        <button type="button" aria-label="Mese precedente" onClick={() => moveMonth(-1)}><ArrowLeft size={18} /></button>
        <label><span>Mese del cedolino</span><select aria-label="Mese del cedolino" value={month} onChange={event => onPeriodChange(Number(event.target.value), year)}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
        <label><span>Anno</span><select aria-label="Anno del cedolino" value={year} onChange={event => onPeriodChange(month, Number(event.target.value))}>{years.map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="button" aria-label="Mese successivo" onClick={() => moveMonth(1)}><ArrowRight size={18} /></button>
      </div>
    </header>
    <div className={styles.tabs} aria-label="Filtra per stato del cedolino">
      {[{ key: "all", label: "Tutti", count: roster.length }, ...Object.entries(labels).map(([key, label]) => ({ key, label, count: roster.filter(worker => worker.status === key).length }))].map(item =>
        <button key={item.key} type="button" aria-pressed={status === item.key} onClick={() => setStatus(item.key)}>{item.label}<span>{item.count}</span></button>)}
    </div>
    <div className={styles.tools}>
      <label className={styles.search}><Search size={18}/><input type="search" aria-label="Cerca collaboratore" placeholder="Cerca un collaboratore…" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <select aria-label="Stato del collaboratore" value={activity} onChange={event => setActivity(event.target.value)}><option value="all">Attivi e non attivi</option><option value="active">Solo attivi</option><option value="inactive">Solo non attivi</option></select>
      <p role="status">{visible.length} di {roster.length} collaboratori</p>
    </div>
    <div className={styles.tableWrap}><table className={styles.table}>
      <caption className={styles.caption}>Cedolini di {months[month - 1].toLowerCase()} {year}</caption>
      <thead><tr><th>Collaboratore</th><th>Cedolino · {months[month - 1]} {year}</th><th>Caricato il</th><th>Archivio</th><th><span className={styles.srOnly}>Azioni</span></th></tr></thead>
      <tbody>{visible.map(worker => <tr key={worker.id}>
        <td><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{worker.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span><div><strong>{worker.name}</strong><small>{worker.mansione || "Collaboratore"}{worker.active === false ? " · Non attivo" : ""}</small></div></div></td>
        <td><span className={styles[worker.status]}>{labels[worker.status as keyof typeof labels]}</span>{worker.payslips.length > 1 && <small className={styles.duplicate}>{worker.payslips.length} documenti: verifica duplicati</small>}</td>
        <td data-label="Caricato il">{worker.payslips[0] ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(worker.payslips[0].created_at)) : "—"}</td>
        <td data-label="Archivio">{worker.filesCount} documenti</td>
        <td className={styles.actions}>{worker.payslips[0] && <button type="button" className={styles.primary} onClick={() => onOpenWorker(worker.id, worker.payslips[0].id)} aria-label={`Apri cedolino di ${worker.name}`}><FileText size={16}/>Cedolino</button>}<button type="button" onClick={() => onOpenWorker(worker.id)} aria-label={`Apri archivio di ${worker.name}`}>Archivio<ArrowRight size={16}/></button></td>
      </tr>)}</tbody>
    </table></div>
    {!visible.length && <div className={styles.empty}><Search size={26}/><h3>Nessun collaboratore trovato</h3><p>Prova un altro nome oppure rimuovi i filtri.</p><button type="button" onClick={() => {setSearch(""); setStatus("all"); setActivity("all");}}><X size={16}/>Azzera filtri</button></div>}
    <footer className={styles.footer}><strong>“Da verificare” non significa assente.</strong> Il collaboratore è sempre visibile: mancano un cedolino o i dati di contratto e presenza necessari per stabilire la consegna del mese.</footer>
  </section>;
}
