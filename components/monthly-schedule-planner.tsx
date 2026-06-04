"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Plus, Sparkles, Users, X, Share2 } from "lucide-react";
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
  editableTime?: boolean;
};

type ScheduleWorker = {
  id: string;
  name: string;
  active: boolean;
  role: string;
  locationId: string | null;
};

type ScheduleLocation = { id: string; name: string; active: boolean };
type SavedExtraWorker = { locationId: string; userId: string };
type ScheduleEntry = {
  userId: string;
  locationId?: string | null;
  categoryId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
};
type Assignment = { categoryId: string; startTime?: string | null; endTime?: string | null; locationId?: string | null };
type AssignmentMap = Record<string, Assignment>;
type CellEditor = {
  workerId: string;
  day: number;
  categoryId: string;
  startTime: string;
  endTime: string;
};

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

function createAssignmentsFromEntries(entries: ScheduleEntry[], year: number, month: number, workerIds: string[], locationId?: string, externalWorkerIds: string[] = []) {
  const assignments: AssignmentMap = {};
  const allowed = new Set(workerIds);
  const external = new Set(externalWorkerIds);
  entries.forEach((entry) => {
    const date = new Date(entry.date);
    if (!allowed.has(entry.userId) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month) return;
    const key = assignmentKey(entry.userId, date.getUTCDate());
    const isSelectedLocation = !locationId || entry.locationId === locationId;
    const isExternalOriginal = external.has(entry.userId);
    if (isSelectedLocation || (isExternalOriginal && !assignments[key])) {
      assignments[key] = {
        categoryId: entry.categoryId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        locationId: entry.locationId,
      };
    }
  });
  return assignments;
}

function minutesBetween(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return 0;
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  if ([startHours, startMinutes, endHours, endMinutes].some((value) => Number.isNaN(value))) return 0;
  return Math.max(0, endHours * 60 + endMinutes - (startHours * 60 + startMinutes));
}

function formatHours(totalMinutes: number) {
  if (!totalMinutes) return "0";
  const hours = totalMinutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
}

function categoryAllowsTimeEdit(category?: ScheduleCategory) {
  if (!category) return false;
  const nameLower = category.name.toLowerCase();
  const codeUpper = category.code.toUpperCase();
  return (
    Boolean(category.editableTime) ||
    codeUpper === "P" ||
    codeUpper === "PE" ||
    codeUpper === "F" ||
    codeUpper === "FE" ||
    codeUpper === "M" ||
    codeUpper === "MA" ||
    codeUpper === "ML" ||
    codeUpper === "A" ||
    nameLower.includes("permesso") ||
    nameLower.includes("ferie") ||
    nameLower.includes("malattia") ||
    nameLower.includes("assenza") ||
    nameLower.includes("altro")
  );
}

