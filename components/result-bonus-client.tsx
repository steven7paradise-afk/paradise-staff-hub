"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  History,
  MessageSquareWarning,
  Minus,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import styles from "@/app/premio-risultato/premio-risultato.module.css";

type Level = "MASTER" | "AUTONOMA" | "JUNIOR";
type DayState = "CONFORMING" | "ZERO" | "NEUTRAL" | "PENDING" | "IN_PROGRESS" | "ADJUSTED";
type Person = {
  id: string;
  name: string;
  role: string;
  locationName: string;
  photoUrl: string | null;
  level: Level | null;
  levelLabel: string;
  days: Array<{ date: string; state: DayState; reasons: string[] }>;
  extras: Array<{ id: string; date: string; label: string; amount: number; source: string }>;
  appointmentsByDay: Record<string, number>;
  calculation: {
    cap: number;
    eligibleDays: number;
    conformingDays: number;
    zeroDays: number;
    neutralDays: number;
    pendingDays: number;
    dailyValue: number;
    dayAmount: number;
    dailyAmounts: Record<string, number>;
    dailyLosses: Record<string, number>;
    extraAmount: number;
    exactAmount: number;
    displayedAmount: number;
    progress: number;
  };
  disciplinaryLetter: boolean;
  timeline: Array<{ id: string; date: string; kind: string; label: string; detail: string; amount: number; contestable: boolean }>;
  disputes: Array<{ id: string; targetId: string; targetDate: string; reason: string; status: "OPEN" | "ACCEPTED" | "REJECTED"; createdAt: string; resolvedBy?: string }>;
  acknowledgement: { at: string; actorName: string } | null;
};
type Data = {
  month: string;
  monthLabel: string;
  today: string;
  finalized: boolean;
  revision: number;
  actor: { id: string; name: string; role: string };
  canManage: boolean;
  isDirection: boolean;
  people: Person[];
  allBuenosAiresStaff: Array<{ id: string; name: string; level: Level | null }>;
  eventTypes: Array<{ value: string; label: string; effect: string }>;
};

