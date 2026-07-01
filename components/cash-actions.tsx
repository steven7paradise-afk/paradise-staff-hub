"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FilePlus2, LockKeyhole, Loader2, Plus, X } from "lucide-react";

type CashLocation = {
  id: string;
  name: string;
};

type CashUser = {
  id: string;
  name: string;
  locationId: string | null;
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const fieldClass = "mt-1 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-bold text-[#111017] shadow-inner outline-none [color-scheme:light] placeholder:text-black/35 focus:border-[#A74758] focus:ring-2 focus:ring-[#A74758]/15";
const textAreaClass = "mt-1 min-h-28 w-full rounded-2xl border border-black/10 bg-white p-4 text-sm font-semibold text-[#111017] shadow-inner outline-none [color-scheme:light] placeholder:text-black/35 focus:border-[#A74758] focus:ring-2 focus:ring-[#A74758]/15";

export function CashActions({
  month,
  monthClosed,
  weekKey,
  weekClosed,
  locations,
  users = [],
}: {
  month: string;
  monthClosed?: { closed_by_name?: string; closed_at?: string } | null;
  weekKey?: string;
  weekClosed?: { closed_by_name?: string; closed_at?: string } | null;
  locations: CashLocation[];
  users?: CashUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [locationId, setLocationId] = useState(() => locations[0]?.id ?? "");
  const [date, setDate] = useState(todayInputValue);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [manualLocationId, setManualLocationId] = useState(() => locations[0]?.id ?? "");
  const [manualUserId, setManualUserId] = useState("");
  const [manualDate, setManualDate] = useState(todayInputValue);
  const [manualWithdrawn, setManualWithdrawn] = useState("");
  const [manualFund, setManualFund] = useState("50");
  const [manualNotes, setManualNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingWeek, setClosingWeek] = useState(false);
  const [error, setError] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
    if (!manualLocationId && locations[0]?.id) setManualLocationId(locations[0].id);
  }, [locationId, locations, manualLocationId]);

  const manualUsers = users.filter((user) => !manualLocationId || !user.locationId || user.locationId === manualLocationId);

  async function saveWithdrawal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/cash/vault-withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, date, amount, reason }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Errore durante il salvataggio.");
      return;
    }
    setOpen(false);
    setAmount("");
    setReason("");
    router.refresh();
  }

  async function closeMonth() {
    if (!confirm(`Vuoi chiudere il mese ${month}? Dopo la chiusura resta nello storico e puoi iniziare un nuovo conteggio.`)) return;
    setClosing(true);
    const response = await fetch("/api/cash/close-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setClosing(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Errore durante la chiusura mese.");
      return;
    }
    router.refresh();
  }

  async function closeWeek() {
    if (!weekKey) return;
    if (!confirm(`Vuoi chiudere la settimana del ${weekKey}? Dopo la chiusura resta nello storico.`)) return;
    setClosingWeek(true);
    const response = await fetch("/api/cash/close-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekKey }),
    });
    setClosingWeek(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Errore durante la chiusura settimana.");
      return;
    }
    router.refresh();
  }

  async function saveManualClosing(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setManualSaving(true);
    setManualError("");
    const response = await fetch("/api/cash/closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: manualLocationId,
        userId: manualUserId,
        date: manualDate,
        withdrawn: manualWithdrawn,
        fund: manualFund,
        notes: manualNotes,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setManualSaving(false);
    if (!response.ok) {
      setManualError(data.error || "Errore durante il salvataggio.");
      return;
    }
    setManualOpen(false);
    setManualWithdrawn("");
    setManualFund("50");
    setManualNotes("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-black shadow-lg transition hover:-translate-y-0.5"
      >
        <FilePlus2 className="size-4" />
        Aggiungi chiusura
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-black shadow-lg transition hover:-translate-y-0.5"
      >
        <Plus className="size-4" />
        Preleva cassaforte
      </button>
      <button
        type="button"
        onClick={closeWeek}
        disabled={closingWeek}
        className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50"
      >
        {weekClosed ? <CheckCircle2 className="size-4 text-emerald-300" /> : closingWeek ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        {weekClosed ? "Settimana chiusa" : "Chiusura settimana"}
      </button>
      <button
        type="button"
        onClick={closeMonth}
        disabled={closing}
        className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50"
      >
        {monthClosed ? <CheckCircle2 className="size-4 text-emerald-300" /> : closing ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        {monthClosed ? "Mese chiuso" : "Chiusura mese"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveWithdrawal} className="pointer-events-auto w-full max-w-lg rounded-[30px] bg-white p-5 text-[#111017] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A74758]">Cassaforte</p>
                <h2 className="mt-1 text-2xl font-black">Nuovo prelievo</h2>
                <p className="mt-1 text-sm text-black/50">Scegli salone, giorno, somma e motivo del prelievo.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-2xl bg-black/5 text-[#111017]">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              {locations.length === 0 ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Nessun salone attivo disponibile per registrare il prelievo.</p>
              ) : null}
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Salone / cassaforte</span>
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                >
                  <option value="" disabled>Seleziona salone</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id} className="text-[#111017]">
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Giorno prelievo</span>
                <input
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Somma prelevata</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Motivo</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  placeholder="Esempio: pagamento fornitore, acquisto urgente, anticipo..."
                  className={textAreaClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                />
              </label>
              {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => saveWithdrawal()}
              disabled={saving || !locationId || locations.length === 0}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111017] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salva prelievo cassaforte
            </button>
          </form>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveManualClosing} className="pointer-events-auto w-full max-w-lg rounded-[30px] bg-white p-5 text-[#111017] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A74758]">Chiusura manuale</p>
                <h2 className="mt-1 text-2xl font-black">Aggiungi chiusura</h2>
                <p className="mt-1 text-sm text-black/50">Per quando un lavoratore dimentica di compilare la chiusura dalla cassa.</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} className="grid size-10 place-items-center rounded-2xl bg-black/5 text-[#111017]">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Salone</span>
                <select
                  value={manualLocationId}
                  onChange={(event) => {
                    setManualLocationId(event.target.value);
                    setManualUserId("");
                  }}
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                >
                  <option value="" disabled>Seleziona salone</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Chi ha fatto la chiusura</span>
                <select
                  value={manualUserId}
                  onChange={(event) => setManualUserId(event.target.value)}
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                >
                  <option value="" disabled>Seleziona lavoratore</option>
                  {manualUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Data chiusura</span>
                <input value={manualDate} onChange={(event) => setManualDate(event.target.value)} type="date" className={fieldClass} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase text-black/40">Importo prelevato</span>
                  <input value={manualWithdrawn} onChange={(event) => setManualWithdrawn(event.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="0.00" className={fieldClass} />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-black/40">Fondo cassa</span>
                  <input value={manualFund} onChange={(event) => setManualFund(event.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="50.00" className={fieldClass} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Nota admin</span>
                <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} rows={3} placeholder="Esempio: inserita da admin per dimenticanza del lavoratore..." className={textAreaClass} />
              </label>
              {manualError ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{manualError}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => saveManualClosing()}
              disabled={manualSaving || !manualLocationId || !manualUserId}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111017] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {manualSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salva chiusura manuale
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
