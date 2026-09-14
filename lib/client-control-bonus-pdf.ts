import { jsPDF } from "jspdf";
import type { TeamBonusReport, TeamBonusResult } from "@/lib/team-bonus-report";

const palette = {
  wine: [127, 52, 66] as const,
  pink: [184, 91, 104] as const,
  ink: [38, 34, 40] as const,
  muted: [113, 106, 114] as const,
  line: [230, 221, 225] as const,
  soft: [250, 246, 248] as const,
  green: [22, 132, 102] as const,
  amber: [181, 106, 23] as const,
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

function pageFooter(doc: jsPDF, page: number) {
  doc.setDrawColor(...palette.line);
  doc.line(15, 198, 282, 198);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...palette.muted);
  doc.text("Paradise - Report interno riservato", 15, 203);
  doc.text(`Pagina ${page}`, 282, 203, { align: "right" });
}

function pageTitle(doc: jsPDF, title: string, subtitle?: string) {
  doc.setTextColor(...palette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(title, 17, 20);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.muted);
    doc.text(subtitle, 17, 27);
  }
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round(value / total * 100) : 0;
}

export function downloadTeamBonusReportPdf(report: TeamBonusReport) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const candidates = report.workers.filter((worker) => worker.comparable);
  const recommended = candidates.filter((worker) => worker.status === "BONUS_CONSIGLIATO");
  const leader = recommended[0] || candidates[0];
  const totalClients = report.workers.reduce((sum, worker) => sum + worker.clients, 0);
  const totalProducts = report.workers.reduce((sum, worker) => sum + worker.products, 0);
  const totalPhotos = report.workers.reduce((sum, worker) => sum + worker.photos, 0);

  doc.setFillColor(...palette.wine);
  doc.rect(15, 14, 267, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("REPORT PERFORMANCE TEAM", 23, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.text("Bonus salone", 23, 37);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(report.monthLabel, 23, 43);
  doc.setFont("helvetica", "bold");
  doc.text(report.salon.toUpperCase(), 214, 28);
  doc.setFont("helvetica", "normal");
  doc.text("Team, Timbrature, Controllo Cliente e Task", 214, 35);

  const cards = [
    ["CANDIDATO PRINCIPALE", leader?.name || "Nessun dato", leader ? `Indice ${leader.score}/100` : ""],
    ["CLIENTI TRACCIATI", String(totalClients), "attribuzioni staff"],
    ["VENDITE PRODOTTO", String(totalProducts), "clienti con prodotto"],
    ["SET FOTO COMPLETI", String(totalPhotos), "prima e dopo"],
  ];
  const cardColors = [[229, 244, 239], [238, 234, 249], [255, 241, 217], [248, 232, 238]];
  cards.forEach((card, index) => {
    const x = 15 + index * 67;
    doc.setFillColor(...cardColors[index] as [number, number, number]);
    doc.setDrawColor(...palette.line);
    doc.roundedRect(x, 54, 64, 25, 1.5, 1.5, "FD");
    doc.setTextColor(...palette.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(card[0], x + 5, 61);
    doc.setTextColor(...palette.ink);
    doc.setFontSize(11);
    doc.text(card[1], x + 5, 69);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...palette.muted);
    doc.text(card[2], x + 5, 75);
  });

  doc.setTextColor(...palette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Classifica indicativa", 15, 91);
  const chartRows = candidates.slice(0, 10);
  const chartTop = 99;
  const rowHeight = Math.min(8.5, 67 / Math.max(1, chartRows.length));
  chartRows.forEach((worker, index) => {
    const y = chartTop + index * rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.ink);
    doc.text(shortName(worker.name), 44, y + 4.2, { align: "right" });
    doc.setFillColor(241, 235, 238);
    doc.roundedRect(48, y, 190, 5.2, 1, 1, "F");
    doc.setFillColor(...palette.pink);
    doc.roundedRect(48, y, 190 * worker.score / 100, 5.2, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${worker.score}`, 242, y + 4.2);
  });

  const noteY = 174;
  doc.setFillColor(...palette.soft);
  doc.setDrawColor(...palette.line);
  doc.roundedRect(15, noteY, 267, 19, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...palette.ink);
  const conclusion = recommended.length
    ? `Bonus consigliato: ${recommended.map((worker) => worker.name).join(", ")}. Verificare comunque eventuali reclami e correzioni alle timbrature prima dell'erogazione.`
    : "Nessun collaboratore raggiunge la soglia indicativa. Valutare i dati completi prima dell'erogazione.";
  doc.text(doc.splitTextToSize(conclusion, 252), 22, noteY + 8);
  pageFooter(doc, 1);

  doc.addPage();
  pageTitle(doc, "Dettaglio di tutti i lavoratori del salone", `Periodo: ${report.monthLabel}. Contratto attivo nel mese; per la graduatoria servono almeno 3 clienti e 3 giorni timbrati.`);
  const headers = ["Collaboratore", "Ruolo", "Gg", "Ore", "Clienti", "Foto", "Prodotti", "Rec.", "Ritardi", "Rientri", "Ass. N.G.", "Indice", "Esito"];
  const widths = [34, 27, 12, 13, 14, 18, 19, 13, 21, 20, 18, 14, 35];
  let y = 35;
  doc.setFillColor(...palette.ink);
  doc.rect(15, y, 267, 12, "F");
  let x = 15;
  headers.forEach((header, index) => {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.text(header, x + widths[index] / 2, y + 7.3, { align: "center" });
    x += widths[index];
  });
  y += 12;
  report.workers.forEach((worker, rowIndex) => {
    const rowColor: [number, number, number] = rowIndex % 2 ? [...palette.soft] : [255, 255, 255];
    doc.setFillColor(...rowColor);
    doc.rect(15, y, 267, 11.5, "F");
    doc.setDrawColor(...palette.line);
    doc.line(15, y + 11.5, 282, y + 11.5);
    const values = [
      worker.name,
      worker.role,
      `${worker.days}/${worker.scheduledDays}`,
      worker.hours.toFixed(1),
      String(worker.clients),
      `${worker.photos} (${percentage(worker.photos, worker.clients)}%)`,
      `${worker.products} (${percentage(worker.products, worker.clients)}%)`,
      String(worker.reviews),
      `${worker.lateDays} / ${worker.lateMinutes}m`,
      `${worker.lateReturns} / ${worker.lateReturnMinutes}m`,
      String(worker.unjustifiedAbsences),
      worker.comparable ? worker.score.toFixed(1) : "N/D",
      statusLabel(worker.status),
    ];
    x = 15;
    values.forEach((value, index) => {
      doc.setFont("helvetica", index === 0 || index === 12 ? "bold" : "normal");
      doc.setFontSize(index === 12 ? 6.2 : 6.5);
      const textColor: [number, number, number] = index === 12 && worker.status === "BONUS_CONSIGLIATO"
        ? [...palette.green]
        : index === 12 && worker.status === "DA_VALUTARE"
          ? [...palette.amber]
          : [...palette.ink];
      doc.setTextColor(...textColor);
      const clipped = doc.splitTextToSize(value, widths[index] - 3)[0] || "";
      doc.text(clipped, x + (index < 2 ? 2 : widths[index] / 2), y + 7, { align: index < 2 ? "left" : "center" });
      x += widths[index];
    });
    y += 11.5;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...palette.muted);
  doc.text("N.G. = non giustificate. Ingresso tardo: oltre 10 minuti rispetto al planning.", 15, Math.min(190, y + 8));
  pageFooter(doc, 2);

  doc.addPage();
  pageTitle(doc, "Clienti, prodotti e foto", `${report.salon} - ${report.monthLabel}`);
  const topRows = candidates.slice(0, 8);
  const maxValue = Math.max(1, ...topRows.flatMap((worker) => [worker.clients, worker.products, worker.photos]));
  const baseline = 118;
  const groupWidth = 29;
  topRows.forEach((worker, index) => {
    const baseX = 30 + index * groupWidth;
    const metrics = [worker.clients, worker.products, worker.photos];
    const barColors: Array<[number, number, number]> = [[128, 100, 216], [...palette.green], [...palette.pink]];
    metrics.forEach((value, metricIndex) => {
      const height = value / maxValue * 68;
      doc.setFillColor(...barColors[metricIndex]);
      doc.rect(baseX + metricIndex * 6, baseline - height, 5, height, "F");
    });
    doc.setTextColor(...palette.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(shortName(worker.name), baseX + 8, baseline + 7, { align: "center" });
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(128, 100, 216); doc.text("Clienti", 30, 37);
  doc.setTextColor(...palette.green); doc.text("Prodotti", 54, 37);
  doc.setTextColor(...palette.pink); doc.text("Foto prima+dopo", 82, 37);

  doc.setTextColor(...palette.ink);
  doc.setFontSize(17);
  doc.text("Criterio trasparente", 15, 143);
  const method = [
    ["30%", "Puntualita e disciplina", "Ingressi oltre 10 minuti, rientri tardi e assenze non giustificate."],
    ["25%", "Foto complete", "Percentuale di clienti con foto/video prima e dopo."],
    ["20%", "Vendita prodotti", "Percentuale di clienti con almeno un prodotto acquistato."],
    ["15%", "Volume clienti", "Confronto con il massimo del team nello stesso periodo."],
    ["10%", "Recensioni e task", "Recensioni ottenute e task completate."],
  ];
  y = 150;
  method.forEach((row, index) => {
    const rowColor: [number, number, number] = index % 2 ? [...palette.soft] : [255, 255, 255];
    doc.setFillColor(...rowColor);
    doc.setDrawColor(...palette.line);
    doc.rect(15, y, 267, 8, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...palette.wine);
    doc.text(row[0], 22, y + 5.2);
    doc.setTextColor(...palette.ink);
    doc.text(row[1], 43, y + 5.2);
    doc.setFont("helvetica", "normal");
    doc.text(row[2], 105, y + 5.2);
    y += 8;
  });
  pageFooter(doc, 3);

  const safeSalon = report.salon.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safeMonth = report.monthLabel.toLowerCase().replace(/\s+/g, "-");
  doc.save(`report_bonus_${safeSalon}_${safeMonth}.pdf`);
}
