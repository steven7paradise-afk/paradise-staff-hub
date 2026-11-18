"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Camera, ChevronRight, Loader2 } from "lucide-react";
import { orderStatusForWorkspace } from "@/lib/order-workspace";
import styles from "./conversion-board.module.css";

export type ConversionBoardItem = {
  id: string;
  clientName: string;
  reference: string;
  description: string;
  status: string;
  photoUrl: string | null;
  photoCount: number;
  staffName: string;
  dateLabel: string;
  deliveryLabel: string;
  overdue: boolean;
};

type ConversionBoardProps = {
  items: ConversionBoardItem[];
  canManage: boolean;
  savingId: string | null;
  onOpen: (id: string) => void;
  onAdvance: (id: string, status: string, note: string) => Promise<void>;
};

const columns = [
  { status: "NEW", label: "Da preparare", tone: "new" },
  { status: "PREPARING", label: "In preparazione", tone: "preparing" },
  { status: "READY", label: "Pronto", tone: "ready" },
  { status: "COMPLETED", label: "Consegnato", tone: "completed" },
] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "C";
}

export function ConversionBoard({ items, ...actions }: ConversionBoardProps) {
  const board = useRef<HTMLDivElement>(null);
  const openButtons = useRef(new Map<string, HTMLButtonElement>());
  const [pendingFocus, setPendingFocus] = useState<{ id: string; status: string; message: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const registerOpenButton = useCallback((id: string, button: HTMLButtonElement | null) => {
    if (button) openButtons.current.set(id, button);
    else openButtons.current.delete(id);
  }, []);

  useEffect(() => {
    if (!pendingFocus) return;
    const updated = items.find(item => item.id === pendingFocus.id);
    if (updated && orderStatusForWorkspace(updated.status, "conversions") !== pendingFocus.status) return;
    setAnnouncement(pendingFocus.message);
    const button = openButtons.current.get(pendingFocus.id);
    if (button) {
      button.focus({ preventScroll: true });
      const viewport = board.current;
      if (viewport) {
        const bounds = viewport.getBoundingClientRect();
        const target = button.getBoundingClientRect();
        const left = target.left < bounds.left ? target.left - bounds.left - 8
          : target.right > bounds.right ? target.right - bounds.right + 8 : 0;
        if (left) viewport.scrollBy({ left, behavior: "auto" });
      }
    } else board.current?.focus({ preventScroll: true });
    setPendingFocus(null);
  }, [items, pendingFocus]);

  async function advance(id: string, status: string, note: string) {
    const reference = items.find(item => item.id === id)?.reference;
    setAnnouncement("");
    await actions.onAdvance(id, status, note);
    const label = columns.find(column => column.status === status)?.label || status;
    setPendingFocus({ id, status, message: `Conversione${reference ? ` ${reference}` : ""}: ${label}.` });
  }

  return (
    <>
    <p className={styles.announcer} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    <div ref={board} className={styles.board} role="region" aria-label="Avanzamento conversioni" tabIndex={0}>
      {columns.map(column => {
        const columnItems = items.filter(item => orderStatusForWorkspace(item.status, "conversions") === column.status);
        return (
          <section className={styles.column} key={column.status} aria-label={column.label}>
            <header className={styles.columnHeading} data-tone={column.tone}>
              <h2>{column.label}</h2>
              <span className={styles.count} aria-label={`${columnItems.length} conversioni`}>{columnItems.length}</span>
            </header>
            <div className={styles.list}>
              {columnItems.length ? columnItems.map(item => (
                <ConversionCard key={item.id} item={{ ...item, status: column.status }} {...actions} onAdvance={advance} openButtonRef={button => registerOpenButton(item.id, button)} />
              )) : <p className={styles.empty}>Nessuna conversione in questo stato.</p>}
            </div>
          </section>
        );
      })}
    </div>
    </>
  );
}

function ConversionCard({ item, canManage, savingId, onOpen, onAdvance, openButtonRef }: Omit<ConversionBoardProps, "items"> & { item: ConversionBoardItem; openButtonRef: (button: HTMLButtonElement | null) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const inFlight = useRef(false);
  const confirmationPanel = useRef<HTMLFormElement>(null);
  const noteId = useId();
  const busy = submitting || savingId === item.id;
  const blocked = submitting || savingId !== null;
  const nextStatus = item.status === "NEW" ? "PREPARING" : item.status === "PREPARING" ? "READY" : null;
  const actionLabel = item.status === "NEW" ? "Avvia" : "Segna pronta";
  const hasPhoto = item.photoUrl && item.photoUrl !== failedPhoto;

  useEffect(() => {
    if (confirming) confirmationPanel.current?.focus({ preventScroll: true });
  }, [confirming]);

  async function advance() {
    if (!canManage || !nextStatus || blocked || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      await onAdvance(item.id, nextStatus, note.trim());
      setConfirming(false);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error && cause.message.trim() ? cause.message : "Aggiornamento non riuscito. Riprova.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <article className={styles.card} aria-busy={busy}>
      <button ref={openButtonRef} type="button" className={styles.open} onClick={() => onOpen(item.id)} aria-label={`Apri conversione ${item.reference} di ${item.clientName}`}>
        <span className={styles.identity}>
          <span className={styles.portrait}>
            {hasPhoto ? <img src={item.photoUrl!} alt="" width={52} height={52} loading="lazy" decoding="async" onError={() => setFailedPhoto(item.photoUrl)} /> : <span aria-hidden="true">{initials(item.clientName)}</span>}
          </span>
          <span className={styles.summary}>
            <span className={styles.name} title={item.clientName}>{item.clientName}</span>
            <span className={styles.reference}>{item.reference}</span>
            {item.description ? <span className={styles.description}>{item.description}</span> : null}
          </span>
        </span>
        <span className={styles.metadata}>
          <span className={styles.staff} title={item.staffName}>{item.staffName || "Non assegnato"}</span>
          <span className={styles.date}>{item.dateLabel}</span>
        </span>
        <span className={styles.metadata}>
          <span className={styles.delivery} title={item.deliveryLabel}>{item.overdue ? <span className={styles.overdue}>In attesa · </span> : null}{item.deliveryLabel}</span>
          <span className={styles.photos}><Camera size={13} aria-hidden="true" />{item.photoCount} foto</span>
        </span>
      </button>

      {confirming && nextStatus && canManage ? (
        <form ref={confirmationPanel} tabIndex={-1} className={styles.confirmation} onSubmit={event => { event.preventDefault(); void advance(); }} aria-label={`Conferma avanzamento ${item.reference}`}>
          <p className={styles.confirmTitle}>{nextStatus === "PREPARING" ? "Avviare la preparazione?" : "Confermare che è pronta?"}</p>
          <label htmlFor={noteId}>Nota <span>(facoltativa)</span></label>
          <textarea id={noteId} rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={blocked} />
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.confirmActions}>
            <button type="button" disabled={blocked} onClick={() => { setConfirming(false); setError(""); }} className={styles.cancel}>Annulla</button>
            <button type="submit" disabled={blocked} className={styles.confirm}>{busy ? <><Loader2 size={15} className={styles.spinner} aria-hidden="true" />Salvataggio…</> : "Conferma"}</button>
          </div>
        </form>
      ) : (
        <div className={styles.footer}>
          {canManage && nextStatus ? (
            <button type="button" disabled={blocked} className={styles.action} onClick={() => { setError(""); setConfirming(true); }}>
              {busy ? <Loader2 size={15} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}{busy ? "Salvataggio…" : actionLabel}
            </button>
          ) : (
            <button type="button" className={styles.action} onClick={() => onOpen(item.id)}>
              {canManage && item.status === "READY" ? "Gestisci consegna" : "Apri dettagli"}<ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
