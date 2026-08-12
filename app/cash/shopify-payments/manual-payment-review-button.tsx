"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type Props = {
  payment: {
    orderId: string;
    orderName: string;
    clientName: string;
    amount: number;
    methods: string[];
    processedAt: string;
    responseId?: string | null;
  };
  review?: {
    status: string;
    requestedByName: string | null;
    requestedAt: string;
    confirmedByName: string | null;
  } | null;
  canConfirm: boolean;
};

export function ManualPaymentReviewButton({ payment, review, canConfirm }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmed = review?.status === "CONFIRMED";
  const requested = review?.status === "REQUESTED";

  async function submit(action: "REQUEST" | "CONFIRM") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cash/shopify-payments/manual-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payment }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Impossibile aggiornare il controllo.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Errore durante il controllo.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mt-2">
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-100 px-3 text-[10px] font-black uppercase text-emerald-800">
          <CheckCircle2 className="size-3.5" /> Confermato manualmente
        </span>
        {review?.confirmedByName ? <p className="mt-1 text-[9px] font-semibold text-black/40">Da {review.confirmedByName}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {requested && !canConfirm ? (
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-100 px-3 text-[10px] font-black uppercase text-amber-800">
          <ShieldAlert className="size-3.5" /> In verifica admin
        </span>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(requested ? "CONFIRM" : "REQUEST")}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase transition disabled:opacity-60 ${requested ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-amber-100 text-amber-900 hover:bg-amber-200"}`}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : requested ? <CheckCircle2 className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
          {requested ? "Conferma manualmente" : "Richiedi conferma manuale"}
        </button>
      )}
      {requested && review?.requestedByName ? <p className="mt-1 text-[9px] font-semibold text-black/40">Richiesto da {review.requestedByName}</p> : null}
      {error ? <p className="mt-1 text-[9px] font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}
