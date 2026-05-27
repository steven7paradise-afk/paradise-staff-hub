"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Plus, RotateCcw, Sparkles, Users } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";

type ScheduleCategory = {
  id: string;
  name: string;
  code: string;
  color: string;
  textColor: string;
  locationId?: string | null;
  startTime?: string;
  endTime?: string;
};

type ScheduleWorker = {
  id: string;
  name: string;
  active: boolean;
  role: string;
  locationId: string | null;
};

type ScheduleLocation = { id: string; name: string; active: boolean };
type ScheduleEntry = { userId: string; categoryId: string; date: string };
type AssignmentMap = Record<string, string>;

const monthNames = [
  "GENNAIO",
  "FEBBRAIO",
  "MARZO",
  "APRILE",
  "MAGGIO",
  "GIUGNO",
  "LUGLIO",
  "AGOSTO",
  "SETTEMBRE",
  "OTTOBRE",
  "NOVEMBRE",
  "DICEMBRE",
];

const weekdayShort = ["D", "L", "M", "M", "G", "V", "S"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function assignmentKey(workerId: string, day: number) {
  return `${workerId}-${day}`;
}

function createAssignmentsFromEntries(entries: ScheduleEntry[], year: number, month: number, workerIds: string[]) {
  const assignments: AssignmentMap = {};
  const allowed = new Set(workerIds);
  entries.forEach((entry) => {
    const date = new Date(entry.date);
    if (allowed.has(entry.userId) && date.getUTCFullYear() === year && date.getUTCMonth() === month) {
      assignments[assignmentKey(entry.userId, date.getUTCDate())] = entry.categoryId;
    }
  });
  return assignments;
}

export function MonthlySchedulePlanner({
  employees,
  locations,
  savedCategories,
  entries,
  canManageCategories,
}: {
  employees: ScheduleWorker[];
  locations: ScheduleLocation[];
  savedCategories: ScheduleCategory[];
  entries: ScheduleEntry[];
  canManageCategories: boolean;
}) {
  const today = new Date();
  const initialLocationId = locations[0]?.id ?? "";
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(today.getMonth());
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [plannerMessage, setPlannerMessage] = useState("");
  const activeWorkers = useMemo(
    () => employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId === selectedLocationId),
    [employees, selectedLocationId],
  );
  const [categories, setCategories] = useState(savedCategories);
  const [activeCategoryId, setActiveCategoryId] = useState(
    savedCategories.find((category) => !category.locationId || category.locationId === initialLocationId)?.id ?? "",
  );
  const [assignments, setAssignments] = useState<AssignmentMap>(() =>
    createAssignmentsFromEntries(entries, 2026, today.getMonth(), employees.filter((employee) => employee.active && employee.locationId === initialLocationId).map((employee) => employee.id)),
  );
  const [newCategory, setNewCategory] = useState({
    name: "",
    code: "",
    color: "#FFA8DD",
    textColor: "#1F1F1F",
    startTime: "",
    endTime: "",
  });

  const days = daysInMonth(year, month);
  const monthDays = useMemo(() => Array.from({ length: days }, (_, index) => index + 1), [days]);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId);
  const activeLocations = locations.filter((location) => location.active);
  const visibleCategories = useMemo(
    () => categories.filter((category) => !category.locationId || category.locationId === selectedLocationId),
    [categories, selectedLocationId],
  );
  const activeCategory = visibleCategories.find((category) => category.id === activeCategoryId);

  function setScheduleMonth(nextMonth: number) {
    setMonth(nextMonth);
    setAssignments(createAssignmentsFromEntries(entries, year, nextMonth, activeWorkers.map((worker) => worker.id)));
  }

  function setScheduleLocation(locationId: string) {
    setSelectedLocationId(locationId);
    const locationWorkers = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId === locationId);
    setAssignments(createAssignmentsFromEntries(entries, year, month, locationWorkers.map((worker) => worker.id)));
    const firstCategory = categories.find((category) => !category.locationId || category.locationId === locationId);
    setActiveCategoryId(firstCategory?.id ?? "");
  }

  async function toggleCell(workerId: string, day: number) {
    if (!activeCategoryId || !activeCategory) {
      setPlannerMessage("Seleziona o crea una categoria per questo salone.");
      return;
    }
    const key = assignmentKey(workerId, day);
    const previous = assignments[key];
    const nextCategory = previous === activeCategoryId ? null : activeCategoryId;
    setAssignments((current) => ({ ...current, [key]: nextCategory ?? "" }));
    const date = new Date(Date.UTC(year, month, day));
    const response = await fetch("/api/schedules/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: workerId, categoryId: nextCategory, date: date.toISOString() }),
    });
    if (!response.ok) {
      setAssignments((current) => ({ ...current, [key]: previous ?? "" }));
      const data = await response.json();
      setPlannerMessage(data.error ?? "Turno non salvato.");
      return;
    }
    setPlannerMessage("Planning aggiornato.");
  }

  async function addCategory() {
    if (!newCategory.name.trim() || !newCategory.code.trim()) return;
    const response = await fetch("/api/schedules/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCategory, locationId: selectedLocationId }),
    });
    const category = await response.json();
    if (!response.ok) {
      setPlannerMessage(category.error ?? "Orario non salvato.");
      return;
    }
    setCategories((current) => [...current.filter((item) => item.id !== category.id), category]);
    setActiveCategoryId(category.id);
    setNewCategory({ name: "", code: "", color: "#FFA8DD", textColor: "#1F1F1F", startTime: "", endTime: "" });
    setPlannerMessage("Nuova categoria salvata.");
  }

  function resetMonth() {
    setAssignments(createAssignmentsFromEntries(entries, year, month, activeWorkers.map((worker) => worker.id)));
  }

  async function downloadPdf() {
    if (!tableRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const image = await toPng(tableRef.current, { backgroundColor: "#FFFFFF", pixelRatio: 2, cacheBust: true });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const properties = pdf.getImageProperties(image);
      const ratio = Math.min((pageWidth - margin * 2) / properties.width, (pageHeight - margin * 2) / properties.height);
      pdf.addImage(image, "PNG", margin, margin, properties.width * ratio, properties.height * ratio);
      const salon = (selectedLocation?.name ?? "Salone").replace(/\s+/g, "-");
      pdf.save(`Planning-${salon}-${monthNames[month]}-${year}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="no-print grid gap-4 xl:grid-cols-[1fr_390px]">
        <Card className="p-0">
          <div className="border-b border-black/5 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-black/40"><Sparkles className="size-4" /> Planner operativo</p>
                <h2 className="mt-2 text-2xl font-semibold">Turnistica mensile</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-paradise-nude/70 px-4 py-2">
                  <p className="text-xs text-black/45">Salone</p>
                  <p className="font-semibold">{selectedLocation?.name ?? "Da creare"}</p>
                </div>
                <div className="rounded-2xl bg-paradise-nude/70 px-4 py-2">
                  <p className="text-xs text-black/45">Staff</p>
                  <p className="font-semibold">{activeWorkers.length} attivi</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_1fr_120px_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Salone</span>
              <select
                className="min-h-12 w-full rounded-2xl border border-black/10 bg-white/90 px-4 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                value={selectedLocationId}
                onChange={(event) => setScheduleLocation(event.target.value)}
              >
                {activeLocations.length === 0 ? <option value="">Nessun salone attivo</option> : null}
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Mese</span>
              <select
                className="min-h-12 w-full rounded-2xl border border-black/10 bg-white/90 px-4 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                value={month}
                onChange={(event) => setScheduleMonth(Number(event.target.value))}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Anno</span>
              <Field value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadPdf} disabled={exporting || !selectedLocationId}>
                <Download className="size-4" />
                {exporting ? "Creazione..." : "PDF"}
              </Button>
              <Button variant="soft" onClick={resetMonth}>
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>

          <div className="border-t border-black/5 px-6 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Categorie e orari</p>
              <p className="text-xs text-black/45">Seleziona una categoria e clicca sulle celle del mese.</p>
            </div>
            <div className="flex flex-wrap gap-2">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeCategoryId === category.id ? "border-black shadow-soft ring-4 ring-black/5" : "border-black/10 hover:border-black/25"
                }`}
                style={{ backgroundColor: category.color, color: category.textColor }}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <span className="grid size-6 place-items-center rounded-full bg-white/45 text-[11px] font-black">{category.code}</span>
                {category.name}
                {category.startTime && category.endTime ? ` ${category.startTime}-${category.endTime}` : ""}
              </button>
            ))}
            {visibleCategories.length === 0 ? <p className="rounded-2xl bg-paradise-nude px-4 py-3 text-sm text-black/55">Nessuna categoria per questo salone. Crea il primo orario dal pannello a destra.</p> : null}
            </div>
          </div>
        </Card>

        {canManageCategories ? <Card className="p-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Configurazione</p>
            <h2 className="mt-2 text-xl font-semibold">Nuova categoria / orario</h2>
            <p className="mt-2 text-sm text-black/50">Sara salvata solo per {selectedLocation?.name ?? "il salone selezionato"}.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field placeholder="Nome es. Apertura" value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} />
            <Field placeholder="Codice es. A" value={newCategory.code} onChange={(event) => setNewCategory({ ...newCategory, code: event.target.value })} />
            <Field type="time" value={newCategory.startTime} onChange={(event) => setNewCategory({ ...newCategory, startTime: event.target.value })} />
            <Field type="time" value={newCategory.endTime} onChange={(event) => setNewCategory({ ...newCategory, endTime: event.target.value })} />
            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3">
              <span className="text-xs font-semibold">Sfondo</span>
              <input type="color" value={newCategory.color} onChange={(event) => setNewCategory({ ...newCategory, color: event.target.value })} />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3">
              <span className="text-xs font-semibold">Testo</span>
              <input type="color" value={newCategory.textColor} onChange={(event) => setNewCategory({ ...newCategory, textColor: event.target.value })} />
            </label>
          </div>
          <Button className="mt-4 w-full" onClick={addCategory}>
            <Plus className="size-4" />
            Carica orario
          </Button>
        </Card> : null}
      </div>
      {plannerMessage ? <p className="no-print rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium">{plannerMessage}</p> : null}

      <div ref={tableRef} className="print-surface overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-soft">
        <div className="schedule-title border-b border-black/10 bg-paradise-noir px-6 py-5 text-white">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Turnistica staff</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">{monthNames[month]} {year}</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-white/75">
              <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> {days} giorni</span>
              <span className="inline-flex items-center gap-2"><Users className="size-4" /> {activeWorkers.length} lavoratori</span>
            </div>
          </div>
        </div>
        <div className="schedule-scroll overflow-x-auto">
          <table className="schedule-table w-full min-w-[1180px] border-collapse bg-white text-black">
            <thead>
              <tr className="bg-[#f8f2f5]">
                <th className="worker-head sticky left-0 z-20 border border-black/10 bg-[#f8f2f5] px-3 py-3 text-left text-sm font-bold">Staff</th>
                {monthDays.map((day) => (
                  <th key={day} className="day-head border border-black/10 bg-[#f8f2f5] text-sm font-semibold">
                    {day}
                  </th>
                ))}
              </tr>
              <tr className="bg-white">
                <th className="worker-head sticky left-0 z-20 border border-black/10 bg-white" />
                {monthDays.map((day) => (
                  <th key={day} className="day-head border border-black/10 bg-white text-xs font-bold text-black/50">
                    {weekdayShort[new Date(year, month, day).getDay()]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeWorkers.length === 0 ? (
                <tr>
                  <td colSpan={days + 1} className="px-6 py-10 text-center text-sm text-black/45">
                    Nessun dipendente attivo in questo salone. Crea un salone attivo e assegna il personale da Dipendenti.
                  </td>
                </tr>
              ) : null}
              {activeWorkers.map((worker) => (
                <tr key={worker.id}>
                  <th className="worker-cell sticky left-0 z-10 border border-black/10 bg-white px-3 py-2 text-left text-sm font-semibold">{worker.name.toUpperCase()}</th>
                  {monthDays.map((day) => {
                    const category = visibleCategories.find((item) => item.id === assignments[assignmentKey(worker.id, day)]);
                    return (
                      <td
                        key={`${worker.id}-${day}`}
                        className="schedule-cell h-8 cursor-pointer border border-black/10 text-center text-[10px] font-bold transition hover:ring-2 hover:ring-paradise-pink/60"
                        style={{
                          backgroundColor: category?.color ?? "#FFFFFF",
                          color: category?.textColor ?? "#1F1F1F",
                        }}
                        onClick={() => toggleCell(worker.id, day)}
                        title={category ? `${worker.name}: ${category.name}` : `${worker.name}: vuoto`}
                      >
                        {category?.code ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend flex flex-wrap gap-3 border-t border-black/10 bg-[#fbfaf9] p-4">
          {visibleCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 text-xs font-semibold text-black">
              <span className="size-4 rounded border border-black/20" style={{ backgroundColor: category.color }} />
              {category.code} - {category.name}
              {category.startTime && category.endTime ? ` (${category.startTime}-${category.endTime})` : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
