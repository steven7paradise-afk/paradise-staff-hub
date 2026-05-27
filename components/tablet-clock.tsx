"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Coffee, Delete, LogIn, LogOut, MapPin, RefreshCw, Send, ShieldCheck, TriangleAlert, UserRound, Volume2, VolumeX, X } from "lucide-react";
import type { BrandingTheme } from "@/lib/branding";

const clockActions = [
  { type: "ENTRATA", label: "Entrata", icon: LogIn, dark: true },
  { type: "PAUSA", label: "Pausa", icon: Coffee, dark: false },
  { type: "RIENTRO", label: "Rientro", icon: RefreshCw, dark: false },
  { type: "USCITA", label: "Uscita", icon: LogOut, dark: true },
] as const;

const requestTypes = [
  { value: "FERIE", label: "Ferie" },
  { value: "PERMESSO", label: "Permesso" },
  { value: "RIPOSO", label: "Riposo" },
  { value: "MALATTIA", label: "Malattia" },
];

type ClockStatus = "OUT" | "IN" | "BREAK";
type TabletDevice = { id: string; name: string; locationName: string };
type IdentifiedWorker = { id: string; name: string; status: ClockStatus };

const statusLabels: Record<ClockStatus, string> = { OUT: "Non entrato", IN: "In turno", BREAK: "In pausa" };
const allowedActionsByStatus: Record<ClockStatus, string[]> = {
  OUT: ["ENTRATA"],
  IN: ["PAUSA", "USCITA"],
  BREAK: ["RIENTRO", "USCITA"],
};

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatClockWithSeconds(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function PinDots({ pin }: { pin: string }) {
  return (
    <div className="grid h-16 grid-cols-6 items-center rounded-[22px] border border-[#eadfd6] bg-white/58 px-8 sm:h-20">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className={`mx-auto size-4 rounded-full border-2 ${pin.length > index ? "border-[#aa7b47] bg-[#aa7b47]" : "border-[#171717]"}`} />
      ))}
    </div>
  );
}

function Keypad({ pin, setPin }: { pin: string; setPin: (pin: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
        <button key={key} className="h-14 rounded-xl border border-[#eadfd6] bg-white/62 text-xl font-medium shadow-sm active:scale-[0.98] sm:h-[62px]" onClick={() => setPin(pin.length < 6 ? `${pin}${key}` : pin)}>
          {key}
        </button>
      ))}
      <button className="grid h-14 place-items-center rounded-xl border border-[#eadfd6] bg-white/62 shadow-sm sm:h-[62px]" onClick={() => setPin(pin.slice(0, -1))}><Delete className="size-5" /></button>
      <button className="h-14 rounded-xl border border-[#eadfd6] bg-white/62 text-xl font-medium shadow-sm sm:h-[62px]" onClick={() => setPin(pin.length < 6 ? `${pin}0` : pin)}>0</button>
      <button className="grid h-14 place-items-center rounded-xl border border-[#eadfd6] bg-white/62 shadow-sm sm:h-[62px]" onClick={() => setPin("")}><X className="size-5" /></button>
    </div>
  );
}

