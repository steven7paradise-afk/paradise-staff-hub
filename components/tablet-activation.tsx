"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle, RotateCw, ShieldAlert } from "lucide-react";

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
  const [state, setState] = useState<ActivationState>({ phase: "activating", message: "Tieni aperta questa pagina mentre registriamo il tablet." });
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const activation = useRef<{ token: string; result: Promise<string> } | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ phase: "error", message: "Apri il link di attivazione che trovi in Impostazioni → Dispositivi.", retryVerification: false });
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
        setState({ phase: "verifying", message: "Verifichiamo che il browser abbia ricevuto l’autorizzazione." });
        const verifiedDeviceId = await tabletActivationRequest();
        if (!active) return;
        if (verifiedDeviceId !== deviceId) {
          throw new Error("Questo browser ha un’altra autorizzazione. Apri il nuovo link sul tablet da attivare.");
        }
        setState({ phase: "ready", message: "La timbratrice si aprirà tra poco." });
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

  const registered = state.phase === "verifying" || state.phase === "ready" ||
    (state.phase === "error" && state.retryVerification);
  const failed = state.phase === "error";
  const ready = state.phase === "ready";
  const title = failed
    ? registered ? "Verifica non riuscita" : "Attivazione non riuscita"
    : ready ? "Tablet autorizzato" : "Attiva la timbratrice";
  const steps = [
    { label: "Registrazione del tablet", complete: registered, current: !registered },
    { label: "Verifica del browser", complete: ready, current: registered && !ready },
  ];

  return (
    <main className="grid min-h-dvh place-items-center bg-paradise-nude px-4 py-8 text-paradise-noir sm:px-8">
      <section aria-labelledby="clock-activation-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft sm:p-9">
        <Image src="/tablet-clock-icon-192.png" width={52} height={52} alt="Paradise" unoptimized className="mb-5 rounded-xl" />
        <div role="status" aria-atomic="true">
          <h1 id="clock-activation-title" className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5e474e] sm:text-base">{state.message}</p>
        </div>

        <ol aria-label="Passaggi dell’attivazione" className="my-5 divide-y divide-[#eadce1] border-y border-[#eadce1]">
          {steps.map((step) => {
            const blocked = step.current && failed;
            const progress = step.complete ? "Completata" : blocked ? "Da verificare" : step.current ? "In corso" : "In attesa";
            const Icon = step.complete ? Check : blocked ? ShieldAlert : step.current ? LoaderCircle : null;
            return (
              <li key={step.label} aria-current={step.current ? "step" : undefined} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5">
                <span className="flex items-center gap-2.5 text-sm font-medium sm:text-base">
                  <span className="grid size-5 shrink-0 place-items-center">
                    {Icon ? (
                      <Icon aria-hidden="true" className={`size-5 ${step.complete ? "text-emerald-700" : blocked ? "text-[#a12242]" : "text-[#842548] motion-safe:animate-spin"}`} />
                    ) : (
                      <span aria-hidden="true" className="size-2 rounded-full bg-[#b89da8]" />
                    )}
                  </span>
                  {step.label}
                </span>
                <span className={`pl-7 text-sm sm:pl-0 ${blocked ? "font-semibold text-[#a12242]" : "text-[#654d56]"}`}>{progress}</span>
              </li>
            );
          })}
        </ol>

        {state.phase === "error" && state.retryVerification ? (
          <button type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#600d19] px-5 py-3 text-sm font-semibold text-white hover:bg-[#78192c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#600d19] sm:w-auto" onClick={() => setVerificationAttempt((attempt) => attempt + 1)}>
            <RotateCw aria-hidden="true" className="size-4" />
            Riprova verifica
          </button>
        ) : null}
      </section>
    </main>
  );
}
