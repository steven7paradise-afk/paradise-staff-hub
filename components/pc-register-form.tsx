"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface PcRegisterFormProps {
  code: string;
  initialPcName: string;
}

export function PcRegisterForm({ code, initialPcName }: PcRegisterFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activatedName, setActivatedName] = useState(initialPcName);

  const handleActivate = async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/appointments/pc/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossibile attivare il dispositivo.");
      }

      setActivatedName(data.name || initialPcName);
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
            PC Cassa Attivato
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
            DISPOSITIVO ABILITATO
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#F6FAF8] border border-[#DCEBE4] text-neutral-800 text-sm font-semibold space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">NOME PC CASSA</div>
          <div className="text-base text-neutral-900 font-serif font-light tracking-wide">{activatedName.toUpperCase()}</div>
        </div>
        
        <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto font-normal">
          Questo browser è stato registrato ed è ora autorizzato a visualizzare l'agenda appuntamenti e le schede cliente senza inserire credenziali personali.
        </p>

        <div className="pt-4">
          <Link
            href="/appointments"
            className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition"
          >
            Accedi all'Agenda
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
          Attivazione PC Cassa
        </h1>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A56A42]">
          CONFIGURAZIONE DISPOSITIVO
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#FFF5F6] border border-[#FADCDD] text-xs text-[#A04E59] font-semibold text-left leading-relaxed">
          <AlertCircle size={16} className="shrink-0 text-[#A04E59]" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm font-semibold space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">DISPOSITIVO DA ATTIVARE</div>
        <div className="text-base text-neutral-900 font-serif font-light tracking-wide">{initialPcName.toUpperCase()}</div>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto font-normal">
        Clicca sul pulsante qui sotto per confermare l'attivazione e registrare questo computer come cassa del salone.
      </p>

      <div className="pt-4">
        <button
          type="button"
          onClick={handleActivate}
          disabled={status === "loading"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition disabled:opacity-50"
        >
          {status === "loading" && <Loader2 className="size-4 animate-spin text-white" />}
          <span>{status === "loading" ? "ATTIVAZIONE..." : "CONFERMA E ATTIVA PC"}</span>
        </button>
      </div>
    </div>
  );
}
