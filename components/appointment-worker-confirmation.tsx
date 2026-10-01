"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import styles from "./appointment-worker-confirmation.module.css";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { appointmentStaffDisplayName, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";

type Worker = { id: string; name: string; photoUrl?: string | null; status?: string };

function WorkerPhoto({ worker, large = false }: { worker: Worker; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`${styles.avatar} ${large ? styles.heroAvatar : ""}`}>
    {worker.photoUrl && !failed ? <img src={resolveDrivePhotoUrl(worker.photoUrl)} alt="" onError={() => setFailed(true)} />
      : worker.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}
  </span>;
}

export function AppointmentWorkerConfirmation({ name, self, workers, officeWorkers = [], canChooseOfficeStaff = false, workersLoading, workersError, clientName, loading, onAssign, onClose }: {
  name: string;
  self?: Worker;
  workers: Worker[];
  officeWorkers?: Worker[];
  canChooseOfficeStaff?: boolean;
  workersLoading: boolean;
  workersError: string;
  clientName: string;
  loading: boolean;
  onAssign: (worker: Worker) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [choose, setChoose] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function assign(worker: Worker) {
    if (busy.current) return;
    busy.current = true;
    setSaving(worker.id);
    setError("");
    try {
      if (!await onAssign(worker)) setError("Assegnazione non salvata. Riprova oppure torna agli appuntamenti.");
    } catch {
      setError("Non riesco a salvare l’assegnazione. Riprova.");
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }
  const showQuestion = Boolean(self && !choose);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="worker-confirm-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className={styles.header}>
      <p className={styles.eyebrow}>Collaboratrice del servizio</p>
      <button type="button" aria-label="Torna agli appuntamenti" onClick={onClose} disabled={Boolean(saving)}><X size={20} /></button>
    </div>
    {!loading && showQuestion && <WorkerPhoto worker={self!} large />}
    <h2 id="worker-confirm-title">{loading ? "Carico il personale…" : showQuestion ? `Ciao ${name}, hai seguito tu ${clientName || "questa cliente"}?` : `Chi ha seguito ${clientName || "questa cliente"}?`}</h2>
    <p className={styles.description}>{loading ? "Un momento, verifico la scheda." : showQuestion ? "Conferma e continua a compilare la nota." : "Scegli chi ha seguito la cliente. La titolare è sempre disponibile; il personale del salone deve aver timbrato ed essere ancora in servizio."}</p>
    {loading ? <Loader2 className="animate-spin" aria-label="Caricamento" /> : showQuestion ?
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={Boolean(saving)} onClick={() => void assign(self!)}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Sì, l’ho seguita io</button>
        <button type="button" disabled={Boolean(saving)} onClick={() => setChoose(true)}>No, scegli un’altra persona</button>
      </div> : workersLoading ? <p role="status">Verifico chi ha timbrato…</p> : workersError ? <p role="alert" className={styles.error}>{workersError}</p> : <div className={styles.list}>
        {workers.map(worker => <button type="button" key={worker.id} disabled={Boolean(saving)} onClick={() => void assign(worker)}>
          <WorkerPhoto worker={worker} /><span className={styles.workerLabel}><strong>{appointmentStaffDisplayName(worker.name, worker.id)}</strong><small>{isAlwaysActiveAppointmentStaff(worker.name, worker.id) ? "Titolare · sempre disponibile" : worker.status === "BREAK" ? "In pausa · timbratura registrata" : "In servizio · timbratura registrata"}</small></span>{saving === worker.id ? <Loader2 className="animate-spin" size={18} /> : <span aria-hidden="true">→</span>}
        </button>)}
        {!workers.length && <p>Nessun collaboratore del salone risulta timbrato e ancora in servizio.</p>}
      </div>}
    {!loading && !showQuestion && canChooseOfficeStaff && <div className={styles.officeSection}>
      <button type="button" className={styles.officeToggle} aria-expanded={officeOpen} aria-controls="office-worker-list" disabled={Boolean(saving)} onClick={() => setOfficeOpen(value => !value)}><Plus size={22} /><span>Personale Ufficio</span></button>
      {officeOpen && <div id="office-worker-list" className={styles.list} aria-label="Personale Ufficio">
        {officeWorkers.map(worker => <button type="button" key={worker.id} disabled={Boolean(saving)} onClick={() => void assign(worker)}>
          <WorkerPhoto worker={worker} /><span className={styles.workerLabel}><strong>{appointmentStaffDisplayName(worker.name, worker.id)}</strong><small>Personale Ufficio</small></span>{saving === worker.id ? <Loader2 className="animate-spin" size={18} /> : <span aria-hidden="true">→</span>}
        </button>)}
        {!officeWorkers.length && <p>Nessun profilo attivo nella sede Ufficio.</p>}
      </div>}
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </dialog>;
}
