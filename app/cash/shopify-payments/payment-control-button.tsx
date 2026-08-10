"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, ScanSearch } from "lucide-react";

type PendingPayment = {
  id: string;
  order: string;
};

const BATCH_SIZE = 5;

export function PaymentControlButton({ payments }: { payments: PendingPayment[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [verified, setVerified] = useState(0);
  const [error, setError] = useState("");

  async function runControl() {
    if (running || !payments.length) return;
    setRunning(true);
    setProcessed(0);
    setVerified(0);
    setError("");

    let checked = 0;
    let confirmed = 0;
    try {
      for (let index = 0; index < payments.length; index += BATCH_SIZE) {
        const batch = payments.slice(index, index + BATCH_SIZE);
        const response = await fetch("/api/cash/shopify-payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch.map((payment) => payment.id) }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Controllo Shopify non riuscito.");

        checked += Number(data.processed || batch.length);
        confirmed += Number(data.verified || 0);
        setProcessed(Math.min(checked, payments.length));
        setVerified(confirmed);
        if (index + BATCH_SIZE < payments.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }
      router.refresh();
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : "Controllo Shopify non riuscito.");
    } finally {
      setRunning(false);
    }
  }

  const progress = payments.length ? Math.round((processed / payments.length) * 100) : 100;

  return (
    <div className="min-w-0 sm:min-w-[260px]">
      <button
        type="button"
        onClick={runControl}
        disabled={running || payments.length === 0}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-[#111017] transition hover:bg-[#F6E8EC] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {running ? <LoaderCircle className="size-4 animate-spin" /> : payments.length ? <ScanSearch className="size-4" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
        {running ? `Controllo ${processed}/${payments.length}` : payments.length ? `Controllo ${payments.length} ordini` : "Tutto verificato"}
      </button>
      {running ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#F0A1AF] transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {processed > 0 && !running && !error ? (
        <p className="mt-2 text-center text-[10px] font-bold text-emerald-300">{verified} verificati su {processed} controllati</p>
      ) : null}
      {error ? <p className="mt-2 text-center text-[10px] font-bold text-rose-300">{error}</p> : null}
    </div>
  );
}
