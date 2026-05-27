"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";

export function TabletActivation({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Registrazione del tablet in corso...");

  useEffect(() => {
    let active = true;
    async function activate() {
      const response = await fetch("/api/devices/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!active) return;
      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Non e stato possibile registrare il tablet.");
        return;
      }
      setState("ready");
      setMessage("Tablet autorizzato. Apertura timbratura...");
      window.setTimeout(() => {
        window.location.href = `/tablet-clock?device=${encodeURIComponent(data.deviceId)}`;
      }, 900);
    }
    if (!token) {
      setState("error");
      setMessage("Link di attivazione mancante.");
    } else {
      void activate();
    }
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-paradise-nude p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-9 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-black/40">Paradise Beauty</p>
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-paradise-softPink">
          {state === "loading" ? <LoaderCircle className="size-8 animate-spin" /> : null}
          {state === "ready" ? <CheckCircle2 className="size-8 text-emerald-600" /> : null}
          {state === "error" ? <ShieldAlert className="size-8 text-red-600" /> : null}
        </div>
        <h1 className="mt-6 text-2xl font-semibold">Attivazione tablet</h1>
        <p className="mt-3 text-sm text-black/55">{message}</p>
      </section>
    </main>
  );
}
