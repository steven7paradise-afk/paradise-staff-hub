"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

function money(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export function CashClosingAmountEditor({
  closingId,
  currentAmount,
  canEdit,
  dark = false,
  align = "right",
}: {
  closingId: string;
  currentAmount: number;
  canEdit: boolean;
  dark?: boolean;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(currentAmount.toFixed(2));
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setEditing(false);
    setAmount(currentAmount.toFixed(2));
    setJustification("");
    setError("");
  }

  async function save() {
    const nextAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setError("Inserisci un importo valido.");
      return;
    }
    if (!justification.trim()) {
      setError("La motivazione della modifica è obbligatoria.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/cash/closings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingId, withdrawn: nextAmount, justification }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Modifica non riuscita.");
      return;
    }
    setEditing(false);
    setJustification("");
    router.refresh();
  }

  if (!editing) {
    return (
      <div className={cn("flex flex-col gap-1", align === "right" ? "items-end text-right" : "items-start text-left")}>
        <p className={cn("font-black", dark ? "text-white" : "text-[#A74758]")}>{money(currentAmount)}</p>
        {canEdit ? (
          <button type="button" onClick={() => { setAmount(currentAmount.toFixed(2)); setEditing(true); }} className={cn("inline-flex items-center gap-1 text-[10px] font-black underline underline-offset-2", dark ? "text-[#F7DFA7]" : "text-[#A74758]")}>
            <Pencil className="size-3" /> Modifica importo
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-[260px] rounded-2xl border p-3 text-left", dark ? "border-white/15 bg-white/[0.06]" : "border-[#E8B6C0] bg-[#FFF8FA]")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[10px] font-black uppercase tracking-wider", dark ? "text-white/55" : "text-black/45")}>Rettifica importo</p>
        <button type="button" onClick={close} className={dark ? "text-white/55" : "text-black/40"} aria-label="Annulla modifica"><X className="size-4" /></button>
      </div>
      <label className="mt-3 block">
        <span className={cn("text-[10px] font-bold", dark ? "text-white/55" : "text-black/50")}>Nuovo importo</span>
        <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-black text-black outline-none focus:border-[#A74758]" />
      </label>
      <label className="mt-2 block">
        <span className={cn("text-[10px] font-bold", dark ? "text-white/55" : "text-black/50")}>Motivazione obbligatoria</span>
        <textarea value={justification} onChange={(event) => setJustification(event.target.value)} rows={2} placeholder="Spiega perché l'importo viene modificato..." className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-xs font-semibold text-black outline-none focus:border-[#A74758]" />
      </label>
      {error ? <p className={cn("mt-2 text-[11px] font-bold", dark ? "text-red-300" : "text-red-700")}>{error}</p> : null}
      <button type="button" onClick={save} disabled={saving} className={cn("mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-black disabled:opacity-50", dark ? "bg-[#F7DFA7] text-black" : "bg-[#A74758] text-white")}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Salva rettifica
      </button>
    </div>
  );
}
