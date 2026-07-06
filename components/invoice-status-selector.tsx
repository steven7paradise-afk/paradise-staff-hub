"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InvoiceStatusSelectorProps = {
  responseId: string;
  initialStatus: string;
};

const INVOICE_STATUSES = [
  { value: "NEW", label: "Da Fare", color: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" },
  { value: "EMESSA", label: "Fattura Emessa", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" },
  { value: "ANNULLATA", label: "Annullata", color: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" },
];

export function InvoiceStatusSelector({ responseId, initialStatus }: InvoiceStatusSelectorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [updating, setUpdating] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setUpdating(true);
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Errore durante l'aggiornamento");
      setStatus(newStatus);
    } catch (err) {
      console.error(err);
      alert("Errore nell'aggiornamento dello stato. Riprova.");
    } finally {
      setUpdating(false);
    }
  };

  const currentConfig = INVOICE_STATUSES.find(s => s.value === status) || INVOICE_STATUSES[0];

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {updating && (
        <Loader2 className="size-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
      )}
      <select
        value={status}
        onChange={handleChange}
        disabled={updating}
        className={cn(
          "appearance-none rounded-full px-3 py-1 text-xs font-black border transition cursor-pointer outline-none pr-8 relative",
          currentConfig.color
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%230e7490' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 0.6rem center",
          backgroundSize: "0.75rem 0.75rem",
          backgroundRepeat: "no-repeat"
        }}
      >
        {INVOICE_STATUSES.map((s) => (
          <option key={s.value} value={s.value} className="bg-white dark:bg-[#121212] text-black dark:text-white">
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
