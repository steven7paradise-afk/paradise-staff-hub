"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { loadClientControlCowlendarHistory } from "@/lib/client-control-cowlendar-history";
import type { loadClientControlShopifyHistory } from "@/lib/client-control-shopify-history";
import styles from "./client-control-directory.module.css";

type Appointments = Omit<NonNullable<Awaited<ReturnType<typeof loadClientControlCowlendarHistory>>>, "orderId">;
type Payments = Awaited<ReturnType<typeof loadClientControlShopifyHistory>>;
export type HistorySource = "appointments" | "payments";
type Result = Appointments | Payments | { status: "unlinked" };

const visitStatus = {
  completed: "Completato",
  upcoming: "In programma",
  canceled: "Annullato / non presentato",
  past: "Passato · esito non registrato",
};

const visitDate = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome",
});

function AppointmentHistory({ data }: { data: Appointments }) {
  return <>
    {data.customer && <dl className={styles.historyContacts}>
      <div><dt>Email</dt><dd>{data.customer.email || "Non registrata"}</dd></div>
      <div><dt>Telefono</dt><dd>{data.customer.phone || "Non registrato"}</dd></div>
    </dl>}
    {data.status === "unlinked"
      ? <p className={styles.muted}>Per questa cliente è disponibile solo la prenotazione collegata alla scheda. Lo storico richiede un contatto verificabile.</p>
      : <>
        <dl className={styles.historyStats}>
          <div><dt>Appuntamenti in archivio</dt><dd>{data.total}</dd></div>
          <div><dt>Completati</dt><dd>{data.completed}</dd></div>
          <div><dt>In programma</dt><dd>{data.upcoming}</dd></div>
          <div><dt>Annullati o non presentati</dt><dd>{data.canceled}</dd></div>
        </dl>
        <p className={styles.muted}>Fonte: appuntamenti Cowlendar già sincronizzati in Staff.</p>
      </>}
    {data.appointments.length > 0 && <ul className={styles.visitList} aria-label="Appuntamenti in archivio">
      {data.appointments.map(visit => <li key={visit.id}>
        <Link href={`/appointments?${new URLSearchParams({ view: "day", focus: visit.day, from: visit.day, to: visit.day, booking: visit.id })}`} prefetch={false}>
          <span><strong>{visit.service || "Appuntamento"}</strong><time dateTime={visit.date}>{visitDate.format(new Date(visit.date))}</time></span>
          <span>{visitStatus[visit.status]}</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </li>)}
    </ul>}
    {data.total > data.appointments.length && <p className={styles.muted}>Mostrati gli ultimi {data.appointments.length} appuntamenti.</p>}
  </>;
}

function PaymentHistory({ data }: { data: Payments }) {
  if (data.status !== "ready") {
    return <p className={styles.muted}>{data.status === "unlinked"
      ? "Lo storico Shopify è disponibile quando la prenotazione è collegata a un ordine originale."
      : "Shopify non ha restituito lo storico dei pagamenti. Riprova tra poco."}</p>;
  }

  return <>
    <dl className={styles.historyStats}>
      <div><dt>Ordini pagati su Shopify</dt><dd>{data.exact ? data.count : `${data.count}+`}</dd></div>
    </dl>
    <p className={styles.muted}>
      {data.coverage === "all" && "Conteggio degli ordini con stato Pagato."}
      {data.coverage === "recent" && "Conteggio degli ordini con stato Pagato negli ultimi 60 giorni."}
      {data.coverage === "unknown" && "Conteggio degli ordini con stato Pagato accessibili a Staff. Lo storico disponibile potrebbe essere parziale."}
    </p>
  </>;
}

export function ClientRecordHistory({ bookingId, source }: { bookingId: string; source: HistorySource }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!bookingId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ booking: bookingId, source });
    async function load() {
      try {
        const response = await fetch(`/api/client-control/customer-history?${params}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(errorBody?.error || "Caricamento non riuscito.");
        }
        const data: Result = await response.json();
        if (!controller.signal.aborted) setResult(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Caricamento non riuscito.");
      }
    }
    void load();
    return () => controller.abort();
  }, [bookingId, source, attempt]);

  if (!bookingId) return <p className={styles.muted}>Collega questa scheda a un appuntamento per consultarne lo storico.</p>;
  const retry = () => { setError(""); setResult(null); setAttempt(previous => previous + 1); };
  if (error) return <div className={styles.historyMessage}><p role="status">{error}</p><button className={styles.button} type="button" onClick={retry}>Riprova</button></div>;
  if (!result) return <p className={styles.muted} role="status">Caricamento dello storico…</p>;
  if (source === "payments" && !("appointments" in result)) return <>
    <PaymentHistory data={result} />
    {result.status === "unavailable" && <button className={styles.button} type="button" onClick={retry}>Riprova</button>}
  </>;
  if ("appointments" in result) return <AppointmentHistory data={result} />;
  return <p className={styles.muted}>La prenotazione collegata non è presente nell’archivio Cowlendar di Staff.</p>;
}
