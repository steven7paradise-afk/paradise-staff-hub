"use client";

import React, { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

type DownloadRefundPdfButtonProps = {
  refund: {
    id: string;
    created_at: string;
    user_location_name?: string | null;
    user: {
      name: string | null;
    } | null;
    status: string;
    internal_notes?: any;
    answers: any;
  };
};

function parseNoteText(notes: any): string {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object") {
    return notes.text || notes.note || JSON.stringify(notes);
  }
  return String(notes);
}

export function DownloadRefundPdfButton({ refund }: DownloadRefundPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleView = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const clientName = refund.answers.refund_client_name || "N/A";
      const shopifyOrder = refund.answers.refund_shopify_order || "N/A";
      const amount = parseFloat(String(refund.answers.refund_amount || "0").replace(",", "."));
      const method = refund.answers.refund_method || "N/A";
      const reason = refund.answers.refund_reason || "N/A";
      const notes = refund.answers.refund_notes || "";
      const internalNotes = parseNoteText(refund.internal_notes);
      
      const statusLabels: Record<string, string> = {
        NEW: "IN ATTESA",
        APPROVED: "APPROVATO",
        REJECTED: "NON APPROVATO"
      };
      const statusLabel = statusLabels[refund.status] || "IN ATTESA";

      const dateStr = new Date(refund.created_at).toLocaleDateString("it-IT", {
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
      const accentColor = [225, 29, 72]; // Rose 600
      const borderLine = [226, 232, 240]; // Slate 200

      // 1. TOP HEADER: Issuer Details & Document Title
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("PARADISE BEAUTY", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text("ROSA FRANCESCA S.R.L.", 15, 25);
      doc.text("Milano, Italia", 15, 29);

      // Right: Document details
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("RICHIESTA RIMBORSO", 120, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text(`Codice Pratica: #REF-${refund.id.substring(0, 8).toUpperCase()}`, 120, 26);
      doc.text(`Data Compilazione: ${dateStr}`, 120, 31);
      doc.text(`Salone di Origine: ${refund.user_location_name || "N/A"}`, 120, 36);
      doc.text(`Compilato da: ${refund.user?.name || "N/A"}`, 120, 41);

      // Divider line
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setLineWidth(0.3);
      doc.line(15, 47, 195, 47);

      // 2. REFUND SUMMARY DETAILS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("DETTAGLI DELLA PRATICA", 15, 54);

      // Box design for values
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(250, 250, 250);
      doc.rect(15, 58, 180, 40, "DF");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text("Cliente:", 20, 65);
      doc.text("Ordine Shopify:", 20, 72);
      doc.text("Metodo Rimborso:", 20, 79);
      doc.text("Importo:", 20, 88);

      doc.setFont("helvetica", "normal");
      doc.text(clientName, 60, 65);
      doc.text(shopifyOrder, 60, 72);
      doc.text(method, 60, 79);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(`€ ${amount.toFixed(2)}`, 60, 88);

      // 3. REASON & NOTES
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("MOTIVAZIONE & NOTE DELLO STAFF", 15, 107);

      let currentY = 113;

      // Reason wrapping
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      const wrappedReason = doc.splitTextToSize(`Motivazione: ${reason}`, 170);
      doc.text(wrappedReason, 15, currentY);
      currentY += (wrappedReason.length * 5) + 3;

      if (notes) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(grayLight[0], grayLight[1], grayLight[2]);
        const wrappedNotes = doc.splitTextToSize(`Note aggiuntive: ${notes}`, 170);
        doc.text(wrappedNotes, 15, currentY);
        currentY += (wrappedNotes.length * 4.5) + 5;
      }

      // Divider line
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.line(15, currentY, 195, currentY);
      currentY += 8;

      // 4. ADMIN APPROVAL STATUS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("APPROVAZIONE E NOTE AMMINISTRATIVE", 15, currentY);
      currentY += 5;

      doc.setFillColor(254, 252, 232); // Light yellow box
      doc.setDrawColor(254, 240, 138);
      doc.rect(15, currentY, 180, 25, "DF");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      doc.text("Stato Pratica:", 20, currentY + 7);
      doc.text("Note Interne:", 20, currentY + 15);

      doc.setFont("helvetica", "bold");
      if (refund.status === "APPROVED") {
        doc.setTextColor(16, 185, 129); // Emerald 500
      } else if (refund.status === "REJECTED") {
        doc.setTextColor(239, 68, 68); // Red 500
      } else {
        doc.setTextColor(245, 158, 11); // Amber 500
      }
      doc.text(statusLabel, 50, currentY + 7);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
      const wrappedIntNotes = doc.splitTextToSize(internalNotes || "Nessuna nota amministrativa inserita.", 130);
      doc.text(wrappedIntNotes, 50, currentY + 15);

      // Footer disclaimer
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text("Questo documento costituisce un riepilogo amministrativo della richiesta di rimborso compilata dallo staff.", 15, 281);
      doc.text(`Generato automaticamente da Staff Hub il ${new Date().toLocaleDateString("it-IT")} alle ${new Date().toLocaleTimeString("it-IT")}`, 15, 285);

      // Output as blob URL and open in new tab
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Refund PDF generation failed:", error);
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
      className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-1.5 text-xs font-black text-[#0e7490] hover:text-[#155e75] bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 dark:text-cyan-400 rounded-xl border border-cyan-200/50 dark:border-cyan-800/30 transition active:scale-[0.98] disabled:opacity-50"
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
