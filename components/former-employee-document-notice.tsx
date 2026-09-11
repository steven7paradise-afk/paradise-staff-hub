"use client";

import { useState } from "react";
import { CalendarClock, Download, X } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export function FormerEmployeeDocumentNotice({ accessUntil }: { accessUntil: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Avviso accesso documenti">
      <div className="w-full max-w-lg rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FCE5F3] text-[#B83D7F]">
            <CalendarClock className="size-6" />
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600" aria-label="Chiudi avviso">
            <X className="size-5" />
          </button>
        </div>
        <h2 className="mt-5 text-xl font-black text-neutral-900">Scarica i tuoi documenti</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
          Il tuo rapporto di lavoro è terminato. Puoi accedere esclusivamente ai tuoi documenti personali per tre mesi.
        </p>
        <div className="mt-5 rounded-2xl border border-[#F3B5D4] bg-[#FFF0F7] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#B83D7F]">Ultimo giorno disponibile</p>
          <p className="mt-1 text-lg font-black capitalize text-neutral-900">{formatDate(accessUntil)}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#D96B94] px-5 text-sm font-bold text-white">
          <Download className="size-4" />
          Vai ai documenti
        </button>
      </div>
    </div>
  );
}