const money = (value: number, digits = 0) => value.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedMoney = (value: number, digits = 2) => `${value >= 0 ? "+" : ""}${money(value, digits)}`;
const fullDate = (date: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string) {
  const [year, value] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const first = new Date(Date.UTC(year, value - 1, 1)).getUTCDay();
  const leading = first === 0 ? 6 : first - 1;
  return [...Array.from({ length: leading }, () => null), ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
}

export function ResultBonusClient({ initialData, initialStaffId }: { initialData: Data; initialStaffId?: string }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(initialStaffId && initialData.people.some((person) => person.id === initialStaffId) ? initialStaffId : initialData.people[0]?.id ?? "");
  const [panel, setPanel] = useState<"EVENT" | "CONFIG" | "DISPUTE" | null>(null);
  const [target, setTarget] = useState<{ id: string; date: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = data.people.find((person) => person.id === selectedId) ?? data.people[0];
  const cells = useMemo(() => calendarCells(data.month), [data.month]);
  const dayMap = useMemo(() => new Map(selected?.days.map((day) => [day.date, day]) ?? []), [selected]);
  const visibleTimeline = useMemo(() => (selected?.timeline ?? [])
    .filter((item) => item.date.startsWith(`${data.month}-`) && item.date <= data.today)
    .sort((a, b) => a.date.localeCompare(b.date)), [selected, data.month, data.today]);
  const timelineDays = useMemo(() => cells
    .filter((date): date is string => date !== null && date <= data.today)
    .map((date) => ({ date, items: visibleTimeline.filter((item) => item.date === date) })), [cells, data.today, visibleTimeline]);

  const navigateMonth = (month: string) => startTransition(() => router.push(`/premio-risultato?month=${month}&staff=${encodeURIComponent(selectedId)}`));
  const selectPerson = (id: string) => {
    setSelectedId(id);
    router.replace(`/premio-risultato?month=${data.month}&staff=${encodeURIComponent(id)}`, { scroll: false });
  };
  const submit = async (body: Record<string, unknown>) => {
    setError(""); setMessage("");
    const response = await fetch("/api/result-bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, month: data.month, revision: data.revision }) });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Salvataggio non riuscito.");
    const refreshed = await fetch(`/api/result-bonus?month=${data.month}`, { cache: "no-store" });
    const next = await refreshed.json();
    if (!refreshed.ok) throw new Error(next.error || "Aggiornamento non riuscito.");
    setData(next);
    setMessage("Modifica salvata e conteggio aggiornato.");
    setPanel(null);
  };
  const run = (body: Record<string, unknown>) => startTransition(async () => {
    try { await submit(body); } catch (cause) { setError(cause instanceof Error ? cause.message : "Operazione non riuscita."); }
  });

  if (!selected) return <div className={styles.emptyState}><Users size={28} /><h2>Nessuna persona disponibile</h2><p>Nessun profilo attivo del salone Buenos Aires.</p></div>;
  const today = dayMap.get(data.today);

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div>
        <div className={styles.eyebrow}><Sparkles size={14} /> SALONE BUENOS AIRES</div>
        <h1>Premio di risultato</h1>
        <p>Giornate, dinamiche e premi individuali del mese.</p>
      </div>
      <div className={styles.headerActions}>
        {data.canManage && <button className={styles.secondaryButton} type="button" onClick={() => setPanel("EVENT")}><Plus size={17} /> Registra evento</button>}
        {data.isDirection && <button className={styles.secondaryButton} type="button" onClick={() => setPanel("CONFIG")}><Settings2 size={17} /> Configura livelli</button>}
        {data.isDirection && <Link href={`/premio-risultato/dinamiche?month=${data.month}`} className={styles.secondaryButton}><CircleDollarSign size={17} /> Dinamiche e premi</Link>}
        <div className={styles.monthControl}>
          <button type="button" aria-label="Mese precedente" onClick={() => navigateMonth(shiftMonth(data.month, -1))}><ChevronLeft size={18} /></button>
          <span><CalendarDays size={17} /> {data.monthLabel}</span>
          <button type="button" aria-label="Mese successivo" disabled={shiftMonth(data.month, 1) > data.today.slice(0, 7)} onClick={() => navigateMonth(shiftMonth(data.month, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>
    </header>

    {(message || error) && <div className={`${styles.feedback} ${error ? styles.feedbackError : ""}`}>{error || message}<button type="button" onClick={() => { setError(""); setMessage(""); }}><X size={15} /></button></div>}

    {data.people.length > 1 && <section className={styles.peopleSection} aria-label="Staff incluso nel premio">
      <div className={styles.sectionHeading}><div><span>TEAM PREMIO</span><h2>Tutto lo staff di Buenos Aires</h2></div><p>{data.people.length} profili attivi</p></div>
      <div className={styles.peopleRail}>{data.people.map((person) => <button key={person.id} type="button" onClick={() => selectPerson(person.id)} className={styles.person} aria-current={person.id === selected.id ? "page" : undefined}>
        <span className={styles.avatarRing}><span className={styles.avatarInitials}>{initials(person.name)}</span>{person.photoUrl && <span className={styles.avatarPhoto} style={{ backgroundImage: `url(${JSON.stringify(person.photoUrl)})` }} />}{person.id === selected.id && <i><Check size={12} strokeWidth={3} /></i>}</span>
        <strong>{person.name}</strong><small>{person.levelLabel}</small>
      </button>)}</div>
    </section>}

    <section className={styles.heroGrid}>
      <article className={styles.rewardCard}>
        {!selected.level ? <>
          <div className={styles.rewardTopline}><div><span>IL MIO CONTO</span><p>{selected.name}</p></div></div>
          <h2>Livello da assegnare</h2>
          <p>Assegna Master, Autonoma o Junior per calcolare il premio mensile.</p>
          {data.isDirection && <button type="button" className={styles.primaryButton} onClick={() => setPanel("CONFIG")}>Assegna livello</button>}
        </> : <>
        <div className={styles.rewardTopline}><div><span>IL MIO CONTO</span><p>{selected.name} · {selected.levelLabel}</p></div><span className={styles.levelBadge}>TETTO {money(selected.calculation.cap)}</span></div>
        <div className={styles.rewardAmount}><strong>{money(selected.calculation.displayedAmount, data.finalized ? 0 : 2)}</strong><span>maturati su {money(selected.calculation.cap)}</span></div>
        <div className={styles.progressTrack} aria-label={`${selected.calculation.progress}% del premio maturato`}><span style={{ width: `${selected.calculation.progress}%` }} /></div>
        <div className={styles.rewardFooter}>
          <div><span>Giornate conformi</span><strong>{selected.calculation.conformingDays} / {selected.calculation.eligibleDays}</strong></div>
          <div><span>Valore giornata</span><strong>{money(selected.calculation.dailyValue, 2)}</strong></div>
          <div><span>Dinamiche e premi</span><strong>{signedMoney(selected.calculation.extraAmount)}</strong></div>
          <div><span>Ancora maturabile</span><strong>{money(Math.max(0, selected.calculation.cap - selected.calculation.exactAmount))}</strong></div>
        </div>
        {selected.disciplinaryLetter && <div className={styles.monthZero}><AlertTriangle size={18} /><span><strong>Premio mensile azzerato</strong>È presente una lettera di contestazione formale nel mese.</span></div>}
        </>}
      </article>

      <article className={`${styles.todayCard} ${today?.state === "ZERO" ? styles.todayZero : today?.state === "NEUTRAL" ? styles.todayNeutral : ""}`}>
        <div className={styles.todayIcon}>{today?.state === "ZERO" ? <AlertTriangle /> : <ShieldCheck />}</div>
        <span>OGGI</span>
        <h2>{today?.state === "ZERO" ? "Giornata a 0 €" : today?.state === "ADJUSTED" ? "Giornata con segnalazioni" : today?.state === "NEUTRAL" ? "Giornata neutra" : today?.state === "PENDING" || !today ? "Nessun turno attivo" : today.state === "IN_PROGRESS" ? "Conforme, in corso" : "Giornata conforme"}</h2>
        <p>{today?.reasons.join(" · ") || "Riposo o nessun turno programmato."}</p>
        {selected.level && (today?.state === "CONFORMING" || today?.state === "IN_PROGRESS") && <strong>+{money(selected.calculation.dailyValue, 2)}</strong>}
      </article>
    </section>

    <section className={styles.metrics}>
      <div><span className={styles.metricIconGreen}><CheckCircle2 /></span><p>Conformi<strong>{selected.calculation.conformingDays}</strong></p></div>
      <div><span className={styles.metricIconAmber}><AlertTriangle /></span><p>A 0 €<strong>{selected.calculation.zeroDays}</strong></p></div>
      <div><span className={styles.metricIconGray}><Clock3 /></span><p>Neutre<strong>{selected.calculation.neutralDays}</strong></p></div>
      <div><span className={styles.metricIconPink}><CircleDollarSign /></span><p>Dinamiche e premi<strong>{selected.level ? signedMoney(selected.calculation.extraAmount) : "—"}</strong></p></div>
    </section>

    <section className={styles.contentGrid}>
      <article className={styles.calendarCard}>
        <div className={styles.sectionHeading}><div><span>CALENDARIO DEL MESE</span><h2>Ogni cifra è spiegabile</h2></div><div className={styles.legend}><span><i className={styles.validDot} /> Conforme</span><span><i className={styles.zeroDot} /> 0 €</span><span><i className={styles.restDot} /> Neutro</span><span><i className={styles.pendingDot} /> Programmato</span></div></div>
        <div className={styles.calendar}>{["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => <span className={styles.weekday} key={day}>{day}</span>)}{cells.map((date, index) => {
          if (!date) return <span className={styles.emptyDay} key={`empty-${index}`} />;
          const day = dayMap.get(date);
          const className = day?.state === "ZERO" || day?.state === "ADJUSTED" ? styles.zero : day?.state === "NEUTRAL" ? styles.rest : day?.state === "PENDING" ? styles.pending : day ? styles.valid : styles.off;
          return <div className={`${styles.day} ${className}`} key={date} title={day?.reasons.join(" · ") || "Riposo"}>
            <span>{Number(date.slice(-2))}</span>
            {day?.state === "ZERO" && <><AlertTriangle size={14} /><strong>0 €</strong></>}
            {day?.state === "ADJUSTED" && <><AlertTriangle size={14} /><strong>Vedi registro</strong></>}
            {(day?.state === "CONFORMING" || day?.state === "IN_PROGRESS") && <><Check size={14} /><strong>{selected.level ? `+${money(selected.calculation.dailyValue, 0)}` : "Conforme"}</strong></>}
            {day?.state === "NEUTRAL" && <small>Neutro</small>}
            {day?.state === "PENDING" && <small>Turno</small>}
            {!day && <small>Riposo</small>}
            {(selected.appointmentsByDay[date] ?? 0) > 0 && <em>{selected.appointmentsByDay[date]} app.</em>}
          </div>;
        })}</div>
      </article>

      <aside className={styles.summaryCard}>
        <div className={styles.sectionHeading}><div><span>CALCOLO</span><h2>Riepilogo trasparente</h2></div></div>
        {!selected.level ? <p>Il conteggio economico sarà disponibile dopo l’assegnazione del livello.</p> : <>
        <dl>
          <div><dt>Valore giornate</dt><dd>{money(selected.calculation.dayAmount, 2)}</dd></div>
          <div><dt>Dinamiche e premi</dt><dd>{signedMoney(selected.calculation.extraAmount)}</dd></div>
          <div><dt>Tetto {selected.levelLabel}</dt><dd>{money(selected.calculation.cap)}</dd></div>
          <div><dt>Totale {data.finalized ? "arrotondato" : "provvisorio"}</dt><dd className={styles.totalValue}>{money(selected.calculation.displayedAmount, data.finalized ? 0 : 2)}</dd></div>
        </dl>
        <div className={styles.notice}><FileCheck2 size={19} /><p><strong>{data.finalized ? "Mese concluso" : "Mese in corso"}</strong><br />{data.finalized ? "Il totale è arrotondato ai 10 € superiori ed è pronto per la presa visione." : "Il valore esatto si aggiorna in tempo reale. L’arrotondamento appare solo a fine mese."}</p></div>
        {data.finalized && selected.id === data.actor.id && !selected.acknowledgement && <button className={styles.primaryButton} disabled={pending} type="button" onClick={() => run({ action: "acknowledge", userId: selected.id })}><FileCheck2 size={17} /> Prendi visione</button>}
        {selected.acknowledgement && <div className={styles.acknowledged}><CheckCircle2 size={17} /> Presa visione {new Date(selected.acknowledgement.at).toLocaleDateString("it-IT")}</div>}
        </>}
      </aside>
    </section>

    <section className={styles.timelineCard}>
      <div className={styles.sectionHeading}><div><span>REGISTRO EVENTI</span><h2>Come si forma il totale</h2></div><p>{timelineDays.length} giornate · {data.month === data.today.slice(0, 7) ? "Dal 1° del mese a oggi" : "Mese completo"}</p></div>
      <div className={styles.dailyRegister}>{timelineDays.map((day) => <details className={styles.dayGroup} key={`${selected.id}:${day.date}`}>
        <summary className={styles.daySummary}>
          <span><strong>{new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))} · Giornata</strong><small>{day.items.length ? `${day.items.length} ${day.items.length === 1 ? "movimento" : "movimenti"} · Apri dettagli` : "Nessun movimento"}</small></span>
          <span className={styles.dayAmounts}>
            <strong title="Guadagno netto della giornata, entro il tetto mensile">{money(selected.calculation.dailyAmounts?.[day.date] ?? 0, 2)}</strong>
            <small>Guadagnati{day.date === data.today ? " · in corso" : ""}</small>
            <small className={(selected.calculation.dailyLosses?.[day.date] ?? 0) > 0 ? styles.dayLoss : undefined}>Persi {(selected.calculation.dailyLosses?.[day.date] ?? 0) > 0 ? "−" : ""}{money(selected.calculation.dailyLosses?.[day.date] ?? 0, 2)}</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        {day.items.length === 0 ? <p className={styles.noMovements}>Nessun movimento registrato per questa giornata.</p> : <div className={styles.timeline}>{day.items.map((item) => <div key={item.id}>
        <span className={item.amount < 0 ? styles.timelineNegative : item.amount > 0 ? styles.timelineValid : item.kind === "ZERO" || item.kind === "MONTH_ZERO" ? styles.timelineZero : styles.timelineNeutral}>{item.amount < 0 ? <Minus size={16} aria-label="Punti sottratti" /> : item.amount > 0 ? <Plus size={16} aria-label="Importo aggiunto" /> : item.kind === "ZERO" || item.kind === "MONTH_ZERO" ? <AlertTriangle size={16} /> : <Clock3 size={16} />}</span>
        <p><strong className={item.amount < 0 ? styles.negative : undefined}>{item.label}</strong><small>{item.detail}</small></p>
        <b className={item.amount < 0 ? styles.negative : item.amount > 0 ? styles.positive : undefined}>{item.amount !== 0 ? signedMoney(item.amount) : item.kind === "ZERO" || item.kind === "MONTH_ZERO" || item.kind === "BONUS" ? "0 €" : "—"}</b>
        {item.contestable && selected.id === data.actor.id && <button className={styles.contestButton} type="button" onClick={() => { setTarget({ id: item.id, date: item.date }); setPanel("DISPUTE"); }}><MessageSquareWarning size={14} /> Contesta</button>}
      </div>)}</div>}
      </details>)}</div>
    </section>

    {selected.disputes.length > 0 && <section className={styles.disputesCard}>
      <div className={styles.sectionHeading}><div><span>CONTESTAZIONI</span><h2>Richieste inviate</h2></div></div>
      {selected.disputes.map((item) => <div className={styles.disputeRow} key={item.id}><p><strong>{fullDate(item.targetDate)}</strong><span>{item.reason}</span></p><span className={styles[`status${item.status}`]}>{item.status === "OPEN" ? "In verifica" : item.status === "ACCEPTED" ? "Accolta" : "Respinta"}</span>{data.isDirection && item.status === "OPEN" && <div><button type="button" onClick={() => run({ action: "resolve-dispute", disputeId: item.id, status: "ACCEPTED" })}>Accogli</button><button type="button" onClick={() => run({ action: "resolve-dispute", disputeId: item.id, status: "REJECTED" })}>Respingi</button></div>}</div>)}
    </section>}

    <section className={styles.historyCard}>
      <div><History size={20} /><span><strong>Storico mensile</strong>Consulta i mesi precedenti senza modificare i dati.</span></div>
      <div>{[-1, -2, -3].map((offset) => { const month = shiftMonth(data.month, offset); return month >= "2026-09" && <button key={month} type="button" onClick={() => navigateMonth(month)}>{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}<ChevronRight size={15} /></button>; })}</div>
    </section>

    {panel && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setPanel(null); }}><div className={styles.drawer} role="dialog" aria-modal="true">
      <button className={styles.closeButton} type="button" aria-label="Chiudi" onClick={() => setPanel(null)}><X /></button>
      {panel === "EVENT" && <EventForm data={data} selected={selected} pending={pending} onSubmit={run} />}
      {panel === "CONFIG" && <ConfigForm data={data} selected={selected} pending={pending} onSubmit={run} />}
      {panel === "DISPUTE" && target && <DisputeForm selected={selected} target={target} pending={pending} onSubmit={run} />}
      {error && <p className={styles.formError}>{error}</p>}
    </div></div>}
  </main>;
}

