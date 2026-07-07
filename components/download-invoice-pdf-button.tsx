"use client";

import React, { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
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
  const [generating, setGenerating] = useState(false);

  const handleView = async () => {
    setGenerating(true);
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
      const grayDark = [51, 65, 85]; // Slate 700
      const grayLight = [100, 116, 139]; // Slate 500
      const accentColor = [167, 71, 88]; // Paradise Magenta
      const borderLine = [226, 232, 240]; // Slate 200

      // 1. TOP HEADER: Issuer Details (Left) & Document Title (Right)
      // Left: Issuer ROSA FRANCESCA S.R.L.
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("ROSA FRANCESCA S.R.L.", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text("CORSO BUENOS AIRES 77", 15, 25);
      doc.text("20124 - MILANO (MI)", 15, 29);
      doc.text("Cod. Fiscale / P.IVA: 13218610965", 15, 33);
      doc.text("REA: MI-2709702", 15, 37);
      doc.text(`PEC: rosafrancescasrl@pec.it`, 15, 41);

      // Right: Document details
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("FATTURA", 140, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text(`Richiesta N.: #${invoice.id.substring(0, 8).toUpperCase()}`, 140, 26);
      doc.text(`Data Richiesta: ${dateStr}`, 140, 31);
      doc.text(`Sede: ${invoice.user_location_name || "N/A"}`, 140, 36);
      doc.text(`Operatore: ${invoice.user?.name || "N/A"}`, 140, 41);

      // Divider line
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setLineWidth(0.3);
      doc.line(15, 47, 195, 47);

      // 2. CUSTOMER DETAILS SECTION (SPETTABILE)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text("SPETTABILE CLIENTE / DESTINATARIO", 15, 54);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      
      // Let's print the customer block
      doc.setFont("helvetica", "bold");
      doc.text(clientName, 15, 60);
      
      doc.setFont("helvetica", "normal");
      doc.text(`Tipo: ${clientType}`, 15, 65);
      
      // Left side details
      const addressWrapped = doc.splitTextToSize(`Indirizzo: ${address}`, 100);
      doc.text(addressWrapped, 15, 70);

      // Right side details (SDI / PEC / VAT / Fiscal Code)
      const rightColX = 125;
      if (clientType.includes("Privato")) {
        doc.text(`Codice Fiscale: ${fiscalCode.toUpperCase()}`, rightColX, 60);
      } else {
        doc.text(`Partita IVA: ${vatNumber}`, rightColX, 60);
        doc.text(`Codice SDI: ${sdiCode.toUpperCase()}`, rightColX, 65);
        doc.text(`PEC: ${pec}`, rightColX, 70);
      }

      // Divider line
      doc.line(15, 82, 195, 82);

      // 3. PRODUCTS & SERVICES TABLE
      // Table headers
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Descrizione", 15, 89);
      doc.text("Q.tà", 130, 89, { align: "right" });
      doc.text("Prezzo Unitario", 160, 89, { align: "right" });
      doc.text("Importo Totale", 195, 89, { align: "right" });

      // Border below headers
      doc.setLineWidth(0.4);
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.line(15, 92, 195, 92);

      // Reset draw color and line width for rows
      doc.setLineWidth(0.15);
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);

      let currentY = 98;
      
      // Retrieve line items (either from Shopify order or mock a single row from request amount)
      const shopifyItems = invoice.answers.invoice_shopify_items;
      const hasShopifyItems = Array.isArray(shopifyItems) && shopifyItems.length > 0;

      const itemsToRender: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

      if (hasShopifyItems) {
        shopifyItems.forEach((item: any) => {
          const qty = item.quantity || 1;
          const uPrice = item.price || 0;
          itemsToRender.push({
            description: item.title || "Prodotto Shopify",
            quantity: qty,
            unitPrice: uPrice,
            totalPrice: uPrice * qty,
          });
        });
      } else {
        // Fallback row matching the typed amount
        itemsToRender.push({
          description: `Richiesta fatturazione servizi / prodotti Paradise (Rif: Scontrino/Ordine ${receiptRef || "N/A"})`,
          quantity: 1,
          unitPrice: amount,
          totalPrice: amount,
        });
      }

      // Render each row
      itemsToRender.forEach((item) => {
        const descWrapped = doc.splitTextToSize(item.description, 100);
        const descHeight = descWrapped.length * 4.5;
        
        doc.text(descWrapped, 15, currentY);
        doc.text(String(item.quantity), 130, currentY, { align: "right" });
        doc.text(`€ ${item.unitPrice.toFixed(2)}`, 160, currentY, { align: "right" });
        doc.text(`€ ${item.totalPrice.toFixed(2)}`, 195, currentY, { align: "right" });

        // Draw light divider below row
        currentY += Math.max(descHeight, 6);
        doc.line(15, currentY - 1, 195, currentY - 1);
        currentY += 4;
      });

      // 4. TAX BREAKDOWN & GRAND TOTAL
      // Right side totals aligned
      const labelX = 145;
      const valueX = 195;

      const imponibile = amount / 1.22;
      const iva = amount - imponibile;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(grayLight[0], grayLight[1], grayLight[2]);
      doc.text("Imponibile IVA 22%:", labelX, currentY, { align: "right" });
      doc.text(`€ ${imponibile.toFixed(2)}`, valueX, currentY, { align: "right" });

      currentY += 5;
      doc.text("IVA 22% su Imponibile:", labelX, currentY, { align: "right" });
      doc.text(`€ ${iva.toFixed(2)}`, valueX, currentY, { align: "right" });

      currentY += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("TOTALE INCASSATO:", labelX, currentY, { align: "right" });
      doc.text(`€ ${amount.toFixed(2)}`, valueX, currentY, { align: "right" });

      // 5. PAYMENT AND NOTES INFO (Bottom Left)
      currentY += 15;
      if (currentY > 230) {
        // Add new page if space is insufficient
        doc.addPage();
        currentY = 20;
      }

      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, 180, 25, "F");
      doc.rect(15, currentY, 180, 25, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text("DETTAGLI DI PAGAMENTO ED NOTE", 20, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text(`• Modalità di Pagamento: ${paymentMethod}`, 20, currentY + 12);
      doc.text(`• Riferimento Incasso: ${receiptRef}`, 20, currentY + 17);
      if (notes) {
        // Cut notes to single line preview
        const previewNotes = notes.length > 80 ? notes.substring(0, 80) + "..." : notes;
        doc.text(`• Note: ${previewNotes}`, 20, currentY + 22);
      }

      // Footer disclaimer
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text("Questo documento costituisce una richiesta di emissione fattura. Non sostituisce la fattura elettronica inviata allo SDI.", 15, 275);
      doc.text(`Generato automaticamente da Staff Hub il ${new Date().toLocaleDateString("it-IT")}`, 150, 275);

      // Output as blob URL and open in new tab
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Errore durante la generazione del PDF. Riprova.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleView}
      disabled={generating}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-[#0e7490] hover:text-[#155e75] bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 dark:text-cyan-400 rounded-xl border border-cyan-200/50 dark:border-cyan-800/30 transition active:scale-[0.98] disabled:opacity-50"
    >
      {generating ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Eye className="size-3.5" />
          Vedi PDF
        </>
      )}
    </button>
  );
}
