"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, FilePlus2, Loader2, Trash2 } from "lucide-react";

const SIBILL_WEB_APP_URL = "https://app.sibill.com/cashflow";

type DraftState = {
  id: string;
  status: string;
  number?: string;
  paymentStatus?: string;
  warnings?: string[];
} | null;

export function CreateSibillDraftButton({
  responseId,
  initialDraft,
}: {
  responseId: string;
  initialDraft: DraftState;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const createDraft = async () => {
    if (draft || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${responseId}/sibill-draft`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bozza non creata. Riprova.");
      setDraft(data.draft);
      const warnings = Array.isArray(data.draft?.warnings) ? data.draft.warnings : [];
      setMessageTone(warnings.length ? "error" : "success");
      setMessage(warnings.length
        ? `Bozza creata. ${warnings.join(" ")}`
        : data.alreadyCreated
          ? "Bozza già presente su Sibill."
          : "Bozza creata e registrata come incassata. Non è stata inviata allo SdI.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Bozza non creata. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft || deleting) return;
    const confirmed = window.confirm("Eliminare questa bozza da Sibill? La richiesta di fattura resterà nel gestionale.");
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${responseId}/sibill-draft`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bozza non eliminata. Riprova.");
      setDraft(null);
      setMessageTone("success");
      setMessage("Bozza eliminata da Sibill. Ora puoi crearne una nuova.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Bozza non eliminata. Riprova.");
    } finally {
      setDeleting(false);
    }
  };

  if (draft) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          Bozza Sibill{draft.number ? ` ${draft.number}` : ""}
        </span>
        {draft.paymentStatus === "PAID" && (
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            Incassata
          </span>
        )}
        <a
          href={SIBILL_WEB_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#0e7490]/25 bg-white px-3 py-2 text-xs font-black text-[#0e7490] shadow-sm transition hover:border-[#0e7490]/50 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:bg-slate-950 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
          aria-label="Controlla la bozza nell'app Sibill (si apre in una nuova scheda)"
        >
          Controlla in Sibill
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={deleteDraft}
          disabled={deleting}
          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          {deleting ? "Elimino…" : "Elimina bozza"}
        </button>
        {message && <span className={`max-w-48 text-center text-[10px] leading-4 ${messageTone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={createDraft}
        disabled={loading}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[#0e7490] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#155e75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
        {loading ? "Creo la bozza…" : "Crea bozza Sibill"}
      </button>
      {message && <span className={`max-w-52 text-center text-[10px] font-semibold leading-4 ${messageTone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{message}</span>}
    </div>
  );
}
