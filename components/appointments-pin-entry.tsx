"use client";

import { useRef, useState } from "react";
import { Loader2, Delete } from "lucide-react";
import { AppointmentsAdminUnlock } from "@/components/appointments-admin-unlock";

export type PinEntryWorker = { id: string; name: string; photo_url?: string | null; locationName: string; status: string };

export function AppointmentsPinEntry({ salon, pcName, onUnlock }: {
  salon: "tutti" | "buenos-aires" | "duomo" | "ufficio";
  pcName?: string;
  onUnlock: (worker: PinEntryWorker, destination: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  async function enter() {
    if (inFlight.current || !/^\d{4}$/.test(pin)) return;
    inFlight.current = true; setBusy(true); setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/appointments/pc/pin-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, salone: salon }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Accesso non riuscito. Riprova.");
      setPin(""); onUnlock(data.worker, data.appointmentUrl);
    } catch (err) {
      setPin("");
      setError(err instanceof DOMException && err.name === "AbortError" ? "Connessione lenta. Riprova." : err instanceof Error ? err.message : "Accesso non riuscito. Riprova.");
      inFlight.current = false; setBusy(false);
    } finally { window.clearTimeout(timeout); }
  }
  return <section className="grid min-h-dvh place-items-center overflow-y-auto bg-[#FFFBF6] px-5 py-8 text-neutral-950">
    <div className="w-full max-w-sm space-y-6 text-center">
      <AppointmentsAdminUnlock salone={salon} compact />
      <header><h1 className="font-serif text-4xl">Gestionale Paradise</h1><p className="mt-3 text-neutral-600">Inserisci il tuo PIN personale di 4 cifre.</p>{pcName && <p className="mt-2 text-sm text-neutral-500">{pcName}</p>}</header>
      <form onSubmit={event => { event.preventDefault(); void enter(); }} className="space-y-5">
        <label className="block text-sm font-semibold" htmlFor="appointment-entry-pin">PIN personale</label>
        <input id="appointment-entry-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" autoFocus value={pin} disabled={busy}
          onChange={event => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
          aria-describedby={error ? "appointment-entry-error" : undefined} aria-invalid={Boolean(error)}
          className="h-16 w-full rounded-2xl border border-pink-200 bg-white text-center text-3xl tracking-[0.6em] focus:outline-none focus:ring-2 focus:ring-pink-500" />
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Cancella", "0", "Indietro"].map(key => <button key={key} type="button" disabled={busy} aria-label={key} onClick={() => {
            setError(""); setPin(value => key === "Cancella" ? "" : key === "Indietro" ? value.slice(0, -1) : `${value}${key}`.slice(0, 4));
          }} className="flex h-16 items-center justify-center rounded-2xl border border-pink-100 bg-white text-xl font-semibold active:bg-pink-100 disabled:opacity-50">{key === "Indietro" ? <Delete aria-hidden className="size-6" /> : key === "Cancella" ? <span className="text-sm">Cancella</span> : key}</button>)}
        </div>
        {error && <p id="appointment-entry-error" role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy || pin.length !== 4} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#A72D65] font-semibold text-white disabled:opacity-40">{busy ? <><Loader2 className="size-5 animate-spin" />Accesso…</> : "Entra"}</button>
      </form>
    </div>
  </section>;
}
