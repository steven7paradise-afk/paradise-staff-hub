"use client";

import { StaffDirectoryContext, StaffIdentity } from "@/components/shift-staff-identity";
import { ShiftAttendanceProvider, ShiftAttendanceComparison } from "@/components/shift-attendance-comparison";
import { ShiftResponseAnalytics } from "@/components/shift-response-analytics";
import { shiftResponseProgress, shiftResponseDays, shiftResponseState } from "@/lib/shift-response-progress";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarRange, CheckCircle2, ChevronDown, Download, FilePenLine, FileText, LoaderCircle, Printer, Search, UserRound } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { ShiftResponsibleComments } from "@/components/shift-responsible-comments";
import type { ShiftResponsibleAccess } from "@/lib/shift-responsible-access";
import { isShiftEventReport, activeShiftFollowUps, staffChecklistDisplayRows, type ShiftResponsibleAnswers, type ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";

type ResponsiblePerson = { id: string; name: string; photoUrl: string | null; shifts?: Record<string, string> };



function formatDay(day: string, long = false) {
  return new Intl.DateTimeFormat("it-IT", long ? { weekday: "long", day: "2-digit", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${day}T12:00:00`));
}

function answerLabel(value: string, question?: ShiftResponsibleQuestion) {
  if (value === "YES") return question?.yesLabel || "Sì";
  if (value === "NO") return question?.noLabel || "No";
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.join(", ");
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.staffNotes)) {
        return record.staffNotes.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          return typeof entry.name === "string" && typeof entry.note === "string" ? [`${entry.name}: ${entry.note}`] : [];
        }).join(" · ");
      }
      if (Array.isArray(record.staffChecks)) {
        return staffChecklistDisplayRows(record.staffChecks, question?.staffResponseMode)
          .map((row) => `${row.staff}: ${row.control}: ${row.outcome}${row.note ? ` — ${row.note}` : ""}`)
          .join(" · ") || "Nessuna selezione";
      }
      if (Array.isArray(record.clientNotes)) {
        return record.clientNotes.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          return typeof entry.name === "string" && typeof entry.note === "string" ? [`${entry.name}: ${entry.note}`] : [];
        }).join(" · ");
      }
      if (Array.isArray(record.textEntries)) {
        return record.textEntries.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          return typeof entry.label === "string" && typeof entry.value === "string" ? [`${entry.label}: ${entry.value}`] : [];
        }).join(" · ");
      }
      if (Array.isArray(record.timelineEntries)) {
        return record.timelineEntries.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          return typeof entry.time === "string" && typeof entry.note === "string" ? [`${entry.time} — ${entry.note}`] : [];
        }).join(" · ");
      }
      if (typeof record.taskTitle === "string" && Array.isArray(record.assignees)) {
        const names = record.assignees.flatMap((item) => item && typeof item === "object" && "name" in item ? [String((item as { name?: unknown }).name || "")] : []).filter(Boolean);
        return `${record.taskTitle}${names.length ? ` → ${names.join(", ")}` : ""}`;
      }
      if (typeof record.name === "string") return `${record.name}${typeof record.note === "string" && record.note ? ` — ${record.note}` : ""}`;
      return Object.entries(record).map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(", ") : String(item)}`).join(" · ");
    }
  } catch { /* risposta testuale */ }
  return value;
}

