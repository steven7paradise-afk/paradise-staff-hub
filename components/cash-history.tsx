"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileDown, Trash2, Calendar, Search, Loader2, ExternalLink } from "lucide-react";
import { jsPDF } from "jspdf";

type CashLocation = {
  id: string;
  name: string;
};

export function CashHistory({
  weekCloses = [],
  locations = [],
  isResponsible = false,
  userSedeId = null,
}: {
  weekCloses: any[];
  locations: CashLocation[];
  isResponsible: boolean;
  userSedeId: string | null;
}) {
  const router = useRouter();
  const [filterLocationId, setFilterLocationId] = useState("");
  const [reopeningKey, setReopeningKey] = useState<string | null>(null);

  // Filtra e ordina lo storico delle chiusure
  const processedCloses = weekCloses
    .map((setting: any) => {
      const val = setting.value || {};
      const keyParts = setting.key.split(":");
      const locationId = keyParts[1] || val.locationId;
      const weekKey = keyParts[2] || val.weekKey;
      return {
        key: setting.key,
        locationId,
        weekKey,
        bank_deposit: val.bank_deposit || 0,
        withdrawals: val.withdrawals || 0,
        notes: val.notes || "",
        daily_breakdown: val.daily_breakdown || [],
        transaction_breakdown: val.transaction_breakdown || [],
        pdf_drive: val.pdf_drive || null,
        closed_at: val.closed_at,
        closed_by_name: val.closed_by_name || "Admin",
      };
    })
    .filter((wc) => {
      if (isResponsible && wc.locationId !== userSedeId) return false;
      if (filterLocationId && wc.locationId !== filterLocationId) return false;
      return true;
    })
    .sort((a, b) => {
      const compareWeek = b.weekKey.localeCompare(a.weekKey);
      if (compareWeek !== 0) return compareWeek;
      const dateB = b.closed_at ? new Date(b.closed_at).getTime() : 0;
      const dateA = a.closed_at ? new Date(a.closed_at).getTime() : 0;
      return dateB - dateA;
    });

  async function handleReopen(weekKey: string, locationId: string, settingKey: string) {
    if (!confirm("Sei sicuro di voler riaprire questa settimana/periodo per questo salone? L'importo in banca verrà cancellato e la disponibilità cassa verrà ripristinata.")) return;
    setReopeningKey(settingKey);
    const response = await fetch("/api/cash/close-week", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekKey,
        locationId,
      }),
    });
    setReopeningKey(null);
    if (!response.ok) {
      alert("Errore durante la riapertura.");
      return;
    }
    router.refresh();
  }

  function formatPeriod(weekKey: string) {
    if (!weekKey) return "Periodo non specificato";
    if (weekKey.includes(":")) {
      const [start, end] = weekKey.split(":");
      return `Dal ${new Date(start).toLocaleDateString("it-IT")} al ${new Date(end).toLocaleDateString("it-IT")}`;
    }
    const mon = new Date(weekKey + "T00:00:00");
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return `Settimana dal ${mon.toLocaleDateString("it-IT")} al ${sun.toLocaleDateString("it-IT")}`;
  }

  return (
    <div className="-mx-4 border-y border-black/10 bg-white p-5 sm:mx-0 sm:rounded-lg sm:border">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Storico</p>
          <h2 className="mt-1 text-2xl font-black text-[#111017]">Storico chiusure periodiche</h2>
          <p className="text-xs text-black/45 mt-0.5">Elenco di tutti i versamenti in banca e chiusure cassa effettuate.</p>
        </div>

        {!isResponsible && locations.length > 0 ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-bold text-black/40">Filtra Sede:</span>
            <select
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              className="h-10 rounded-xl border border-black/10 bg-[#FAF7F9] px-3 text-xs font-bold text-[#111017] outline-none focus:border-[#A74758]"
            >
              <option value="">Tutti i saloni</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {processedCloses.length === 0 ? (
        <div className="py-8 text-center text-xs text-black/40 italic">
          Nessuna chiusura periodica trovata per i criteri selezionati.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 text-[10px] font-black uppercase text-black/45">
                <th className="pb-3 pr-4">Sede / Salone</th>
                <th className="pb-3 pr-4">Periodo Chiusura</th>
                <th className="pb-3 pr-4">Data Chiusura</th>
                <th className="pb-3 pr-4">Operatore</th>
                <th className="pb-3 pr-4 text-right">Somma Dichiarata</th>
                <th className="pb-3 pr-4 text-right">Versato Banca</th>
                <th className="pb-3 pr-4 text-right">Prelievi / Spese</th>
                <th className="pb-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-xs text-[#111017]">
              {processedCloses.map((wc) => {
                const locName = locations.find((l) => l.id === wc.locationId)?.name || wc.locationId;
                const totalDeclared = wc.daily_breakdown.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
                const difference = (wc.bank_deposit + Math.abs(wc.withdrawals)) - totalDeclared;

                return (
                  <tr key={wc.key} className="hover:bg-black/[0.01] transition-colors">
                    <td className="py-3.5 pr-4 font-bold">{locName}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-1.5 font-semibold text-black/70">
                        <Calendar className="size-3.5 text-[#A74758]" />
                        <span>{formatPeriod(wc.weekKey)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-black/50">
                      {wc.closed_at ? new Date(wc.closed_at).toLocaleString("it-IT") : "-"}
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-black/70">{wc.closed_by_name}</td>
                    <td className="py-3.5 pr-4 text-right font-semibold text-black/60">
                      {totalDeclared.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-black text-emerald-700">
                      {wc.bank_deposit.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-black text-amber-700">
                      {wc.withdrawals !== 0 ? "-" : ""}
                      {Math.abs(wc.withdrawals).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            generateHistoryClosePdf(
                              locName,
                              wc.weekKey,
                              wc.closed_by_name,
                              wc.closed_at || "",
                              wc.bank_deposit,
                              wc.withdrawals,
                              wc.notes,
                              wc.daily_breakdown,
                              wc.transaction_breakdown
                            )
                          }
                          title="Scarica PDF Chiusura"
                          className="grid size-8 place-items-center rounded-xl bg-black/5 text-black hover:bg-black/10 transition-colors"
                        >
                          <FileDown className="size-4" />
                        </button>
                        {wc.pdf_drive?.webViewLink ? (
                          <a
                            href={wc.pdf_drive.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            title="Apri PDF su Drive"
                            className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                        {!isResponsible ? (
                          <button
                            type="button"
                            onClick={() => handleReopen(wc.weekKey, wc.locationId, wc.key)}
                            disabled={reopeningKey === wc.key}
                            title="Riapri Periodo"
                            className="grid size-8 place-items-center rounded-xl bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {reopeningKey === wc.key ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function generateHistoryClosePdf(
  locationName: string,
  weekKey: string,
  closedByName: string,
  closedAt: string,
  bankDeposit: number,
  withdrawals: number,
  notes: string,
  breakdown: any[],
  transactions: any[] = []
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
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
  doc.text(`Settimana/Periodo:`, 15, 52);
  doc.setFont("helvetica", "bold");
  doc.text(weekKey.includes(":") ? weekKey.replace(":", " al ") : weekKey, 50, 52);

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

  breakdown.forEach((item: any) => {
    const rawDate = item.date || "";
    const dateFormatted = rawDate;
    const opName = item.operator || "Lavoratore";
    const amount = Number(item.amount || 0);
    totalDeclared += amount;

    doc.text(dateFormatted, 18, y);
    doc.text(opName, 60, y);
    doc.text(amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" }), 180, y, { align: "right" });

    doc.setDrawColor(245, 245, 245);
    doc.line(15, y + 2.5, 195, y + 2.5);
    y += 8;
  });

  if (transactions.length > 0) {
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
    transactions.forEach((item: any) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      const amount = Number(item.amount || 0);
      doc.text(String(item.date || "-"), 18, y);
      doc.text(doc.splitTextToSize(String(item.reason || "Motivo non indicato"), 72)[0] || "-", 48, y);
      doc.text(doc.splitTextToSize(String(item.operator || "Operatore"), 34)[0] || "-", 125, y);
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

  const filename = `chiusura_periodica_${locationName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${weekKey.replace(":", "_")}.pdf`;
  doc.save(filename);
}
