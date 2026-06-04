"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Save, Search, UserRound } from "lucide-react";
import { Badge, Button, Card, Field } from "@/components/ui";

type Worker = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  location: string;
};

type WorkRecord = {
  userId: string;
  date: string;
  hours: number;
  note: string;
  paidBreak: boolean;
  manualOverride: boolean;
  grossHours: number;
  breakHours: number;
  netHours: number;
  firstEntry: string | null;
  lastExit: string | null;
};

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => new Date(Date.UTC(year, month, index + 1)));
}

export function WorkHoursManager({
  workers,
  initialYear,
  initialMonth,
}: {
  workers: Worker[];
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("Tutti i saloni");
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers[0]?.id ?? "");
  const [records, setRecords] = useState<Record<string, Omit<WorkRecord, "userId" | "date">>>({});
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const locationOptions = useMemo(() => ["Tutti i saloni", ...Array.from(new Set(workers.map((worker) => worker.location))).sort((a, b) => a.localeCompare(b, "it"))], [workers]);
  const filteredWorkers = workers.filter((worker) => {
    const matchesLocation = locationFilter === "Tutti i saloni" || worker.location === locationFilter;
    const matchesQuery = `${worker.name} ${worker.email} ${worker.location}`.toLowerCase().includes(query.toLowerCase());
    return matchesLocation && matchesQuery;
  });
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId);
  const days = useMemo(() => daysInMonth(year, month), [year, month]);
  const totalHours = days.reduce((total, day) => total + (records[`${selectedWorkerId}-${dateKey(day)}`]?.hours ?? 0), 0);

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      setLoadingRecords(true);
      const response = await fetch(`/api/work-hours?year=${year}&month=${month}`);
      const data = await response.json();
      if (!active) return;
      if (!response.ok) {
        setMessage(data.error ?? "Ore non caricate.");
        setLoadingRecords(false);
        return;
      }
      const map: Record<string, Omit<WorkRecord, "userId" | "date">> = {};
      (data as WorkRecord[]).forEach((record) => {
        map[`${record.userId}-${record.date.slice(0, 10)}`] = {
          hours: record.hours,
          note: record.note,
          paidBreak: record.paidBreak,
          manualOverride: record.manualOverride,
          grossHours: record.grossHours,
          breakHours: record.breakHours,
          netHours: record.netHours,
          firstEntry: record.firstEntry,
          lastExit: record.lastExit,
        };
      });
      setRecords(map);
      setLoadingRecords(false);
    }
    void loadRecords();
    return () => {
      active = false;
    };
  }, [year, month]);

  useEffect(() => {
    if (filteredWorkers.length > 0 && !filteredWorkers.some((worker) => worker.id === selectedWorkerId)) {
      setSelectedWorkerId(filteredWorkers[0].id);
    }
  }, [filteredWorkers, selectedWorkerId]);

  function emptyRecord() {
    return { hours: 0, note: "", paidBreak: false, manualOverride: false, grossHours: 0, breakHours: 0, netHours: 0, firstEntry: null, lastExit: null };
  }

  function updateLocal(day: Date, key: "hours" | "note" | "paidBreak" | "manualOverride", value: string | boolean) {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    setRecords((current) => ({
      ...current,
      [recordKey]: {
        ...(current[recordKey] ?? emptyRecord()),
        [key]: key === "hours" ? Number(value) : value,
      },
    }));
  }

  async function saveDay(day: Date) {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    const record = records[recordKey] ?? emptyRecord();
    setSavingKey(recordKey);
    setMessage("");
    const response = await fetch("/api/work-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedWorkerId, date: day.toISOString(), hours: record.hours, note: record.note, paidBreak: record.paidBreak, manualOverride: record.manualOverride }),
    });
    const data = await response.json();
    setSavingKey("");
    if (!response.ok) {
      setMessage(data.error ?? "Ore non salvate.");
      return;
    }
    setRecords((current) => ({
      ...current,
      [recordKey]: {
        ...record,
        hours: data.hours,
        grossHours: data.grossHours,
        breakHours: data.breakHours,
        netHours: data.netHours,
        firstEntry: data.firstEntry,
        lastExit: data.lastExit,
      },
    }));
    setMessage("Ore aggiornate.");
  }

  async function exportPdf(pdfWorkers: Worker[], filename: string) {
    setExporting(true);
    setMessage("");
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const rowHeight = 6;
      const tableWidth = pageWidth - margin * 2;
      const monthLabel = `${monthNames[month]} ${year}`;

      function drawHeader(worker: Worker, workerTotal: number) {
        pdf.setFillColor(31, 31, 31);
        pdf.rect(0, 0, pageWidth, 36, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text("PARADISE BEAUTY", margin, 15);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text("Conteggio mensile ore staff", margin, 22);

        pdf.setFillColor(255, 214, 234);
        pdf.roundedRect(pageWidth - margin - 34, 9, 34, 16, 4, 4, "F");
        pdf.setTextColor(31, 31, 31);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text(`${workerTotal.toFixed(2).replace(".00", "")} h`, pageWidth - margin - 28, 19);

        pdf.setTextColor(31, 31, 31);
        pdf.setFontSize(15);
        pdf.text(worker.name.toUpperCase(), margin, 46);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(110, 110, 110);
        pdf.text(`${worker.email}  |  ${worker.location}  |  ${monthLabel}`, margin, 53);
        pdf.text("Pausa non retribuita gia esclusa, salvo quando marcata come pagata.", margin, 59);
      }

      function drawTableHead(y: number) {
        pdf.setFillColor(247, 233, 239);
        pdf.rect(margin, y, tableWidth, rowHeight, "F");
        pdf.setDrawColor(225, 213, 218);
        pdf.rect(margin, y, tableWidth, rowHeight);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.8);
        pdf.setTextColor(31, 31, 31);
        pdf.text("Giorno", margin + 3, y + 4.2);
        pdf.text("Timbratura", margin + 42, y + 4.2);
        pdf.text("Ore", margin + 84, y + 4.2);
        pdf.text("Note", margin + 106, y + 4.2);
      }

      pdfWorkers.forEach((worker, workerIndex) => {
        if (workerIndex > 0) pdf.addPage();
        const workerTotal = days.reduce((total, day) => total + (records[`${worker.id}-${dateKey(day)}`]?.hours ?? 0), 0);
        drawHeader(worker, workerTotal);
        let y = 66;
        drawTableHead(y);
        y += rowHeight;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        days.forEach((day) => {
          const record = records[`${worker.id}-${dateKey(day)}`] ?? emptyRecord();
          if (y > pageHeight - 18) {
            pdf.addPage();
            y = 16;
            drawTableHead(y);
            y += rowHeight;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
          }
          const rowFill = day.getUTCDay() === 0 || day.getUTCDay() === 6 ? 252 : 255;
          pdf.setFillColor(rowFill, rowFill, rowFill);
          pdf.rect(margin, y, tableWidth, rowHeight, "F");
          pdf.setDrawColor(232, 224, 228);
          pdf.rect(margin, y, tableWidth, rowHeight);
          pdf.setTextColor(31, 31, 31);
          pdf.text(new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day), margin + 3, y + 4.2);
          pdf.text(record.firstEntry && record.lastExit ? `${record.firstEntry} - ${record.lastExit}` : "-", margin + 42, y + 4.2);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${record.hours.toFixed(2).replace(".00", "")} h`, margin + 84, y + 4.2);
          pdf.setFont("helvetica", "normal");
          const noteLines = pdf.splitTextToSize(record.note || "", tableWidth - 110);
          pdf.text(noteLines[0] ?? "", margin + 106, y + 4.2);
          y += rowHeight;
        });
      });

      pdf.save(filename);
    } finally {
      setExporting(false);
    }
  }

  async function exportAllPdf() {
    const scope = locationFilter === "Tutti i saloni" ? workers : workers.filter((worker) => worker.location === locationFilter);
    await exportPdf(scope, `Ore-staff-${locationFilter.replaceAll(" ", "-")}-${monthNames[month]}-${year}.pdf`);
  }

  async function exportSelectedPdf() {
    if (!selectedWorker) return;
    const filenameName = selectedWorker.name.replaceAll(" ", "-");
    await exportPdf([selectedWorker], `Ore-${filenameName}-${monthNames[month]}-${year}.pdf`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="p-0">
        <div className="border-b border-black/5 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Personale</p>
          <select
            className="mt-4 min-h-11 w-full rounded-2xl border border-black/10 bg-white/80 px-3 text-sm font-semibold outline-none focus:border-paradise-pink"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            {locationOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3">
            <Search className="size-4 text-black/40" />
            <input className="h-11 flex-1 bg-transparent text-sm outline-none" placeholder="Cerca lavoratore..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-3">
          {filteredWorkers.length === 0 ? <p className="p-4 text-sm text-black/45">Nessun lavoratore presente.</p> : null}
          {filteredWorkers.map((worker) => (
            <button
              key={worker.id}
              className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${selectedWorkerId === worker.id ? "border-black bg-paradise-softPink/55 shadow-sm" : "border-black/5 bg-white/60 hover:bg-white"}`}
              onClick={() => setSelectedWorkerId(worker.id)}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-paradise-noir text-white">
                  <UserRound className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">{worker.name}</p>
                  <p className="text-xs text-black/45">{worker.location}</p>
                  <Badge tone={worker.active ? "green" : "dark"}>{worker.active ? "Attivo" : "Disattivato"}</Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-black/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Conteggio mensile</p>
              <h2 className="mt-2 text-2xl font-semibold">{selectedWorker?.name ?? "Seleziona lavoratore"}</h2>
              <p className="mt-1 text-sm text-black/50">{selectedWorker?.email}</p>
            </div>
            <div className="rounded-3xl bg-paradise-noir px-6 py-4 text-white">
              <p className="text-3xl font-semibold">{totalHours}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-white/50">ore totali</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]">
            <select className="min-h-12 rounded-2xl border border-black/10 bg-white/80 px-4 text-sm font-semibold" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
            <Field type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="soft" onClick={exportSelectedPdf} disabled={exporting || !selectedWorker}>
              <Download className="size-4" />
              PDF lavoratore
            </Button>
            <Button onClick={exportAllPdf} disabled={exporting || workers.length === 0}>
              <Download className="size-4" />
              {exporting ? "Creo PDF..." : locationFilter === "Tutti i saloni" ? "PDF tutti" : "PDF salone"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="bg-paradise-softPink/55 text-left">
                <th className="px-4 py-3">Giorno</th>
                <th className="px-4 py-3">Timbratura</th>
                <th className="px-4 py-3">Ore lavorate</th>
                <th className="px-4 py-3">Pausa</th>
                <th className="px-4 py-3">Correzione</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
                const record = records[recordKey] ?? emptyRecord();
                return (
                  <tr key={recordKey} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-black/35" /> {new Intl.DateTimeFormat("it-IT").format(day)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {record.firstEntry && record.lastExit ? `${record.firstEntry} - ${record.lastExit}` : "Nessuna timbratura"}
                    </td>
                    <td className="px-4 py-3">
                      <input className="h-10 w-24 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink disabled:bg-black/[0.03]" disabled={!record.manualOverride} type="number" min="0" max="24" step="0.01" value={record.hours} onChange={(event) => updateLocal(day, "hours", event.target.value)} />
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium">
                        <input type="checkbox" checked={record.paidBreak} onChange={(event) => updateLocal(day, "paidBreak", event.target.checked)} />
                        Pagata {record.breakHours ? `(${record.breakHours} h)` : ""}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium">
                        <input type="checkbox" checked={record.manualOverride} onChange={(event) => updateLocal(day, "manualOverride", event.target.checked)} />
                        Manuale
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <input className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-paradise-pink" value={record.note} onChange={(event) => updateLocal(day, "note", event.target.value)} placeholder="Riposo, festivo, malattia..." />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="soft" onClick={() => saveDay(day)} disabled={!selectedWorkerId || savingKey === recordKey}><Save className="size-4" /> {savingKey === recordKey ? "Salvo" : "Salva"}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loadingRecords ? <p className="m-5 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-semibold">Calcolo ore dalle timbrature in corso...</p> : null}
        {message ? <p className="m-5 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-semibold">{message}</p> : null}
      </Card>
    </div>
  );
}
