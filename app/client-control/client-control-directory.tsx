"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import type { AnalyticsCategory, AnalyticsRow } from "@/lib/client-control-analytics";
import { clientControlUrl } from "./client-control-navigation";
import { ClientRecordHistory, type HistorySource } from "./client-record-history";
import styles from "./client-control-directory.module.css";

const statusLabels: Record<AnalyticsCategory, string> = {
  completed: "Completata con nota",
  missing: "Nota mancante",
  pending: "Da completare",
  cancelled: "Annullata / non presentata",
  inconsistent: "Da verificare",
};

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" });
const pageSize = 25;

function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T12:00:00Z`));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it");
}

function orderLabel(order: string) {
  return order ? `#${order.replace(/^#/, "")}` : "—";
}

function Initials({ name }: { name: string }) {
  return <span className={styles.initials} aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("it")}</span>;
}

function Status({ category }: { category: AnalyticsCategory }) {
  return <span className={styles.status} data-category={category}>{statusLabels[category]}</span>;
}

const sections = [
  { id: "overview", label: "Panoramica" },
  { id: "appointments", label: "Appuntamenti" },
  { id: "payments", label: "Pagamenti Shopify" },
  { id: "notes", label: "Note servizio" },
  { id: "checks", label: "Verifiche" },
] as const;

function ClientRecord({ row, heading }: { row: AnalyticsRow; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("overview");
  const [openedHistories, setOpenedHistories] = useState<HistorySource[]>([]);
  const agendaParams = new URLSearchParams({ view: "day", focus: row.date, from: row.date, to: row.date });
  if (row.bookingId) agendaParams.set("booking", row.bookingId);
  const checks = [
    { label: "Foto o video prima", checked: row.checks.before },
    { label: "Foto o video dopo", checked: row.checks.after },
    { label: "Prodotti", checked: row.checks.products },
    { label: "Recensione", checked: row.checks.review },
  ];

  return <div className={styles.profile}>
    <aside className={styles.identity} aria-label="Riepilogo scheda">
      <Initials name={row.client} />
      <h1 ref={heading} tabIndex={-1}>{row.client}</h1>
      <Status category={row.category} />
      <dl className={styles.facts}>
        <div><dt>{row.dateSource === "appointment" ? "Data appuntamento" : "Data scheda"}</dt><dd>{formatDate(row.date)}</dd></div>
        <div><dt>Sede</dt><dd>{row.salon}</dd></div>
        <div><dt>Collaboratore principale</dt><dd>{row.primary?.name || "Non assegnato"}</dd></div>
        <div><dt>Ordine Shopify</dt><dd>{orderLabel(row.order)}</dd></div>
      </dl>
      <Link className={styles.button} href={`/appointments?${agendaParams.toString()}`} prefetch={false}>
        <CalendarDays size={16} /> {row.bookingId ? "Apri appuntamento" : "Apri agenda del giorno"} <ArrowUpRight size={15} />
      </Link>
    </aside>
    <div className={styles.history}>
      <nav className={styles.tabs} aria-label="Sezioni scheda">
        {sections.map(item => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => {
          setSection(item.id);
          const source = item.id;
          if (source === "appointments" || source === "payments") {
            setOpenedHistories(previous => previous.includes(source) ? previous : [...previous, source]);
          }
        }}>{item.label}</button>)}
      </nav>
      <section className={styles.recordContent} aria-labelledby="client-record-section">
        <h2 id="client-record-section">{sections.find(item => item.id === section)?.label}</h2>
        {section === "overview" && <>
          <p className={styles.muted}>{row.reason}</p>
          <dl className={styles.overview}>
            <div><dt>Servizi registrati</dt><dd>{row.services.join(", ") || "Non indicati"}</dd></div>
            <div><dt>Note secondarie di</dt><dd>{row.secondaryNotes.map(person => person.name).join(", ") || "Nessuna nota secondaria"}</dd></div>
            <div><dt>Come ci ha conosciuto</dt><dd>{row.discovery}{row.discoveryDetail && ` · ${row.discoveryDetail}`}</dd></div>
          </dl>
          {row.duplicates > 0 && <p className={styles.notice}>Altre schede collegate allo stesso appuntamento escluse dal conteggio: {row.duplicates}.</p>}
        </>}
        {section === "notes" && <div className={styles.note}>
          {row.note ? <p>{row.note}</p> : <p className={styles.muted}>Nessun testo salvato nella nota.</p>}
        </div>}
        {section === "checks" && <ul className={styles.checks}>
          {checks.map(item => <li key={item.label}><span>{item.label}</span><strong data-checked={item.checked}>{item.checked && <Check size={15} aria-hidden="true" />}{item.checked ? "Segnato" : "Non segnato"}</strong></li>)}
        </ul>}
        {openedHistories.map(source => <div key={source} hidden={section !== source}>
          <ClientRecordHistory bookingId={row.bookingId} source={source} />
        </div>)}
      </section>
    </div>
  </div>;
}

