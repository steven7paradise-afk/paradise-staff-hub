"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { CalendarDays, Download, RefreshCw, Save, Search, UserRound, Clock, CalendarCheck, ShieldAlert, Award, Check } from "lucide-react";
import { Badge, Button, Card, Field } from "@/components/ui";

type Worker = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  location: string;
  photoUrl?: string | null;
};

type WorkRecord = {
  userId: string;
  date: string;
  hours: number | string;
  note: string;
  paidBreak: boolean;
  manualOverride: boolean;
  grossHours: number;
  breakHours: number;
  netHours: number;
  firstEntry: string | null;
  lastExit: string | null;
  scheduledHours: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  categoryCode: string | null;
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

  const weeks = useMemo(() => {
    const weeksList: Date[][] = [];
    let currentWeek: Date[] = [];
    
    days.forEach((day) => {
      currentWeek.push(day);
      // Sunday is getUTCDay() === 0
      if (day.getUTCDay() === 0) {
        weeksList.push(currentWeek);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      weeksList.push(currentWeek);
    }
    
    return weeksList;
  }, [days]);

  const getWeekTotals = useCallback((weekDays: Date[]) => {
    let worked = 0;
    let due = 0;
    
    weekDays.forEach((day) => {
      const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
      const record = records[recordKey];
      worked += Number(record?.hours) || 0;
      due += record?.scheduledHours ?? 0;
    });
    
    return { worked, due };
  }, [records, selectedWorkerId]);

  const loadRecords = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingRecords(true);
    const response = await fetch(`/api/work-hours?year=${year}&month=${month}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Ore non caricate.");
      setLoadingRecords(false);
      return;
    }
    const map: Record<string, Omit<WorkRecord, "userId" | "date"> & { scheduledHours: number }> = {};
    (data as (WorkRecord & { scheduledHours?: number; plannedStart?: string | null; plannedEnd?: string | null; categoryCode?: string | null })[]).forEach((record) => {
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
        plannedStart: record.plannedStart ?? null,
        plannedEnd: record.plannedEnd ?? null,
        categoryCode: record.categoryCode ?? null,
      };
    });
    setRecords(map);
    setLoadingRecords(false);
  }, [month, year]);

  // Calculate statistics (Worked, Due, Missing, Overtime)
  const stats = useMemo(() => {
    let worked = 0;
    let due = 0;
    let missing = 0;
    let overtime = 0;

    days.forEach((day) => {
      const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
      const record = records[recordKey];
      const hours = Number(record?.hours) || 0;
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
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const handleFocus = () => {
      void loadRecords(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadRecords(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRecords(false);
      }
    }, 30000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [loadRecords]);

  useEffect(() => {
    if (filteredWorkers.length > 0 && !filteredWorkers.some((worker) => worker.id === selectedWorkerId)) {
      setSelectedWorkerId(filteredWorkers[0].id);
    }
  }, [filteredWorkers, selectedWorkerId]);

  function emptyRecord() {
    return { hours: "", note: "", paidBreak: false, manualOverride: false, grossHours: 0, breakHours: 0, netHours: 0, firstEntry: null, lastExit: null, scheduledHours: 0, plannedStart: null, plannedEnd: null, categoryCode: null };
  }

  function updateLocal(day: Date, key: "hours" | "note" | "paidBreak" | "manualOverride", value: string | boolean) {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    setRecords((current) => {
      const rec = current[recordKey] ?? emptyRecord();
      let updatedPaidBreak = rec.paidBreak;
      let updatedManualOverride = rec.manualOverride;
      let updatedHours = rec.hours;
      let updatedNote = rec.note;

      if (key === "paidBreak") {
        updatedPaidBreak = Boolean(value);
        if (!updatedManualOverride) {
          updatedHours = updatedPaidBreak ? rec.grossHours : rec.netHours;
        }
      } else if (key === "manualOverride") {
        updatedManualOverride = Boolean(value);
        if (!updatedManualOverride) {
          updatedHours = rec.paidBreak ? rec.grossHours : rec.netHours;
        }
      } else if (key === "hours") {
        updatedHours = String(value);
        updatedManualOverride = true; // Auto-check manual override!
      } else if (key === "note") {
        updatedNote = String(value);
      }

      return {
        ...current,
        [recordKey]: {
          ...rec,
          hours: updatedHours,
          paidBreak: updatedPaidBreak,
          manualOverride: updatedManualOverride,
          note: updatedNote,
        },
      };
    });
  }

  async function saveDay(day: Date, updatedRecord?: Omit<WorkRecord, "userId" | "date"> & { scheduledHours: number }) {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    const record = updatedRecord || (records[recordKey] ?? emptyRecord());
    setSavingKey(recordKey);
    setMessage("");
    const response = await fetch("/api/work-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedWorkerId, date: day.toISOString(), hours: Number(record.hours) || 0, note: record.note, paidBreak: record.paidBreak, manualOverride: record.manualOverride }),
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
        plannedStart: data.plannedStart ?? record.plannedStart,
        plannedEnd: data.plannedEnd ?? record.plannedEnd,
        categoryCode: data.categoryCode ?? record.categoryCode,
      },
    }));
    setMessage("Ore aggiornate.");
    void loadRecords(false);
  }

  const handleCheckboxChange = async (day: Date, key: "paidBreak" | "manualOverride", checked: boolean) => {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    const rec = records[recordKey] ?? emptyRecord();
    const updatedPaidBreak = key === "paidBreak" ? checked : rec.paidBreak;
    const updatedManualOverride = key === "manualOverride" ? checked : rec.manualOverride;

    let updatedHours = rec.hours;
    if (!updatedManualOverride) {
      updatedHours = updatedPaidBreak ? rec.grossHours : rec.netHours;
    }

    const updatedRec = {
      ...rec,
      [key]: checked,
      hours: updatedHours,
    };

    setRecords((current) => ({
      ...current,
      [recordKey]: updatedRec,
    }));

    await saveDay(day, updatedRec);
  };

  const lastFocusValue = useRef<string | number | null>(null);

  const handleInputFocus = (value: string | number) => {
    lastFocusValue.current = value;
  };

  const handleInputBlur = async (day: Date, key: "hours" | "note", value: string) => {
    const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
    const rec = records[recordKey] ?? emptyRecord();
    const updatedValue = key === "hours" ? (value === "" ? 0 : Number(value)) : value;

    if (lastFocusValue.current === updatedValue) return;

    const updatedRec = {
      ...rec,
      [key]: updatedValue,
      manualOverride: key === "hours" ? true : rec.manualOverride,
    };

    await saveDay(day, updatedRec);
  };

  async function exportPdf(pdfWorkers: Worker[], filename: string) {
    setExporting(true);
    setMessage("");
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
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
        pdf.text(`${workerTotal.toFixed(2).replace(".", ",")} h`, pageWidth - margin - 29, 19);

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
        pdf.text("Data", margin + 23, y + 4.2);
        pdf.text("Ingresso (Pianif.)", margin + 48, y + 4.2);
        pdf.text("Uscita (Pianif.)", margin + 78, y + 4.2);
        pdf.text("Entrata (Timbr.)", margin + 108, y + 4.2);
        pdf.text("Uscita (Timbr.)", margin + 138, y + 4.2);
        pdf.text("Totale Ore", margin + 168, y + 4.2);
        pdf.text("Controllo", margin + 193, y + 4.2);
        pdf.text("Note", margin + 218, y + 4.2);
      }

      pdfWorkers.forEach((worker, workerIndex) => {
        if (workerIndex > 0) pdf.addPage();
        const workerTotal = days.reduce((total, day) => total + (Number(records[`${worker.id}-${dateKey(day)}`]?.hours) || 0), 0);
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

          // 1. Giorno
          const dayName = new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(day);
          const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          pdf.text(capitalizedDayName, margin + 3, y + 4.2);

          // 2. Data
          const dateStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(day);
          pdf.text(dateStr, margin + 23, y + 4.2);

          // 3. Ingresso (planned start)
          pdf.text(record.plannedStart ?? "-", margin + 48, y + 4.2);

          // 4. Uscita (planned end)
          pdf.text(record.plannedEnd ?? "-", margin + 78, y + 4.2);

          // 5. Entrata (actual entry)
          pdf.text(record.firstEntry ?? "-", margin + 108, y + 4.2);

          // 6. Uscita (actual exit)
          pdf.text(record.lastExit ?? "-", margin + 138, y + 4.2);

          // 7. Totale Ore (calculated net clocked hours)
          const computedHours = record.paidBreak ? record.grossHours : record.netHours;
          pdf.text(computedHours > 0 ? computedHours.toFixed(2).replace(".", ",") : "-", margin + 168, y + 4.2);

          // 8. Controllo (actual approved/corrected hours)
          pdf.setFont("helvetica", "bold");
          const ctrlHours = Number(record.hours) || 0;
          pdf.text(ctrlHours > 0 ? ctrlHours.toFixed(2).replace(".", ",") : "0,00", margin + 193, y + 4.2);
          pdf.setFont("helvetica", "normal");

          // 9. Note
          const noteLines = pdf.splitTextToSize(record.note || "", 52);
          pdf.text(noteLines[0] ?? "", margin + 218, y + 4.2);

          y += rowHeight;
        });
      });

      pdf.save(filename);
    } finally {
      setExporting(false);
    }
  }

  async function exportAllPdf() {
    const scope = (locationFilter === "Tutti i saloni" ? workers : workers.filter((worker) => worker.location === locationFilter))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
    await exportPdf(scope, `Ore-staff-${locationFilter.replaceAll(" ", "-")}-${monthNames[month]}-${year}.pdf`);
  }

  async function exportSelectedPdf() {
    if (!selectedWorker) return;
    const filenameName = selectedWorker.name.replaceAll(" ", "-");
    await exportPdf([selectedWorker], `Ore-${filenameName}-${monthNames[month]}-${year}.pdf`);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Selector Panel */}
      <Card className="p-5 border border-black/5 bg-white/80 dark:bg-neutral-900/80 shadow-md backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Seleziona Personale</p>
              <p className="text-xs text-black/50 dark:text-white/40 mt-1">Filtra per salone o cerca per nome per visualizzare e modificare le ore.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Location Selector */}
              <select
                className="min-h-10 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-3 text-xs font-semibold outline-none focus:border-paradise-pink dark:text-white"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                {locationOptions.map((location) => (
                  <option key={location} value={location} className="dark:bg-[#201F24] dark:text-white">{location}</option>
                ))}
              </select>
              {/* Search Bar */}
              <div className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-3 h-10 w-48 sm:w-64">
                <Search className="size-3.5 text-black/40 dark:text-white/40" />
                <input
                  className="flex-1 bg-transparent text-xs outline-none dark:text-white"
                  placeholder="Cerca lavoratore..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Horizontal Scrolling Worker List */}
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
            {filteredWorkers.length === 0 ? (
              <p className="text-xs text-black/45 dark:text-white/45 py-2">Nessun lavoratore corrisponde ai filtri.</p>
            ) : (
              filteredWorkers.map((worker) => {
                const isSelected = selectedWorkerId === worker.id;
                return (
                  <button
                    key={worker.id}
                    onClick={() => setSelectedWorkerId(worker.id)}
                    className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none py-1"
                  >
                    <div className={`relative size-14 rounded-full p-0.5 border-2 transition ${isSelected ? "border-paradise-pink scale-105" : "border-transparent group-hover:border-black/10 dark:group-hover:border-white/10"}`}>
                      {worker.photoUrl ? (
                        <img
                          src={worker.photoUrl}
                          alt={worker.name}
                          className="size-full rounded-full object-cover shadow-sm bg-neutral-100"
                        />
                      ) : (
                        <div className="size-full rounded-full bg-paradise-noir dark:bg-white/15 text-white dark:text-white/80 grid place-items-center font-bold text-sm shadow-sm">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-paradise-pink border-2 border-white dark:border-neutral-900 grid place-items-center shadow-sm">
                          <Check className="size-3 text-white stroke-[3px]" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold tracking-tight max-w-[75px] truncate text-center ${isSelected ? "text-paradise-pink" : "text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white"}`}>
                      {worker.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })
            )}
          </div>
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
              <Button
                variant="soft"
                className="h-10 text-xs px-4"
                onClick={() => void loadRecords(true)}
                disabled={loadingRecords}
              >
                <RefreshCw className={`size-3.5 ${loadingRecords ? "animate-spin" : ""}`} />
                Aggiorna
              </Button>
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

        <div className="lg:hidden space-y-6 p-4">
          {weeks.map((weekDays, weekIdx) => {
            const { worked, due } = getWeekTotals(weekDays);
            const firstDayStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(weekDays[0]);
            const lastDayStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(weekDays[weekDays.length - 1]);
            
            return (
              <div key={`week-section-${weekIdx}`} className="space-y-3">
                <div className="flex items-center justify-between px-4 py-2 bg-[#FAF6F9] dark:bg-neutral-850 rounded-2xl border border-black/[0.03]">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-paradise-pink">Settimana {weekIdx + 1}</span>
                    <span className="text-[10px] font-semibold text-black/45 dark:text-white/40">{firstDayStr} - {lastDayStr}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold text-black/60 dark:text-white/70">
                    <span>Lavorate: <strong className="text-paradise-pink">{worked.toFixed(2).replace(".00", "")} h</strong></span>
                    <span>Dovute: <strong className="text-amber-600 dark:text-paradise-gold">{due.toFixed(2).replace(".00", "")} h</strong></span>
                  </div>
                </div>

                {weekDays.map((day) => {
                  const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
                  const record = records[recordKey] ?? emptyRecord();
                  const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                  return (
                    <div
                      key={`mobile-${recordKey}`}
                      className={`rounded-[24px] border p-4 shadow-sm ${isWeekend ? "border-paradise-nude bg-paradise-nude/15" : "border-black/5 bg-white dark:bg-neutral-900"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">
                            {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" }).format(day)}
                          </p>
                          <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                            {record.firstEntry && record.lastExit ? `${record.firstEntry} - ${record.lastExit}` : "Nessuna timbratura"}
                          </p>
                        </div>
                        <Badge tone={record.scheduledHours > 0 ? "pink" : "dark"}>
                          {record.scheduledHours > 0 ? `${record.scheduledHours.toFixed(2).replace(".00", "")} h dovute` : "Riposo / libero"}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-black/5 bg-neutral-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">Lavorate</p>
                          <input
                            className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-paradise-pink disabled:bg-black/[0.03] disabled:text-black/50"
                            type="number"
                            min="0"
                            max="24"
                            step="0.01"
                            value={record.hours}
                            onChange={(event) => updateLocal(day, "hours", event.target.value)}
                            onFocus={(event) => handleInputFocus(event.target.value)}
                            onBlur={(event) => void handleInputBlur(day, "hours", event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                          />
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-neutral-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">Sistema</p>
                          <div className="mt-2 space-y-2 text-xs font-semibold text-black/70">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-black/10 text-paradise-pink focus:ring-paradise-pink"
                                checked={record.paidBreak}
                                onChange={(event) => void handleCheckboxChange(day, "paidBreak", event.target.checked)}
                              />
                              Pausa pagata
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-black/10 text-paradise-pink focus:ring-paradise-pink"
                                checked={record.manualOverride}
                                onChange={(event) => void handleCheckboxChange(day, "manualOverride", event.target.checked)}
                              />
                              Correzione manuale
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-black/5 bg-neutral-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">Note</p>
                        <input
                          className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-paradise-pink"
                          value={record.note}
                          onChange={(event) => updateLocal(day, "note", event.target.value)}
                          onFocus={(event) => handleInputFocus(event.target.value)}
                          onBlur={(event) => void handleInputBlur(day, "note", event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                          placeholder="Riposo, festivo, malattia..."
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-2xl border border-black/5 bg-white p-3">
                          <p className="font-bold uppercase tracking-[0.14em] text-black/35">Entrata</p>
                          <p className="mt-1 font-semibold">{record.firstEntry ?? "--"}</p>
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-white p-3">
                          <p className="font-bold uppercase tracking-[0.14em] text-black/35">Uscita</p>
                          <p className="mt-1 font-semibold">{record.lastExit ?? "--"}</p>
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-white p-3">
                          <p className="font-bold uppercase tracking-[0.14em] text-black/35">Pausa</p>
                          <p className="mt-1 font-semibold">{record.breakHours ? `${record.breakHours} h` : "--"}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end h-8 border-t border-black/[0.03] pt-2">
                        {savingKey === recordKey ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-black/45 dark:text-white/40">
                            <RefreshCw className="size-3.5 animate-spin text-paradise-pink" />
                            <span>Salvo...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-500">
                            <Check className="size-3.5 text-emerald-500" />
                            <span>Salvato</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1250px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-black/5 dark:border-white/5 text-left font-bold text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
                <th className="px-3.5 py-4">Giorno</th>
                <th className="px-3.5 py-4">Data</th>
                <th className="px-3.5 py-4">Ingresso (Pianif.)</th>
                <th className="px-3.5 py-4">Uscita (Pianif.)</th>
                <th className="px-3.5 py-4">Pausa</th>
                <th className="px-3.5 py-4">Entrata (Timbr.)</th>
                <th className="px-3.5 py-4">Uscita (Timbr.)</th>
                <th className="px-3.5 py-4">Permessi</th>
                <th className="px-3.5 py-4">Totale Ore</th>
                <th className="px-3.5 py-4">Controllo</th>
                <th className="px-3.5 py-4">Note</th>
                <th className="px-3.5 py-4 text-right">Stato</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((weekDays, weekIdx) => {
                const { worked, due } = getWeekTotals(weekDays);
                const firstDayStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(weekDays[0]);
                const lastDayStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(weekDays[weekDays.length - 1]);

                return (
                  <tr key={`week-group-${weekIdx}`} className="contents">
                    {/* Week Header Row */}
                    <tr key={`week-header-${weekIdx}`} className="bg-gradient-to-r from-paradise-softPink/10 to-transparent border-t-2 border-b border-black/5 dark:border-white/5">
                      <td colSpan={12} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-[0.16em] text-paradise-pink">Settimana {weekIdx + 1}</span>
                            <span className="text-xs font-semibold text-black/45 dark:text-white/40">({firstDayStr} - {lastDayStr})</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-black/60 dark:text-white/70">
                              Ore Lavorate: <strong className="text-paradise-pink">{worked.toFixed(2).replace(".", ",")} h</strong>
                            </span>
                            <span className="text-xs font-bold text-black/60 dark:text-white/70">
                              Ore Dovute: <strong className="text-amber-600 dark:text-paradise-gold">{due.toFixed(2).replace(".", ",")} h</strong>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Day Rows */}
                    {weekDays.map((day) => {
                      const recordKey = `${selectedWorkerId}-${dateKey(day)}`;
                      const record = records[recordKey] ?? emptyRecord();
                      const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                      const computedHours = record.paidBreak ? record.grossHours : record.netHours;

                      const dayName = new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(day);
                      const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                      const dateStr = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(day);

                      return (
                        <tr key={recordKey} className={`border-b border-black/5 dark:border-white/5 transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 ${isWeekend ? "bg-paradise-nude/10 dark:bg-neutral-800/10" : ""}`}>
                          {/* 1. Giorno */}
                          <td className="px-3.5 py-3.5">
                            <span className="inline-flex items-center gap-2 font-semibold">
                              <CalendarDays className="size-4 text-black/35 dark:text-white/35" />
                              {capitalizedDayName}
                            </span>
                          </td>
                          {/* 2. DATA */}
                          <td className="px-3.5 py-3.5 text-xs font-semibold text-black/75 dark:text-white/70">
                            {dateStr}
                          </td>
                          {/* 3. Ingresso (Pianif.) */}
                          <td className="px-3.5 py-3.5 text-xs text-black/60 dark:text-white/60 font-semibold">
                            {record.plannedStart ?? "-"}
                          </td>
                          {/* 4. Uscita (Pianif.) */}
                          <td className="px-3.5 py-3.5 text-xs text-black/60 dark:text-white/60 font-semibold">
                            {record.plannedEnd ?? "-"}
                          </td>
                          {/* 5. Pausa */}
                          <td className="px-3.5 py-3.5">
                            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold cursor-pointer text-black/70 dark:text-white/80">
                              <input
                                type="checkbox"
                                className="rounded border-black/10 dark:border-white/10 text-paradise-pink focus:ring-paradise-pink size-4"
                                checked={record.paidBreak}
                                onChange={(event) => void handleCheckboxChange(day, "paidBreak", event.target.checked)}
                              />
                              <span>Pagata {record.breakHours ? `(${record.breakHours.toFixed(2).replace(".00", "")} h)` : ""}</span>
                            </label>
                          </td>
                          {/* 6. Entrata (Timbr.) */}
                          <td className="px-3.5 py-3.5 text-xs font-semibold text-black/55 dark:text-white/55">
                            {record.firstEntry ?? "-"}
                          </td>
                          {/* 7. Uscita (Timbr.) */}
                          <td className="px-3.5 py-3.5 text-xs font-semibold text-black/55 dark:text-white/55">
                            {record.lastExit ?? "-"}
                          </td>
                          {/* 8. Permessi */}
                          <td className="px-3.5 py-3.5 text-xs font-bold text-amber-700 dark:text-paradise-gold">
                            {record.categoryCode === "P" || record.categoryCode === "PE" ? "Permesso" :
                             record.categoryCode === "FE" || record.categoryCode === "F" ? "Ferie" :
                             record.categoryCode === "M" || record.categoryCode === "MA" ? "Malattia" : "-"}
                          </td>
                          {/* 9. Totale Ore */}
                          <td className="px-3.5 py-3.5 font-bold text-black/65 dark:text-white/65">
                            {computedHours > 0 ? `${computedHours.toFixed(2).replace(".", ",")} h` : "-"}
                          </td>
                          {/* 10. Controllo */}
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-2">
                              <input
                                className="h-9 w-16 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-2 text-sm font-semibold outline-none focus:border-paradise-pink dark:text-white disabled:bg-black/[0.03] dark:disabled:bg-white/[0.03] disabled:text-black/50 dark:disabled:text-white/50"
                                type="number"
                                min="0"
                                max="24"
                                step="0.01"
                                value={record.hours}
                                onChange={(event) => updateLocal(day, "hours", event.target.value)}
                                onFocus={(event) => handleInputFocus(event.target.value)}
                                onBlur={(event) => void handleInputBlur(day, "hours", event.target.value)}
                                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                              />
                              <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer text-black/50 dark:text-white/50">
                                <input
                                  type="checkbox"
                                  className="rounded border-black/10 dark:border-white/10 text-paradise-pink focus:ring-paradise-pink size-3.5"
                                  checked={record.manualOverride}
                                  onChange={(event) => void handleCheckboxChange(day, "manualOverride", event.target.checked)}
                                />
                                <span>M</span>
                              </label>
                            </div>
                          </td>
                          {/* 11. Note */}
                          <td className="px-3.5 py-3.5">
                            <input
                              className="h-9 w-full min-w-[130px] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-3 text-sm outline-none focus:border-paradise-pink dark:text-white"
                              value={record.note}
                              onChange={(event) => updateLocal(day, "note", event.target.value)}
                              onFocus={(event) => handleInputFocus(event.target.value)}
                              onBlur={(event) => void handleInputBlur(day, "note", event.target.value)}
                              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                              placeholder="Nota..."
                            />
                          </td>
                          {/* 12. Stato */}
                          <td className="px-3.5 py-3.5 text-right">
                            <div className="flex items-center justify-end h-9">
                              {savingKey === recordKey ? (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-black/45 dark:text-white/40">
                                  <RefreshCw className="size-3.5 animate-spin text-paradise-pink" />
                                  <span>Salvo...</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-500/90">
                                  <Check className="size-3.5 text-emerald-500" />
                                  <span>Salvato</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
