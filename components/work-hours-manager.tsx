"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Save, Search, UserRound, Clock, CalendarCheck, ShieldAlert, Award } from "lucide-react";
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
  scheduledHours: number;
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
  const [records, setRecords] = useState<Record<string, Omit<WorkRecord, "userId" | "date"> & { scheduledHours: number }>>({});
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

  // Calculate statistics (Worked, Due, Missing, Overtime)
  const stats = useMemo(() => {
    let worked = 0;
    let due = 0;
    let missing = 0;
    let overtime = 0;

    days.forEach((day) => {
      const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
      const record = records[recordKey];
      const hours = record?.hours ?? 0;
      const scheduled = record?.scheduledHours ?? 0;

      worked += hours;
      due += scheduled;

      if (scheduled > 0) {
        if (hours > scheduled) {
          overtime += (hours - scheduled);
        } else {
          missing += (scheduled - hours);
        }
      } else {
        if (hours > 0) {
          overtime += hours;
        }
      }
    });

    return {
      worked,
      due,
      missing,
      overtime,
    };
  }, [days, records, selectedWorkerId]);

  const totalHours = stats.worked;

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
      const map: Record<string, Omit<WorkRecord, "userId" | "date"> & { scheduledHours: number }> = {};
      (data as (WorkRecord & { scheduledHours?: number })[]).forEach((record) => {
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
          scheduledHours: record.scheduledHours ?? 0,
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
    return { hours: 0, note: "", paidBreak: false, manualOverride: false, grossHours: 0, breakHours: 0, netHours: 0, firstEntry: null, lastExit: null, scheduledHours: 0 };
  }

  function updateLocal(day: Date, key: "hours" | "note" | "paidBreak" | "manualOverride", value: string | boolean) {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    setRecords((current) => {
      const rec = current[recordKey] ?? emptyRecord();
      const updatedPaidBreak = key === "paidBreak" ? Boolean(value) : rec.paidBreak;
      const updatedManualOverride = key === "manualOverride" ? Boolean(value) : rec.manualOverride;
      
      let updatedHours = rec.hours;
      if (key === "hours") {
        updatedHours = Number(value);
      } else if (key === "paidBreak") {
        if (!updatedManualOverride) {
          updatedHours = updatedPaidBreak ? rec.grossHours : rec.netHours;
        }
      } else if (key === "manualOverride") {
        if (!updatedManualOverride) {
          updatedHours = rec.paidBreak ? rec.grossHours : rec.netHours;
        }
      }

      return {
        ...current,
        [recordKey]: {
          ...rec,
          [key]: key === "hours" ? Number(value) : value,
          hours: updatedHours,
        },
      };
    });
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
        paidBreak: data.paidBreak,
        manualOverride: data.manualOverride,
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
      <Card className="p-0 border border-black/5 bg-white/80 dark:bg-neutral-900/80 shadow-md backdrop-blur-md">
        <div className="border-b border-black/5 dark:border-white/5 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Personale</p>
          <select
            className="mt-4 min-h-11 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 px-3 text-sm font-semibold outline-none focus:border-paradise-pink dark:text-white"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            {locationOptions.map((location) => (
              <option key={location} value={location} className="dark:bg-[#201F24] dark:text-white">{location}</option>
            ))}
          </select>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-800/70 px-3">
            <Search className="size-4 text-black/40 dark:text-white/40" />
            <input className="h-11 flex-1 bg-transparent text-sm outline-none dark:text-white" placeholder="Cerca lavoratore..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-3">
          {filteredWorkers.length === 0 ? <p className="p-4 text-sm text-black/45 dark:text-white/45">Nessun lavoratore presente.</p> : null}
          {filteredWorkers.map((worker) => (
            <button
              key={worker.id}
              className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${selectedWorkerId === worker.id ? "border-paradise-pink bg-paradise-softPink/30 dark:bg-paradise-pink/10 shadow-sm" : "border-black/5 dark:border-white/5 bg-white/60 dark:bg-neutral-850/60 hover:bg-white dark:hover:bg-neutral-800"}`}
              onClick={() => setSelectedWorkerId(worker.id)}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-paradise-noir dark:bg-white text-white dark:text-paradise-noir shadow-sm">
                  <UserRound className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{worker.name}</p>
                  <p className="text-xs text-black/45 dark:text-white/45">{worker.location}</p>
                  <div className="mt-1.5">
                    <Badge tone={worker.active ? "green" : "dark"}>{worker.active ? "Attivo" : "Disattivato"}</Badge>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 border border-black/5 bg-white/90 dark:bg-neutral-900/95 shadow-lg backdrop-blur-md overflow-hidden">
        {/* Header con Info Lavoratore */}
        <div className="border-b border-black/5 dark:border-white/5 p-6 bg-gradient-to-r from-paradise-softPink/15 via-transparent to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-paradise-pink dark:text-paradise-pink/80">Gestione Ore Lavorate</p>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight">{selectedWorker?.name ?? "Seleziona lavoratore"}</h2>
              <p className="text-xs text-black/45 dark:text-white/45">{selectedWorker?.email} &bull; {selectedWorker?.location}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="soft" className="h-10 text-xs px-4" onClick={exportSelectedPdf} disabled={exporting || !selectedWorker}>
                <Download className="size-3.5" />
                PDF Lavoratore
              </Button>
              <Button className="h-10 text-xs px-4" onClick={exportAllPdf} disabled={exporting || workers.length === 0}>
                <Download className="size-3.5" />
                {exporting ? "Generando..." : locationFilter === "Tutti i saloni" ? "PDF Tutti Saloni" : "PDF Salone"}
              </Button>
            </div>
          </div>

          {/* Selezione Mese e Anno */}
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]">
            <select
              className="min-h-11 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-800 px-4 text-sm font-semibold outline-none focus:border-paradise-pink dark:text-white"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {monthNames.map((name, index) => <option key={name} value={index} className="dark:bg-[#201F24] dark:text-white">{name}</option>)}
            </select>
            <Field
              type="number"
              className="min-h-11 rounded-2xl"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>

          {/* Griglia Statistiche di Lusso (Worked, Due, Missing, Overtime) */}
          <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Ore Lavorate */}
            <div className="p-4 rounded-[20px] bg-neutral-50 dark:bg-neutral-800/40 border border-black/5 dark:border-white/5 flex flex-col justify-between transition hover:shadow-luxury">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Ore Lavorate</p>
                <Clock className="size-3.5 text-paradise-pink" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-paradise-pink">{stats.worked.toFixed(2).replace(".00", "")} h</p>
              <p className="mt-1 text-[10px] text-black/45 dark:text-white/45">Ore totali registrate</p>
            </div>

            {/* Ore Dovute */}
            <div className="p-4 rounded-[20px] bg-neutral-50 dark:bg-neutral-800/40 border border-black/5 dark:border-white/5 flex flex-col justify-between transition hover:shadow-luxury">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Ore Dovute</p>
                <CalendarCheck className="size-3.5 text-amber-600 dark:text-paradise-gold" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-amber-600 dark:text-paradise-gold">{stats.due.toFixed(2).replace(".00", "")} h</p>
              <p className="mt-1 text-[10px] text-black/45 dark:text-white/45">Pianificate da contratto</p>
            </div>

            {/* Ore Mancanti */}
            <div className={`p-4 rounded-[20px] border flex flex-col justify-between transition hover:shadow-luxury ${stats.missing > 0 ? "bg-rose-500/5 border-rose-500/10" : "bg-neutral-50 dark:bg-neutral-800/40 border-black/5 dark:border-white/5"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Ore Mancanti</p>
                <ShieldAlert className={`size-3.5 ${stats.missing > 0 ? "text-rose-500" : "text-black/35"}`} />
              </div>
              <p className={`mt-3 text-2xl font-bold tracking-tight ${stats.missing > 0 ? "text-rose-500" : "text-neutral-500"}`}>{stats.missing.toFixed(2).replace(".00", "")} h</p>
              <p className="mt-1 text-[10px] text-black/45 dark:text-white/45">Da completare</p>
            </div>

            {/* Straordinari */}
            <div className={`p-4 rounded-[20px] border flex flex-col justify-between transition hover:shadow-luxury ${stats.overtime > 0 ? "bg-emerald-500/5 border-emerald-500/10" : "bg-neutral-50 dark:bg-neutral-800/40 border-black/5 dark:border-white/5"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Straordinari</p>
                <Award className={`size-3.5 ${stats.overtime > 0 ? "text-emerald-500" : "text-black/35"}`} />
              </div>
              <p className={`mt-3 text-2xl font-bold tracking-tight ${stats.overtime > 0 ? "text-emerald-500" : "text-neutral-500"}`}>{stats.overtime.toFixed(2).replace(".00", "")} h</p>
              <p className="mt-1 text-[10px] text-black/45 dark:text-white/45">Ore extra non dovute</p>
            </div>
          </div>
        </div>

        {/* Tabella timbrature */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-black/5 dark:border-white/5 text-left">
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Giorno</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Timbratura</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Dovute</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Lavorate</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Pausa</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Correzione</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Note</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50 text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
                const record = records[recordKey] ?? emptyRecord();
                const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                return (
                  <tr key={recordKey} className={`border-b border-black/5 dark:border-white/5 transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 ${isWeekend ? "bg-paradise-nude/10 dark:bg-neutral-800/10" : ""}`}>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-black/35 dark:text-white/35" /> {new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-black/55 dark:text-white/55">
                      {record.firstEntry && record.lastExit ? `${record.firstEntry} - ${record.lastExit}` : "Nessuna timbratura"}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-black/60 dark:text-white/60">
                      {record.scheduledHours > 0 ? `${record.scheduledHours.toFixed(2).replace(".00", "")} h` : "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      <input
                        className="h-9 w-20 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-3.5 text-sm font-semibold outline-none focus:border-paradise-pink dark:text-white disabled:bg-black/[0.03] dark:disabled:bg-white/[0.03] disabled:text-black/50 dark:disabled:text-white/50"
                        disabled={!record.manualOverride}
                        type="number"
                        min="0"
                        max="24"
                        step="0.01"
                        value={record.hours}
                        onChange={(event) => updateLocal(day, "hours", event.target.value)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold cursor-pointer text-black/70 dark:text-white/80">
                        <input
                          type="checkbox"
                          className="rounded border-black/10 dark:border-white/10 text-paradise-pink focus:ring-paradise-pink size-4"
                          checked={record.paidBreak}
                          onChange={(event) => updateLocal(day, "paidBreak", event.target.checked)}
                        />
                        Pagata {record.breakHours ? `(${record.breakHours} h)` : ""}
                      </label>
                    </td>
                    <td className="px-5 py-3.5">
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold cursor-pointer text-black/70 dark:text-white/80">
                        <input
                          type="checkbox"
                          className="rounded border-black/10 dark:border-white/10 text-paradise-pink focus:ring-paradise-pink size-4"
                          checked={record.manualOverride}
                          onChange={(event) => updateLocal(day, "manualOverride", event.target.checked)}
                        />
                        Manuale
                      </label>
                    </td>
                    <td className="px-5 py-3.5">
                      <input
                        className="h-9 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-3 text-sm outline-none focus:border-paradise-pink dark:text-white"
                        value={record.note}
                        onChange={(event) => updateLocal(day, "note", event.target.value)}
                        placeholder="Riposo, festivo, malattia..."
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button variant="soft" className="h-9 text-xs px-3" onClick={() => saveDay(day)} disabled={!selectedWorkerId || savingKey === recordKey}>
                        <Save className="size-3.5" />
                        {savingKey === recordKey ? "Salvo" : "Salva"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
 
        {loadingRecords ? (
          <div className="m-5 p-4 rounded-2xl bg-paradise-nude dark:bg-neutral-850 text-sm font-semibold animate-pulse dark:text-white">
            Calcolo ore dalle timbrature in corso...
          </div>
        ) : null}
        {message ? (
          <div className="m-5 p-4 rounded-2xl bg-paradise-nude dark:bg-neutral-850 text-sm font-semibold text-[#B85B68] dark:text-paradise-pink">
            {message}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

