"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Delete, RefreshCw, LockKeyhole, Sun, Moon } from "lucide-react";
import { AppointmentsAdminUnlock } from "@/components/appointments-admin-unlock";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { appointmentPinKey } from "@/lib/appointment-pin-keyboard";
import styles from "./appointments-pin-entry.module.css";

const THEME_KEY = "paradise-appointments-entry-theme";

export type PinEntryWorker = { id: string; name: string; photo_url?: string | null; locationName: string; status: string };

export function AppointmentsPinEntry({ salon, pcName, onUnlock }: {
  salon: "tutti" | "buenos-aires" | "duomo" | "ufficio";
  pcName?: string;
  onUnlock: (worker: PinEntryWorker, destination: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<PinEntryWorker | null>(null);
  const pinLength = selectedWorker ? 2 : 4;
  const [workers, setWorkers] = useState<PinEntryWorker[]>([]);
  const [staffState, setStaffState] = useState<"loading" | "ready" | "error">("loading");
  const [staffRetry, setStaffRetry] = useState(0);
  const inFlight = useRef(false);
  const pinInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  // Restore focus after React commits profile changes or re-enables the input
  // following a rejected PIN, rather than focusing a still-disabled element.
  useEffect(() => {
    if (!busy) pinInput.current?.focus({ preventScroll: true });
  }, [selectedWorker, busy]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* Storage can be unavailable on shared devices. */ }
    setTheme(saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light");
    const followSystem = () => {
      try { if (["light", "dark"].includes(localStorage.getItem(THEME_KEY) ?? "")) return; } catch { /* Use the system preference. */ }
      setTheme(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);
  function changeTheme(value: "light" | "dark") {
    setTheme(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* The toggle still works without persistence. */ }
  }
  function chooseWorker(worker: PinEntryWorker | null) {
    setSelectedWorker(worker); setPin(""); setError("");
    pinInput.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 719px)").matches) {
      pinInput.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function loadStaff() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/appointments/pc/active-staff?salone=${encodeURIComponent(salon)}&scope=pin-entry`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Staff non disponibile");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Staff non disponibile");
        if (!controller.signal.aborted) { setWorkers(data); setStaffState("ready"); }
      } catch {
        if (!controller.signal.aborted) setStaffState("error");
      } finally { pending = false; }
    }
    setStaffState("loading");
    void loadStaff();
    const interval = window.setInterval(loadStaff, 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [salon, staffRetry]);
  async function enter() {
    if (inFlight.current || !/^\d+$/.test(pin) || pin.length !== pinLength) return;
    inFlight.current = true; setBusy(true); setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(selectedWorker ? "/api/appointments/pc/select-worker" : "/api/appointments/pc/pin-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedWorker ? { workerId: selectedWorker.id, pinPrefix: pin, salone: salon } : { pin, salone: salon }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Accesso non riuscito. Riprova.");
      setPin(""); onUnlock(data.worker ?? selectedWorker, data.appointmentUrl);
    } catch (err) {
      setPin("");
      setError(err instanceof DOMException && err.name === "AbortError" ? "Connessione lenta. Riprova." : err instanceof Error ? err.message : "Accesso non riuscito. Riprova.");
      inFlight.current = false; setBusy(false);
    } finally { window.clearTimeout(timeout); }
  }
  return <section className={styles.screen} data-theme={theme ?? undefined}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.brand}>PARADISE <span>· STAFF</span></p>
        <div className={styles.title}><h1>Accedi al salone</h1>{pcName && <p>{pcName}</p>}</div>
        <div className={styles.tools}>
          <div className={styles.themeToggle} role="group" aria-label="Aspetto della schermata">
            <button type="button" onClick={() => changeTheme("light")} aria-label="Tema chiaro" aria-pressed={theme === "light"} title="Tema chiaro"><Sun aria-hidden className="size-5" /></button>
            <button type="button" onClick={() => changeTheme("dark")} aria-label="Tema scuro" aria-pressed={theme === "dark"} title="Tema scuro"><Moon aria-hidden className="size-5" /></button>
          </div>
          <div className={styles.admin}><AppointmentsAdminUnlock salone={salon} compact /></div>
        </div>
      </header>
      <div className={styles.columns} onKeyDownCapture={event => {
        const target = event.target as HTMLElement;
        // Native input editing (including paste/selection) must remain intact.
        // Scope shortcuts to this login surface, never to the admin dialog.
        if (target.closest("input, textarea, select, [contenteditable='true']")) return;
        const action = appointmentPinKey({ ...event, isComposing: event.nativeEvent.isComposing });
        if (!action) return;
        // Enter on a profile must retain normal keyboard button activation.
        if (action === "submit" && !target.closest("form")) return;
        event.preventDefault();
        event.stopPropagation();
        if (busy || inFlight.current) return;
        if (action === "submit") { void enter(); return; }
        setError("");
        setPin(value => action === "backspace" ? value.slice(0, -1) : action === "clear" ? "" : `${value}${action}`.slice(0, pinLength));
        pinInput.current?.focus({ preventScroll: true });
      }}>
      <section aria-label="Personale disponibile" className={styles.profiles}>
        <div className={styles.panelHeading}><div><h2>Il tuo profilo {staffState === "ready" && <span className={styles.count}>{workers.length}</span>}</h2><p>Scegli la tua foto</p></div><button type="button" disabled={staffState === "loading" || busy} onClick={() => setStaffRetry(value => value + 1)} aria-label="Aggiorna personale" title="Aggiorna personale" className={styles.refresh}><RefreshCw aria-hidden className={`size-4 ${staffState === "loading" ? "animate-spin" : ""}`} /></button></div>
        {staffState === "loading" && <p role="status" className={styles.message}>Caricamento personale…</p>}
        {staffState === "error" && <div role="status" className={styles.message}>Foto non disponibili. Puoi comunque inserire il PIN. <button type="button" onClick={() => setStaffRetry(value => value + 1)} className={styles.link}>Riprova</button></div>}
        {staffState === "ready" && workers.length === 0 && <p className={styles.message}>Nessun profilo disponibile in questo salone. Verifica la timbratura con la reception.</p>}
        {workers.length > 0 && <ul className={styles.profileGrid}>
          {workers.map(worker => <li key={worker.id} className="min-w-0 text-center">
            <button type="button" disabled={busy} aria-pressed={selectedWorker?.id === worker.id} aria-label={`Accedi come ${worker.name}`} onClick={() => chooseWorker(worker)} className={styles.profile}>
            {selectedWorker?.id === worker.id && <span className={styles.selectedCheck}><Check aria-hidden className="size-3.5" /></span>}
            <StaffPortrait worker={worker} />
            <p className="mt-3 break-words text-sm font-semibold leading-snug">{worker.name}</p>
            <p className={styles.status} data-paused={worker.status === "BREAK"}><span aria-hidden />{worker.status === "BREAK" ? "In pausa" : "Disponibile"}</p>
            </button>
          </li>)}
        </ul>}
      </section>
      <form onSubmit={event => { event.preventDefault(); void enter(); }} className={styles.pinPanel}>
        <div className={styles.identity} aria-live="polite">
          {selectedWorker ? <StaffPortrait worker={selectedWorker} compact /> : <span className={styles.lock}><LockKeyhole aria-hidden className="size-5" /></span>}
          <div className="min-w-0"><h2>{selectedWorker?.name ?? "Accesso con PIN"}</h2><p>{selectedWorker ? "Profilo selezionato" : "Senza selezionare una foto"}</p></div>
        </div>
        <label className="block text-sm font-medium" htmlFor="appointment-entry-pin">{selectedWorker ? "Inserisci le prime 2 cifre del PIN" : "Inserisci il PIN completo di 4 cifre"}</label>
        <input ref={pinInput} id="appointment-entry-pin" type="password" inputMode="numeric" pattern={`[0-9]{${pinLength}}`} maxLength={pinLength} autoComplete="off" placeholder={selectedWorker ? "••" : "••••"} value={pin} disabled={busy}
          onChange={event => { setPin(event.target.value.replace(/\D/g, "").slice(0, pinLength)); setError(""); }}
          aria-describedby={error ? "appointment-entry-error" : undefined} aria-invalid={Boolean(error)}
          className={styles.pinInput} />
        <div className={styles.keypad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Cancella", "0", "Indietro"].map(key => <button key={key} type="button" disabled={busy} aria-label={key} onClick={() => {
            setError(""); setPin(value => key === "Cancella" ? "" : key === "Indietro" ? value.slice(0, -1) : `${value}${key}`.slice(0, pinLength));
            pinInput.current?.focus({ preventScroll: true });
          }}>{key === "Indietro" ? <Delete aria-hidden className="size-5" /> : key === "Cancella" ? <span className="text-xs">Cancella</span> : key}</button>)}
        </div>
        {error && <p id="appointment-entry-error" role="alert" className={styles.error}>{error}</p>}
        <button type="submit" disabled={busy || pin.length !== pinLength} className={styles.enter}>{busy ? <><Loader2 className="size-5 animate-spin" />Accesso…</> : <>Entra <ArrowRight aria-hidden className="size-4" /></>}</button>
        {selectedWorker && <button type="button" disabled={busy} onClick={() => chooseWorker(null)} className={styles.link}>Usa il PIN completo</button>}
      </form>
      </div>
    </div>
  </section>;
}

function StaffPortrait({ worker, compact = false }: { worker: PinEntryWorker; compact?: boolean }) {
  const url = resolveDrivePhotoUrl(worker.photo_url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={styles.portrait} data-compact={compact}>
    {url && failedUrl !== url ? <img src={url} alt={`Foto di ${worker.name}`} onError={() => setFailedUrl(url)} className="size-full object-cover object-top" /> : <span aria-label={`Foto non disponibile per ${worker.name}`}>{worker.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span>}
  </div>;
}