export function ShiftResponsibleResponseDashboard({ questions, answers, assignments, people, staffDirectory = people, access, planner, monthlyReport, weekDates = [], previousWeekHref, nextWeekHref, fullPage = false }: {
  questions: ShiftResponsibleQuestion[];
  answers: ShiftResponsibleAnswers;
  assignments: Record<string, string>;
  people: ResponsiblePerson[];
  staffDirectory?: ResponsiblePerson[];
  access: ShiftResponsibleAccess;
  planner?: ReactNode;
  monthlyReport?: ReactNode;
  weekDates?: string[];
  previousWeekHref?: string;
  nextWeekHref?: string;
  fullPage?: boolean;
}) {
  const [planningOpen, setPlanningOpen] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const peopleById = useMemo(() => Object.fromEntries(people.map((person) => [person.id, person])), [people]);
  const allRows = useMemo(() => Array.from(new Set([...shiftResponseDays(assignments, answers), ...weekDates])).map((day) => {
    const values = answers[day] || {};
    const progress = shiftResponseProgress(questions, values);
    const audit = access[day]?.audit ?? [];
    const lastEdit = audit[audit.length - 1];
    const assigned = peopleById[assignments[day]];
    return { day, values, progress, state: shiftResponseState(day, today, progress, values), assigned, actorName: lastEdit?.actorName || assigned?.name || "Responsabile", updatedAt: lastEdit?.at };
  }).sort((a, b) => b.day.localeCompare(a.day)), [access, answers, assignments, peopleById, questions, today, weekDates]);
  const rows = allRows.filter(row => row.day.startsWith(month));
  const weekRows = weekDates.map(day => allRows.find(row => row.day === day)!).filter(Boolean);
  const [selectedDay, setSelectedDay] = useState(weekDates.includes(today) ? today : weekDates[0] || rows[0]?.day || "");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);
  const selected = allRows.find(row => row.day === selectedDay) ?? weekRows[0];
  const missing = selected ? questions.filter(question => question.required !== false && shiftResponseProgress([question], selected.values).percent < 100) : [];
  function openDay(day: string) {
    setSelectedDay(day);
    window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function exportCsv() {
    const header = ["Data", "Responsabile", "Compilato da", ...questions.map((question) => question.title)];
    const csvRows = rows.map((row) => [formatDay(row.day), row.assigned?.name ?? "", row.actorName, ...questions.map((question) => answerLabel(row.values[question.id] ?? "", question))]);
    const csv = [header, ...csvRows].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "risposte-responsabile-di-turno.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function generatePdf() {
    if (!selected || isGeneratingPdf) return;
    setPdfError("");
    setIsGeneratingPdf(true);
    try {
      const [{ jsPDF }, logoResponse] = await Promise.all([
        import("jspdf"),
        fetch("/logo.png"),
      ]);
      if (!logoResponse.ok) throw new Error("Logo non disponibile");
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Logo non leggibile"));
        reader.onerror = () => reject(new Error("Logo non leggibile"));
        reader.readAsDataURL(logoBlob);
      });
      const acknowledgementCards = await Promise.all(people.map(async (person) => {
        const acknowledgement = access[selected.day]?.acknowledgements?.[person.id];
        let photoDataUrl = "";
        if (person?.photoUrl) {
          try {
            const driveId = person.photoUrl.match(/\/file\/d\/([^/]+)/)?.[1]
              || person.photoUrl.match(/[?&]id=([^&]+)/)?.[1]
              || person.photoUrl.match(/\/api\/drive-image\?id=([^&]+)/)?.[1];
            const photoUrl = driveId ? `/api/drive-image?id=${encodeURIComponent(decodeURIComponent(driveId))}` : resolveDrivePhotoUrl(person.photoUrl);
            const photoResponse = await fetch(photoUrl);
            if (photoResponse.ok) {
              const photoBlob = await photoResponse.blob();
              photoDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Foto non leggibile"));
                reader.onerror = () => reject(new Error("Foto non leggibile"));
                reader.readAsDataURL(photoBlob);
              });
            }
          } catch {
            photoDataUrl = "";
          }
        }
        return { person, acknowledgement, photoDataUrl };
      }));

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 18;
      let y = 0;

      const drawHeader = (continuation = false) => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.addImage(logoDataUrl, "PNG", margin, 12, 38, 13.6);
        pdf.setTextColor(22, 27, 24);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(continuation ? 12 : 18);
        pdf.text(continuation ? "Verbale del turno - continua" : "Verbale responsabile di turno", pageWidth - margin, continuation ? 20 : 19, { align: "right" });
        pdf.setDrawColor(224, 231, 226);
        pdf.line(margin, 31, pageWidth - margin, 31);
        y = 39;
      };

      const ensureSpace = (height: number) => {
        if (y + height <= pageHeight - 18) return;
        pdf.addPage();
        drawHeader(true);
      };

      const writeSectionTitle = (title: string) => {
        ensureSpace(14);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(22, 136, 58);
        pdf.text(title.toUpperCase(), margin, y);
        y += 7;
      };

      const drawTableHeader = (labels: string[], widths: number[]) => {
        ensureSpace(10);
        let x = margin;
        labels.forEach((label, index) => {
          pdf.setFillColor(235, 242, 237);
          pdf.setDrawColor(214, 224, 217);
          pdf.rect(x, y, widths[index], 8, "FD");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.5);
          pdf.setTextColor(72, 84, 76);
          pdf.text(label.toUpperCase(), x + 2.5, y + 5.1, { maxWidth: widths[index] - 5 });
          x += widths[index];
        });
        y += 8;
      };

      const drawTextTableRow = (cells: string[], widths: number[], minimumHeight = 10) => {
        const lines = cells.map((cell, index) => pdf.splitTextToSize(cell || "-", widths[index] - 5) as string[]);
        const rowHeight = Math.max(minimumHeight, 5 + Math.max(...lines.map((item) => item.length)) * 3.4);
        ensureSpace(rowHeight);
        let x = margin;
        lines.forEach((cellLines, index) => {
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(222, 229, 224);
          pdf.rect(x, y, widths[index], rowHeight, "FD");
          pdf.setFont("helvetica", index === 0 ? "bold" : "normal");
          pdf.setFontSize(7.2);
          pdf.setTextColor(44, 53, 47);
          pdf.text(cellLines, x + 2.5, y + 5.3);
          x += widths[index];
        });
        y += rowHeight;
      };

      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(93, 103, 96);
      pdf.text(formatDay(selected.day, true), margin, y);
      y += 8;

      const summaryWidths = [48, 48, 30, 48];
      drawTableHeader(["Responsabile", "Compilato da", "Completo", "Aggiornato"], summaryWidths);
      drawTextTableRow([
        selected.assigned?.name || "Non assegnato",
        selected.actorName,
        `${selected.progress.completed}/${selected.progress.total}`,
        selected.updatedAt ? `${formatDay(selected.updatedAt.slice(0, 10))} · ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(selected.updatedAt))}` : "Non disponibile",
      ], summaryWidths);
      y += 8;

      if (acknowledgementCards.length) {
        writeSectionTitle("Presa visione e stato del turno");
        const statusWidths = [15, 59, 39, 37, 24];
        drawTableHeader(["Foto", "Responsabile", "Presa visione", "Stato", "Entrata"], statusWidths);
        acknowledgementCards.forEach(({ person, acknowledgement, photoDataUrl }) => {
          ensureSpace(13);
          const rowY = y;
          let x = margin;
          statusWidths.forEach((width) => {
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(222, 229, 224);
            pdf.rect(x, rowY, width, 13, "FD");
            x += width;
          });
          const photoX = margin + 3.25;
          try {
            if (photoDataUrl) {
              const photoFormat = photoDataUrl.startsWith("data:image/png") ? "PNG" : photoDataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
              pdf.addImage(photoDataUrl, photoFormat, photoX, rowY + 2, 8.5, 8.5);
            } else {
              throw new Error("Foto non disponibile");
            }
          } catch {
              const initials = (person.name || "Responsabile").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
              pdf.setFillColor(226, 247, 232);
              pdf.circle(photoX + 4.25, rowY + 6.25, 4.25, "F");
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(5.8);
              pdf.setTextColor(22, 136, 58);
              pdf.text(initials, photoX + 4.25, rowY + 7, { align: "center" });
          }
          const acknowledgementTime = acknowledgement
            ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(acknowledgement.at))
            : "Non attiva";
          const status = acknowledgement?.shiftStatus || "In attesa";
          const values = [person.name, acknowledgementTime, status, acknowledgement?.clockIn || "-"];
          let textX = margin + statusWidths[0];
          values.forEach((value, index) => {
            pdf.setFont("helvetica", index === 0 || index === 2 ? "bold" : "normal");
            pdf.setFontSize(7.2);
            pdf.setTextColor(index === 2 && status.toLocaleLowerCase("it-IT").includes("pausa") ? 184 : 44, index === 2 && status.toLocaleLowerCase("it-IT").includes("pausa") ? 113 : 53, index === 2 && status.toLocaleLowerCase("it-IT").includes("pausa") ? 0 : 47);
            pdf.text(pdf.splitTextToSize(value, statusWidths[index + 1] - 5), textX + 2.5, rowY + 7.4);
            textX += statusWidths[index + 1];
          });
          y += 13;
        });
        y += 8;
      }

      writeSectionTitle("Riepilogo risposte");
      const responseWidths = [8, 72, 65, 29];
      drawTableHeader(["N.", "Domanda", "Risposta", "Firma"], responseWidths);
      const dayAudit = access[selected.day]?.audit ?? [];
      questions.forEach((question, index) => {
        const value = selected.values[question.id];
        const response = value ? answerLabel(value, question) : "Nessuna risposta";
        const branches = activeShiftFollowUps(question, value).flatMap((followUp) => {
          const branchValue = selected.values[`${question.id}::${followUp.key}`];
          return branchValue ? [`${followUp.prompt}: ${answerLabel(branchValue)}`] : [];
        });
        const latestSignature = [...dayAudit].reverse().find((entry) => entry.questionId === question.id || entry.questionId.startsWith(`${question.id}::`));
        drawTextTableRow([
          String(index + 1),
          question.title,
          [response, ...branches].join("\n"),
          latestSignature?.actorName || selected.actorName,
        ], responseWidths);
      });

      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(229, 235, 231);
        pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(125, 134, 128);
        pdf.text("Paradise Beauty - Verbale responsabile di turno", margin, pageHeight - 8);
        pdf.text(`Pagina ${page} di ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }
      pdf.save(`verbale-turno-${selected.day}.pdf`);
    } catch {
      setPdfError("Non è stato possibile creare il PDF. Riprova.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <StaffDirectoryContext.Provider value={staffDirectory}><div className={fullPage ? "min-h-screen bg-[#fcfafb] px-3 pb-8 pt-20 sm:px-6 lg:px-8" : "p-4"}>
      <div className="mx-auto max-w-[1400px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#c32965]">Gestione turni</p><h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Programmazione responsabile di turno</h1><p className="mt-1 text-sm text-neutral-500">Organizza, controlla e verifica le attività giornaliere del team.</p></div>
          <button onClick={() => setPlanningOpen(!planningOpen)} aria-expanded={planningOpen} className="inline-flex items-center gap-2 rounded-xl bg-[#c32965] px-4 py-3 text-xs font-bold text-white"><CalendarRange className="size-4" />Organizza settimana</button>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 text-xs font-semibold">
          <Link href={previousWeekHref || "?"} className="rounded-lg border border-black/10 px-3 py-2">← Settimana precedente</Link>
          <span className="flex items-center gap-2"><CalendarDays className="size-4" />{weekDates.length ? `${formatDay(weekDates[0])} – ${formatDay(weekDates[6])}` : "Giornate registrate"}<Link href="/programmazione-responsabile-di-turno" className="ml-2 rounded-lg bg-neutral-100 px-3 py-2">Oggi</Link></span>
          <Link href={nextWeekHref || "?"} className="rounded-lg border border-black/10 px-3 py-2">Settimana successiva →</Link>
          <Link href="/programmazione-responsabile-di-turno/modulo" className="px-3 py-2 text-[#a83260]">Modifica modulo</Link>
        </div>
        {planningOpen && planner ? <section id="organizza-turni" className="rounded-2xl border border-pink-100 bg-white p-3">{planner}</section> : null}
        <section className="rounded-2xl border border-black/5 bg-white p-3 sm:p-4">
          <h2 className="flex items-center gap-3 text-sm font-bold"><span className="grid size-7 place-items-center rounded-lg bg-pink-100 text-[#c32965]">1</span>Programma la settimana</h2><p className="mb-4 ml-10 text-xs text-neutral-500">Seleziona un giorno per vedere i dettagli e controllare le attività.</p>
          <nav aria-label="Giorni della settimana" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {weekRows.map(row => <button type="button" key={row.day} onClick={() => setSelectedDay(row.day)} aria-pressed={selected?.day === row.day} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-4 text-center ${selected?.day === row.day ? "border-pink-400 bg-pink-50" : "border-black/5 bg-white hover:bg-pink-50/40"}`}>
              <span className="text-[10px] uppercase">{new Intl.DateTimeFormat("it-IT", {weekday:"short"}).format(new Date(`${row.day}T12:00:00`))}</span><span className="text-2xl font-bold leading-none">{row.day.slice(8)}</span><Avatar person={row.assigned} /><span className="max-w-full truncate text-xs font-bold">{row.assigned?.name || "Da assegnare"}</span><span className="text-[10px] text-neutral-500">{row.assigned?.shifts?.[row.day] || "Orario non disponibile"}</span><span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${row.progress.percent === 100 ? "bg-emerald-50 text-emerald-700" : row.day > today ? "bg-neutral-100 text-neutral-500" : "bg-orange-50 text-orange-700"}`}>{!row.assigned && !Object.keys(row.values).length ? "Non assegnato" : row.state}</span>
            </button>)}
          </nav>
        </section>
        {selected ? <section ref={detailRef} className="scroll-mt-20 space-y-4 rounded-2xl border border-black/5 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-3 text-sm font-bold"><span className="grid size-7 place-items-center rounded-lg bg-pink-100 text-[#c32965]">2</span>Controllo giornata <span className="capitalize text-[#c32965]">{formatDay(selected.day, true)}</span></h2><button onClick={() => void generatePdf()} disabled={isGeneratingPdf} className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs"><Download className="size-4" />{isGeneratingPdf ? "Creazione…" : "Scarica report giornata"}</button></div>
          {pdfError ? <p role="alert" className="text-sm text-red-600">{pdfError}</p> : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-xl border border-black/5 p-4"><p className="text-xs">Completamento giornata</p><div className="mt-1 flex items-end justify-between"><strong className="text-3xl">{selected.progress.percent}%</strong><span className="text-xs text-neutral-500">{selected.progress.completed} / {selected.progress.total} controlli obbligatori</span></div><div className="mt-3 h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-[#e63779]" style={{width:`${selected.progress.percent}%`}} /></div></div>
            <div className="rounded-xl bg-emerald-50 p-4"><CheckCircle2 className="mb-2 size-5 text-emerald-600" /><strong className="text-2xl">{selected.progress.completed}</strong><p className="text-xs">Controlli compilati</p></div>
            <div className="rounded-xl bg-orange-50 p-4"><FileText className="mb-2 size-5 text-orange-600" /><strong className="text-2xl">{missing.length}</strong><p className="text-xs">{selected.day > today ? "Controlli previsti" : "Da completare"}</p></div>
          </div>
          {missing.length > 0 && selected.day <= today ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-pink-100 bg-pink-50 p-4"><div><p className="text-sm font-bold text-[#c32965]">{missing.length} controlli richiedono la compilazione</p><p className="mt-1 text-xs text-neutral-500">{missing.slice(0,3).map(q => q.title).join(" · ")}{missing.length > 3 ? ` · altri ${missing.length-3}` : ""}</p></div><Link href="/responsabile-di-turno" className="rounded-lg bg-[#c32965] px-4 py-2 text-xs font-semibold text-white">Pagina del responsabile →</Link></div> : null}
          <ShiftAttendanceProvider key={`attendance-${selected.day}`} day={selected.day}><ResponseDetail key={`detail-${selected.day}`} row={selected} questions={questions} /></ShiftAttendanceProvider>
          <ShiftResponsibleComments key={`comments-${selected.day}`} day={selected.day} initialComments={access[selected.day]?.comments ?? []} />
          <AuditTrail entries={access[selected.day]?.audit ?? []} questions={questions} />
        </section> : null}
        <details className="rounded-2xl border border-black/5 bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Analisi e report mensili</summary><div className="mt-5 space-y-5"><label className="flex items-center gap-3 text-sm">Mese di analisi<input type="month" value={month} onChange={event => {if(event.target.value) setMonth(event.target.value)}} className="rounded-lg border p-2" /></label><p className="text-xs text-neutral-500">Conteggi basati sul modulo attualmente configurato.</p><ShiftResponseAnalytics rows={rows.filter(row => assignments[row.day] || answers[row.day])} today={today} questions={questions} onDay={openDay} /><button onClick={exportCsv} className="rounded-lg border px-4 py-2 text-xs">Esporta dati CSV</button>{monthlyReport}</div></details>
      </div>
    </div></StaffDirectoryContext.Provider>
  );
}

function AuditTrail({ entries, questions }: { entries: ShiftResponsibleAccess[string]["audit"]; questions: ShiftResponsibleQuestion[] }) {
  if (!entries.length) return null;
  const questionsById = Object.fromEntries(questions.map((question) => [question.id, question]));
  const groupedEntries = Array.from(
    [...entries].reverse().slice(0, 60).reduce((groups, entry) => {
      const current = groups.get(entry.questionId) ?? [];
      current.push(entry);
      groups.set(entry.questionId, current);
      return groups;
    }, new Map<string, typeof entries>()),
  );

  function entryTitle(questionId: string) {
    const [baseId, branch] = questionId.split("::");
    const question = questionsById[baseId];
    return {
      question,
      title: question ? `${question.title}${branch ? " — approfondimento" : ""}` : "Risposta del turno",
    };
  }

  return <section id="storico-modifiche" className="scroll-mt-6 border-t border-black/[0.06] bg-[#fbf9fa] p-4 sm:p-6" aria-label="Storico modifiche firmate">
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe6f1] text-xs font-black text-[#b7356d]">3</span>
      <div><h4 className="text-sm font-black text-[#202124]">Approfondisci le modifiche</h4><p className="mt-1 text-[9px] text-black/45">Cronologia firmata, raggruppata per domanda. Apri una riga per vedere tutti i cambiamenti.</p></div>
    </div>
    <div className="mt-5 overflow-hidden rounded-[18px] border border-black/[0.08] bg-white">
      {groupedEntries.map(([questionId, questionEntries]) => {
        const { question, title } = entryTitle(questionId);
        const latest = questionEntries[0];
        const hasLatestComparison = typeof latest.nextValue === "string";
        return <details key={questionId} className="group border-b border-black/[0.08] last:border-b-0">
          <summary className="grid cursor-pointer list-none gap-3 px-2 py-4 marker:content-none sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1.3fr)_auto] sm:items-center sm:px-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black text-[#303833]">{title}</p>
              <p className="mt-1 text-[8px] text-black/40">{questionEntries.length} {questionEntries.length === 1 ? "modifica" : "modifiche"}</p>
            </div>
            <div className="min-w-0">
              {hasLatestComparison ? <p className="flex min-w-0 items-center gap-2 text-[9px]"><span className="max-w-[42%] truncate text-black/45">{latest.previousValue ? answerLabel(latest.previousValue, question) : "Nessuna risposta"}</span><ArrowRight className="size-3 shrink-0 text-black/25" /><span className="max-w-[42%] truncate font-bold text-[#16883a]">{answerLabel(latest.nextValue || "", question)}</span></p> : <p className="text-[9px] text-black/35">Confronto precedente non disponibile</p>}
              <p className="mt-1 text-[8px] text-black/40">Ultima firma: <StaffIdentity name={latest.actorName} /></p>
            </div>
            <span className="flex items-center justify-between gap-3 sm:justify-end"><time className="whitespace-nowrap text-[8px] font-bold text-black/40">{formatDay(latest.at.slice(0, 10))} · {new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(latest.at))}</time><ChevronDown className="size-4 text-black/35 transition group-open:rotate-180" /></span>
          </summary>
          <div className="border-t border-black/[0.06] bg-[#f7faf8] px-3 py-2 sm:px-5">
            {questionEntries.map((entry, entryIndex) => {
              const hasComparison = typeof entry.nextValue === "string";
              return <article key={entry.id} className="grid gap-2 border-b border-black/[0.06] py-4 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-5">
                <div><StaffIdentity name={entry.actorName} /><time className="mt-1 block text-[8px] text-black/40">{formatDay(entry.at.slice(0, 10))} · {new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(entry.at))}</time><p className="mt-1 text-[8px] text-black/30">Modifica {questionEntries.length - entryIndex}</p></div>
                {hasComparison ? <div className="grid gap-2 sm:grid-cols-[1fr_22px_1fr] sm:items-center">
                  <div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-wide text-black/35">Prima</p><p className="mt-1 whitespace-pre-wrap break-words text-[9px] leading-relaxed text-[#5f6368]">{entry.previousValue ? answerLabel(entry.previousValue, question) : "Nessuna risposta"}</p></div>
                  <ArrowRight className="hidden size-3.5 text-black/20 sm:block" />
                  <div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-wide text-[#16883a]">Ora</p><p className="mt-1 whitespace-pre-wrap break-words text-[9px] font-semibold leading-relaxed text-[#303833]">{answerLabel(entry.nextValue || "", question)}</p></div>
                </div> : <p className="self-center text-[9px] text-black/35">Confronto non disponibile per questa registrazione precedente.</p>}
              </article>;
            })}
          </div>
        </details>;
      })}
    </div>
  </section>;
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent?: "green" | "pink" }) {
  return <article className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_5px_16px_rgba(47,28,38,0.03)] sm:px-5"><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-black/40">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className={`text-2xl font-black tracking-[-0.04em] ${accent === "green" ? "text-[#16883a]" : accent === "pink" ? "text-[#b33e60]" : "text-[#242124]"}`}>{value}</p><span className={`mb-1 size-2 rounded-full ${accent === "green" ? "bg-[#42b85d]" : accent === "pink" ? "bg-[#d94c88]" : "bg-black/20"}`} /></div><p className="mt-0.5 text-[8px] text-black/40">{note}</p></article>;
}

function Avatar({ person }: { person?: ResponsiblePerson }) {
  return <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ececec] text-[8px] font-black text-black/45">{person?.photoUrl ? <img src={resolveDrivePhotoUrl(person.photoUrl)} alt="" className="size-full object-cover" /> : <UserRound className="size-4" />}</span>;
}


function StaffResponseCards({ rows, mode }: { rows: string[][]; mode?: "attendance" | "pause" }) {
  const groups = new Map<string, string[][]>();
  for (const [name, ...details] of rows) groups.set(name, [...(groups.get(name) ?? []), details]);
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...groups].map(([name, entries]) => <article key={name} className="overflow-hidden rounded-xl border border-black/5 bg-white"><header className="border-b border-black/5 bg-pink-50/40 p-3"><StaffIdentity name={name} /></header><div className="divide-y divide-black/5 px-3">{mode ? <p className="pt-2 text-[10px] font-bold uppercase text-neutral-400">Dichiarazione responsabile</p> : null}{entries.map((entry, index) => <div key={index} className="flex items-start justify-between gap-3 py-2.5 text-xs"><span className="whitespace-pre-wrap text-neutral-600">{entry[0]}{entry[2] ? <span className="mt-2 block rounded-lg bg-rose-50 p-2 text-rose-800">{entry[2]}</span> : null}</span>{entry[1] ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry[1] === "Sì" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{entry[1]}</span> : null}</div>)}</div>{mode ? <ShiftAttendanceComparison name={name} mode={mode} declared={entries.filter(entry => entry[1] === "Sì").map(entry => entry[0])} /> : null}</article>)}</div>;
}

function StructuredResponse({ value, question }: { value: string; question?: ShiftResponsibleQuestion }) {
  if (value === "YES" || value === "NO") {
    const positive = value === "YES";
    return <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-[9px] font-black ${positive ? "bg-[#e8f7eb] text-[#277b38]" : "bg-[#fdecef] text-[#b33350]"}`}>{answerLabel(value, question)}</span>;
  }
  let parsed: Record<string, unknown> | unknown[] | null = null;
  try { parsed = JSON.parse(value) as Record<string, unknown> | unknown[]; } catch { /* risposta testuale */ }
  if (Array.isArray(parsed)) {
    return <div className="flex flex-wrap gap-1.5">{parsed.map((item, index) => <span key={`${String(item)}-${index}`} className="rounded-full bg-[#f0f3f1] px-2.5 py-1 text-[9px] font-bold text-[#424943]">{String(item)}</span>)}</div>;
  }
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.staffNotes)) {
      return <StaffResponseCards rows={parsed.staffNotes.flatMap((item) => item && typeof item === "object" ? [[String((item as Record<string, unknown>).name || "-"), String((item as Record<string, unknown>).note || "-")]] : [])} />;
    }
    if (Array.isArray(parsed.staffChecks)) {
      const rows = staffChecklistDisplayRows(parsed.staffChecks, question?.staffResponseMode)
        .map((row) => [row.staff, row.control, row.outcome, row.note || ""]);
      return rows.length
        ? <StaffResponseCards rows={rows} mode={/tutti presenti/i.test(question?.title || "") ? "attendance" : /^pause?$/i.test(question?.title.trim() || "") ? "pause" : undefined} />
        : <p className="text-[10px] italic text-black/35">Nessuna risposta selezionata.</p>;
    }
    if (Array.isArray(parsed.clientNotes)) {
      return <ResponseTable headers={["Cliente", "Ora", "Servizio", "Nota"]} rows={parsed.clientNotes.flatMap((item) => item && typeof item === "object" ? [[String((item as Record<string, unknown>).name || "-"), String((item as Record<string, unknown>).time || "-"), String((item as Record<string, unknown>).service || "-"), String((item as Record<string, unknown>).note || "-")]] : [])} />;
    }
    if (Array.isArray(parsed.textEntries)) {
      return <ResponseTable headers={["Voce", "Risposta"]} rows={parsed.textEntries.flatMap((item) => item && typeof item === "object" ? [[String((item as Record<string, unknown>).label || "Voce"), String((item as Record<string, unknown>).value || "-")]] : [])} />;
    }
    if (Array.isArray(parsed.timelineEntries)) {
      return <ResponseTable headers={["Ora", "Nota"]} rows={parsed.timelineEntries.flatMap((item) => item && typeof item === "object" ? [[String((item as Record<string, unknown>).time || "-"), String((item as Record<string, unknown>).note || "-")]] : [])} />;
    }
    if (typeof parsed.taskTitle === "string") {
      const assignees = Array.isArray(parsed.assignees) ? parsed.assignees.flatMap((item) => item && typeof item === "object" ? [String((item as Record<string, unknown>).name || "")].filter(Boolean) : []) : [];
      return <div className="rounded-xl border border-black/[0.07] bg-[#f7faf8] p-3"><p className="text-[10px] font-bold text-[#303833]">{parsed.taskTitle}</p>{assignees.length ? <p className="mt-1.5 text-[8px] font-semibold text-black/45">{assignees.map(name => <StaffIdentity key={name} name={name} />)}</p> : null}</div>;
    }
  }
  return <p className="whitespace-pre-wrap break-words text-[10px] font-semibold leading-relaxed text-[#555d57]">{answerLabel(value, question)}</p>;
}

function ResponseTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-black/[0.07] bg-white">
    <div className="min-w-[460px]">
      <div className="grid bg-[#f6f3f4]" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{headers.map((header) => <span key={header} className="border-r border-black/[0.06] px-3 py-2.5 text-[8px] font-black uppercase tracking-wide text-black/40 last:border-r-0">{header}</span>)}</div>
      <div className="divide-y divide-black/[0.06]">{rows.map((row, rowIndex) => <div key={rowIndex} className="grid" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{row.map((cell, cellIndex) => <span key={cellIndex} className="min-w-0 break-words border-r border-black/[0.06] px-3 py-3 text-[10px] leading-relaxed text-[#444b46] last:border-r-0">{cell}</span>)}</div>)}</div>
    </div>
  </div>;
}

function ResponseDetail({ row, questions }: { row: { day: string; values: Record<string, string>; assigned?: ResponsiblePerson; actorName: string; updatedAt?: string; progress: { percent: number; completed: number; total: number } }; questions: ShiftResponsibleQuestion[] }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return <aside className="overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_12px_35px_rgba(47,28,38,0.05)]" aria-label={`Risposte del ${formatDay(row.day)}`}>
    <div className="flex flex-col gap-4 border-b border-black/[0.08] bg-[#fff7fa] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-3.5"><span className="scale-110"><Avatar person={row.assigned} /></span><div className="min-w-0"><span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#b7356d]">Verbale della giornata</span><h4 className="mt-0.5 truncate text-base font-black text-[#202124]">{row.assigned?.name || row.actorName}</h4><p className="mt-1 text-[9px] capitalize text-black/45">{formatDay(row.day, true)}{row.updatedAt ? ` · aggiornata alle ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(row.updatedAt))}` : ""}</p></div></div>
      <div className="flex items-center gap-3 sm:justify-end"><div className="text-right"><p className="text-[8px] font-black uppercase tracking-wide text-black/35">Compilazione</p><p className="mt-0.5 text-[10px] font-bold text-[#343034]">{row.progress.completed} di {row.progress.total} risposte</p></div><span className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 text-[9px] font-black ${row.progress.percent === 100 ? "border-[#ccebd2] text-[#277b38]" : "border-[#f1d49c] text-[#8b5a00]"}`}><CheckCircle2 className={`size-4 ${row.progress.percent === 100 ? "text-[#49a852]" : "text-[#d7a23a]"}`} />{row.progress.percent}%</span></div>
    </div>
    <div className="flex items-center justify-between px-4 py-3"><h3 className="text-sm font-bold">Controlli e attività</h3><button className="text-xs font-semibold text-[#c32965]" onClick={() => setExpanded(expanded.length === questions.length ? [] : questions.map(q => q.id))}>{expanded.length === questions.length ? "Comprimi tutti" : "Espandi tutti"}</button></div><div className="divide-y divide-black/[0.07]">
      {questions.map((question, index) => {
        const value = row.values[question.id];
        const branches = activeShiftFollowUps(question, value).flatMap((followUp) => {
          const branchValue = row.values[`${question.id}::${followUp.key}`];
          return branchValue ? [{ ...followUp, value: branchValue }] : [];
        });
        const complete = Boolean(value?.trim()) && activeShiftFollowUps(question, value).every(branch => row.values[`${question.id}::${branch.key}`]?.trim());
        const isOpen = expanded.includes(question.id);
        return <div key={question.id} className="shift-response-row">
          <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(current => isOpen ? current.filter(id => id !== question.id) : [...current, question.id])} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-pink-50/30"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-pink-50 text-xs font-bold text-[#c32965]">{index + 1}</span><span className="min-w-0 flex-1 text-xs font-semibold">{question.title}</span><span className={`rounded-full px-2 py-1 text-[10px] ${complete ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{complete ? "Compilato" : isShiftEventReport(question) && !value?.trim() ? "Nessuna segnalazione" : question.required === false ? "Facoltativo" : "Da completare"}</span><ChevronDown className={`size-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} /></button>
          {isOpen ? <div className="mx-4 mb-4 rounded-xl bg-[#faf8f9] p-4">{value ? <StructuredResponse value={value} question={question} /> : <p className="text-xs text-neutral-500">{isShiftEventReport(question) ? "Nessun evento segnalato per questa giornata." : "Nessuna risposta registrata."}</p>}{branches.map(branch => <div key={branch.key} className="mt-3 border-t pt-3"><p className="mb-2 text-xs font-semibold">{branch.prompt}</p><StructuredResponse value={branch.value} /></div>)}</div> : null}
        </div>;

      })}
    </div>
  </aside>;
}