function EventForm({ data, selected, pending, onSubmit }: { data: Data; selected: Person; pending: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ action: "event", userId: values.get("userId"), date: values.get("date"), type: values.get("type"), evidence: values.get("evidence") }); }}>
    <span className={styles.formEyebrow}>REGISTRO RESPONSABILE</span><h2>Registra un evento</h2><p>Non si sottraggono euro a mano: l’evento produce soltanto l’effetto previsto dalle regole.</p>
    <label>Persona<select name="userId" defaultValue={selected.id}>{data.people.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.levelLabel}</option>)}</select></label>
    <label>Data<input type="date" name="date" required min={`${data.month}-01`} max={new Date(Math.min(Date.now(), new Date(`${shiftMonth(data.month, 1)}-01`).getTime() - 86_400_000)).toISOString().slice(0, 10)} defaultValue={data.today.startsWith(data.month) ? data.today : `${data.month}-01`} /></label>
    <label>Tipo di evento<select name="type">{data.eventTypes.map((type) => <option value={type.value} key={type.value}>{type.label} · {type.effect}</option>)}</select></label>
    <label>Nota o prova<textarea name="evidence" required maxLength={1000} rows={5} placeholder="Descrivi il fatto in modo verificabile…" /></label>
    <button className={styles.primaryButton} disabled={pending} type="submit"><Plus size={17} /> {pending ? "Salvataggio…" : "Registra evento"}</button>
  </form>;
}

