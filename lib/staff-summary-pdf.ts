import { jsPDF } from "jspdf";
import type { StaffSummaryRow } from "./staff-attendance-summary";

export function createStaffSummaryPdf(rows: StaffSummaryRow[], label: string, filters: string, generatedAt: string, photos = new Map<string, string | null>()) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const ink = [38, 35, 41] as const;
  const muted = [119, 113, 122] as const;
  const text = (value: string | string[], x: number, y: number, size = 9, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...ink); doc.text(value, x, y);
  };
  const rule = (y: number) => { doc.setDrawColor(229, 226, 231); doc.line(14, y, 196, y); };
  const header = () => {
    text("PARADISE", 14, 16, 9, true);
    doc.setTextColor(...muted); doc.setFontSize(8); doc.text("STAFF / PRESENZE", 196, 16, { align: "right" });
    text("Riepilogo presenze", 14, 27, 19, true);
    text(label.charAt(0).toUpperCase() + label.slice(1), 14, 34, 10);
    doc.setFontSize(8); doc.setTextColor(...muted);
    const lines: string[] = doc.splitTextToSize(filters, 182); doc.text(lines, 14, 41);
    const y = 45 + lines.length * 3.5; rule(y); return y + 7;
  };
  const identity = (row: StaffSummaryRow, y: number, continued: boolean) => {
    const photo = photos.get(row.id);
    if (photo) doc.addImage(photo, "JPEG", 14, y, 20, 20);
    else {
      doc.setFillColor(241, 238, 242); doc.roundedRect(14, y, 20, 20, 3, 3, "F");
      text(row.name.split(/\s+/).slice(0, 2).map(part => part[0]).join(""), 20, y + 12, 11, true);
    }
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    const name: string[] = doc.splitTextToSize(row.name, 153); text(name, 40, y + 6, 14, true);
    const nameHeight = name.length * 5.5;
    text(`${row.location}${row.active ? "" : " / Archiviato"}`, 40, y + nameHeight + 8, 9);
    if (continued) text("Cronologia / continua", 40, y + nameHeight + 14, 8);
    return y + Math.max(27, nameHeight + (continued ? 19 : 13));
  };
  const tableHeader = (y: number) => {
    doc.setFillColor(246, 245, 247); doc.rect(14, y, 182, 9, "F");
    text("DATA", 18, y + 6, 7, true); text("EVENTO", 42, y + 6, 7, true);
    text("STATO", 126, y + 6, 7, true); text("MINUTI", 179, y + 6, 7, true);
    return y + 9;
  };
  if (!rows.length) { const y = header(); text("Nessun lavoratore corrisponde ai filtri selezionati.", 14, y + 8, 11); }
  rows.forEach((row, index) => {
    if (index) doc.addPage();
    let y = identity(row, header(), false);
    const metrics = [
      ["RITARDI", row.late, `${row.lateMinutes} minuti complessivi`],
      ["GIUSTIFICATI", row.sickness + row.holidays + row.other, "giorni autorizzati"],
      ["SENZA GIUSTIFICA", row.unjustified || 0, "giorni registrati"],
      ["TIMBRATURE MANCANTI", row.missing, "da verificare"],
    ] as const;
    metrics.forEach(([title, value, description], position) => {
      const x = 14 + position * 46.5;
      doc.setFillColor(247, 246, 248); doc.roundedRect(x, y, 42.5, 27, 2, 2, "F");
      text(title, x + 3, y + 6, 6.5, true); text(String(value), x + 3, y + 16, 19, true);
      doc.setFontSize(7); doc.setTextColor(...muted); doc.text(description, x + 3, y + 23);
    });
    y += 35;
    text(`Malattia: ${row.sickness}   /   Ferie: ${row.holidays}   /   Altre assenze: ${row.other}`, 14, y, 8.5);
    y += 6; text(`Permessi: ${row.permits}   /   Riposi: ${row.rest}   /   Richieste in attesa: ${row.pending}`, 14, y, 8.5);
    y += 10; text("Cronologia del mese", 14, y, 11, true); y += 5;
    y = tableHeader(y);
    if (!row.events.length) text("Nessun evento registrato nel mese.", 18, y + 8, 9);
    for (const event of row.events) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      const eventLines: string[] = doc.splitTextToSize(event.label, 77);
      const stateLines: string[] = doc.splitTextToSize(event.status, 45);
      const height = Math.max(eventLines.length, stateLines.length) * 4 + 7;
      if (y + height > 270) {
        doc.addPage(); y = identity(row, header(), true); y = tableHeader(y);
      }
      text(event.date.split("-").reverse().join("/"), 18, y + 7, 8);
      text(eventLines, 42, y + 7, 8.5);
      doc.setFontSize(8); doc.setTextColor(...muted); doc.text(stateLines, 126, y + 7);
      text(event.minutes ? `+${event.minutes}` : "-", 182, y + 7, 8.5, Boolean(event.minutes));
      y += height; rule(y);
    }
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); rule(278);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...muted);
    doc.text("Ritardi oltre la tolleranza. Timbrature mancanti da verificare, non assenze ingiustificate confermate.", 14, 283);
    doc.text("Giorni autorizzati: incluse assenze programmate. Permessi anche parziali. Documento riservato.", 14, 286.5);
    doc.setFontSize(7);
    doc.text(`Aggiornato: ${new Date(generatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}`, 14, 292);
    doc.text(`${page} / ${pages}`, 196, 292, { align: "right" });
  }
  doc.setProperties({ title: `Riepilogo presenze / ${label}`, author: "Paradise Staff Hub" });
  return doc;
}
