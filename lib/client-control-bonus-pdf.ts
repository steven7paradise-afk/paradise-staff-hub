import { jsPDF } from "jspdf";
import type { TeamBonusReport, TeamBonusResult } from "@/lib/team-bonus-report";

const palette = {
  wine: [127, 52, 66] as const,
  pink: [184, 91, 104] as const,
  ink: [38, 34, 40] as const,
  muted: [113, 106, 114] as const,
  line: [230, 221, 225] as const,
  soft: [250, 246, 248] as const,
  green: [50, 160, 115] as const,
  greenSoft: [218, 242, 230] as const,
  amber: [181, 106, 23] as const,
  amberSoft: [255, 239, 185] as const,
  graySoft: [235, 235, 235] as const,
};

function statusLabel(status: TeamBonusResult["status"]) {
  if (status === "BONUS_CONSIGLIATO") return "Bonus consigliato";
  if (status === "DA_VALUTARE") return "Da valutare";
  if (status === "NON_PRIORITARIO") return "Non prioritario";
  return "Dati insufficienti";
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]} ${parts.at(-1)?.[0] || ""}.`;
}

function clipped(doc: jsPDF, value: string, width: number) {
  return doc.splitTextToSize(value, width)[0] || "";
}

function setFill(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function pageFooter(doc: jsPDF, page: number) {
  doc.setDrawColor(...palette.line);
  doc.line(15, 198, 282, 198);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...palette.muted);
  doc.text("Paradise - Report interno riservato", 15, 203);
  doc.text(`Pagina ${page} di 4`, 282, 203, { align: "right" });
}

function pageTitle(doc: jsPDF, title: string, subtitle: string) {
  doc.setTextColor(...palette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...palette.muted);
  doc.text(subtitle, 15, 23);
}

function calendarPage(doc: jsPDF, report: TeamBonusReport) {
  pageTitle(doc, "Controllo Cliente: totale mensile e calendario", `${report.salon} - ${report.monthLabel}`);
  const totalCards = report.workers.reduce((sum, worker) => sum + worker.clients, 0);
  const totalPostoLampo = report.workers.reduce((sum, worker) => sum + (worker.postoLampo ?? 0), 0);
  const totalLateEntries = report.workers.reduce((sum, worker) => sum + worker.lateDays, 0);
  const totalLateEntryMinutes = report.workers.reduce((sum, worker) => sum + worker.lateMinutes, 0);
  const totalLateReturns = report.workers.reduce((sum, worker) => sum + worker.lateReturns, 0);
  const totalLateReturnMinutes = report.workers.reduce((sum, worker) => sum + worker.lateReturnMinutes, 0);
  const cards = [
    { label: "SCHEDE COMPLETATE", value: String(totalCards), detail: "totale mese", color: palette.greenSoft },
    { label: "POSTO LAMPO", value: String(totalPostoLampo), detail: "totale mese", color: palette.amberSoft },
    { label: "RITARDI ENTRATA", value: String(totalLateEntries), detail: `${totalLateEntryMinutes} min totali`, color: palette.amberSoft },
    { label: "RITARDI PAUSA", value: String(totalLateReturns), detail: `${totalLateReturnMinutes} min totali`, color: palette.amberSoft },
    { label: "LAVORATORI ATTIVI", value: String(report.workers.length), detail: "nel report", color: palette.soft },
  ] as const;
  const cardGap = 3;
  const cardWidth = (267 - cardGap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = 15 + index * (cardWidth + cardGap);
    setFill(doc, card.color);
    doc.setDrawColor(...palette.line);
    doc.roundedRect(x, 29, cardWidth, 22, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.4);
    doc.setTextColor(...palette.muted);
    doc.text(card.label, x + 4, 35.5);
    doc.setFontSize(12.5);
    doc.setTextColor(...palette.ink);
    doc.text(card.value, x + 4, 44.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(...palette.muted);
    doc.text(card.detail, x + cardWidth - 4, 44.5, { align: "right" });
  });

  const days = new Date(Date.UTC(report.year, report.month, 0)).getUTCDate();
  const nameWidth = 39;
  const totalWidth = 267;
  const dayWidth = (totalWidth - nameWidth) / days;
  const top = 61;
  const availableHeight = 127;
  const headerHeight = 8;
  const tableRows = Math.max(1, report.workers.length + 1);
  const rowHeight = Math.min(8.5, (availableHeight - headerHeight) / tableRows);
  doc.setFillColor(...palette.ink);
  doc.rect(15, top, totalWidth, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  doc.text("COLLABORATORE", 17, top + 5.3);
  for (let day = 1; day <= days; day += 1) {
    doc.text(String(day), 15 + nameWidth + (day - 0.5) * dayWidth, top + 5.3, { align: "center" });
  }
  report.workers.forEach((worker, rowIndex) => {
    const y = top + headerHeight + rowIndex * rowHeight;
    setFill(doc, rowIndex % 2 ? palette.soft : [255, 255, 255]);
    doc.rect(15, y, totalWidth, rowHeight, "F");
    doc.setDrawColor(...palette.line);
    doc.line(15, y + rowHeight, 282, y + rowHeight);
    doc.setTextColor(...palette.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(4.2, Math.min(6.2, rowHeight - 1.5)));
    doc.text(clipped(doc, worker.name, nameWidth - 3), 17, y + rowHeight / 2 + 1.5);
    const counts = worker.dailyCounts ?? worker.dailySheets ?? {};
    for (let day = 1; day <= days; day += 1) {
      const key = `${report.year}-${String(report.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const count = counts[key] ?? 0;
      setFill(doc, count >= 5 ? palette.greenSoft : count > 0 ? palette.amberSoft : palette.graySoft);
      const cellX = 15 + nameWidth + (day - 1) * dayWidth;
      doc.rect(cellX + 0.15, y + 0.15, Math.max(0.4, dayWidth - 0.3), Math.max(0.4, rowHeight - 0.3), "F");
      doc.setTextColor(...palette.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(3.3, Math.min(5.2, dayWidth * 0.9)));
      doc.text(String(count), cellX + dayWidth / 2, y + rowHeight / 2 + 1.25, { align: "center" });
    }
  });
  const totalRowY = top + headerHeight + report.workers.length * rowHeight;
  setFill(doc, palette.wine);
  doc.rect(15, totalRowY, totalWidth, rowHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(4, Math.min(5.8, rowHeight - 1.5)));
  doc.text("TOTALE GIORNO", 17, totalRowY + rowHeight / 2 + 1.5);
  for (let day = 1; day <= days; day += 1) {
    const key = `${report.year}-${String(report.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const total = report.workers.reduce((sum, worker) => sum + (worker.dailyCounts?.[key] ?? worker.dailySheets?.[key] ?? 0), 0);
    const cellX = 15 + nameWidth + (day - 1) * dayWidth;
    doc.text(String(total), cellX + dayWidth / 2, totalRowY + rowHeight / 2 + 1.25, { align: "center" });
  }
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...palette.muted);
  doc.text("Legenda: verde >= 5 schede; giallo 1-4; grigio 0.", 15, 193);
  pageFooter(doc, 1);
}

function workersPage(doc: jsPDF, report: TeamBonusReport) {
  doc.addPage();
  pageTitle(doc, "Totali mensili di tutti i lavoratori attivi", `${report.salon} - ${report.monthLabel}`);
  const headers = ["Collaboratore", "Ruolo", "Schede", "Posto Lampo", "Ritardi entrata", "Rientri pausa tardi", "Sistemazione fasce"];
  const widths = [55, 42, 26, 30, 36, 42, 36];
  const top = 31;
  const headerHeight = 10;
  const rowHeight = Math.min(11, 150 / Math.max(1, report.workers.length));
  doc.setFillColor(...palette.ink);
  doc.rect(15, top, 267, headerHeight, "F");
  let x = 15;
  headers.forEach((header, index) => {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text(header, x + widths[index] / 2, top + 6.2, { align: "center" });
    x += widths[index];
  });
  report.workers.forEach((worker, index) => {
    const y = top + headerHeight + index * rowHeight;
    setFill(doc, index % 2 ? palette.soft : [255, 255, 255]);
    doc.rect(15, y, 267, rowHeight, "F");
    doc.setDrawColor(...palette.line);
    doc.line(15, y + rowHeight, 282, y + rowHeight);
    const values = [worker.name, worker.role, String(worker.clients), String(worker.postoLampo ?? 0), `${worker.lateDays} (${worker.lateMinutes} min)`, `${worker.lateReturns} (${worker.lateReturnMinutes} min)`, String(worker.sistemazioneFasce ?? 0)];
    x = 15;
    values.forEach((value, column) => {
      doc.setTextColor(...palette.ink);
      doc.setFont("helvetica", column === 0 ? "bold" : "normal");
      doc.setFontSize(Math.max(4.2, Math.min(6.7, rowHeight - 2)));
      doc.text(clipped(doc, value, widths[column] - 3), x + (column < 2 ? 2 : widths[column] / 2), y + rowHeight / 2 + 1.7, { align: column < 2 ? "left" : "center" });
      x += widths[column];
    });
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...palette.muted);
  doc.text("Ritardo entrata: oltre 10 minuti rispetto al planning. Rientri pausa: numero eventi oltre la durata prevista e minuti complessivi.", 15, 193);
  pageFooter(doc, 2);
}

function comparisonPage(doc: jsPDF, report: TeamBonusReport) {
  doc.addPage();
  pageTitle(doc, "Confronto performance e metodologia", `${report.salon} - ${report.monthLabel}`);
  const candidates = report.workers.filter((worker) => worker.comparable).slice(0, 14);
  const rowHeight = Math.min(8, 93 / Math.max(1, candidates.length));
  candidates.forEach((worker, index) => {
    const y = 31 + index * rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...palette.ink);
    doc.text(clipped(doc, shortName(worker.name), 33), 49, y + 4.2, { align: "right" });
    doc.setFillColor(241, 235, 238);
    doc.roundedRect(53, y, 183, 5.2, 1, 1, "F");
    doc.setFillColor(...palette.pink);
    doc.roundedRect(53, y, 183 * worker.score / 100, 5.2, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${worker.score.toFixed(1)} - ${statusLabel(worker.status)}`, 240, y + 4.2);
  });
  if (!candidates.length) {
    doc.setFontSize(8);
    doc.setTextColor(...palette.muted);
    doc.text("Nessun lavoratore con almeno 3 schede e 3 giorni timbrati.", 15, 41);
  }
  doc.setTextColor(...palette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Criterio trasparente", 15, 139);
  const method = [
    ["30%", "Puntualita e disciplina", "Ingressi tardi, rientri pausa tardi e assenze non giustificate."],
    ["25%", "Foto complete", "Percentuale di schede con foto/video prima e dopo."],
    ["20%", "Vendita prodotti", "Percentuale di schede con almeno un prodotto acquistato."],
    ["15%", "Volume clienti", "Confronto con il massimo del team nello stesso periodo."],
    ["10%", "Recensioni e task", "Recensioni ottenute e task completate."],
  ];
  method.forEach((row, index) => {
    const y = 146 + index * 8;
    setFill(doc, index % 2 ? palette.soft : [255, 255, 255]);
    doc.setDrawColor(...palette.line);
    doc.rect(15, y, 267, 8, "FD");
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...palette.wine);
    doc.text(row[0], 21, y + 5.2);
    doc.setTextColor(...palette.ink);
    doc.text(row[1], 42, y + 5.2);
    doc.setFont("helvetica", "normal");
    doc.text(row[2], 105, y + 5.2);
  });
  pageFooter(doc, 3);
}