function ConfigForm({ data, selected, pending, onSubmit }: { data: Data; selected: Person; pending: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [userId, setUserId] = useState(selected.id);
  const [level, setLevel] = useState(selected.level ?? "");
  return <form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ action: "configure", userId: values.get("userId"), level: values.get("level") }); }}>
    <span className={styles.formEyebrow}>DIREZIONE</span><h2>Livelli e tetti</h2><p>La classificazione vale per il mese selezionato e resta tracciata. Master 500 €, Autonoma 300 €, Junior 200 €.</p>
    <label>Persona<select name="userId" value={userId} onChange={(event) => { setUserId(event.target.value); setLevel(data.people.find((person) => person.id === event.target.value)?.level ?? ""); }}>{data.people.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.levelLabel}</option>)}</select></label>
    <label>Nuovo livello<select name="level" value={level} onChange={(event) => setLevel(event.target.value)} required><option value="" disabled>Seleziona livello</option><option value="MASTER">Master · tetto 500 €</option><option value="AUTONOMA">Autonoma · tetto 300 €</option><option value="JUNIOR">Junior · tetto 200 €</option></select></label>
    <div className={styles.rulePreview}><ShieldCheck size={20} /><p><strong>Valore giornaliero del livello</strong>Usa la base impostata in Dinamiche e premi. In modalità automatica, il tetto viene diviso per le giornate lavorative effettive del mese. Ferie, permessi e malattia giustificata restano neutrali.</p></div>
    <button className={styles.primaryButton} disabled={pending} type="submit"><Settings2 size={17} /> {pending ? "Salvataggio…" : "Salva livello"}</button>
  </form>;
}

function DisputeForm({ selected, target, pending, onSubmit }: { selected: Person; target: { id: string; date: string }; pending: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); onSubmit({ action: "dispute", userId: selected.id, targetId: target.id, targetDate: target.date, reason: values.get("reason") }); }}>
    <span className={styles.formEyebrow}>ENTRO 3 GIORNI</span><h2>Contesta la rilevazione</h2><p>{selected.name} · {fullDate(target.date)}. La richiesta arriva alla direzione e non modifica automaticamente il conteggio.</p>
    <label>Motivo<textarea name="reason" required maxLength={1000} rows={6} placeholder="Spiega cosa deve essere verificato…" /></label>
    <button className={styles.primaryButton} disabled={pending} type="submit"><MessageSquareWarning size={17} /> {pending ? "Invio…" : "Invia contestazione"}</button>
  </form>;
}
