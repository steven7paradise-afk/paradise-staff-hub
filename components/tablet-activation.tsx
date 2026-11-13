"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";

async function tabletActivationRequest(token?: string): Promise<string> {
  const response = await fetch("/api/devices/activate", {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    ...(token ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    } : {}),
  }).catch(() => {
    throw new Error("Connessione non disponibile. Verifica la rete del tablet e riprova.");
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.deviceId !== "string") {
    throw new Error(typeof data?.error === "string" ? data.error : "Il server non ha confermato l’autorizzazione del tablet.");
  }
  return data.deviceId;
}

type ActivationState =
  | { phase: "activating" | "verifying" | "ready"; message: string }
  | { phase: "error"; message: string; retryVerification: boolean };

export function TabletActivation({ token }: { token: string }) {
  const [state, setState] = useState<ActivationState>({ phase: "activating", message: "Registrazione del tablet in corso…" });
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const activation = useRef<{ token: string; result: Promise<string> } | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ phase: "error", message: "Link di attivazione mancante.", retryVerification: false });
      return;
    }
    if (activation.current?.token !== token) {
      activation.current = { token, result: tabletActivationRequest(token) };
    }
    const { result } = activation.current;
    let active = true;
    async function finishActivation() {
      let deviceId: string | undefined;
      try {
        deviceId = await result;
        if (!active) return;
        setState({ phase: "verifying", message: "Verifica dell’autorizzazione sul tablet…" });
        const verifiedDeviceId = await tabletActivationRequest();
        if (!active) return;
        if (verifiedDeviceId !== deviceId) {
          throw new Error("Questo browser ha un’altra autorizzazione. Apri il nuovo link sul tablet da attivare.");
        }
        setState({ phase: "ready", message: "Tablet autorizzato. Apertura timbratura…" });
        window.location.replace("/tablet-clock");
      } catch (error) {
        if (active) {
          setState({
            phase: "error",
            message: error instanceof Error ? error.message : "Verifica del tablet non riuscita.",
            retryVerification: Boolean(deviceId),
          });
        }
      }
    }
    void finishActivation();
    return () => {
      active = false;
    };
  }, [token, verificationAttempt]);

  return (
    <main className="grid min-h-screen place-items-center bg-paradise-nude p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-9 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-black/40">Paradise Beauty</p>
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-paradise-softPink">
          {state.phase === "activating" || state.phase === "verifying" ? <LoaderCircle className="size-8 animate-spin" /> : null}
          {state.phase === "ready" ? <CheckCircle2 className="size-8 text-emerald-600" /> : null}
          {state.phase === "error" ? <ShieldAlert className="size-8 text-red-600" /> : null}
        </div>
        <h1 className="mt-6 text-2xl font-semibold">Attivazione tablet</h1>
        <p role="status" className="mt-3 text-sm text-black/55">{state.message}</p>
        {state.phase === "error" && state.retryVerification ? (
          <button type="button" className="mt-5 min-h-11 rounded-xl bg-black px-5 text-white" onClick={() => setVerificationAttempt((attempt) => attempt + 1)}>
            Riprova verifica
          </button>
        ) : null}
      </section>
    </main>
  );
}
