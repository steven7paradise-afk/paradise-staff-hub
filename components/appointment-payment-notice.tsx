"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Plus, RefreshCw, ShoppingBag, X } from "lucide-react";
import styles from "./appointment-payment-notice.module.css";

type Payment = {
  id: string;
  orderName: string;
  clientName: string;
  createdAt: string;
  totalPrice: number;
  sourceName?: string | null;
};

/** Display only payments verified against the open appointment's customer. */
export function AppointmentPaymentNotice<T extends Payment>({ payments, loading, selectedOrder, disabled, onSelect, onOpen, onRefresh }: {
  payments: T[];
  loading: boolean;
  selectedOrder: string;
  disabled?: boolean;
  onSelect: (payment: T) => void;
  onOpen: () => void;
  onRefresh: () => void;
}) {
  const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

  return <div className={styles.host}>
    {payments.length > 0 ? <section className={styles.daily} aria-label="Pagamenti della cliente nel giorno dell’appuntamento">
      <header className={styles.dailyHeader}>
        <strong role="status">Pagamenti del giorno · {payments.length}</strong>
        <div className={styles.tools}>
          <button type="button" onClick={onRefresh} disabled={loading} aria-label="Aggiorna pagamenti del giorno"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          <button type="button" onClick={onOpen} aria-haspopup="dialog">Storico ordini</button>
        </div>
      </header>
      <ul className={styles.dailyList}>
      {payments.map(payment => {
        const selected = selectedOrder.replace(/^#/, "") === payment.orderName.replace(/^#/, "");
        return <li key={payment.id} className={`${styles.notice} ${selected ? styles.confirmed : ""}`} aria-label={`Pagamento ${payment.orderName}${selected ? ", ordine confermato per la nota" : ""}`}>
      <div className={styles.bag} aria-hidden="true"><ShoppingBag size={22} strokeWidth={1.8} /></div>
      <div className={styles.content}>
        <strong className={styles.order}>{payment.orderName.startsWith("#") ? payment.orderName : `#${payment.orderName}`}</strong>
        <span className={styles.name}>{payment.clientName}</span>
        <span className={styles.meta}>{date.format(new Date(payment.createdAt))}</span>
        <span className={styles.meta}>{payment.sourceName === "pos" ? "Shopify · Punto vendita" : payment.sourceName === "web" ? "Shopify · Online" : "Shopify"}</span>
        <strong className={styles.amount}>{money.format(payment.totalPrice)}</strong>
        {selected ? <span className={styles.confirmedLabel} role="status"><Check size={14} aria-hidden="true" /> Ordine confermato per la nota</span> : null}
      </div>
      <div className={styles.selection}>
        <button type="button" className={styles.plus} onClick={() => onSelect(payment)} disabled={disabled || selected} aria-pressed={selected} aria-label={selected ? `Ordine ${payment.orderName} confermato per la nota` : `Conferma ordine ${payment.orderName} per la nota di ${payment.clientName}`}>
          {selected ? <Check size={30} strokeWidth={3} /> : <Plus size={30} strokeWidth={3} />}
        </button>
      </div>
    </li>;
      })}
      </ul>
    </section> : <div className={styles.waiting}>
      <ShoppingBag size={22} aria-hidden="true" />
      <span role="status">{loading ? "Cerco i pagamenti della cliente…" : "Nessun pagamento del giorno verificato"}</span>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Verifica il pagamento della cliente"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
      <button type="button" onClick={onOpen} className={styles.plus} aria-label="Apri i pagamenti della cliente" aria-haspopup="dialog"><Plus size={24} /></button>
    </div>}
  </div>;
}

export function AppointmentPaymentHistory({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="payment-history-title"
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogInner}>
      <header className={styles.dialogHeader}>
        <h2 id="payment-history-title">Pagamenti della cliente</h2>
        <button type="button" onClick={onClose} aria-label="Chiudi pagamenti"><X size={20} /></button>
      </header>
      {children}
    </div>
  </dialog>;
}
