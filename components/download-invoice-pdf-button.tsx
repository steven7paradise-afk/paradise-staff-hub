"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

type DownloadInvoicePdfButtonProps = {
  invoice: {
    id: string;
    created_at: string;
    user_location_name?: string | null;
    user: {
      name: string | null;
    };
    answers: any;
  };
};

export function DownloadInvoicePdfButton({ invoice }: DownloadInvoicePdfButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const clientName = invoice.answers.invoice_client_name || "N/A";
      const clientType = invoice.answers.invoice_client_type || "N/A";
      const fiscalCode = invoice.answers.invoice_fiscal_code || "N/A";
      const vatNumber = invoice.answers.invoice_vat_number || "N/A";
      const sdiCode = invoice.answers.invoice_sdi_code || "N/A";
      const pec = invoice.answers.invoice_pec || "N/A";
      const address = invoice.answers.invoice_address || "N/A";
      const amount = parseFloat(invoice.answers.invoice_amount || "0");
      const paymentMethod = invoice.answers.invoice_payment_method || "N/A";
      const receiptRef = invoice.answers.invoice_receipt_ref || "N/A";
      const notes = invoice.answers.invoice_notes || "";
      const dateStr = new Date(invoice.created_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome"
      });

      // Colors
      const primaryColor = [15, 23, 42]; // Slate 900
      const accentColor = [14, 116, 144]; // Cyan 700
      const lightBg = [248, 250, 252]; // Slate 50
      const borderLine = [226, 232, 240]; // Slate 200

      // Header Band
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, "F");

      // Brand
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("PARADISE HAIR & SPA", 15, 18);

      doc.setTextColor(186, 230, 253); // Light cyan
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RICEVUTA DI RICHIESTA FATTURA ELETTRONICA", 15, 25);

      // Metadata Header Right
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`ID Richiesta: ${invoice.id.substring(0, 8).toUpperCase()}`, 150, 18);
      doc.text(`Data: ${dateStr}`, 150, 24);
      doc.text(`Sede: ${invoice.user_location_name || "N/A"}`, 150, 30);
      doc.text(`Operatore: ${invoice.user?.name || "N/A"}`, 150, 36);

      // Body Section: Customer Details Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, 55, 180, 55, "F");
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.rect(15, 55, 180, 55, "S");

      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DATI ANAGRAFICI CLIENTE", 20, 62);

      doc.setTextColor(51, 65, 85); // Slate 700
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Tipo Cliente: ${clientType}`, 20, 70);
      doc.text(`Nome / Ragione Sociale: ${clientName}`, 20, 76);

      if (clientType.includes("Privato")) {
        doc.text(`Codice Fiscale: ${fiscalCode.toUpperCase()}`, 20, 82);
      } else {
        doc.text(`Partita IVA: ${vatNumber}`, 20, 82);
        doc.text(`Codice SDI: ${sdiCode.toUpperCase()}`, 20, 88);
        doc.text(`PEC: ${pec}`, 20, 94);
      }
      doc.text(`Indirizzo Fatturazione: ${address}`, 20, clientType.includes("Privato") ? 88 : 100);

      // Body Section: Payment/Invoice Details Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, 118, 180, 45, "F");
      doc.rect(15, 118, 180, 45, "S");

      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DETTAGLI FATTURAZIONE ED INCASSO", 20, 125);

      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Metodo di Pagamento: ${paymentMethod}`, 20, 133);
      doc.text(`Riferimento Scontrino / Ordine: ${receiptRef}`, 20, 139);
      
      const formattedAmount = amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
      doc.setFont("helvetica", "bold");
      doc.text(`Importo Totale Incassato: ${formattedAmount}`, 20, 147);

      // Notes Section
      if (notes) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(15, 171, 180, 30, "F");
        doc.rect(15, 171, 180, 30, "S");

        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("NOTE ED ELEMENTI AGGIUNTIVI", 20, 178);

        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        
        // Wrap notes to fit box width
        const wrappedNotes = doc.splitTextToSize(notes, 170);
        doc.text(wrappedNotes, 20, 184);
      }

      // Footer disclaimer
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Questo documento costituisce una richiesta di emissione fattura. Non sostituisce la fattura elettronica inviata allo SDI.", 15, 275);
      doc.text(`Generato automaticamente da Staff Hub il ${new Date().toLocaleDateString("it-IT")}`, 150, 275);

      // Save PDF
      const filename = `richiesta_fattura_${clientName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${invoice.id.substring(0, 6)}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Errore durante la generazione del PDF. Riprova.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-[#0e7490] hover:text-[#155e75] bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 dark:text-cyan-400 rounded-xl border border-cyan-200/50 dark:border-cyan-800/30 transition active:scale-[0.98] disabled:opacity-50"
    >
      {downloading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Download className="size-3.5" />
          PDF
        </>
      )}
    </button>
  );
}
