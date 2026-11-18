"use client";

import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { PCAccessMode } from "@/lib/appointments-pc-auth";

interface PcRegisterFormProps {
  code: string;
  initialPcName: string;
  accessMode?: PCAccessMode;
}

export function PcRegisterForm({ code, initialPcName, accessMode = "worker" }: PcRegisterFormProps) {
  const reception = accessMode === "reception";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activatedName, setActivatedName] = useState(initialPcName);
  const [appointmentUrl, setAppointmentUrl] = useState("/appointments");

  const handleActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/appointments/pc/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Impossibile attivare il dispositivo. Riprova.");
      }

      setActivatedName(data.name || initialPcName);
      setAppointmentUrl(data.appointmentUrl || "/appointments");
      setStatus("success");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Errore durante l'attivazione.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="size-16 text-emerald-500 stroke-[1.5]" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-serif font-light tracking-wide uppercase text-neutral-900">
            PC {reception ? "Reception" : "Lavoratori"} attivato
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
            DISPOSITIVO ABILITATO
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#F6FAF8] border border-[#DCEBE4] text-neutral-800 text-sm font-semibold space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">NOME DEL PC</div>
          <div className="text-base text-neutral-900 font-serif font-light tracking-wide">{activatedName.toUpperCase()}</div>
        </div>
        
        <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto font-normal">
          {reception
            ? "Questo browser è autorizzato per la reception. Per accedere, inserisci il tuo PIN personale una volta al giorno."
            : "Questo browser è autorizzato per i lavoratori. Ogni persona accede al proprio profilo con il PIN personale."}
        </p>

        <div className="pt-4">
          <Link
            href={appointmentUrl}
            className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition"
          >
            {reception ? "Apri la Reception" : "Scegli profilo staff"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full border border-neutral-300 flex items-center justify-center font-serif text-lg tracking-widest text-neutral-800 bg-[#FAF6F5]">
          P
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl md:text-2xl font-serif font-light tracking-wide uppercase text-neutral-900">
          Attivazione PC {reception ? "Reception" : "Lavoratori"}
        </h1>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A56A42]">
          CONFIGURAZIONE DISPOSITIVO
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#FFF5F6] border border-[#FADCDD] text-xs text-[#A04E59] font-semibold text-left leading-relaxed">
          <AlertCircle size={16} className="shrink-0 text-[#A04E59]" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm font-semibold space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">DISPOSITIVO DA ATTIVARE</div>
        <div className="text-base text-neutral-900 font-serif font-light tracking-wide">{initialPcName.toUpperCase()}</div>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto font-normal">
        {reception
          ? "Autorizza questo computer per la reception di Repubblica. L’accesso richiederà il PIN personale una volta al giorno."
          : "Autorizza questo computer per i lavoratori del salone. L’accesso al proprio profilo continuerà a richiedere il PIN personale."}
      </p>

      <form action="/api/appointments/pc/register" method="post" onSubmit={handleActivate} className="pt-4">
        <input type="hidden" name="code" value={code} />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition disabled:opacity-50"
        >
          {status === "loading" && <Loader2 className="size-4 animate-spin text-white" />}
          <span>{status === "loading" ? "ATTIVAZIONE..." : "CONFERMA E ATTIVA PC"}</span>
        </button>
      </form>
    </div>
  );
}
