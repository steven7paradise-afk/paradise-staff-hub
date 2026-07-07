"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FilePlus2, LockKeyhole, Loader2, Plus, Upload, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { VAULT_WITHDRAWAL_FIELD_IDS } from "@/lib/vault-withdrawal-form";

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
  weekClosed = [],
  locations,
  users = [],
  allClosings = [],
  vaultWithdrawals = [],
  isResponsible = false,
  userSedeId = null,
}: {
  month: string;
  monthClosed?: { closed_by_name?: string; closed_at?: string } | null;
  weekKey?: string;
  weekClosed?: any;
  locations: CashLocation[];
  users?: CashUser[];
  allClosings?: any[];
  vaultWithdrawals?: any[];
  isResponsible?: boolean;
  userSedeId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [locationId, setLocationId] = useState(() => locations[0]?.id ?? "");
  const [date, setDate] = useState(todayInputValue);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
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

  const [weekCloseModalOpen, setWeekCloseModalOpen] = useState(false);
  const [selectedWeekCloseLocationId, setSelectedWeekCloseLocationId] = useState("");
  const [bankDeposit, setBankDeposit] = useState("");
  const [withdrawalsAmt, setWithdrawalsAmt] = useState("");
  const [weekCloseNotes, setWeekCloseNotes] = useState("");
  const [savingWeekClose, setSavingWeekClose] = useState(false);
  const [reopeningWeek, setReopeningWeek] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    if (weekCloseModalOpen && weekKey) {
      const mon = new Date(weekKey + "T00:00:00");
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      
      const monStr = weekKey;
      const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
      
      setCustomStartDate(monStr);
      setCustomEndDate(sunStr);
    }
  }, [weekCloseModalOpen, weekKey]);

  useEffect(() => {
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
    if (!manualLocationId && locations[0]?.id) setManualLocationId(locations[0].id);
  }, [locationId, locations, manualLocationId]);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  useEffect(() => {
    if (selectedWeekCloseLocationId && customStartDate && customEndDate) {
      const startRange = new Date(customStartDate + "T00:00:00");
      const endRange = new Date(customEndDate + "T23:59:59");

      const weeklyVault = vaultWithdrawals.filter((vw: any) => {
        const locId = vw.user_location_id;
        if (locId !== selectedWeekCloseLocationId) return false;
        const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date;
        const vwDate = rawDate ? new Date(rawDate + "T00:00:00") : new Date(vw.created_at);
        return vwDate >= startRange && vwDate <= endRange;
      });

      const autoSum = weeklyVault.reduce(
        (sum: number, vw: any) => sum + Number(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount || 0),
        0
      );

      const sortedVault = [...weeklyVault].sort((a, b) => {
        const dateA = new Date(a.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || a.date || a.created_at).getTime();
        const dateB = new Date(b.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || b.date || b.created_at).getTime();
        return dateB - dateA;
      });

      const autoNotes = sortedVault.map((vw: any) => {
        const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date;
        const formattedDate = rawDate ? new Date(rawDate + "T00:00:00").toLocaleDateString("it-IT") : new Date(vw.created_at).toLocaleDateString("it-IT");
        const amount = Number(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount || 0);
        const reason = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] || vw.reason || "Motivo non indicato";
        return `- ${formattedDate}: ${amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })} (${reason})`;
      }).join("\n");

      setWithdrawalsAmt(autoSum > 0 ? autoSum.toString() : "");
      setWeekCloseNotes(autoNotes ? `Dettaglio Spese / Prelievi:\n${autoNotes}` : "");
    } else {
      setWithdrawalsAmt("");
      setWeekCloseNotes("");
    }
  }, [selectedWeekCloseLocationId, customStartDate, customEndDate, vaultWithdrawals]);

  const manualUsers = users.filter((user) => !manualLocationId || !user.locationId || user.locationId === manualLocationId);

  async function saveWithdrawal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    if (!receipt) {
      setSaving(false);
      setError("Carica la foto dello scontrino prima di salvare.");
      return;
    }
    const formData = new FormData();
    formData.append("locationId", locationId);
    formData.append("date", date);
    formData.append("amount", amount);
    formData.append("reason", reason);
    formData.append("receipt", receipt);
    const response = await fetch("/api/cash/vault-withdrawals", {
      method: "POST",
      body: formData,
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
    setReceipt(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview("");
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
        onClick={() => {
          const defaultLocId = isResponsible ? (userSedeId ?? "") : (locations[0]?.id ?? "");
          setSelectedWeekCloseLocationId(defaultLocId);
          setWeekCloseModalOpen(true);
        }}
        className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15"
      >
        {(isResponsible && weekClosed.some((wc: any) => wc.locationId === userSedeId)) || (!isResponsible && weekClosed.length === locations.length && locations.length > 0) ? (
          <CheckCircle2 className="size-4 text-emerald-300" />
        ) : (
          <LockKeyhole className="size-4" />
        )}
        {isResponsible && weekClosed.some((wc: any) => wc.locationId === userSedeId) ? "Settimana chiusa" : "Chiusura settimana"}
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
                <p className="mt-1 text-sm text-black/50">Scegli salone, giorno, somma, motivo e fotografa lo scontrino.</p>
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
              <div>
                <span className="text-xs font-black uppercase text-black/40">Foto scontrino *</span>
                {receiptPreview ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]">
                    <img src={receiptPreview} alt="Anteprima scontrino" className="max-h-56 w-full object-contain" />
                  </div>
                ) : (
                  <div className="mt-2 grid h-28 place-items-center rounded-2xl border-2 border-dashed border-black/10 bg-black/[0.02] text-center text-sm font-semibold text-black/40">
                    <div>
                      <Camera className="mx-auto mb-2 size-6" />
                      Scatta o scegli la foto
                    </div>
                  </div>
                )}
                <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#F7EDEF] px-4 text-sm font-black text-[#A74758] transition hover:bg-[#F1DFE3]">
                  <Upload className="size-4" />
                  {receipt ? "Sostituisci foto" : "Carica foto scontrino"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
                        setError("Scegli una foto valida fino a 10 MB.");
                        event.currentTarget.value = "";
                        return;
                      }
                      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
                      setReceipt(file);
                      setReceiptPreview(URL.createObjectURL(file));
                      setError("");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="mt-1 text-center text-[11px] font-semibold text-black/35">JPG, PNG o WEBP · massimo 10 MB</p>
              </div>
              {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => saveWithdrawal()}
              disabled={saving || !locationId || !receipt || locations.length === 0}
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

      {weekCloseModalOpen ? (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="pointer-events-auto w-full max-w-2xl rounded-[30px] bg-white p-6 text-[#111017] shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A74758]">Salone</p>
                <h2 className="mt-1 text-2xl font-black">Chiusura Settimanale</h2>
                {(() => {
                  const mon = new Date((weekKey || "") + "T00:00:00");
                  const sun = new Date(mon);
                  sun.setDate(sun.getDate() + 6);
                  return (
                    <p className="mt-1 text-sm text-black/50">
                      Settimana dal <strong>{mon.toLocaleDateString("it-IT")}</strong> al <strong>{sun.toLocaleDateString("it-IT")}</strong>
                    </p>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setWeekCloseModalOpen(false)}
                className="grid size-10 place-items-center rounded-2xl bg-black/5 text-[#111017]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase text-black/40">Seleziona Salone</span>
                <select
                  value={selectedWeekCloseLocationId}
                  onChange={(e) => {
                    setSelectedWeekCloseLocationId(e.target.value);
                  }}
                  disabled={isResponsible}
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                >
                  <option value="" disabled>Seleziona salone</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase text-black/40">Data Inizio Chiusura</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className={fieldClass}
                    style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-black/40">Data Fine Chiusura</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className={fieldClass}
                    style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                  />
                </label>
              </div>

              {selectedWeekCloseLocationId && (() => {
                const isStandardWeek = (() => {
                  const mon = new Date((weekKey || "") + "T00:00:00");
                  const sun = new Date(mon);
                  sun.setDate(sun.getDate() + 6);
                  const monStr = weekKey;
                  const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
                  return customStartDate === monStr && customEndDate === sunStr;
                })();

                const currentTargetWeekKey = isStandardWeek ? (weekKey || "") : `${customStartDate}:${customEndDate}`;

                const locationClose = weekClosed.find(
                  (wc: any) => wc.locationId === selectedWeekCloseLocationId && wc.weekKey === currentTargetWeekKey
                );
                const locationName = locations.find((l) => l.id === selectedWeekCloseLocationId)?.name || "Salone";

                const startRange = new Date(customStartDate + "T00:00:00");
                const endRange = new Date(customEndDate + "T23:59:59");

                const weeklyClosings = allClosings.filter((c: any) => {
                  const locId = c.user_location_id || c.location?.id;
                  if (locId !== selectedWeekCloseLocationId) return false;
                  const cDate = new Date(c.answers?.cash_date || c.created_at);
                  return cDate >= startRange && cDate <= endRange;
                });

                const sortedClosings = [...weeklyClosings].sort((a, b) => {
                  const dA = new Date(a.answers?.cash_date || a.created_at).getTime();
                  const dB = new Date(b.answers?.cash_date || b.created_at).getTime();
                  return dB - dA;
                });

                const totalWithdrawnWeek = sortedClosings.reduce(
                  (sum, c) => sum + Number(c.answers?.cash_withdrawn || 0),
                  0
                );

                const totalDeclaredWeek = totalWithdrawnWeek;

                return (
                  <div className="space-y-4">
                    {locationClose ? (
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold">
                          <CheckCircle2 className="size-5 text-emerald-600" />
                          <span>Settimana chiusa con successo</span>
                        </div>
                        <p className="mt-1 text-xs text-emerald-700">
                          Chiusa da {locationClose.closed_by_name} il {new Date(locationClose.closed_at).toLocaleString("it-IT")}
                        </p>
                        
                        <div className="mt-4 grid gap-3 grid-cols-3">
                          <div className="rounded-xl bg-white p-3 border border-emerald-100">
                            <span className="text-[10px] font-black uppercase text-black/35">Dichiarato Cassa</span>
                            <p className="text-sm sm:text-base font-black mt-0.5">{totalDeclaredWeek.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-emerald-100">
                            <span className="text-[10px] font-black uppercase text-black/35">Versato in Banca</span>
                            <p className="text-sm sm:text-base font-black mt-0.5 text-emerald-700">{(locationClose.bank_deposit || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-emerald-100">
                            <span className="text-[10px] font-black uppercase text-black/35">Prelievi / Spese</span>
                            <p className="text-sm sm:text-base font-black mt-0.5 text-amber-700">
                              {locationClose.withdrawals > 0 ? "-" : ""}
                              {(locationClose.withdrawals || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                            </p>
                          </div>
                        </div>

                        {locationClose.notes && (
                          <div className="mt-3">
                            <span className="text-[10px] font-black uppercase text-black/35">Note</span>
                            <p className="text-xs mt-0.5 text-black/70 italic bg-white p-2 rounded-lg border border-emerald-100 whitespace-pre-wrap">{locationClose.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                        <p className="text-xs font-bold text-amber-800">
                          La settimana selezionata per questo salone non è ancora stata chiusa.
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Rivedi il dettaglio giornaliero qui sotto e dichiara la somma versata in banca per procedere.
                        </p>
                      </div>
                    )}

                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-black/40 mb-2">Dettaglio Giornaliero Dichiarato</h3>
                      {sortedClosings.length === 0 ? (
                        <p className="text-xs text-black/45 italic py-2">Nessuna chiusura giornaliera registrata in questo periodo.</p>
                      ) : (
                        <div className="overflow-hidden border border-black/5 rounded-xl bg-[#FAF7F9]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-black/5 text-[10px] font-black uppercase text-black/45">
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Operatore</th>
                                <th className="px-4 py-2 text-right">Dichiarato</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 text-xs">
                              {sortedClosings.map((c: any) => {
                                const rawDate = c.answers?.cash_date || c.date || c.created_at;
                                const dateStr = new Date(rawDate).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
                                const op = c.answers?._signature?.user_name || c.user?.name || "Lavoratore";
                                const amt = Number(c.answers?.cash_withdrawn || 0);
                                return (
                                  <tr key={c.id}>
                                    <td className="px-4 py-2 font-bold capitalize">{dateStr}</td>
                                    <td className="px-4 py-2 text-black/60">{op}</td>
                                    <td className="px-4 py-2 text-right font-black">{amt.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-black/5 font-black">
                                <td colSpan={2} className="px-4 py-2">Totale Dichiarato Settimana</td>
                                <td className="px-4 py-2 text-right text-[#A74758]">
                                  {totalDeclaredWeek.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {!locationClose ? (
                      <div className="space-y-3 pt-1">
                        <div className="grid gap-3 grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-black uppercase text-black/40">Importo Versato in Banca (€)</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              placeholder={(totalDeclaredWeek - (parseFloat(withdrawalsAmt.replace(",", ".")) || 0)).toString()}
                              value={bankDeposit}
                              onChange={(e) => setBankDeposit(e.target.value)}
                              className={fieldClass}
                              style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                            />
                          </label>

                          <label className="block">
                            <span className="text-xs font-black uppercase text-black/40">Spese / Prelievi (€)</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              placeholder="0"
                              value={withdrawalsAmt}
                              onChange={(e) => setWithdrawalsAmt(e.target.value)}
                              className={fieldClass}
                              style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-black/40">Note Amministrative</span>
                          <textarea
                            rows={2}
                            placeholder="Esempio: Versato l'intero importo, discrepanze riscontrate..."
                            value={weekCloseNotes}
                            onChange={(e) => setWeekCloseNotes(e.target.value)}
                            className={textAreaClass}
                            style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                          />
                        </label>

                        {/* Dynamic discrepancy preview box */}
                        {(() => {
                          const prelieviVal = withdrawalsAmt === "" ? 0 : Math.abs(parseFloat(withdrawalsAmt.replace(",", ".")));
                          const calculatedPrelievi = isNaN(prelieviVal) ? 0 : prelieviVal;
                          const depositVal = bankDeposit === "" ? (totalDeclaredWeek - calculatedPrelievi) : parseFloat(bankDeposit.replace(",", "."));
                          const calculatedDeposit = isNaN(depositVal) ? 0 : depositVal;
                          
                          const totalRemoved = calculatedDeposit + calculatedPrelievi;
                          const diff = totalRemoved - totalDeclaredWeek;

                          return (
                            <div className="rounded-2xl border border-black/5 bg-[#FAF7F9] p-3 space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-black/40">Anteprima Chiusura</p>
                              <div className="flex justify-between text-xs">
                                <span className="text-black/60">Somma Dichiarata in Cassa:</span>
                                <span className="font-bold">{totalDeclaredWeek.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-black/60">Totale Rimosso (Banca + Prelievi):</span>
                                <span className="font-bold">{totalRemoved.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                              </div>
                              <div className="border-t border-black/5 pt-1.5 flex justify-between text-xs font-bold">
                                <span>Discrepanza / Differenza:</span>
                                <span className={diff > 0.01 ? "text-emerald-700" : diff < -0.01 ? "text-red-600" : "text-black/50"}>
                                  {(diff > 0 ? "+" : "") + diff.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid gap-3 sm:grid-cols-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const prelieviAmt = withdrawalsAmt === "" ? 0 : Math.abs(parseFloat(withdrawalsAmt.replace(",", ".")));
                              const calculatedPrelievi = isNaN(prelieviAmt) ? 0 : prelieviAmt;
                              const depositAmt = bankDeposit === "" ? (totalDeclaredWeek - calculatedPrelievi) : parseFloat(bankDeposit.replace(",", "."));
                              const calculatedDeposit = isNaN(depositAmt) ? 0 : depositAmt;
                              generateWeeklyClosePdf(
                                locationName,
                                currentTargetWeekKey || "",
                                "Anteprima",
                                new Date().toISOString(),
                                calculatedDeposit,
                                calculatedPrelievi,
                                weekCloseNotes,
                                sortedClosings
                              );
                            }}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm font-black text-black transition hover:bg-black/5"
                          >
                            Stampa PDF Anteprima
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const prelieviAmt = withdrawalsAmt === "" ? 0 : Math.abs(parseFloat(withdrawalsAmt.replace(",", ".")));
                              const calculatedPrelievi = isNaN(prelieviAmt) ? 0 : prelieviAmt;
                              const depositAmt = bankDeposit === "" ? (totalDeclaredWeek - calculatedPrelievi) : parseFloat(bankDeposit.replace(",", "."));
                              const calculatedDeposit = isNaN(depositAmt) ? 0 : depositAmt;
                              if (isNaN(calculatedDeposit) || isNaN(calculatedPrelievi)) {
                                alert("Inserisci un importo valido.");
                                return;
                              }
                              setSavingWeekClose(true);
                              const breakdown = sortedClosings.map((c: any) => ({
                                date: new Date(c.answers?.cash_date || c.created_at).toLocaleDateString("it-IT"),
                                amount: Number(c.answers?.cash_withdrawn || 0),
                                operator: c.answers?._signature?.user_name || c.user?.name || "Lavoratore"
                              }));
                              const response = await fetch("/api/cash/close-week", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  weekKey: currentTargetWeekKey,
                                  locationId: selectedWeekCloseLocationId,
                                  bankDeposit: calculatedDeposit,
                                  withdrawals: calculatedPrelievi,
                                  notes: weekCloseNotes,
                                  dailyBreakdown: breakdown
                                })
                              });
                              setSavingWeekClose(false);
                              if (!response.ok) {
                                alert("Errore durante il salvataggio della chiusura.");
                                return;
                              }
                              generateWeeklyClosePdf(
                                locationName,
                                currentTargetWeekKey || "",
                                "Chiusura",
                                new Date().toISOString(),
                                calculatedDeposit,
                                calculatedPrelievi,
                                weekCloseNotes,
                                sortedClosings
                              );
                              setWeekCloseModalOpen(false);
                              setBankDeposit("");
                              setWithdrawalsAmt("");
                              setWeekCloseNotes("");
                              router.refresh();
                            }}
                            disabled={savingWeekClose}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#A74758] px-4 text-sm font-black text-white hover:bg-[#8f3c4b] disabled:opacity-50"
                          >
                            {savingWeekClose ? <Loader2 className="size-4 animate-spin" /> : null}
                            Salva e Chiudi Settimana
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            generateWeeklyClosePdf(
                              locationName,
                              currentTargetWeekKey || "",
                              locationClose.closed_by_name || "Admin",
                              locationClose.closed_at,
                              locationClose.bank_deposit || 0,
                              locationClose.withdrawals || 0,
                              locationClose.notes || "",
                              sortedClosings
                            );
                          }}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#A74758] px-4 text-sm font-black text-white hover:bg-[#8f3c4b]"
                        >
                          Scarica PDF Chiusura
                        </button>
                        
                        {!isResponsible && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Sei sicuro di voler riaprire questa settimana per questo salone? L'importo in banca verrà cancellato e la disponibilità cassa verrà ripristinata.")) return;
                              setReopeningWeek(true);
                              const response = await fetch("/api/cash/close-week", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  weekKey: currentTargetWeekKey,
                                  locationId: selectedWeekCloseLocationId
                                })
                              });
                              setReopeningWeek(false);
                              if (!response.ok) {
                                alert("Errore durante la riapertura.");
                                return;
                              }
                              router.refresh();
                            }}
                            disabled={reopeningWeek}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {reopeningWeek ? <Loader2 className="size-4 animate-spin" /> : null}
                            Riapri Settimana
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function generateWeeklyClosePdf(
  locationName: string,
  weekKey: string,
  closedByName: string,
  closedAt: string,
  bankDeposit: number,
  withdrawals: number,
  notes: string,
  closings: any[]
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(167, 71, 88); // #A74758
  doc.text("PARADISE", 15, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("Staff Hub - Chiusura Settimanale Cassa", 15, 25);

  // Divider line
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 28, 195, 28);

  // Meta Info
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("Dettagli Sede e Periodo:", 15, 38);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Salone / Sede:`, 15, 45);
  doc.setFont("helvetica", "bold");
  doc.text(locationName, 50, 45);

  doc.setFont("helvetica", "normal");
  doc.text(`Settimana del:`, 15, 52);
  doc.setFont("helvetica", "bold");
  doc.text(weekKey, 50, 52);

  doc.setFont("helvetica", "normal");
  doc.text(`Operatore:`, 15, 59);
  doc.setFont("helvetica", "bold");
  doc.text(closedByName, 50, 59);

  doc.setFont("helvetica", "normal");
  doc.text(`Data Chiusura:`, 15, 66);
  doc.setFont("helvetica", "bold");
  const closeDateFormatted = closedAt ? new Date(closedAt).toLocaleString("it-IT") : new Date().toLocaleString("it-IT");
  doc.text(closeDateFormatted, 50, 66);

  // Table of days
  doc.setFont("helvetica", "bold");
  doc.text("DETTAGLIO GIORNALIERO DICHIARATO:", 15, 80);

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 85, 180, 8, "F");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Data", 18, 90.5);
  doc.text("Operatore", 60, 90.5);
  doc.text("Importo Dichiarato", 160, 90.5, { align: "right" });

  let y = 98;
  let totalDeclared = 0;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  
  closings.forEach((c) => {
    const rawDate = c.answers?.cash_date || c.date || c.created_at;
    const dateFormatted = new Date(rawDate).toLocaleDateString("it-IT");
    const opName = c.answers?._signature?.user_name || c.user?.name || "Lavoratore";
    const amount = Number(c.answers?.cash_withdrawn || 0);
    totalDeclared += amount;

    doc.text(dateFormatted, 18, y);
    doc.text(opName, 60, y);
    doc.text(amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" }), 180, y, { align: "right" });
    
    doc.setDrawColor(245, 245, 245);
    doc.line(15, y + 2.5, 195, y + 2.5);
    y += 8;
  });

  // Total block
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, 195, y);
  
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Totale cassa dichiarato nella settimana:", 15, y);
  doc.text(totalDeclared.toLocaleString("it-IT", { style: "currency", currency: "EUR" }), 180, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(167, 71, 88);
  doc.text("IMPORTO VERSATO IN BANCA:", 15, y);
  doc.text(bankDeposit.toLocaleString("it-IT", { style: "currency", currency: "EUR" }), 180, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(217, 119, 6); // Amber color for expenses/withdrawals
  doc.text("PRELIEVI / SPESE SETTIMANALI:", 15, y);
  const absWithdrawals = Math.abs(withdrawals);
  const formattedWithdrawals = absWithdrawals > 0 ? `-${absWithdrawals.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}` : absWithdrawals.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  doc.text(formattedWithdrawals, 180, y, { align: "right" });

  // Discrepancy
  const totalRemoved = bankDeposit + absWithdrawals;
  const discrepancy = totalRemoved - totalDeclared;
  if (Math.abs(discrepancy) > 0.01) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 50, 50);
    doc.text("Discrepanza / Differenza:", 15, y);
    doc.text((discrepancy > 0 ? "+" : "") + discrepancy.toLocaleString("it-IT", { style: "currency", currency: "EUR" }), 180, y, { align: "right" });
  }

  // Notes
  if (notes) {
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("Note Amministrative:", 15, y);
    
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(notes, 15, y, { maxWidth: 170 });
  }

  // Footer / Signatures
  y = 265;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, 195, y);
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Paradise Staff Hub - Generato Automaticamente", 15, y + 6);
  doc.text(`Data Stampa: ${new Date().toLocaleString("it-IT")}`, 150, y + 6);

  const filename = `chiusura_settimanale_${locationName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${weekKey}.pdf`;
  doc.save(filename);
}
