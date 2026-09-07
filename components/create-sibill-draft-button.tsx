"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, FilePlus2, Loader2 } from "lucide-react";

const SIBILL_WEB_APP_URL = "https://app.sibill.com/cashflow";

type DraftState = {
  id: string;
  status: string;
  number?: string;
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
  const [message, setMessage] = useState("");

  const createDraft = async () => {
    if (draft || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${responseId}/sibill-draft`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bozza non creata. Riprova.");
      setDraft(data.draft);
      setMessage(data.alreadyCreated ? "Bozza già presente su Sibill." : "Bozza creata: non è stata inviata allo SdI.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bozza non creata. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  if (draft) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          Bozza Sibill{draft.number ? ` ${draft.number}` : ""}
        </span>
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
        {message && <span className="max-w-48 text-center text-[10px] leading-4 text-emerald-700 dark:text-emerald-300">{message}</span>}
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
      {message && <span className="max-w-52 text-center text-[10px] font-semibold leading-4 text-rose-600 dark:text-rose-300">{message}</span>}
    </div>
  );
}
