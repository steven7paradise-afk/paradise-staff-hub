import { jsPDF } from 'jspdf';
import { eventFingerprint, type BonusDecision } from './direction-bonus';
import type { DirectionBonusData } from './direction-bonus-data';
export function directionPdf(report: DirectionBonusData, userId: string) { const row = report.rows.find(r => r.id === userId); if (!row)
    throw new Error('Persona non disponibile'); const doc = new jsPDF(); let y = 20; const line = (value: string, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 12 : 9); for (const text of doc.splitTextToSize(value, 178)) {
    if (y > 278) {
        doc.addPage();
        y = 20;
    }
    doc.text(text, 16, y);
    y += 6;
} }; line('PARADISE | ANTEPRIMA NON APPROVATA', true); line(`${row.name} - ${report.month}`, true); line(`Base: ${row.cards} schede pesate / ${row.divisor} = ${row.average} x ${report.rules.point} EUR = ${row.base} EUR`); line(`Totale provvisorio: ${row.total} EUR`, true); line('Fonti aperte: ' + report.issues.length); for (const e of row.events) {
    const d: BonusDecision | undefined = report.state.decisions[e.id];
    const cancelled = d?.fingerprint === eventFingerprint(e) && d.choice === 'CANCEL';
    const start = y;
    line(`${e.day} | ${e.label} | ${e.kind === 'card' ? e.units + ' schede' : e.amount + ' EUR'}`);
    if (cancelled && y - start === 6)
        doc.line(16, start - 1, 194, start - 1);
    line(`Fonte: ${e.source} - ${e.reference}`);
    if (d)
        line(`${d.choice === 'CANCEL' ? 'ANNULLATO' : 'CONTA'}: ${d.reason} (${d.actor})`);
    if (e.note)
        line(e.note);
} return doc; }
export function csvCell(value: unknown) { const raw = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') + '"'; }