export function MonthlySchedulePlanner({
  employees,
  locations,
  savedCategories,
  entries,
  savedExtraWorkers,
  canManageCategories,
  canEditPlanning,
}: {
  employees: ScheduleWorker[];
  locations: ScheduleLocation[];
  savedCategories: ScheduleCategory[];
  entries: ScheduleEntry[];
  savedExtraWorkers: SavedExtraWorker[];
  canManageCategories: boolean;
  canEditPlanning: boolean;
}) {
  const today = new Date();
  const initialLocationId = locations[0]?.id ?? "";
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(today.getMonth());
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [plannerMessage, setPlannerMessage] = useState("");
  const [extraWorkerIdsByLocation, setExtraWorkerIdsByLocation] = useState<Record<string, string[]>>(() =>
    savedExtraWorkers.reduce<Record<string, string[]>>((accumulator, item) => {
      accumulator[item.locationId] = [...(accumulator[item.locationId] ?? []), item.userId];
      return accumulator;
    }, {}),
  );
  const [categories, setCategories] = useState(savedCategories);
  const [activeCategoryId, setActiveCategoryId] = useState(
    savedCategories.find((category) => !category.locationId || category.locationId === initialLocationId)?.id ?? "",
  );
  const [assignments, setAssignments] = useState<AssignmentMap>(() =>
    createAssignmentsFromEntries(
      entries,
      2026,
      today.getMonth(),
      employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((employee) => employee.id),
      initialLocationId,
      savedExtraWorkers.filter((item) => item.locationId === initialLocationId).map((item) => item.userId),
    ),
  );
  const [cellEditor, setCellEditor] = useState<CellEditor | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    code: "",
    color: "#FFA8DD",
    textColor: "#1F1F1F",
    startTime: "",
    endTime: "",
    editableTime: false,
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
  const selectedExtraWorkerIds = useMemo(() => extraWorkerIdsByLocation[selectedLocationId] ?? [], [extraWorkerIdsByLocation, selectedLocationId]);
  const activeWorkers = useMemo(() => {
    const base = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId === selectedLocationId);
    const plannedExternalIds = new Set(
      entries
        .filter((entry) => {
          const date = new Date(entry.date);
          return entry.locationId === selectedLocationId && date.getUTCFullYear() === year && date.getUTCMonth() === month;
        })
        .map((entry) => entry.userId),
    );
    const extraIds = new Set([...selectedExtraWorkerIds, ...plannedExternalIds]);
    const extra = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId !== selectedLocationId && extraIds.has(employee.id));
    return [...base, ...extra].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, entries, month, selectedExtraWorkerIds, selectedLocationId, year]);
  const availableExternalWorkers = useMemo(
    () =>
      employees
        .filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId !== selectedLocationId && !activeWorkers.some((worker) => worker.id === employee.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeWorkers, employees, selectedLocationId],
  );

  function setScheduleMonth(nextMonth: number) {
    setMonth(nextMonth);
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(entries, year, nextMonth, workerIds, selectedLocationId, selectedExtraWorkerIds));
  }

  function setScheduleLocation(locationId: string) {
    setSelectedLocationId(locationId);
    const locationWorkers = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN");
    const locationExtraWorkerIds = extraWorkerIdsByLocation[locationId] ?? [];
    setAssignments(createAssignmentsFromEntries(entries, year, month, locationWorkers.map((worker) => worker.id), locationId, locationExtraWorkerIds));
    const firstCategory = categories.find((category) => !category.locationId || category.locationId === locationId);
    setActiveCategoryId(firstCategory?.id ?? "");
  }

  async function openCellEditor(workerId: string, day: number) {
    if (!canEditPlanning) {
      setPlannerMessage("Vista sola lettura: il responsabile puo visualizzare il planning, ma non modificarlo.");
      return;
    }
    if (!activeCategoryId || !activeCategory) {
      setPlannerMessage("Seleziona o crea una categoria per questo salone.");
      return;
    }
    const key = assignmentKey(workerId, day);
    const previous = assignments[key];
    const previousCategory = categories.find((item) => item.id === previous?.categoryId);
    const isExternalCommitment = Boolean(previous?.locationId && previous.locationId !== selectedLocationId);
    if (isExternalCommitment) {
      const category = previousCategory ?? activeCategory;
      setCellEditor({
        workerId,
        day,
        categoryId: category.id,
        startTime: previous?.startTime ?? category.startTime ?? "",
        endTime: previous?.endTime ?? category.endTime ?? "",
      });
      return;
    }

    if (!categoryAllowsTimeEdit(activeCategory)) {
      if (previous?.categoryId === activeCategory.id) {
        await clearCellAssignmentFor(workerId, day);
        return;
      }
      await saveCellAssignment({
        workerId,
        day,
        categoryId: activeCategory.id,
        startTime: activeCategory.startTime ?? "",
        endTime: activeCategory.endTime ?? "",
      });
      return;
    }

    const categoryId = previousCategory && visibleCategories.some((item) => item.id === previousCategory.id) ? previousCategory.id : activeCategoryId;
    const category = previousCategory ?? activeCategory;
    setCellEditor({
      workerId,
      day,
      categoryId,
      startTime: previous?.startTime ?? category.startTime ?? "",
      endTime: previous?.endTime ?? category.endTime ?? "",
    });
  }

  async function saveCellAssignment(next: CellEditor) {
    const category = visibleCategories.find((item) => item.id === next.categoryId);
    if (!category) {
      setPlannerMessage("Categoria non valida per questo salone.");
      return;
    }
    const key = assignmentKey(next.workerId, next.day);
    const previous = assignments[key];
    const startTime = next.startTime || category.startTime || "";
    const endTime = next.endTime || category.endTime || "";
    setAssignments((current) => ({
      ...current,
      [key]: { categoryId: next.categoryId, startTime, endTime, locationId: selectedLocationId },
    }));
    const date = new Date(Date.UTC(year, month, next.day));
    const response = await fetch("/api/schedules/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: next.workerId, locationId: selectedLocationId, categoryId: next.categoryId, date: date.toISOString(), startTime, endTime }),
    });
    if (!response.ok) {
      setAssignments((current) => {
        const copy = { ...current };
        if (previous) copy[key] = previous;
        else delete copy[key];
        return copy;
      });
      const data = await response.json();
      setPlannerMessage(data.error ?? "Turno non salvato.");
      return;
    }
    setCellEditor(null);
    setPlannerMessage("Planning aggiornato.");
  }

  async function clearCellAssignment() {
    if (!cellEditor) return;
    await clearCellAssignmentFor(cellEditor.workerId, cellEditor.day);
  }

  async function clearCellAssignmentFor(workerId: string, day: number) {
    const key = assignmentKey(workerId, day);
    const previous = assignments[key];
    setAssignments((current) => {
      const copy = { ...current };
      delete copy[key];
      return copy;
    });
    const date = new Date(Date.UTC(year, month, day));
    const response = await fetch("/api/schedules/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: workerId, locationId: selectedLocationId, categoryId: null, date: date.toISOString() }),
    });
    if (!response.ok) {
      setAssignments((current) => (previous ? { ...current, [key]: previous } : current));
      const data = await response.json();
      setPlannerMessage(data.error ?? "Turno non eliminato.");
      return;
    }
    setCellEditor(null);
    setPlannerMessage("Cella svuotata.");
  }

  function workerTotalMinutes(workerId: string) {
    return monthDays.reduce((total, day) => {
      const assignment = assignments[assignmentKey(workerId, day)];
      const category = categories.find((item) => item.id === assignment?.categoryId);
      return total + minutesBetween(assignment?.startTime ?? category?.startTime, assignment?.endTime ?? category?.endTime);
    }, 0);
  }

  async function addExternalWorker(userId: string) {
    if (!userId || !selectedLocationId) return;
    setExtraWorkerIdsByLocation((current) => ({
      ...current,
      [selectedLocationId]: [...new Set([...(current[selectedLocationId] ?? []), userId])],
    }));
    const response = await fetch("/api/schedules/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedLocationId, userId }),
    });
    if (!response.ok) {
      setExtraWorkerIdsByLocation((current) => ({
        ...current,
        [selectedLocationId]: (current[selectedLocationId] ?? []).filter((id) => id !== userId),
      }));
      const data = await response.json();
      setPlannerMessage(data.error ?? "Lavoratore non aggiunto.");
      return;
    }
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(entries, year, month, workerIds, selectedLocationId, [...selectedExtraWorkerIds, userId]));
    setPlannerMessage("Lavoratore aggiunto al planning del salone.");
  }

  async function removeExternalWorker(userId: string) {
    setExtraWorkerIdsByLocation((current) => ({
      ...current,
      [selectedLocationId]: (current[selectedLocationId] ?? []).filter((id) => id !== userId),
    }));
    const response = await fetch("/api/schedules/workers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedLocationId, userId }),
    });
    if (!response.ok) {
      setExtraWorkerIdsByLocation((current) => ({
        ...current,
        [selectedLocationId]: [...new Set([...(current[selectedLocationId] ?? []), userId])],
      }));
      const data = await response.json();
      setPlannerMessage(data.error ?? "Lavoratore non rimosso.");
      return;
    }
    const nextExtraIds = selectedExtraWorkerIds.filter((id) => id !== userId);
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(entries, year, month, workerIds, selectedLocationId, nextExtraIds));
    setPlannerMessage("Lavoratore rimosso dalla lista del salone.");
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
    setNewCategory({ name: "", code: "", color: "#FFA8DD", textColor: "#1F1F1F", startTime: "", endTime: "", editableTime: false });
    setPlannerMessage("Nuova categoria salvata.");
  }

  function resetMonth() {
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(entries, year, month, workerIds, selectedLocationId, selectedExtraWorkerIds));
  }

  function setScheduleYear(nextYear: number) {
    setYear(nextYear);
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(entries, nextYear, month, workerIds, selectedLocationId, selectedExtraWorkerIds));
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

  const editorCategory = cellEditor ? categories.find((category) => category.id === cellEditor.categoryId) : undefined;
  const editorAssignment = cellEditor ? assignments[assignmentKey(cellEditor.workerId, cellEditor.day)] : undefined;
  const editorIsExternalCommitment = Boolean(editorAssignment?.locationId && editorAssignment.locationId !== selectedLocationId);
  const editorCanChangeTime = !editorIsExternalCommitment && categoryAllowsTimeEdit(editorCategory);

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
              <Field value={year} onChange={(event) => setScheduleYear(Number(event.target.value))} type="number" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadPdf} disabled={exporting || !selectedLocationId}>
                <Download className="size-4" />
                {exporting ? "Creazione..." : "PDF"}
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
            {canEditPlanning && availableExternalWorkers.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white/70 p-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Aggiungi da altro salone</span>
                <select
                  className="min-h-10 min-w-[260px] rounded-2xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    void addExternalWorker(event.target.value);
                  }}
                >
                  <option value="">Seleziona lavoratore...</option>
                  {availableExternalWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {selectedExtraWorkerIds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedExtraWorkerIds.map((workerId) => {
                  const worker = employees.find((item) => item.id === workerId);
                  if (!worker) return null;
                  const workerLocation = locations.find((location) => location.id === worker.locationId);
                  return (
                    <span key={workerId} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/70">
                      {worker.name}
                      <span className="text-black/35">{workerLocation?.name}</span>
                      {canEditPlanning ? <button className="grid size-6 place-items-center rounded-full bg-paradise-nude text-black hover:bg-paradise-pink/40" onClick={() => removeExternalWorker(workerId)} type="button" aria-label={`Rimuovi ${worker.name}`}>
                        <X className="size-3" />
                      </button> : null}
                    </span>
                  );
                })}
              </div>
            ) : null}
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
          <label className="mt-3 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={newCategory.editableTime}
              onChange={(event) => setNewCategory({ ...newCategory, editableTime: event.target.checked })}
            />
            Permetti modifica orario sulla singola cella
          </label>
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
                <th className="worker-head sticky left-0 z-20 w-[220px] max-w-[220px] border border-black/10 bg-[#f8f2f5] px-3 py-3 text-left text-sm font-bold">Staff</th>
                <th className="border border-black/10 bg-[#f8f2f5] px-2 py-3 text-center text-sm font-bold">Ore</th>
                {monthDays.map((day) => (
                  <th key={day} className="day-head border border-black/10 bg-[#f8f2f5] text-sm font-semibold">
                    {day}
                  </th>
                ))}
              </tr>
              <tr className="bg-white">
                <th className="worker-head sticky left-0 z-20 w-[220px] max-w-[220px] border border-black/10 bg-white" />
                <th className="border border-black/10 bg-white text-[10px] font-bold uppercase text-black/45">tot.</th>
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
                  <td colSpan={days + 2} className="px-6 py-10 text-center text-sm text-black/45">
                    Nessun dipendente attivo in questo salone. Crea un salone attivo e assegna il personale da Dipendenti.
                  </td>
                </tr>
              ) : null}
              {activeWorkers.map((worker) => (
                <tr key={worker.id}>
                  <th className="worker-cell sticky left-0 z-10 w-[220px] max-w-[220px] truncate border border-black/10 bg-white px-3 py-2 text-left text-sm font-semibold" title={worker.name}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{worker.name.toUpperCase()}</span>
                      <a
                        href={`/schedules/card?userId=${worker.id}&month=${month + 1}&year=${year}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black/35 hover:text-paradise-pink transition-colors p-1 rounded hover:bg-black/[0.03]"
                        title="Genera cartolina turni"
                      >
                        <Share2 className="size-3.5" />
                      </a>
                    </div>
                  </th>
                  <td className="border border-black/10 bg-[#fbfaf9] px-2 text-center text-sm font-black">{formatHours(workerTotalMinutes(worker.id))}</td>
                  {monthDays.map((day) => {
                    const assignment = assignments[assignmentKey(worker.id, day)];
                    const category = categories.find((item) => item.id === assignment?.categoryId);
                    const shownStart = assignment?.startTime ?? category?.startTime;
                    const shownEnd = assignment?.endTime ?? category?.endTime;
                    return (
                      <td
                        key={`${worker.id}-${day}`}
                        className={`schedule-cell h-8 border border-black/10 text-center text-[10px] font-bold transition ${canEditPlanning ? "cursor-pointer hover:ring-2 hover:ring-paradise-pink/60" : ""}`}
                        style={{
                          backgroundColor: category?.color ?? "#FFFFFF",
                          color: category?.textColor ?? "#1F1F1F",
                        }}
                        onClick={() => openCellEditor(worker.id, day)}
                        title={category ? `${worker.name}: ${category.name}${shownStart && shownEnd ? ` ${shownStart}-${shownEnd}` : ""}` : `${worker.name}: vuoto`}
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

      {cellEditor ? (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/40">Modifica cella</p>
            <h3 className="mt-2 text-2xl font-semibold">
              {employees.find((worker) => worker.id === cellEditor.workerId)?.name ?? "Lavoratore"} · {cellEditor.day} {monthNames[month].toLowerCase()}
            </h3>
            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Categoria</span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                  value={cellEditor.categoryId}
                  disabled={editorIsExternalCommitment}
                  onChange={(event) => {
                    const category = visibleCategories.find((item) => item.id === event.target.value);
                    setCellEditor((current) =>
                      current
                        ? {
                            ...current,
                            categoryId: event.target.value,
                            startTime: category?.startTime ?? current.startTime,
                            endTime: category?.endTime ?? current.endTime,
                          }
                        : current,
                    );
                  }}
                >
                  {editorCategory && !visibleCategories.some((category) => category.id === editorCategory.id) ? (
                    <option value={editorCategory.id}>
                      {editorCategory.code} - {editorCategory.name} (altro salone)
                    </option>
                  ) : null}
                  {visibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code} - {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Inizio</span>
                  <Field
                    type="time"
                    value={cellEditor.startTime}
                    disabled={!editorCanChangeTime}
                    onChange={(event) => setCellEditor({ ...cellEditor, startTime: event.target.value })}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Fine</span>
                  <Field
                    type="time"
                    value={cellEditor.endTime}
                    disabled={!editorCanChangeTime}
                    onChange={(event) => setCellEditor({ ...cellEditor, endTime: event.target.value })}
                  />
                </label>
              </div>
              {editorIsExternalCommitment ? (
                <p className="text-xs font-medium text-black/45">Questo e un impegno gia presente in un altro salone. Serve per non creare doppio turno.</p>
              ) : !editorCanChangeTime ? (
                <p className="text-xs font-medium text-black/45">Questa categoria usa sempre l'orario fisso. Attiva la modifica orario quando crei una categoria nuova.</p>
              ) : null}
              <p className="rounded-2xl bg-paradise-nude px-4 py-3 text-sm text-black/60">
                Ore cella: <strong>{formatHours(minutesBetween(cellEditor.startTime, cellEditor.endTime))}</strong>
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="soft" onClick={() => setCellEditor(null)}>
                Chiudi
              </Button>
              {!editorIsExternalCommitment ? (
                <>
                  <Button variant="soft" onClick={clearCellAssignment}>
                    Svuota
                  </Button>
                  <Button onClick={() => saveCellAssignment(cellEditor)}>Salva turno</Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