export function TabletClock({ device, branding }: { device: TabletDevice | null; branding?: BrandingTheme }) {
  const [now, setNow] = useState(new Date());
  const [pin, setPinValue] = useState("");
  const [worker, setWorker] = useState<IdentifiedWorker | null>(null);
  const [message, setMessage] = useState("Inserisci il tuo codice personale");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState("FERIE");
  const [startDate, setStartDate] = useState("2026-06-10");
  const [endDate, setEndDate] = useState("2026-06-10");
  const [reason, setReason] = useState("");
  const [requestMessage, setRequestMessage] = useState("Il PIN gia inserito conferma questa richiesta come firma.");

  const visibleActions = worker ? clockActions.filter((action) => allowedActionsByStatus[worker.status].includes(action.type)) : [];
  const tabletStyle = {
    "--tablet-bg": branding?.background_color ?? "#fbf7f2",
    "--tablet-card": branding?.card_color ?? "#ffffff",
    "--tablet-text": branding?.text_color ?? "#171717",
    "--tablet-accent": branding?.gradient_color ?? "#a77a49",
    "--tablet-soft": branding?.secondary_color ?? "#f8ddd7",
    "--tablet-dark": branding?.text_color ?? "#1c1c1c",
  } as CSSProperties;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem("paradise-tablet-sound") !== "off");
  }, []);

  function sound(kind: "tap" | "success" | "error", force = false) {
    if (!soundEnabled && !force) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    const play = () => {
      const notes: Array<[number, number, number, OscillatorType, number]> = kind === "tap"
        ? [[720, 0, 0.07, "square", 0.16]]
        : kind === "success"
          ? [[523, 0, 0.14, "sine", 0.5], [659, 0.13, 0.18, "sine", 0.55], [880, 0.32, 0.34, "triangle", 0.6]]
          : [[235, 0, 0.24, "sawtooth", 0.58], [170, 0.23, 0.27, "sawtooth", 0.64], [115, 0.49, 0.4, "square", 0.68]];
      notes.forEach(([frequency, delay, duration, wave, volume]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = wave;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + duration + 0.03);
      });
    };
    if (context.state === "suspended") {
      void context.resume().then(play);
    } else {
      play();
    }
  }

  function showFeedback(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    if (type === "success") navigator.vibrate?.([70, 35, 70]);
    if (type === "error") navigator.vibrate?.([180, 60, 180, 60, 180]);
  }

  async function identifyPin(pinToRead = pin) {
    if (!/^\d{4,6}$/.test(pinToRead) || !device || identifying) return;
    setIdentifying(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      setMessage("Riconoscimento in corso...");
      const response = await fetch("/api/attendance/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({ pin: pinToRead }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        setWorker(null);
        setMessage(data.error ?? "Codice personale non riconosciuto.");
        showFeedback("error", data.error ?? "Codice personale non riconosciuto.");
        sound("error");
        return;
      }
      setWorker({ id: data.employeeId, name: data.employeeName, status: data.status });
      setMessage(`${data.employeeName}: ${statusLabels[data.status as ClockStatus]}`);
      showFeedback("success", `${data.employeeName} riconosciuta. Scegli l'azione.`);
      sound("success");
    } catch (error: unknown) {
      const timeoutError = error instanceof DOMException && error.name === "AbortError";
      setMessage(timeoutError ? "Lettura lenta. Riprova il PIN." : "Impossibile verificare il codice.");
      showFeedback("error", timeoutError ? "Lettura oltre 3 secondi. Riprova." : "Impossibile verificare il codice.");
      sound("error");
    } finally {
      window.clearTimeout(timeout);
      setIdentifying(false);
    }
  }

  useEffect(() => {
    if (pin.length === 6 && device) void identifyPin(pin);
    // La lettura a 6 cifre resta immediata; i PIN piu corti si inviano con il pulsante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, device]);

  useEffect(() => {
    if (!worker || requestOpen) return;
    const privacyTimeout = window.setTimeout(() => {
      setWorker(null);
      setPinValue("");
      setMessage("Inserisci il tuo codice personale");
      setFeedback(null);
    }, 30000);
    return () => window.clearTimeout(privacyTimeout);
  }, [worker, requestOpen]);

  function updatePin(next: string) {
    if (next !== pin) sound("tap");
    setPinValue(next);
    setWorker(null);
    setFeedback(null);
    setMessage(next.length < 4 ? "Inserisci il tuo codice personale" : next.length === 6 ? "Riconoscimento automatico..." : "Premi Invia PIN per continuare");
  }

  function finishPrivateOperation(text: string) {
    sound("success");
    showFeedback("success", text);
    setMessage(text);
    setWorker(null);
    setPinValue("");
  }

  async function clock(type: string) {
    if (!worker || !/^\d{4,6}$/.test(pin) || !device) return;
    setLoading(type);
    try {
      const response = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({ employeeId: worker.id, pin, type, note: "Timbratura tablet" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Timbratura non registrata.");
        showFeedback("error", data.error ?? "Timbratura non registrata.");
        sound("error");
        return;
      }
      finishPrivateOperation(`${type} registrata alle ${data.time}${data.adjusted ? ` (ora rilevata ${data.actualTime})` : ""}.`);
    } catch {
      setMessage("Connessione non disponibile. Timbratura non registrata.");
      showFeedback("error", "Connessione non disponibile. Timbratura non registrata.");
      sound("error");
    } finally {
      setLoading(null);
    }
  }

  async function sendLeaveRequest() {
    if (!worker || !device) return;
    setRequestMessage("Invio richiesta in corso...");
    try {
      const response = await fetch("/api/tablet-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({ pin, type: requestType, startDate, endDate, reason }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRequestMessage(data.error ?? "Richiesta non inviata.");
        showFeedback("error", data.error ?? "Richiesta non inviata.");
        sound("error");
        return;
      }
      setRequestOpen(false);
      setReason("");
      finishPrivateOperation("Richiesta inviata e firmata con codice personale.");
    } catch {
      setRequestMessage("Connessione non disponibile. Richiesta non inviata.");
      showFeedback("error", "Connessione non disponibile. Richiesta non inviata.");
      sound("error");
    }
  }

  if (!device) {
    return (
      <main className="grid min-h-screen place-items-center bg-[color:var(--tablet-bg)] p-5 text-[color:var(--tablet-text)]" style={tabletStyle}>
        <div className="rounded-[28px] border border-[#eadfd6] bg-white/80 px-10 py-12 text-center shadow-lg">
          <ShieldCheck className="mx-auto size-12 text-red-500" />
          <p className="mt-5 text-xl font-semibold">Dispositivo non autorizzato alla timbratura</p>
        </div>
      </main>
    );
  }

  function ActionCard({ action }: { action: (typeof clockActions)[number] }) {
    const Icon = action.icon;
    return (
      <button
        className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border border-black/10 px-4 shadow-[0_12px_36px_rgba(0,0,0,0.10)] active:scale-[0.99] lg:min-h-[190px] ${action.dark ? "bg-[color:var(--tablet-dark)] text-white" : "bg-[color:var(--tablet-card)]/72"}`}
        disabled={loading !== null}
        onClick={() => clock(action.type)}
      >
        <Icon className="size-9 text-[color:var(--tablet-accent)] lg:size-12" strokeWidth={1.4} />
        <p className="mt-3 text-sm uppercase tracking-[0.2em] lg:mt-5 lg:text-lg">{loading === action.type ? "Invio" : action.label}</p>
      </button>
    );
  }

  function BrandClock({ compact = false }: { compact?: boolean }) {
    return (
      <div className="text-center">
        <div className={`mx-auto grid place-items-center overflow-hidden ${compact ? "size-24" : "size-36 lg:size-44"}`}>
          {branding?.logo_url ? <img src={branding.logo_url} alt="Paradise Beauty" className="size-full object-contain" /> : <p className={`${compact ? "text-8xl" : "text-[140px]"} font-serif italic leading-none text-[color:var(--tablet-accent)]`}>P</p>}
        </div>
        <p className={`font-serif leading-none tracking-tight ${compact ? "mt-3 text-6xl" : "mt-2 text-7xl lg:text-[112px]"}`}>{formatClock(now)}</p>
        <p className="mt-2 text-base text-black/62 lg:text-lg">{formatDay(now)}</p>
      </div>
    );
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-[color:var(--tablet-bg)] p-2 text-[color:var(--tablet-text)] sm:p-4" style={tabletStyle}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] border-[10px] border-black bg-[color:var(--tablet-card)] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:px-7 sm:py-6 xl:border-[16px]">
        <header className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/70"><MapPin className="size-4 text-[color:var(--tablet-accent)]" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm">{device.locationName}</p>
              <p className="text-xs text-black/60 sm:text-sm">{device.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Test suono"
              className="flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 text-xs font-bold uppercase text-[color:var(--tablet-accent)]"
              onClick={() => {
                setSoundEnabled(true);
                window.localStorage.setItem("paradise-tablet-sound", "on");
                sound("success", true);
                showFeedback("info", "Test audio eseguito.");
              }}
            >
              <Volume2 className="size-5" /> <span className="hidden sm:inline">Test suono</span>
            </button>
            <button
              aria-label={soundEnabled ? "Suono attivo" : "Suono disattivato"}
              className="grid size-10 place-items-center rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 text-[color:var(--tablet-accent)]"
              onClick={() => {
                const enabled = !soundEnabled;
                setSoundEnabled(enabled);
                window.localStorage.setItem("paradise-tablet-sound", enabled ? "on" : "off");
                if (enabled) sound("success", true);
              }}
            >
              {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 py-2 text-xs font-bold uppercase text-emerald-600 sm:text-sm">
              <ShieldCheck className="size-4" /> Autorizzato
            </div>
          </div>
        </header>

        {!worker ? (
          <section className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 items-center gap-8 py-3 lg:grid-cols-[440px_1fr]">
            <div className="mx-auto w-full max-w-[440px]">
              {feedback ? (
                <div className={`mb-3 flex min-h-12 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-bold shadow-sm ${
                  feedback.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-[#eadfd6] bg-white/70 text-black/70"
                }`}>
                  {feedback.type === "error" ? <TriangleAlert className="size-5" /> : <ShieldCheck className="size-5" />}
                  <span>{feedback.text}</span>
                </div>
              ) : null}
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--tablet-accent)]">Codice personale</p>
              <PinDots pin={pin} />
              <p className="my-2 text-center text-sm font-semibold text-black/55">{identifying ? "Riconoscimento..." : pin.length === 6 ? "Lettura automatica in corso..." : "Inserisci il PIN e premi Invia."}</p>
              <Keypad pin={pin} setPin={updatePin} />
              <button
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--tablet-dark)] text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!/^\d{4,6}$/.test(pin) || identifying}
                onClick={() => void identifyPin()}
              >
                <Send className="size-4 text-[color:var(--tablet-accent)]" /> {identifying ? "Lettura..." : "Invia PIN"}
              </button>
            </div>
            <div className="hidden lg:block">
              <BrandClock />
            </div>
          </section>
        ) : (
          <section className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1250px] flex-1 items-center gap-8 py-3 lg:grid-cols-[minmax(460px,1fr)_390px]">
            <div className="grid grid-cols-2 gap-4">
              {visibleActions.map((action) => <ActionCard key={action.type} action={action} />)}
              <div className="col-span-2 flex min-h-20 items-center justify-between rounded-2xl border border-black/10 bg-[color:var(--tablet-card)]/58 px-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--tablet-accent)]">Stato turno</p>
                <p className="text-xl font-semibold">{statusLabels[worker.status]}</p>
              </div>
            </div>
            <div>
              <BrandClock compact />
              {feedback ? (
                <div className={`mt-4 flex min-h-14 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-bold shadow-sm ${
                  feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
                }`}>
                  {feedback.type === "success" ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
                  <span>{feedback.text}</span>
                </div>
              ) : null}
              <p className="mt-3 text-center text-lg font-semibold">{worker.name}</p>
              <button
                className="mt-3 flex h-14 w-full items-center justify-between rounded-2xl bg-[color:var(--tablet-soft)] px-5 text-left shadow-sm"
                onClick={() => { setRequestMessage("Il PIN gia inserito conferma questa richiesta come firma."); setRequestOpen(true); }}
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="size-6 text-[color:var(--tablet-accent)]" />
                  <div>
                    <p className="text-sm uppercase tracking-[0.14em]">Ferie / Permessi</p>
                    <p className="text-xs text-black/55">Invia richiesta firmata</p>
                  </div>
                </div>
                <ArrowRight className="size-5" />
              </button>
              <button
                className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white/60 text-sm font-semibold"
                onClick={() => {
                  setWorker(null);
                  setPinValue("");
                  setFeedback(null);
                  setMessage("Inserisci il tuo codice personale");
                }}
              >
                Cambia lavoratore
              </button>
            </div>
          </section>
        )}

        <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-8 border-t border-black/10 pt-4 text-xs text-black/58 sm:text-sm">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[color:var(--tablet-accent)]" /> Dispositivo autorizzato</span>
          <span>Sincronizzazione: <strong>{formatClockWithSeconds(now)}</strong></span>
        </footer>

        {requestOpen && worker ? (
          <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-[color:var(--tablet-bg)]/92 p-4 backdrop-blur-xl">
            <section className="w-full max-w-3xl rounded-[28px] border border-black/10 bg-[color:var(--tablet-card)]/92 p-5 shadow-xl sm:p-7">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--tablet-accent)]">Richiesta firmata</p>
                  <h2 className="mt-2 text-2xl font-semibold">Ferie, permessi o riposo</h2>
                  <p className="mt-2 text-sm text-black/55">{worker.name}</p>
                </div>
                <button className="grid size-10 place-items-center rounded-xl border border-black/10" onClick={() => setRequestOpen(false)}><X className="size-5" /></button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <select className="h-14 rounded-2xl border border-[#eadfd6] bg-white px-4" value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                  {requestTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input className="h-14 rounded-2xl border border-[#eadfd6] px-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (opzionale)" />
                <input className="h-14 rounded-2xl border border-[#eadfd6] px-4" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <input className="h-14 rounded-2xl border border-[#eadfd6] px-4" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                <div className="rounded-2xl bg-[#f8ddd7] p-4 text-sm text-black/65 sm:col-span-2">
                  <UserRound className="mb-2 size-5 text-[#a77a49]" />
                  La richiesta e confermata dal codice personale inserito e comparira nel planning dopo l'approvazione Admin.
                </div>
              </div>
              <button className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#1c1c1c] text-sm font-semibold uppercase tracking-[0.14em] text-white" onClick={sendLeaveRequest}>
                <Send className="size-5 text-[#c9a06a]" /> Invia richiesta
              </button>
              <p className="mt-3 text-center text-sm font-medium text-black/58">{requestMessage}</p>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
