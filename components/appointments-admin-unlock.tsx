"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";

export function AppointmentsAdminUnlock({
  salone,
  compact = false,
}: {
  salone: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (loading) return;
    setOpen(false);
    setPin("");
    setError("");
  }

  function addDigit(digit: string) {
    setPin((current) => `${current}${digit}`.slice(0, 6));
    setError("");
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setError("Inserisci il PIN completo di 4–6 cifre.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/appointments/pc/admin-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, salone }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Accesso amministratore non riuscito.");
      const login = await signIn("credentials", { pin, redirect: false });
      if (login?.error) throw new Error("PIN amministratore non riconosciuto.");
      setPin("");
      router.replace(data?.appointmentUrl || "/appointments");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accesso amministratore non riuscito.");
      setPin("");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mx-auto grid place-items-center rounded-full border border-[#D8B7A7]/55 bg-white/55 text-neutral-950 shadow-[0_14px_40px_rgba(120,82,64,0.10)] transition hover:-translate-y-0.5 hover:bg-white active:scale-95 ${compact ? "size-12" : "size-16"}`}
        aria-label="Accesso amministratore"
        title="Accesso amministratore"
      >
        <LockKeyhole className={compact ? "size-6" : "size-7"} strokeWidth={1.45} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/35 px-5 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 cursor-default" onClick={close} aria-label="Chiudi accesso amministratore" />
          <form
            onSubmit={unlock}
            className="relative w-full max-w-sm rounded-[30px] border border-[#E6CEC4] bg-[#FFFBF6] p-5 text-center shadow-[0_28px_90px_rgba(60,38,28,0.28)]"
          >
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="ml-auto grid size-11 place-items-center rounded-full border border-[#E6CEC4] bg-white text-neutral-700 transition hover:bg-[#FFF2EC] active:scale-95 disabled:opacity-45"
              aria-label="Chiudi"
            >
              <X className="size-5" />
            </button>
            <span className="mx-auto mt-1 grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-lg">
              <ShieldCheck className="size-7" />
            </span>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#A56A42]">Accesso protetto</p>
            <h3 className="mt-1 font-serif text-3xl font-light text-neutral-950">Amministratore</h3>
            <p className="mt-2 text-sm font-semibold leading-5 text-neutral-500">Inserisci il PIN completo che usi per la timbratura.</p>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800" role="alert" aria-live="polite">
                {error}
              </div>
            ) : null}

            <div className="mx-auto mt-5 flex h-14 max-w-56 items-center justify-center gap-3 rounded-2xl border border-[#D8B7A7]/70 bg-white/80 px-4" aria-label={`${pin.length} cifre inserite`}>
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className={`size-3 rounded-full border-2 ${pin.length > index ? "border-[#C96F70] bg-[#C96F70]" : "border-neutral-300"}`} />
              ))}
            </div>

            <div className="mx-auto mt-5 grid w-[252px] grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button key={digit} type="button" disabled={loading || pin.length >= 6} onClick={() => addDigit(digit)} className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35">
                  {digit}
                </button>
              ))}
              <button type="button" disabled={loading || !pin} onClick={() => setPin((current) => current.slice(0, -1))} className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-neutral-950 transition active:scale-95 disabled:opacity-35" aria-label="Cancella una cifra">
                <X className="size-5" />
              </button>
              <button type="button" disabled={loading || pin.length >= 6} onClick={() => addDigit("0")} className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 transition active:scale-95 disabled:opacity-35">0</button>
              <button type="button" disabled={loading || !pin} onClick={() => setPin("")} className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700 transition active:scale-95 disabled:opacity-35">Cancella</button>
            </div>

            <button type="submit" disabled={loading || pin.length < 4} className="mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-neutral-950 px-6 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition hover:bg-neutral-800 active:scale-95 disabled:pointer-events-none disabled:opacity-35">
              {loading ? <Loader2 className="size-5 animate-spin" /> : <><span>Accedi con tutti i permessi</span><ArrowRight className="size-5" /></>}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
