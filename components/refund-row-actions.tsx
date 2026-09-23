"use client";

import React, { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { refundStates, validRefundStates, refundStatusHistory, REFUND_STATUS_LABELS, REFUND_PAYMENT_LABELS } from "@/lib/refund-status";
import { cn } from "@/lib/utils";
import { DownloadRefundPdfButton } from "@/components/download-refund-pdf-button";

type RefundRowActionsProps = {
  responseId: string;
  initialStatus: string;
  initialNotes: any;
  initialActivityLog: unknown;
  refund: {
    id: string;
    created_at: string;
    user_location_name?: string | null;
    user: {
      name: string | null;
    } | null;
    status: string;
    internal_notes?: any;
    answers: any;
  };
};

const REFUND_STATUSES = [
  { value: "IN_PROGRESS", label: "In lavorazione", color: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200" },
  { value: "REFUNDED", label: "Rimborsato", color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200" },
  { value: "NEW", label: "In Attesa", color: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" },
  { value: "APPROVED", label: "Approvato", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" },
  { value: "REJECTED", label: "Non Approvato", color: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" },
];

function parseNoteText(notes: any): string {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object") {
    return notes.text || notes.note || "";
  }
  return String(notes);
}

export function RefundRowActions({ responseId, initialStatus, initialNotes, initialActivityLog, refund }: RefundRowActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(() => refundStates(initialStatus, initialNotes).approval);
  const [paymentStatus, setPaymentStatus] = useState(() => refundStates(initialStatus, initialNotes).payment);
  const [history, setHistory] = useState(() => refundStatusHistory(initialActivityLog));
  const [error, setError] = useState("");
  const [noteText, setNoteText] = useState(() => parseNoteText(initialNotes));
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, field: "status" | "paymentStatus" = "status") => {
    const newStatus = e.target.value;
    if (newStatus === "REFUNDED" && !window.confirm("Confermi che il rimborso è già stato eseguito? Questa azione registra il rimborso, ma non trasferisce denaro.")) return;
    setUpdatingStatus(true);
    setError("");
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newStatus, expectedStatus: status, expectedPaymentStatus: paymentStatus }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || "Errore durante l'aggiornamento");
      const states = refundStates(saved.status, saved.internal_notes);
      setStatus(states.approval);
      setPaymentStatus(states.payment);
      setHistory(refundStatusHistory(saved.activity_log));
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Stato non salvato. Riprova.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    setUpdatingNotes(true);
    setSaveSuccess(false);
    setError("");
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: { text: noteText } }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || "Errore durante il salvataggio");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Nota non salvata. Riprova.");
    } finally {
      setUpdatingNotes(false);
    }
  };

  const currentConfig = REFUND_STATUSES.find(s => s.value === status) || REFUND_STATUSES[0];
  const approvedBy = [...history].reverse().find((event) => event.to === "APPROVED");
  const latest = history.at(-1);
  const paymentBy = [...history].reverse().find(event => event.type === "REFUND_PAYMENT_CHANGE" || ["IN_PROGRESS", "REFUNDED"].includes(event.to));
  const dateLabel = (at: string) => new Date(at).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-3 min-w-[260px] max-w-sm">
      {/* Status Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/60">Approvazione:</span>
        <div className="relative inline-flex items-center gap-1.5">
          {updatingStatus && (
            <Loader2 className="size-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
          )}
          <select
            aria-label="Approvazione della richiesta"
            value={status}
            onChange={(event) => handleStatusChange(event)}
            disabled={updatingStatus || updatingNotes}
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
            {!Object.hasOwn(REFUND_STATUS_LABELS, status) && <option value={status}>Stato precedente: {status}</option>}
            {Object.entries(REFUND_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value} disabled={!validRefundStates(value, paymentStatus)} className="bg-white dark:bg-[#121212] text-black dark:text-white">
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-black/70 dark:text-white/70">
        Stato del rimborso:
        <select aria-label="Stato del pagamento del rimborso" value={paymentStatus}
          onChange={(event) => handleStatusChange(event, "paymentStatus")}
          disabled={updatingStatus || updatingNotes || status !== "APPROVED" || paymentStatus === "REFUNDED"}
          className="min-h-9 rounded-lg border border-black/20 bg-white px-2 text-black disabled:opacity-60 dark:border-white/20 dark:bg-neutral-900 dark:text-white">
          {Object.entries(REFUND_PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="text-xs text-black/60 dark:text-white/60">{status !== "APPROVED" ? "Il pagamento si abilita dopo l’approvazione. " : ""}Registra il rimborso, senza trasferire denaro.</p>
      <div className="space-y-1 text-xs text-black/70 dark:text-white/70">
        <p><strong>Approvato da:</strong> {approvedBy ? `${approvedBy.by} · ${dateLabel(approvedBy.at)}` : "Non registrato"}</p>
        <p><strong>Pagamento aggiornato da:</strong> {paymentBy ? `${paymentBy.by} · ${dateLabel(paymentBy.at)}` : "Non registrato"}</p>
        <p><strong>Ultimo aggiornamento:</strong> {latest ? `${latest.by} · ${dateLabel(latest.at)}` : "Non registrato"}</p>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}

      {/* Internal Notes Textarea */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/45 dark:text-white/45">Note Interne Admin:</span>
        <div className="relative flex flex-col gap-1">
          <textarea
            aria-label="Note interne del rimborso"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Scrivi una nota interna..."
            rows={2}
            className="w-full text-xs p-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-black dark:text-white outline-none resize-none focus:border-cyan-500/50 transition duration-200"
          />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-black/60 dark:text-white/60">Conferma con Salva nota</span>
            <button
              onClick={handleSaveNotes}
              disabled={updatingNotes || updatingStatus}
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
                "Salva nota"
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* PDF View/Download Button */}
      <div className="pt-2 border-t border-black/5 dark:border-white/5">
        <DownloadRefundPdfButton 
          refund={{
            ...refund,
            status,
            internal_notes: { text: noteText, refundPaymentStatus: paymentStatus }
          }} 
        />
      </div>
    </div>
  );
}
