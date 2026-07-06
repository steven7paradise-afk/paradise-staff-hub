"use client";

import React, { useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type RefundRowActionsProps = {
  responseId: string;
  initialStatus: string;
  initialNotes: any;
};

const REFUND_STATUSES = [
  { value: "NEW", label: "In Attesa", color: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" },
  { value: "APPROVED", label: "Approvato", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" },
  { value: "REJECTED", label: "Non Approvato", color: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" },
];

function parseNoteText(notes: any): string {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object") {
    return notes.text || notes.note || JSON.stringify(notes);
  }
  return String(notes);
}

export function RefundRowActions({ responseId, initialStatus, initialNotes }: RefundRowActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [noteText, setNoteText] = useState(() => parseNoteText(initialNotes));
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setUpdatingStatus(true);
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
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    setUpdatingNotes(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: { text: noteText } }),
      });
      if (!res.ok) throw new Error("Errore durante il salvataggio");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Errore nel salvataggio delle note interne. Riprova.");
    } finally {
      setUpdatingNotes(false);
    }
  };

  const currentConfig = REFUND_STATUSES.find(s => s.value === status) || REFUND_STATUSES[0];

  return (
    <div className="flex flex-col gap-3 min-w-[200px]">
      {/* Status Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/45 dark:text-white/45">Stato:</span>
        <div className="relative inline-flex items-center gap-1.5">
          {updatingStatus && (
            <Loader2 className="size-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
          )}
          <select
            value={status}
            onChange={handleStatusChange}
            disabled={updatingStatus}
            className={cn(
              "appearance-none rounded-full px-3 py-1 text-xs font-black border transition cursor-pointer outline-none pr-8 relative",
              currentConfig.color
            )}
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239F1239' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundPosition: "right 0.6rem center",
              backgroundSize: "0.75rem 0.75rem",
              backgroundRepeat: "no-repeat"
            }}
          >
            {REFUND_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-white dark:bg-[#121212] text-black dark:text-white">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Internal Notes Textarea */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/45 dark:text-white/45">Note Interne Admin:</span>
        <div className="relative flex flex-col gap-1">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Scrivi una nota interna..."
            rows={2}
            className="w-full text-xs p-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-black dark:text-white outline-none resize-none focus:border-cyan-500/50 transition duration-200"
          />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-black/30 dark:text-white/30">Autosalva al clic fuori</span>
            <button
              onClick={handleSaveNotes}
              disabled={updatingNotes}
              className="inline-flex items-center gap-1 font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition"
            >
              {updatingNotes ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Salvataggio...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span className="text-emerald-500 font-black">Salvato!</span>
                </>
              ) : (
                "Salva ora"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
