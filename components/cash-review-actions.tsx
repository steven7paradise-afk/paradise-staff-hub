"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type CashReview = {
  status?: string;
  note?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
};

const statusOptions = [
  { value: "DA_CONTROLLARE", label: "Da controllare" },
  { value: "CORRETTO", label: "Corretto" },
  { value: "ERRORE", label: "Errore" },
];

export function CashReviewActions({
  closingId,
  initialReview,
  compact = false,
}: {
  closingId: string;
  initialReview?: CashReview | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(initialReview?.status ?? "DA_CONTROLLARE");
  const [note, setNote] = useState(initialReview?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/cash/closing-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingId, status, note }),
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Errore durante il salvataggio del controllo.");
      return;
    }
    setIsEditing(false);
    router.refresh();
  }

  const statusColorMap = {
    DA_CONTROLLARE: "bg-amber-50 text-amber-700 border-amber-200/50",
    CORRETTO: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
    ERRORE: "bg-red-50 text-red-700 border-red-200/50",
  };

  const statusLabelMap = {
    DA_CONTROLLARE: "Da controllare",
    CORRETTO: "Corretto",
    ERRORE: "Errore",
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[#FAF7F9] px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
            statusColorMap[status as keyof typeof statusColorMap] || statusColorMap.DA_CONTROLLARE
          )}>
            {status === "ERRORE" ? <TriangleAlert className="size-2.5" /> : status === "CORRETTO" ? <CheckCircle2 className="size-2.5" /> : null}
            {statusLabelMap[status as keyof typeof statusLabelMap] || "Da controllare"}
          </span>
          {initialReview?.note?.trim() ? (
            <span className="text-black/60 italic truncate max-w-[200px] sm:max-w-[450px]">
              - "{initialReview.note}"
            </span>
          ) : (
            <span className="text-black/35 italic">- Nessuna nota di controllo</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-black/50 hover:text-black font-black text-[11px] underline flex items-center gap-1 transition shrink-0"
        >
          Modifica
        </button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-black/5 bg-[#FAF7F9] p-3", compact && "min-w-[280px]")}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/40">Modifica stato controllo</span>
        <button
          type="button"
          onClick={() => {
            setStatus(initialReview?.status ?? "DA_CONTROLLARE");
            setNote(initialReview?.note ?? "");
            setIsEditing(false);
          }}
          className="text-black/40 hover:text-black/70"
        >
          <X className="size-4" />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatus(option.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black transition",
              status === option.value
                ? option.value === "ERRORE"
                  ? "bg-red-100 text-red-700"
                  : option.value === "CORRETTO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                : "bg-white text-black/45"
            )}
          >
            {option.value === "ERRORE" ? <TriangleAlert className="size-3" /> : option.value === "CORRETTO" ? <CheckCircle2 className="size-3" /> : null}
            {option.label}
          </button>
        ))}
      </div>
      
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={compact ? 2 : 3}
        placeholder="Nota responsabile..."
        className="mt-3 w-full rounded-2xl border border-black/10 bg-white p-3 text-xs font-semibold outline-none focus:border-[#A74758]"
      />
      
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-black/35 truncate max-w-[180px] sm:max-w-[280px]">
          {initialReview?.reviewed_by_name ? `Ultimo: ${initialReview.reviewed_by_name}` : "Azione rapida chiusura"}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setStatus(initialReview?.status ?? "DA_CONTROLLARE");
              setNote(initialReview?.note ?? "");
              setIsEditing(false);
            }}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-black text-black/60 hover:bg-black/5"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[#111017] px-4 text-xs font-black text-white disabled:opacity-50 hover:bg-black/90"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
