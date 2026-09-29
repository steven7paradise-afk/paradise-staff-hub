"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Gift, Save } from "lucide-react";
import { RESULT_BONUS_DYNAMICS, RESULT_BONUS_LEVELS, RESULT_BONUS_START_MONTH, parseResultBonusDailyValues, resultBonusRuleLabel, type ResultBonusDailyValues, type ResultBonusLevel, type ResultBonusDynamic, type ResultBonusRule, type ResultBonusRules } from "@/lib/result-bonus";
import styles from "@/app/premio-risultato/dinamiche/dinamiche.module.css";

type Award = { id: string; name: string; amount: number; evidence: string; date: string };
type Props = {
  month: string; revision: number; initialRules: ResultBonusRules;
  initialDailyValues: ResultBonusDailyValues;
  people: Array<{ id: string; name: string; configured: boolean }>;
  lastUpdate: { at: string; actorName: string } | null;
  awards: Award[];
  today: string;
};
const euro = (value: number) => value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function ResultBonusSettings(props: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(props.initialRules);
  const [saved, setSaved] = useState(props.initialRules);
  const [dailyValues, setDailyValues] = useState(props.initialDailyValues);
  const [savedDailyValues, setSavedDailyValues] = useState(props.initialDailyValues);
  const [revision, setRevision] = useState(props.revision);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [awards, setAwards] = useState(props.awards);
  const [userId, setUserId] = useState(props.people.find((person) => person.configured)?.id ?? "");
  const [awardAmount, setAwardAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const [date, setDate] = useState(props.today.startsWith(props.month) ? props.today : `${props.month}-01`);
  const requestId = useRef<string | null>(null);
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved) || JSON.stringify(dailyValues) !== JSON.stringify(savedDailyValues) || Object.values(dailyValues).some(Number.isNaN);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${props.month}-01T00:00:00Z`));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const updateRule = (key: ResultBonusDynamic, change: Partial<ResultBonusRule>) => { setRules((old) => ({ ...old, [key]: { ...old[key], ...change } })); setConfirm(false); setMessage(""); };
  const updateDailyValue = (level: ResultBonusLevel, amount: number | null) => { setDailyValues((old) => ({ ...old, [level]: amount })); setConfirm(false); setMessage(""); };
  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/result-bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, month: props.month, revision }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Salvataggio non riuscito. Riprova.");
    setRevision(result.revision);
    return result;
  }
  async function saveRules() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await send({ action: "rules", rules, dailyValues: parseResultBonusDailyValues(dailyValues), baseRules: saved, baseDailyValues: savedDailyValues });
      setRules(result.rules); setSaved(result.rules); setDailyValues(result.dailyValues); setSavedDailyValues(result.dailyValues);
      setConfirm(false); setMessage("Valori giornalieri e dinamiche salvati. Il premio del mese sarà ricalcolato con questi valori.");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Salvataggio non riuscito."); }
    finally { setBusy(false); }
  }
  async function saveAward(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      await send({ action: "personal-bonus", userId, amount: Number(awardAmount), date, evidence, requestId: requestId.current });
      setAwards((old) => [...old, { id: requestId.current!, name: props.people.find((person) => person.id === userId)?.name ?? "", amount: Number(awardAmount), date, evidence }]);
      setAwardAmount(""); setEvidence(""); requestId.current = null;
      setMessage("Premio individuale assegnato e salvato.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Premio non salvato."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <Link href={`/premio-risultato?month=${props.month}`} className={styles.back} onClick={(event) => { if (dirty && !window.confirm("Ci sono modifiche non salvate. Vuoi uscire senza salvarle?")) event.preventDefault(); }}><ArrowLeft size={16} /> Premio di risultato</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}>BUENOS AIRES · RISERVATO ALLA DIREZIONE</span><h1>Punti delle dinamiche</h1><p>Imposta +4, −5 o il valore che scegli. 1 punto = 1 €. Lo staff vede solo il guadagno giornaliero.</p></div><label className={styles.month}>Mese di applicazione<input type="month" value={props.month} min={RESULT_BONUS_START_MONTH} disabled={busy} onChange={(event) => { if (event.target.value && (!dirty || window.confirm("Cambiare mese senza salvare le modifiche?"))) router.push(`/premio-risultato/dinamiche?month=${event.target.value}`); }} /></label></header>
    <div className={styles.scope}><strong>{monthLabel}</strong><span>I valori modificano l’intero mese selezionato, anche gli eventi già registrati. I mesi precedenti restano invariati. I nuovi mesi ereditano le ultime regole disponibili.</span></div>
    {message && <p className={styles.success} role="status"><CheckCircle2 size={18} />{message}</p>}
    {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => { if (!dirty || window.confirm("Ricaricare senza salvare le modifiche?")) window.location.reload(); }}>Ricarica dati</button></p>}
    <div className={styles.layout}><section className={styles.section}>
      <form onSubmit={(event) => { event.preventDefault(); setConfirm(true); }}>
        <div className={styles.sectionHead}><h2>Valore della giornata</h2><p>Scegli la base giornaliera per ogni livello nel mese selezionato. 1 punto = 1 €. Le dinamiche si aggiungono o si sottraggono a questa base.</p></div>
        <fieldset disabled={busy} className={`${styles.fieldset} ${styles.dailyValues}`} aria-label="Valore della giornata per livello">
          {(["JUNIOR", "AUTONOMA", "MASTER"] as const).map((level) => {
            const definition = RESULT_BONUS_LEVELS[level];
            const label = level === "AUTONOMA" ? "Autonomo" : definition.label;
            const amount = dailyValues[level];
            return <div className={styles.dailyLevel} key={level}>
              <h3>{label}</h3><p>Tetto mensile {euro(definition.cap)}</p>
              <label>Calcolo<select aria-label={`Calcolo giornata ${label}`} value={amount === null ? "AUTO" : "FIXED"} onChange={(event) => updateDailyValue(level, event.target.value === "AUTO" ? null : 0)}><option value="AUTO">Automatico dal tetto</option><option value="FIXED">Valore fisso al giorno</option></select></label>
              <label>Punti al giorno<input aria-label={`Valore giornata ${label}`} type="number" inputMode="decimal" min="0" max="10000" step="0.01" required={amount !== null} value={amount === null || Number.isNaN(amount) ? "" : amount} placeholder="Es. 10" onChange={(event) => updateDailyValue(level, event.target.value === "" ? NaN : Number(event.target.value))} /></label>
              <small>{amount === null ? "Automatico: tetto diviso per i giorni previsti. Scrivi un importo per personalizzarlo." : Number.isFinite(amount) ? `${euro(amount)} per giornata, prima delle dinamiche.` : "Inserisci un importo valido."}</small>
            </div>;
          })}
        </fieldset>
        <div className={styles.sectionHead}><h2>Quanto vale ogni azione</h2><p>Scrivi i punti nel campo a destra: + aggiunge, − riduce, 0 non cambia il guadagno. Inserire un valore sostituisce la regola di azzeramento.</p></div>
        <fieldset disabled={busy} className={styles.fieldset}>
          {(Object.keys(RESULT_BONUS_DYNAMICS) as ResultBonusDynamic[]).map((key) => {
            const definition = RESULT_BONUS_DYNAMICS[key]; const rule = rules[key];
            return <div className={styles.rule} key={key}>
              <div><h3>{definition.label}</h3><p>{definition.detail}</p><small className={rule.mode === "AMOUNT" && rule.amount < 0 ? styles.negative : styles.effect}>{resultBonusRuleLabel(rule)}</small></div>
              <div className={styles.controls}><label>Regola<select aria-label={`Effetto: ${definition.label}`} value={rule.mode} onChange={(event) => updateRule(key, { mode: event.target.value as ResultBonusRule["mode"] })}>
                {definition.mode === "ZERO_DAY" && <option value="ZERO_DAY">Azzera la giornata</option>}
                <option value="AMOUNT">Valore in punti (+ / −)</option><option value="TRACK_ONLY">Solo segnalazione</option>
              </select></label>
              <label>Punti (+ / −)<input aria-label={`Punti: ${definition.label}`} type="number" step="0.01" min={-10000} max={10000} required value={Number.isNaN(rule.amount) ? "" : rule.amount} onChange={(event) => updateRule(key, { mode: "AMOUNT", amount: event.target.value === "" ? NaN : Number(event.target.value) })} /></label></div>
            </div>;
          })}
        </fieldset>
        <footer className={styles.saveBar}><span>{dirty ? "Modifiche da salvare" : "Nessuna modifica da salvare"}</span><button type="submit" className={styles.primary} disabled={!dirty || busy}><Save size={17} />Salva valori</button>
          {confirm && <div className={styles.confirm} role="alert"><strong>Confermi il ricalcolo di {monthLabel}?</strong><p>I nuovi importi si applicano a tutto lo staff del salone per questo mese. Le prese visione già registrate saranno da confermare nuovamente.</p><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Annulla</button><button type="button" className={styles.primary} disabled={busy} onClick={saveRules}>{busy ? "Salvataggio…" : "Conferma e salva"}</button></div>}
        </footer>
      </form>
    </section>
    <aside className={styles.aside}>
      <section className={styles.section}><div className={styles.sectionHead}><Gift size={23} /><h2>Premio individuale</h2><p>Un riconoscimento aggiuntivo per una persona.</p></div>
        <form className={styles.awardForm} onSubmit={saveAward}><fieldset disabled={busy} className={styles.fieldset}>
          <label>Lavoratore<select required value={userId} onChange={(event) => setUserId(event.target.value)}><option value="" disabled>Seleziona una persona</option>{props.people.map((person) => <option value={person.id} key={person.id} disabled={!person.configured}>{person.name}{!person.configured ? " · assegna prima il livello" : ""}</option>)}</select></label>
          <label>Premio in punti<input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" required value={awardAmount} onChange={(event) => setAwardAmount(event.target.value)} placeholder="Es. 25" /></label>
          <label>Data<input type="date" required min={`${props.month}-01`} max={new Date(Number(props.month.slice(0, 4)), Number(props.month.slice(5)), 0, 12).toLocaleDateString("en-CA")} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Motivazione<textarea required maxLength={1000} rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Per quale risultato assegni il premio?" /></label>
          <p className={styles.note}>1 punto = 1 €. Il premio concorre al tetto mensile. Il lavoratore riceve solo l’importo finale, dopo l’uscita.</p>
          <button className={styles.primary} type="submit" disabled={busy || !userId}><Gift size={17} />{busy ? "Salvataggio…" : "Assegna premio"}</button>
        </fieldset></form>
      </section>
      <section className={`${styles.section} ${styles.info}`}><h2>Cosa riceve il lavoratore</h2><p>Dopo la timbratura di uscita riceve una notifica nell’app con il solo guadagno della giornata. Punti, dinamiche e penalità restano riservati alla direzione.</p><p>La base giornaliera usa il valore fisso del livello, se impostato; altrimenti il tetto diviso per i giorni previsti. I punti modificano il guadagno di quel giorno: non scende sotto 0 € e non intacca le giornate precedenti. Resta il tetto mensile.</p><p>Le modifiche non reinviano notifiche già comunicate. La lettera di contestazione mantiene l’azzeramento mensile.</p><p>Per <Link href="/tables">Sistemazione fasce</Link> conta la data di inserimento della riga. Servono nome e cognome in “app. precedente”, anche dopo “Staff:”. Soprannomi e nomi ambigui non vengono attribuiti automaticamente.</p>{props.lastUpdate && <small>Ultima modifica: {props.lastUpdate.actorName}, {new Date(props.lastUpdate.at).toLocaleDateString("it-IT")}</small>}</section>
      {awards.length > 0 && <section className={`${styles.section} ${styles.info}`}><h2>Premi assegnati nel mese</h2>{awards.map((award) => <div className={styles.award} key={award.id}><strong>{award.name}<span>+{euro(award.amount)}</span></strong><p>{award.evidence}</p><small>{new Date(`${award.date}T12:00:00`).toLocaleDateString("it-IT")}</small></div>)}</section>}
    </aside></div>
  </main>;
}
