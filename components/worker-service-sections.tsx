"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, LockKeyhole, Plus, FileText } from "lucide-react";
import { CLIENT_CONTROL_SERVICE_OPTIONS, SECONDARY_SERVICE_OPTIONS } from "@/lib/client-control-service-rules";
import { appointmentStaffDisplayName } from "@/lib/appointment-staff-access";
import { cleanWorkerServiceDetail, workerServiceKey, workerServiceNote, type WorkerServiceSection } from "@/lib/worker-service-sections";
import styles from "./worker-service-sections.module.css";

type Props = {
  officeNote: string;
  serviceDate?: string;
  workers: { id: string; name: string }[];
  sections: WorkerServiceSection[];
  onChange: (sections: WorkerServiceSection[]) => void;
  disabled?: boolean;
  completionChecks?: ReactNode;
};

export function WorkerServiceSections({ officeNote, serviceDate, workers, sections, onChange, disabled = false, completionChecks }: Props) {
  const uid = useId();
  const [openedAt] = useState(() => new Date().toISOString());
  const receiptDateValue = serviceDate && Number.isFinite(Date.parse(serviceDate)) ? serviceDate : openedAt;
  const receiptDate = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome",
  }).format(new Date(receiptDateValue));
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const activeId = openId === undefined ? (sections[0] ? workerServiceKey(sections[0]) : null) : openId;
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  function change(id: string, patch: Partial<WorkerServiceSection>) {
    onChange(sections.map(section => workerServiceKey(section) === id ? { ...section, ...patch } : section));
  }
  function addDetail(section: WorkerServiceSection) {
    const text = section.draftDetail.trim();
    if (!text || section.details.length >= 30) return;
    change(workerServiceKey(section), { details: [...section.details, text], draftDetail: "" });
  }
  return <div className={styles.root}>
    <aside className={styles.office} aria-label="Nota dell’ufficio">
      <div><LockKeyhole size={16} /><strong>Nota dell’ufficio</strong><span>Solo lettura</span></div>
      <p>{officeNote || "Nessuna nota dell’ufficio."}</p>
    </aside>
    {!sections.length && <p className={styles.empty}>Seleziona una collaboratrice per compilare i servizi.</p>}
    {sections.map((section, index) => {
      const worker = workers.find(person => person.id === section.staffId);
      const name = appointmentStaffDisplayName(worker?.name, section.staffId);
      const expanded = activeId === workerServiceKey(section);
      const note = workerServiceNote(section);
      const panelId = `${uid}-${index}`;
      return <section className={styles.card} key={workerServiceKey(section)} aria-label={`Sezione ${index + 1}: servizi di ${name}`}>
        <button type="button" className={styles.heading} aria-expanded={expanded} aria-controls={panelId}
          onClick={() => setOpenId(expanded ? (sections[index + 1] ? workerServiceKey(sections[index + 1]) : null) : workerServiceKey(section))}>
          <span className={styles.number}>{index + 1}</span>
          <span className={styles.title}><span>Sezione {index + 1} · {section.staffId === sections[0]?.staffId ? "Principale" : "Collaboratrice"}</span><strong>{name} <span className={styles.separator}>/</span> Servizi eseguiti</strong>
            <small>{section.services.join(" · ") || "Scegli uno o più servizi"}</small>
          </span>
          <ChevronDown size={22} className={expanded ? styles.rotated : ""} />
        </button>
        {!expanded && <div className={styles.summary}><FileText size={16} /><p>{note || "Nota ancora da compilare."}{section.draftDetail.trim() ? " · Dettaglio in bozza" : ""}</p></div>}
        <div id={panelId} hidden={!expanded}>
          <fieldset disabled={disabled} className={styles.layout}>
            <legend className={styles.srOnly}>Servizi e nota di {name}</legend>
            <div className={styles.fields}>
              <div className={styles.services}><div className={styles.label}><strong>Servizi eseguiti</strong><span>Puoi scegliere più servizi</span></div>
                <div className={styles.options}>{(index === 1 ? SECONDARY_SERVICE_OPTIONS : CLIENT_CONTROL_SERVICE_OPTIONS).map(service => {
                  const selected = section.services.includes(service);
                  return <button type="button" key={service} aria-pressed={selected} onClick={() => change(workerServiceKey(section), { services: selected ? section.services.filter(value => value !== service) : [...section.services, service] })}>{selected && <Check size={16} />}{service}</button>;
                })}</div>
              </div>
              <div className={`${styles.grid} ${index === 1 ? styles.singleRow : ""}`}>
                {index !== 1 && ([['grammi', 'Quanti grammi?', ['100g', '150g', '200g']], ['lunghezza', 'Lunghezza', ['55cm', '65cm', '75cm']], ['fasce', 'Quante fasce?', ['1', '2', '3', '4', '5']]] as const).map(([key, label, options]) => {
                  const customKey = `${workerServiceKey(section)}-${key}`;
                  const custom = customFields[customKey] ?? Boolean(section[key] && !(options as readonly string[]).includes(section[key]));
                  return <div key={key}><strong className={styles.fieldLabel}>{label}</strong><div className={styles.options}>
                    {options.map(value => <button type="button" key={value} aria-pressed={section[key] === value} onClick={() => { setCustomFields(prev => ({ ...prev, [customKey]: false })); change(workerServiceKey(section), { [key]: section[key] === value ? "" : value }); }}>{value}</button>)}
                    <button type="button" aria-pressed={Boolean(custom)} onClick={() => setCustomFields(prev => ({ ...prev, [customKey]: !custom }))}>Personalizzato</button>
                  </div>{custom && <label className={styles.custom}><span>{label} — personalizzato</span><input maxLength={100} value={section[key]} onChange={event => change(workerServiceKey(section), { [key]: event.target.value })} /></label>}</div>;
                })}
                <div><strong className={styles.fieldLabel}>Come era la cliente?</strong><div className={styles.options}>
                  {['Tranquilla', 'Simpatica', 'Esigente', 'Pretenziosa'].map(value => <button key={value} type="button" aria-pressed={section.atteggiamento === value} onClick={() => change(workerServiceKey(section), { atteggiamento: section.atteggiamento === value ? "" : value })}>{value}</button>)}
                </div></div>
              </div>
              {index === 0 && completionChecks ? <div className="mt-6">{completionChecks}</div> : null}
            </div>
            <aside className={styles.note} aria-label={`Nota del servizio di ${name}`}>
              <h4><FileText size={18} />Nota del servizio · {name}</h4>
              <div className={styles.receipt} aria-live="polite" aria-label={`Riepilogo del servizio di ${name}`}>
                <div className={styles.receiptHeader}>
                  <strong>{name}</strong><span className={styles.receiptDots} aria-hidden="true" />
                  <time dateTime={receiptDateValue} title={serviceDate && Number.isFinite(Date.parse(serviceDate)) ? "Data dell’appuntamento" : "Data di oggi"}>{receiptDate}</time>
                </div>
                <div className={styles.receiptBlock}>
                  <span className={styles.receiptLabel}>Nota</span>
                  {section.details.map(cleanWorkerServiceDetail).filter(Boolean).length ? section.details.map(cleanWorkerServiceDetail).filter(Boolean).map((detail, detailIndex) => <p key={detailIndex}>{detail}</p>) : <p className={styles.receiptEmpty}>Nessuna nota aggiunta.</p>}
                </div>
                <div className={styles.receiptBlock}>
                  <span className={styles.receiptLabel}>Servizi eseguiti</span>
                  {section.services.length ? <ul>{section.services.map(service => <li key={service}>{service}</li>)}</ul> : <p className={styles.receiptEmpty}>Nessun servizio selezionato.</p>}
                </div>
                {(section.grammi || section.lunghezza || section.fasce || section.atteggiamento) && <dl className={styles.receiptSpecs}>
                  {([["Grammi", section.grammi], ["Lunghezza", section.lunghezza], ["Fasce", section.fasce], ["Cliente", section.atteggiamento]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>}
              </div>
              <label htmlFor={`${panelId}-detail`}>Aggiungi un dettaglio</label>
              <textarea id={`${panelId}-detail`} rows={3} maxLength={600} value={section.draftDetail}
                placeholder="Scrivi un dettaglio e premi Invio…"
                onChange={event => change(workerServiceKey(section), { draftDetail: event.target.value })}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); addDetail(section); }
                }} />
              <div className={styles.detailActions}><small>Invio aggiunge · Maiusc+Invio va a capo</small><button type="button" onClick={() => addDetail(section)} disabled={!section.draftDetail.trim() || section.details.length >= 30}><Plus size={16} />Aggiungi</button></div>
              {section.details.length >= 30 && <p role="status">Hai raggiunto il limite di 30 dettagli per questa nota.</p>}
            </aside>
          </fieldset>
        </div>
      </section>;
    })}
  </div>;
}