function detailsPage(doc: jsPDF, report: TeamBonusReport) {
  doc.addPage();
  pageTitle(doc, "Schede cliente, note e prodotti", `${report.salon} - ${report.monthLabel}. Estratto compatto; le righe eccedenti sono aggregate.`);
  const groups = report.workers.map((worker) => ({ worker, details: worker.clientDetails ?? [] })).filter((group) => group.details.length);
  const maximumRows = 28;
  const selected: Array<{ worker: string; detail: NonNullable<TeamBonusResult["clientDetails"]>[number] }> = [];
  let cursor = 0;
  while (selected.length < maximumRows && groups.some((group) => cursor < group.details.length)) {
    groups.forEach((group) => {
      if (selected.length < maximumRows && cursor < group.details.length) selected.push({ worker: group.worker.name, detail: group.details[cursor] });
    });
    cursor += 1;
  }
  const headers = ["Collaboratore / cliente", "Data", "Servizi", "Prodotti", "Note"];
  const widths = [55, 23, 32, 65, 92];
  const top = 30;
  const rowHeight = Math.min(5.3, 151 / Math.max(1, selected.length));
  doc.setFillColor(...palette.ink);
  doc.rect(15, top, 267, 9, "F");
  let x = 15;
  headers.forEach((header, index) => {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.text(header, x + 2, top + 5.8);
    x += widths[index];
  });
  selected.forEach(({ worker, detail }, index) => {
    const y = top + 9 + index * rowHeight;
    setFill(doc, index % 2 ? palette.soft : [255, 255, 255]);
    doc.rect(15, y, 267, rowHeight, "F");
    doc.setDrawColor(...palette.line);
    doc.line(15, y + rowHeight, 282, y + rowHeight);
    const service = [detail.postoLampo ? "Posto Lampo" : "", detail.sistemazioneFasce ? "Sistemazione fasce" : ""].filter(Boolean).join(", ") || "-";
    const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" }).format(new Date(detail.date));
    const values = [`${worker} - ${detail.clientName}`, date, service, detail.products, detail.note];
    x = 15;
    values.forEach((value, column) => {
      doc.setTextColor(...palette.ink);
      doc.setFont("helvetica", column === 0 ? "bold" : "normal");
      doc.setFontSize(Math.max(3.8, Math.min(5.3, rowHeight - 0.7)));
      doc.text(clipped(doc, value, widths[column] - 3), x + 2, y + rowHeight / 2 + 1.25);
      x += widths[column];
    });
  });
  if (!selected.length) {
    doc.setFontSize(8);
    doc.setTextColor(...palette.muted);
    doc.text("Nessuna scheda cliente disponibile nel periodo.", 17, 48);
  }
  const totalDetails = groups.reduce((sum, group) => sum + group.details.length, 0);
  const omitted = Math.max(0, totalDetails - selected.length);
  doc.setFillColor(...palette.soft);
  doc.setDrawColor(...palette.line);
  doc.roundedRect(15, 188, 267, 7, 1, 1, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...palette.muted);
  doc.text(omitted ? `${selected.length} schede mostrate su ${totalDetails}; ${omitted} aggregate per mantenere il report in quattro pagine.` : `${totalDetails} schede mostrate integralmente.`, 18, 192.7);
  pageFooter(doc, 4);
}

export function downloadTeamBonusReportPdf(report: TeamBonusReport) {
  const doc = buildTeamBonusReportPdf(report);
  const safeSalon = report.salon.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safeMonth = report.monthLabel.toLowerCase().replace(/\s+/g, "-");
  doc.save(`report_bonus_${safeSalon}_${safeMonth}.pdf`);
}

export function buildTeamBonusReportPdf(report: TeamBonusReport) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  calendarPage(doc, report);
  workersPage(doc, report);
  comparisonPage(doc, report);
  detailsPage(doc, report);
  return doc;
}