export function ClientControlDirectory({ month, rows, warning }: { month: string; rows: AnalyticsRow[]; warning: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams.get("id");
  const record = recordId ? rows.find(row => row.id === recordId) : undefined;
  const heading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<{ id: string; y: number }>(null);
  const [search, setSearch] = useState("");
  const [salon, setSalon] = useState("");
  const [category, setCategory] = useState<AnalyticsCategory | "">("");
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const salons = useMemo(() => [...new Set(rows.map(row => row.salon))].sort((a, b) => a.localeCompare(b, "it")), [rows]);
  const filtered = useMemo(() => {
    const query = normalize(search.trim().replace(/^#/, "")).split(/\s+/).filter(Boolean);
    const matching = rows.filter(row => {
      if ((salon && row.salon !== salon) || (category && row.category !== category)) return false;
      if (!query.length) return true;
      const haystack = normalize([row.client, row.order, row.primary?.name, ...row.services].join(" "));
      return query.every(term => haystack.includes(term));
    });
    return sort === "name" ? matching.sort((a, b) => a.client.localeCompare(b.client, "it")) : matching;
  }, [rows, search, salon, category, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const visibleRows = filtered.slice(offset, offset + pageSize);
  const activeFilters = Boolean(search || category || salon || sort !== "date");

  useEffect(() => {
    if (recordId) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    } else if (returnTo.current) {
      document.getElementById(`client-record-${returnTo.current.id}`)?.focus({ preventScroll: true });
      window.scrollTo({ top: returnTo.current.y });
    }
  }, [recordId]);

  const listUrl = clientControlUrl(month);
  const resetFilters = () => {
    setSearch("");
    setSalon("");
    setCategory("");
    setSort("date");
    setPage(1);
  };

  return <div className={styles.page}>
    {recordId ? <>
      <Link className={styles.back} href={listUrl} onNavigate={event => {
        event.preventDefault();
        if (returnTo.current?.id === recordId) window.history.back();
        else window.history.replaceState(null, "", listUrl);
      }}><ArrowLeft size={17} /> Tutte le schede</Link>
      {record
        ? <ClientRecord key={record.id} row={record} heading={heading} />
        : <div className={styles.empty}><h1 ref={heading} tabIndex={-1}>Scheda non trovata</h1><p>Controlla il mese o torna all’elenco delle schede.</p></div>}
    </> : <>
      <header className={styles.header}>
        <div><h1>Controllo clienti</h1><p>Schede servizio, note e verifiche del salone.</p></div>
        <div className={styles.actions}>
          <Link className={styles.button} href={clientControlUrl(month, { view: "analytics" })} prefetch={false}>Analisi e report</Link>
          <Link className={styles.primary} href="/client-control?view=archive" prefetch={false}>Gestisci schede <ArrowUpRight size={16} /></Link>
        </div>
      </header>

      <section className={styles.directory} aria-label="Elenco schede cliente">
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" /><span className="sr-only">Cerca nelle schede</span>
            <input type="search" placeholder="Cerca cliente o numero d’ordine" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <label className={styles.month}><span className="sr-only">Mese delle schede</span>
            <input aria-label="Mese delle schede" type="month" value={month} onChange={event => {
              if (event.target.value) router.push(clientControlUrl(event.target.value));
            }} />
          </label>
          <button type="button" className={styles.filterButton} aria-expanded={filtersOpen} aria-controls="client-control-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={16} /> Filtri avanzati
          </button>
          <div id="client-control-filters" className={styles.filterFields} hidden={!filtersOpen}>
              <label>Sede<select value={salon} onChange={event => { setSalon(event.target.value); setPage(1); }}>
                <option value="">Tutte le sedi</option>{salons.map(name => <option key={name}>{name}</option>)}
              </select></label>
              <label>Stato<select value={category} onChange={event => { setCategory(event.target.value as AnalyticsCategory | ""); setPage(1); }}>
                <option value="">Tutti gli stati</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              <label>Ordina per<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
                <option value="date">Data più recente</option><option value="name">Nome cliente A–Z</option>
              </select></label>
          </div>
        </div>
        <div className={styles.summary}>
          <p aria-live="polite">{filtered.length === 1 ? "1 scheda" : `${filtered.length} schede`}</p>
          {activeFilters && <button type="button" className={styles.textButton} onClick={resetFilters}>Azzera filtri</button>}
        </div>
        {warning && <p className={styles.notice} role="status">{warning}</p>}
        {visibleRows.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th scope="col">Cliente</th><th scope="col">Data</th><th scope="col">Collaboratore</th><th scope="col">Servizi</th><th scope="col">Ordine</th><th scope="col">Stato</th></tr></thead>
          <tbody>{visibleRows.map(row => {
            const href = clientControlUrl(month, { id: row.id });
            return <tr key={row.id}>
              <td><Link id={`client-record-${row.id}`} className={styles.person} href={href} prefetch={false} onNavigate={event => {
                event.preventDefault();
                returnTo.current = { id: row.id, y: window.scrollY };
                window.history.pushState(null, "", href);
              }}><Initials name={row.client} /><span><strong>{row.client}</strong><small>{row.salon}<span className={styles.mobileDate}> · {formatDate(row.date)}</span></small></span><ArrowRight className={styles.rowArrow} size={15} aria-hidden="true" /></Link></td>
              <td>{formatDate(row.date)}</td>
              <td>{row.primary?.name || "Non assegnato"}</td>
              <td>{row.services.join(", ") || "—"}</td>
              <td>{orderLabel(row.order)}</td>
              <td><Status category={row.category} /></td>
            </tr>;
          })}</tbody>
        </table></div> : <div className={styles.empty}>
          <h2>{activeFilters ? "Nessuna scheda trovata" : "Nessuna scheda per questo mese"}</h2>
          <p>{activeFilters ? "Prova un altro nome o azzera i filtri." : "Seleziona un altro mese per consultare l’archivio."}</p>
        </div>}
        {totalPages > 1 && <div className={styles.pagination} aria-label="Paginazione schede">
          <span aria-live="polite">{offset + 1}–{offset + visibleRows.length} di {filtered.length}</span>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Pagina precedente"><ChevronLeft size={18} /></button>
          <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Pagina successiva"><ChevronRight size={18} /></button>
        </div>}
      </section>
    </>}
  </div>;
}
