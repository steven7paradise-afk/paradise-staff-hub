"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Camera, CheckCircle2, FilePlus2, LockKeyhole, Loader2, Plus, ReceiptText, Upload, WalletCards, X } from "lucide-react";
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

type MonthWeekCloseSetting = {
  key: string;
  value: any;
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthIsStillOpen(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date() < new Date(year, monthNumber, 1);
}

function monthDisplayLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function money(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(raw: unknown, fallback?: unknown) {
  const value = raw || fallback;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return value ? new Date(value as string) : new Date();
}

function dateIsInMonth(date: Date, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return true;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === month;
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value as string));
}

function formatCurrency(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

const fieldClass = "mt-2 h-[52px] w-full rounded-sm border border-black/15 bg-white px-4 text-sm font-bold text-[#111017] outline-none [color-scheme:light] placeholder:text-black/30 transition focus:border-black focus:ring-1 focus:ring-black";
const textAreaClass = "mt-2 min-h-28 w-full resize-y rounded-sm border border-black/15 bg-white p-4 text-sm font-semibold text-[#111017] outline-none [color-scheme:light] placeholder:text-black/30 transition focus:border-black focus:ring-1 focus:ring-black";
const modalBackdropClass = "fixed inset-0 z-[1000] flex items-end justify-center bg-black/65 p-0 backdrop-blur-md sm:items-center sm:p-6";
const modalPanelClass = "pointer-events-auto flex max-h-[100dvh] w-full flex-col overflow-hidden bg-[#F5F3EF] text-[#111111] shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:max-h-[92dvh] sm:rounded-sm";
const modalEyebrowClass = "text-[10px] font-black uppercase tracking-[0.28em] text-[#A74758]";
const modalLabelClass = "text-[10px] font-black uppercase tracking-[0.18em] text-black/45";
const secondaryButtonClass = "inline-flex min-h-12 items-center justify-center border border-black/20 bg-transparent px-6 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:border-black hover:bg-white disabled:opacity-40";
const primaryButtonClass = "inline-flex min-h-12 items-center justify-center gap-2 bg-black px-7 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-40";

export function CashActions({
  month,
  monthClosed,
  weekKey,
  weekClosed = [],
  locations,
  users = [],
  allClosings = [],
  vaultWithdrawals = [],
  monthWeekCloses = [],
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
  monthWeekCloses?: MonthWeekCloseSetting[];
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
  const [monthCloseModalOpen, setMonthCloseModalOpen] = useState(false);

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
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  const selectedMonthLabel = monthDisplayLabel(month);
  const monthStillOpen = monthIsStillOpen(month);
  const monthClosingRows = allClosings
    .map((closing: any) => {
      const dateValue = parseDate(closing.answers?.cash_date || closing.date, closing.created_at);
      return {
        id: closing.id,
        date: dateValue,
        locationName: closing.user_location_name || closing.location?.name || locationNameById.get(closing.user_location_id) || "Sede non indicata",
        operator: closing.answers?._signature?.user_name || closing.user?.name || "Firma non indicata",
        amount: money(closing.answers?.cash_withdrawn || closing.withdrawn),
        fund: money(closing.answers?.cash_fund || closing.fund),
        notes: String(closing.answers?.cash_notes || closing.notes || ""),
      };
    })
    .filter((closing) => dateIsInMonth(closing.date, month))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const monthVaultRows = vaultWithdrawals
    .map((withdrawal: any) => {
      const dateValue = parseDate(withdrawal.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || withdrawal.date, withdrawal.created_at);
      return {
        id: withdrawal.id,
        date: dateValue,
        locationName: withdrawal.user_location_name || withdrawal.location?.name || locationNameById.get(withdrawal.user_location_id) || "Sede non indicata",
        operator: withdrawal.answers?._signature?.user_name || withdrawal.user?.name || "Operatore",
        amount: money(withdrawal.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || withdrawal.amount),
        reason: String(withdrawal.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] || withdrawal.reason || "Motivo non indicato"),
      };
    })
    .filter((withdrawal) => dateIsInMonth(withdrawal.date, month))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const monthWeekCloseRows = monthWeekCloses
    .map((setting) => {
      const value = setting.value || {};
      const keyParts = setting.key.split(":");
      const locationIdFromKey = keyParts[1] || "";
      const weekParts = String(value.weekKey || "").split(":");
      const startDate = weekParts[0] ? parseDate(weekParts[0]) : null;
      const endDate = weekParts[1] ? parseDate(weekParts[1]) : startDate ? new Date(startDate) : null;
      if (endDate && !weekParts[1]) endDate.setDate(endDate.getDate() + 6);
      return {
        id: setting.key,
        locationName: value.location_name || locationNameById.get(locationIdFromKey) || "Sede non indicata",
        period: startDate && endDate ? `${formatDay(startDate)} - ${formatDay(endDate)}` : String(value.weekKey || "-"),
        closedBy: value.closed_by_name || "Operatore",
        closedAt: value.closed_at,
        bankDeposit: money(value.bank_deposit),
        withdrawals: money(value.withdrawals),
        notes: String(value.notes || ""),
      };
    })
    .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime());
  const monthClosingsTotal = monthClosingRows.reduce((sum, row) => sum + row.amount, 0);
  const monthVaultTotal = monthVaultRows.reduce((sum, row) => sum + row.amount, 0);
  const monthBankDepositTotal = monthWeekCloseRows.reduce((sum, row) => sum + row.bankDeposit, 0);
  const monthWeeklyWithdrawalsTotal = monthWeekCloseRows.reduce((sum, row) => sum + row.withdrawals, 0);

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
    const confirmEarly = monthIsStillOpen(month);
    setClosing(true);
    const response = await fetch("/api/cash/close-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, confirmEarly }),
    });
    setClosing(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Errore durante la chiusura mese.");
      return;
    }
    setMonthCloseModalOpen(false);
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
    <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto">
      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-black text-black transition hover:border-black/25 hover:bg-[#FAF7F9]"
      >
        <FilePlus2 className="size-4" />
        Aggiungi chiusura
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#111017] px-3 text-xs font-black text-white transition hover:bg-black"
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-black/10 bg-[#FAF7F9] px-3 text-xs font-black text-black transition hover:border-black/25"
      >
        {(isResponsible && weekClosed.some((wc: any) => wc.locationId === userSedeId)) || (!isResponsible && weekClosed.length === locations.length && locations.length > 0) ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <LockKeyhole className="size-4" />
        )}
        {isResponsible && weekClosed.some((wc: any) => wc.locationId === userSedeId) ? "Settimana chiusa" : "Chiusura settimana"}
      </button>
      <button
        type="button"
        onClick={() => setMonthCloseModalOpen(true)}
        disabled={closing}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-black/10 bg-[#FAF7F9] px-3 text-xs font-black text-black transition hover:border-black/25 disabled:opacity-50"
      >
        {monthClosed ? <CheckCircle2 className="size-4 text-emerald-600" /> : closing ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        {monthClosed ? "Mese chiuso" : "Chiusura mese"}
      </button>

      {monthCloseModalOpen ? (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} sm:max-w-6xl`}>
            <div className="flex shrink-0 items-start justify-between gap-6 border-b border-black/10 bg-white px-6 py-5 sm:px-8 sm:py-7">
              <div>
                <p className={modalEyebrowClass}>Controllo amministrativo · {selectedMonthLabel}</p>
                <h2 className="mt-2 font-serif text-3xl leading-none sm:text-4xl">Chiusura del mese</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">Rivedi chiusure settimanali, giornaliere e uscite prima della conferma definitiva.</p>
              </div>
              <button type="button" onClick={() => setMonthCloseModalOpen(false)} aria-label="Chiudi" className="grid size-11 shrink-0 place-items-center border border-black/15 bg-white text-black transition hover:bg-black hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              {monthStillOpen ? (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-black">Il mese non è ancora finito.</p>
                    <p className="mt-1 text-xs font-semibold">Puoi chiuderlo, ma fallo solo se sei sicura: la chiusura entrerà nello storico mensile.</p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MonthSummaryCard icon={CalendarDays} label="Chiusure giornaliere" value={monthClosingRows.length.toString()} detail={formatCurrency(monthClosingsTotal)} />
                <MonthSummaryCard icon={LockKeyhole} label="Chiusure settimanali" value={monthWeekCloseRows.length.toString()} detail={`Banca ${formatCurrency(monthBankDepositTotal)}`} />
                <MonthSummaryCard icon={WalletCards} label="Spese / prelievi" value={monthVaultRows.length.toString()} detail={`-${formatCurrency(monthVaultTotal)}`} />
                <MonthSummaryCard icon={ReceiptText} label="Netto controllato" value={formatCurrency(monthClosingsTotal - monthVaultTotal)} detail={`Settimane: ${formatCurrency(monthBankDepositTotal - monthWeeklyWithdrawalsTotal)}`} />
              </div>

              <MonthSection title="Chiusure settimanali">
                {monthWeekCloseRows.length === 0 ? (
                  <EmptyMonthMessage text="Nessuna chiusura settimanale salvata per questo mese." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-black/5">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-[#FAF7F9] text-[10px] font-black uppercase tracking-[0.14em] text-black/40">
                        <tr>
                          <th className="px-4 py-3">Sede</th>
                          <th className="px-4 py-3">Periodo</th>
                          <th className="px-4 py-3">Chiusa da</th>
                          <th className="px-4 py-3 text-right">Versato banca</th>
                          <th className="px-4 py-3 text-right">Spese</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {monthWeekCloseRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 font-black">{row.locationName}</td>
                            <td className="px-4 py-3 text-black/60">{row.period}</td>
                            <td className="px-4 py-3 text-black/60">{row.closedBy}<br /><span className="text-black/35">{formatDateTime(row.closedAt)}</span></td>
                            <td className="px-4 py-3 text-right font-black text-emerald-700">{formatCurrency(row.bankDeposit)}</td>
                            <td className="px-4 py-3 text-right font-black text-[#A74758]">-{formatCurrency(row.withdrawals)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </MonthSection>

              <MonthSection title="Chiusure giornaliere">
                {monthClosingRows.length === 0 ? (
                  <EmptyMonthMessage text="Nessuna chiusura giornaliera registrata per questo mese." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-black/5">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-[#FAF7F9] text-[10px] font-black uppercase tracking-[0.14em] text-black/40">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Sede</th>
                          <th className="px-4 py-3">Operatore</th>
                          <th className="px-4 py-3 text-right">Dichiarato</th>
                          <th className="px-4 py-3 text-right">Fondo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {monthClosingRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 font-bold capitalize">{formatDay(row.date)}</td>
                            <td className="px-4 py-3 text-black/60">{row.locationName}</td>
                            <td className="px-4 py-3 text-black/60">{row.operator}</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-700">{formatCurrency(row.amount)}</td>
                            <td className="px-4 py-3 text-right font-black">{formatCurrency(row.fund)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </MonthSection>

              <MonthSection title="Transazioni / spese / prelievi">
                {monthVaultRows.length === 0 ? (
                  <EmptyMonthMessage text="Nessuna spesa o prelievo registrato per questo mese." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-black/5">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-[#FAF7F9] text-[10px] font-black uppercase tracking-[0.14em] text-black/40">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Sede</th>
                          <th className="px-4 py-3">Motivo</th>
                          <th className="px-4 py-3">Operatore</th>
                          <th className="px-4 py-3 text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {monthVaultRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 font-bold capitalize">{formatDay(row.date)}</td>
                            <td className="px-4 py-3 text-black/60">{row.locationName}</td>
                            <td className="px-4 py-3 text-black/65">{row.reason}</td>
                            <td className="px-4 py-3 text-black/50">{row.operator}</td>
                            <td className="px-4 py-3 text-right font-black text-[#A74758]">-{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </MonthSection>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-black/10 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" onClick={() => setMonthCloseModalOpen(false)} className={secondaryButtonClass}>
                Annulla
              </button>
              <button
                type="button"
                onClick={closeMonth}
                disabled={closing}
                className={primaryButtonClass}
              >
                {closing ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                Conferma chiusura mese
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className={modalBackdropClass}>
          <form onSubmit={saveWithdrawal} className={`${modalPanelClass} sm:max-w-5xl`}>
            <div className="flex shrink-0 items-start justify-between gap-6 border-b border-black/10 bg-white px-6 py-5 sm:px-8 sm:py-7">
              <div>
                <p className={modalEyebrowClass}>Cassaforte · Nuovo movimento</p>
                <h2 className="mt-2 font-serif text-3xl leading-none sm:text-4xl">Nuovo prelievo</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">Registra il prelievo, indica la motivazione e allega il documento che ne certifica l’uscita.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi" className="grid size-11 shrink-0 place-items-center border border-black/15 bg-white text-black transition hover:bg-black hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8 lg:border-r lg:border-black/10">
              {locations.length === 0 ? (
                <p className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Nessun salone attivo disponibile per registrare il prelievo.</p>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                <span className={modalLabelClass}>Salone / cassaforte</span>
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
                <span className={modalLabelClass}>Giorno prelievo</span>
                <input
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  className={fieldClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                />
              </label>
              <label className="block">
                <span className={modalLabelClass}>Somma prelevata (€)</span>
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
              <label className="block sm:col-span-2">
                <span className={modalLabelClass}>Motivo del prelievo</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  placeholder="Esempio: pagamento fornitore, acquisto urgente, anticipo..."
                  className={textAreaClass}
                  style={{ color: "#111017", WebkitTextFillColor: "#111017", backgroundColor: "#ffffff" }}
                />
              </label>
              </div>
              {error ? <p className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
              </div>

              <div className="flex flex-col bg-[#EDE9E2] px-6 py-6 sm:px-8 sm:py-8">
                <div>
                <span className={modalLabelClass}>Documento giustificativo *</span>
                <p className="mt-2 text-sm leading-6 text-black/55">Fotografa lo scontrino o carica un’immagine leggibile. Il documento resterà collegato al movimento.</p>
                {receiptPreview ? (
                  <div className="mt-5 overflow-hidden border border-black/15 bg-white">
                    <img src={receiptPreview} alt="Anteprima scontrino" className="h-52 w-full object-contain sm:h-64" />
                  </div>
                ) : (
                  <div className="mt-5 grid h-52 place-items-center border border-dashed border-black/25 bg-white/70 text-center text-sm font-semibold text-black/45 sm:h-64">
                    <div>
                      <Camera className="mx-auto mb-3 size-7 stroke-[1.5]" />
                      <span className="block font-black text-black/70">Nessun documento caricato</span>
                      <span className="mt-1 block text-xs font-medium">JPG, PNG o WEBP · massimo 10 MB</span>
                    </div>
                  </div>
                )}
                <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-black bg-transparent px-4 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-black hover:text-white">
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
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-black/10 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Annulla</button>
              <button type="submit" disabled={saving || !locationId || !receipt || locations.length === 0} className={primaryButtonClass}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Registra prelievo
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {manualOpen ? (
        <div className={modalBackdropClass}>
          <form onSubmit={saveManualClosing} className={`${modalPanelClass} sm:max-w-4xl`}>
            <div className="flex shrink-0 items-start justify-between gap-6 border-b border-black/10 bg-white px-6 py-5 sm:px-8 sm:py-7">
              <div>
                <p className={modalEyebrowClass}>Cassa · Rettifica amministrativa</p>
                <h2 className="mt-2 font-serif text-3xl leading-none sm:text-4xl">Aggiungi chiusura</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">Inserisci una chiusura mancante mantenendo traccia del salone e del lavoratore responsabile.</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} aria-label="Chiudi" className="grid size-11 shrink-0 place-items-center border border-black/15 bg-white text-black transition hover:bg-black hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <label className="block">
                <span className={modalLabelClass}>Salone</span>
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
                <span className={modalLabelClass}>Lavoratore responsabile</span>
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
                <span className={modalLabelClass}>Data chiusura</span>
                <input value={manualDate} onChange={(event) => setManualDate(event.target.value)} type="date" className={fieldClass} />
              </label>
                <label className="block">
                  <span className={modalLabelClass}>Importo dichiarato (€)</span>
                  <input value={manualWithdrawn} onChange={(event) => setManualWithdrawn(event.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="0.00" className={fieldClass} />
                </label>
                <label className="block">
                  <span className={modalLabelClass}>Fondo cassa (€)</span>
                  <input value={manualFund} onChange={(event) => setManualFund(event.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="50.00" className={fieldClass} />
                </label>
              <label className="block sm:col-span-2">
                <span className={modalLabelClass}>Nota amministrativa</span>
                <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} rows={3} placeholder="Esempio: inserita da admin per dimenticanza del lavoratore..." className={textAreaClass} />
              </label>
              {manualError ? <p className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 sm:col-span-2">{manualError}</p> : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-black/10 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" onClick={() => setManualOpen(false)} className={secondaryButtonClass}>Annulla</button>
              <button type="submit" disabled={manualSaving || !manualLocationId || !manualUserId} className={primaryButtonClass}>
                {manualSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Salva chiusura
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {weekCloseModalOpen ? (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} sm:max-w-5xl`}>
            <div className="flex shrink-0 items-start justify-between gap-6 border-b border-black/10 bg-white px-6 py-5 sm:px-8 sm:py-7">
              <div>
                <p className={modalEyebrowClass}>Salone · Controllo settimanale</p>
                <h2 className="mt-2 font-serif text-3xl leading-none sm:text-4xl">Chiusura settimanale</h2>
                {(() => {
                  const mon = new Date((weekKey || "") + "T00:00:00");
                  const sun = new Date(mon);
                  sun.setDate(sun.getDate() + 6);
                  return (
                    <p className="mt-3 text-sm text-black/55">
                      Settimana dal <strong>{mon.toLocaleDateString("it-IT")}</strong> al <strong>{sun.toLocaleDateString("it-IT")}</strong>
                    </p>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setWeekCloseModalOpen(false)}
                aria-label="Chiudi"
                className="grid size-11 shrink-0 place-items-center border border-black/15 bg-white text-black transition hover:bg-black hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
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

                const weeklyVaultWithdrawals = vaultWithdrawals
                  .filter((vw: any) => {
                    const locId = vw.user_location_id || vw.location?.id;
                    if (locId !== selectedWeekCloseLocationId) return false;
                    const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date || vw.created_at;
                    const vwDate = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
                      ? new Date(rawDate + "T00:00:00")
                      : new Date(rawDate);
                    return vwDate >= startRange && vwDate <= endRange;
                  })
                  .sort((a: any, b: any) => {
                    const aDate = new Date(a.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || a.date || a.created_at).getTime();
                    const bDate = new Date(b.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || b.date || b.created_at).getTime();
                    return bDate - aDate;
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
                      <h3 className="text-xs font-black uppercase tracking-wider text-black/40 mb-2">Chiusure cassa del periodo</h3>
                      {sortedClosings.length === 0 ? (
                        <p className="text-xs text-black/45 italic py-2">Nessuna chiusura cassa registrata in questo periodo.</p>
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

                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-black/40 mb-2">Transazioni / prelievi del periodo</h3>
                      {weeklyVaultWithdrawals.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-black/10 bg-[#FAF7F9] px-4 py-3 text-xs font-semibold text-black/40">
                          Nessun prelievo o spesa registrata per questo salone nel periodo selezionato.
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-black/5 text-[10px] font-black uppercase text-black/45">
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Motivo</th>
                                <th className="px-4 py-2">Operatore</th>
                                <th className="px-4 py-2 text-right">Importo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 text-xs">
                              {weeklyVaultWithdrawals.map((vw: any) => {
                                const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date || vw.created_at;
                                const dateStr = new Date(rawDate).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
                                const amount = money(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount);
                                const reason = String(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] || vw.reason || "Motivo non indicato");
                                const operator = vw.answers?._signature?.user_name || vw.user?.name || "Operatore";
                                return (
                                  <tr key={vw.id}>
                                    <td className="px-4 py-2 font-bold capitalize">{dateStr}</td>
                                    <td className="px-4 py-2 text-black/65">{reason}</td>
                                    <td className="px-4 py-2 text-black/50">{operator}</td>
                                    <td className="px-4 py-2 text-right font-black text-amber-700">-{amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-black/5 font-black">
                                <td colSpan={3} className="px-4 py-2">Totale transazioni / prelievi</td>
                                <td className="px-4 py-2 text-right text-amber-700">
                                  -{weeklyVaultWithdrawals.reduce((sum: number, vw: any) => sum + money(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount), 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
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
                                sortedClosings,
                                weeklyVaultWithdrawals
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
                              const transactionBreakdown = weeklyVaultWithdrawals.map((vw: any) => ({
                                date: new Date(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date || vw.created_at).toLocaleDateString("it-IT"),
                                amount: money(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount),
                                reason: String(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] || vw.reason || "Motivo non indicato"),
                                operator: vw.answers?._signature?.user_name || vw.user?.name || "Operatore",
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
                                  dailyBreakdown: breakdown,
                                  transactionBreakdown
                                })
                              });
                              setSavingWeekClose(false);
                              if (!response.ok) {
                                alert("Errore durante il salvataggio della chiusura.");
                                return;
                              }
                              const doc = generateWeeklyClosePdf(
                                locationName,
                                currentTargetWeekKey || "",
                                "Chiusura",
                                new Date().toISOString(),
                                calculatedDeposit,
                                calculatedPrelievi,
                                weekCloseNotes,
                                sortedClosings,
                                weeklyVaultWithdrawals
                              );
                              if (doc) {
                                try {
                                  const uploadResponse = await fetch("/api/cash/weekly-close-pdf", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      locationId: selectedWeekCloseLocationId,
                                      weekKey: currentTargetWeekKey,
                                      locationName,
                                      monthLabel: monthDisplayLabel(month),
                                      pdfBase64: doc.output("datauristring"),
                                    }),
                                  });
                                  if (!uploadResponse.ok) {
                                    const uploadData = await uploadResponse.json().catch(() => ({}));
                                    alert(uploadData.error || "Chiusura salvata, ma caricamento PDF su Drive non riuscito.");
                                  }
                                } catch (err) {
                                  alert("Chiusura salvata, ma caricamento PDF su Drive non riuscito.");
                                }
                              }
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
                              sortedClosings,
                              weeklyVaultWithdrawals
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

function MonthSummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[#FAF7F9] p-4">
      <div className="flex items-center gap-2 text-[#A74758]">
        <Icon className="size-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-[#111017]">{value}</p>
      <p className="mt-1 text-xs font-bold text-black/45">{detail}</p>
    </div>
  );
}

function MonthSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-black/40">{title}</h3>
      {children}
    </section>
  );
}

function EmptyMonthMessage({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-black/10 bg-[#FAF7F9] px-4 py-3 text-sm font-semibold text-black/40">
      {text}
    </p>
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
  closings: any[],
  vaults: any[] = []
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
  doc.text("CHIUSURE CASSA DEL PERIODO:", 15, 80);

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

  if (vaults.length > 0) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("TRANSAZIONI / PRELIEVI DEL PERIODO:", 15, y);
    y += 5;

    doc.setFillColor(250, 247, 249);
    doc.rect(15, y, 180, 8, "F");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Data", 18, y + 5.5);
    doc.text("Motivo", 48, y + 5.5);
    doc.text("Operatore", 125, y + 5.5);
    doc.text("Importo", 180, y + 5.5, { align: "right" });
    y += 13;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    vaults.forEach((vw) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date || vw.created_at;
      const dateFormatted = new Date(rawDate).toLocaleDateString("it-IT");
      const reason = String(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] || vw.reason || "Motivo non indicato");
      const opName = vw.answers?._signature?.user_name || vw.user?.name || "Operatore";
      const amount = money(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount);

      doc.text(dateFormatted, 18, y);
      doc.text(doc.splitTextToSize(reason, 72)[0] || "-", 48, y);
      doc.text(doc.splitTextToSize(opName, 34)[0] || "-", 125, y);
      doc.text(`-${amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`, 180, y, { align: "right" });
      doc.setDrawColor(245, 245, 245);
      doc.line(15, y + 2.5, 195, y + 2.5);
      y += 8;
    });
  }

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
  return doc;
}
