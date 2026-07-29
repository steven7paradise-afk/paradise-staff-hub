"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Pencil, Plus, Sparkles, Users, X, Share2, ChevronUp, ChevronDown } from "lucide-react";
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
type AllowedScheduleMonth = { month: number; year: number };
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

type CategoryForm = {
  name: string;
  code: string;
  color: string;
  textColor: string;
  startTime: string;
  endTime: string;
  editableTime: boolean;
};

type CategoryMenu = {
  categoryId: string;
  x: number;
  y: number;
} | null;

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
const emptyCategoryForm: CategoryForm = {
  name: "",
  code: "",
  color: "#FFA8DD",
  textColor: "#1F1F1F",
  startTime: "",
  endTime: "",
  editableTime: false,
};

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

function sameScheduleDay(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

function replaceScheduleEntry(current: ScheduleEntry[], next: ScheduleEntry) {
  return [
    ...current.filter((entry) => !(entry.userId === next.userId && sameScheduleDay(entry.date, next.date))),
    next,
  ];
}

function removeScheduleEntry(current: ScheduleEntry[], userId: string, date: string, locationId?: string | null) {
  return current.filter((entry) => {
    if (entry.userId !== userId || !sameScheduleDay(entry.date, date)) return true;
    if (locationId && entry.locationId && entry.locationId !== locationId) return true;
    return false;
  });
}

function scheduleEntryFromApi(value: any, fallback: ScheduleEntry): ScheduleEntry {
  return {
    userId: String(value?.user_id ?? value?.userId ?? fallback.userId),
    locationId: value?.location_id ?? value?.locationId ?? fallback.locationId ?? null,
    categoryId: String(value?.category_id ?? value?.categoryId ?? fallback.categoryId),
    date: String(value?.date ?? fallback.date),
    startTime: value?.start_time ?? value?.startTime ?? fallback.startTime ?? null,
    endTime: value?.end_time ?? value?.endTime ?? fallback.endTime ?? null,
  };
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
  initialWorkersOrder = [],
  initialMonth,
  initialYear,
  allowedMonths,
}: {
  employees: ScheduleWorker[];
  locations: ScheduleLocation[];
  savedCategories: ScheduleCategory[];
  entries: ScheduleEntry[];
  savedExtraWorkers: SavedExtraWorker[];
  canManageCategories: boolean;
  canEditPlanning: boolean;
  initialWorkersOrder?: string[];
  initialMonth?: number;
  initialYear?: number;
  allowedMonths?: AllowedScheduleMonth[];
}) {
  const today = new Date();
  const initialLocationId = locations[0]?.id ?? "";
  const initialPlannerMonth = initialMonth ?? today.getMonth();
  const initialPlannerYear = initialYear ?? today.getFullYear();
  const [year, setYear] = useState(initialPlannerYear);
  const [month, setMonth] = useState(initialPlannerMonth);
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const [secondPrintLocationId, setSecondPrintLocationId] = useState("");
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
  const [scheduleEntries, setScheduleEntries] = useState(entries);
  const [activeCategoryId, setActiveCategoryId] = useState(
    savedCategories.find((category) => !category.locationId || category.locationId === initialLocationId)?.id ?? "",
  );
  const [assignments, setAssignments] = useState<AssignmentMap>(() =>
    createAssignmentsFromEntries(
      scheduleEntries,
      initialPlannerYear,
      initialPlannerMonth,
      employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((employee) => employee.id),
      initialLocationId,
      savedExtraWorkers.filter((item) => item.locationId === initialLocationId).map((item) => item.userId),
    ),
  );
  const [cellEditor, setCellEditor] = useState<CellEditor | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<CategoryMenu>(null);
  const [newCategory, setNewCategory] = useState<CategoryForm>(emptyCategoryForm);
  const [workersOrderList, setWorkersOrderList] = useState<string[]>(initialWorkersOrder);

  const saveWorkersOrder = async (newOrder: string[]) => {
    try {
      await fetch("/api/settings/workers-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder),
      });
    } catch (err) {
      console.error("Errore nel salvataggio dell'ordine:", err);
    }
  };

  const handleMoveWorker = async (workerId: string, direction: "up" | "down") => {
    const currentActiveIds = activeWorkers.map((w) => w.id);
    const index = currentActiveIds.indexOf(workerId);
    if (index === -1) return;

    let targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentActiveIds.length) return;

    const otherId = currentActiveIds[targetIndex];

    const allEmployeeIds = employees.map((e) => e.id);
    const mergedOrder = [...workersOrderList];

    // Ensure all employees are populated in the custom order list
    allEmployeeIds.forEach((id) => {
      if (!mergedOrder.includes(id)) {
        mergedOrder.push(id);
      }
    });

    const idxA = mergedOrder.indexOf(workerId);
    const idxB = mergedOrder.indexOf(otherId);
    if (idxA !== -1 && idxB !== -1) {
      mergedOrder[idxA] = otherId;
      mergedOrder[idxB] = workerId;
    }

    setWorkersOrderList(mergedOrder);
    await saveWorkersOrder(mergedOrder);
  };

  const [bulkWorkerId, setBulkWorkerId] = useState("all");
  const [bulkDaysMode, setBulkDaysMode] = useState("mon-sat");
  const [bulkOverwriteMode, setBulkOverwriteMode] = useState("empty");

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
      scheduleEntries
        .filter((entry) => {
          const date = new Date(entry.date);
          return entry.locationId === selectedLocationId && date.getUTCFullYear() === year && date.getUTCMonth() === month;
        })
        .map((entry) => entry.userId),
    );
    const extraIds = new Set([...selectedExtraWorkerIds, ...plannedExternalIds]);
    const extra = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId !== selectedLocationId && extraIds.has(employee.id));
    
    const combined = [...base, ...extra];
    return combined.sort((a, b) => {
      const idxA = workersOrderList.indexOf(a.id);
      const idxB = workersOrderList.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [employees, scheduleEntries, month, selectedExtraWorkerIds, selectedLocationId, year, workersOrderList]);
  const availableExternalWorkers = useMemo(
    () =>
      employees
        .filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId !== selectedLocationId && !activeWorkers.some((worker) => worker.id === employee.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeWorkers, employees, selectedLocationId],
  );

  const hasMonthRestriction = Boolean(allowedMonths?.length);

  function isAllowedMonth(nextMonth: number, nextYear: number) {
    return !hasMonthRestriction || allowedMonths?.some((item) => item.month === nextMonth && item.year === nextYear);
  }

  function setScheduleMonth(nextMonth: number, nextYear = year) {
    if (!isAllowedMonth(nextMonth, nextYear)) {
      setPlannerMessage("Questo mese non e ancora visibile per i collaboratori.");
      return;
    }
    setMonth(nextMonth);
    setYear(nextYear);
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(scheduleEntries, nextYear, nextMonth, workerIds, selectedLocationId, selectedExtraWorkerIds));
  }

  function setScheduleLocation(locationId: string) {
    setSelectedLocationId(locationId);
    const locationWorkers = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN");
    const locationExtraWorkerIds = extraWorkerIdsByLocation[locationId] ?? [];
    setAssignments(createAssignmentsFromEntries(scheduleEntries, year, month, locationWorkers.map((worker) => worker.id), locationId, locationExtraWorkerIds));
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
    const useCellTime = categoryAllowsTimeEdit(category);
    const startTime = useCellTime ? (next.startTime || category.startTime || "") : (category.startTime || "");
    const endTime = useCellTime ? (next.endTime || category.endTime || "") : (category.endTime || "");
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
    const savedEntry = await response.json();
    setScheduleEntries((current) => replaceScheduleEntry(current, scheduleEntryFromApi(savedEntry, {
      userId: next.workerId,
      locationId: selectedLocationId,
      categoryId: next.categoryId,
      date: date.toISOString(),
      startTime,
      endTime,
    })));
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
    setScheduleEntries((current) => removeScheduleEntry(current, workerId, date.toISOString(), selectedLocationId));
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

  function workersForLocation(locationId: string) {
    const base = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId === locationId);
    const extraIds = new Set([
      ...(extraWorkerIdsByLocation[locationId] ?? []),
      ...scheduleEntries
        .filter((entry) => {
          const date = new Date(entry.date);
          return entry.locationId === locationId && date.getUTCFullYear() === year && date.getUTCMonth() === month;
        })
        .map((entry) => entry.userId),
    ]);
    const extra = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN" && employee.locationId !== locationId && extraIds.has(employee.id));
    return [...base, ...extra].sort((a, b) => a.name.localeCompare(b.name));
  }

  function assignmentsForLocation(locationId: string, workers: ScheduleWorker[]) {
    if (locationId === selectedLocationId) return assignments;
    return createAssignmentsFromEntries(
      scheduleEntries,
      year,
      month,
      workers.map((worker) => worker.id),
      locationId,
      extraWorkerIdsByLocation[locationId] ?? [],
    );
  }

  function categoriesForLocation(locationId: string) {
    return categories.filter((category) => !category.locationId || category.locationId === locationId);
  }

  function workerTotalMinutesFor(workerId: string, scheduleAssignments: AssignmentMap) {
    return monthDays.reduce((total, day) => {
      const assignment = scheduleAssignments[assignmentKey(workerId, day)];
      const category = categories.find((item) => item.id === assignment?.categoryId);
      return total + minutesBetween(assignment?.startTime ?? category?.startTime, assignment?.endTime ?? category?.endTime);
    }, 0);
  }

  function hexToRgb(hex: string) {
    const fallback = "FFFFFF";
    const normalized = (hex || fallback).replace("#", "").trim();
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((character) => `${character}${character}`)
            .join("")
        : normalized.padEnd(6, "F").slice(0, 6);
    const parsed = Number.parseInt(value, 16);
    if (Number.isNaN(parsed)) return { r: 255, g: 255, b: 255 };
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  function setPdfFill(pdf: any, color: string) {
    const { r, g, b } = hexToRgb(color);
    pdf.setFillColor(r, g, b);
  }

  function setPdfText(pdf: any, color: string) {
    const { r, g, b } = hexToRgb(color);
    pdf.setTextColor(r, g, b);
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
    setAssignments(createAssignmentsFromEntries(scheduleEntries, year, month, workerIds, selectedLocationId, [...selectedExtraWorkerIds, userId]));
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
    setAssignments(createAssignmentsFromEntries(scheduleEntries, year, month, workerIds, selectedLocationId, nextExtraIds));
    setPlannerMessage("Lavoratore rimosso dalla lista del salone.");
  }

  function openNewCategoryForm() {
    setEditingCategoryId(null);
    setNewCategory(emptyCategoryForm);
    setCategoryMenu(null);
    setCategoryFormOpen(true);
  }

  function openEditCategoryForm(category: ScheduleCategory) {
    setEditingCategoryId(category.id);
    setNewCategory({
      name: category.name,
      code: category.code,
      color: category.color,
      textColor: category.textColor,
      startTime: category.startTime ?? "",
      endTime: category.endTime ?? "",
      editableTime: Boolean(category.editableTime),
    });
    setCategoryMenu(null);
    setCategoryFormOpen(true);
  }

  function closeCategoryForm() {
    setCategoryFormOpen(false);
    setEditingCategoryId(null);
    setNewCategory(emptyCategoryForm);
  }

  async function saveCategory() {
    if (!newCategory.name.trim() || !newCategory.code.trim()) return;
    const editingCategory = categories.find((category) => category.id === editingCategoryId);
    const response = await fetch("/api/schedules/categories", {
      method: editingCategoryId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCategory, id: editingCategoryId, locationId: editingCategory?.locationId ?? selectedLocationId }),
    });
    const category = await response.json();
    if (!response.ok) {
      setPlannerMessage(category.error ?? "Orario non salvato.");
      return;
    }
    setCategories((current) => [...current.filter((item) => item.id !== category.id), category]);
    setActiveCategoryId(category.id);
    closeCategoryForm();
    setPlannerMessage(editingCategoryId ? "Categoria aggiornata." : "Nuova categoria salvata.");
  }

  function resetMonth() {
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(scheduleEntries, year, month, workerIds, selectedLocationId, selectedExtraWorkerIds));
  }

  function setScheduleYear(nextYear: number) {
    if (!isAllowedMonth(month, nextYear)) {
      setPlannerMessage("Questo anno non e ancora visibile per i collaboratori.");
      return;
    }
    setYear(nextYear);
    const workerIds = employees.filter((employee) => employee.active && employee.role !== "SUPER_ADMIN").map((worker) => worker.id);
    setAssignments(createAssignmentsFromEntries(scheduleEntries, nextYear, month, workerIds, selectedLocationId, selectedExtraWorkerIds));
  }

  async function applyBulkAssignment() {
    if (!canEditPlanning) return;
    if (!activeCategoryId || !activeCategory) {
      setPlannerMessage("Seleziona una categoria da applicare dal pannello 'Categorie e orari'.");
      return;
    }

    const payload: any[] = [];
    const updatedAssignments = { ...assignments };
    const targets = bulkWorkerId === "all" ? activeWorkers : activeWorkers.filter((w) => w.id === bulkWorkerId);

    for (const day of monthDays) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      let matchDay = false;
      if (bulkDaysMode === "all") matchDay = true;
      else if (bulkDaysMode === "mon-sat" && dayOfWeek !== 0) matchDay = true;
      else if (bulkDaysMode === "mon-fri" && dayOfWeek >= 1 && dayOfWeek <= 5) matchDay = true;

      if (!matchDay) continue;

      for (const worker of targets) {
        const key = assignmentKey(worker.id, day);
        const current = assignments[key];

        if (bulkOverwriteMode === "empty" && current) {
          continue;
        }

        // Evita di sovrascrivere impegni in altri saloni
        if (current?.locationId && current.locationId !== selectedLocationId) {
          continue;
        }

        const dateUtc = new Date(Date.UTC(year, month, day));
        payload.push({
          userId: worker.id,
          locationId: selectedLocationId,
          categoryId: activeCategory.id,
          date: dateUtc.toISOString(),
          startTime: activeCategory.startTime ?? null,
          endTime: activeCategory.endTime ?? null,
        });

        updatedAssignments[key] = {
          categoryId: activeCategory.id,
          startTime: activeCategory.startTime ?? null,
          endTime: activeCategory.endTime ?? null,
          locationId: selectedLocationId,
        };
      }
    }

    if (payload.length === 0) {
      setPlannerMessage("Nessuna cella modificata secondo i filtri selezionati.");
      return;
    }

    setPlannerMessage("Salvataggio di massa in corso...");
    try {
      const response = await fetch("/api/schedules/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        setPlannerMessage(data.error ?? "Errore durante il salvataggio di massa.");
        return;
      }

      setAssignments(updatedAssignments);
      setScheduleEntries((current) =>
        payload.reduce<ScheduleEntry[]>(
          (nextEntries, item) => replaceScheduleEntry(nextEntries, {
            userId: String(item.userId),
            locationId: item.locationId,
            categoryId: String(item.categoryId),
            date: String(item.date),
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
          }),
          current,
        )
      );
      setPlannerMessage(`Salvati con successo ${payload.length} turni.`);
    } catch (e) {
      setPlannerMessage("Errore di connessione.");
    }
  }

  async function clearBulkAssignment() {
    if (!canEditPlanning) return;
    const confirmed = window.confirm("Sei sicuro di voler svuotare le celle selezionate nel mese per il personale indicato?");
    if (!confirmed) return;

    const payload: any[] = [];
    const updatedAssignments = { ...assignments };
    const targets = bulkWorkerId === "all" ? activeWorkers : activeWorkers.filter((w) => w.id === bulkWorkerId);

    for (const day of monthDays) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();

      let matchDay = false;
      if (bulkDaysMode === "all") matchDay = true;
      else if (bulkDaysMode === "mon-sat" && dayOfWeek !== 0) matchDay = true;
      else if (bulkDaysMode === "mon-fri" && dayOfWeek >= 1 && dayOfWeek <= 5) matchDay = true;

      if (!matchDay) continue;

      for (const worker of targets) {
        const key = assignmentKey(worker.id, day);
        const current = assignments[key];

        if (!current) continue;

        // Evita di svuotare impegni in altri saloni
        if (current.locationId && current.locationId !== selectedLocationId) {
          continue;
        }

        const dateUtc = new Date(Date.UTC(year, month, day));
        payload.push({
          userId: worker.id,
          locationId: selectedLocationId,
          categoryId: null,
          date: dateUtc.toISOString(),
        });

        delete updatedAssignments[key];
      }
    }

    if (payload.length === 0) {
      setPlannerMessage("Nessun turno da eliminare secondo i filtri selezionati.");
      return;
    }

    setPlannerMessage("Eliminazione di massa in corso...");
    try {
      const response = await fetch("/api/schedules/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        setPlannerMessage(data.error ?? "Errore durante l'eliminazione di massa.");
        return;
      }

      setAssignments(updatedAssignments);
      setScheduleEntries((current) =>
        payload.reduce<ScheduleEntry[]>(
          (nextEntries, item) => removeScheduleEntry(nextEntries, String(item.userId), String(item.date), item.locationId),
          current,
        )
      );
      setPlannerMessage(`Svuotate con successo ${payload.length} celle.`);
    } catch (e) {
      setPlannerMessage("Errore di connessione.");
    }
  }

  async function downloadPdf() {
    if (!tableRef.current || exporting) return;
    setExporting(true);
    tableRef.current.classList.add("schedule-pdf-mode");
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const image = await toPng(tableRef.current, {
        backgroundColor: "#FFFFFF",
        pixelRatio: 3,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.pdfHidden === "true"),
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 4;
      const properties = pdf.getImageProperties(image);
      const ratio = Math.min((pageWidth - margin * 2) / properties.width, (pageHeight - margin * 2) / properties.height);
      const imageWidth = properties.width * ratio;
      const imageHeight = properties.height * ratio;
      pdf.addImage(image, "PNG", (pageWidth - imageWidth) / 2, margin, imageWidth, imageHeight);
      const salon = (selectedLocation?.name ?? "Salone").replace(/\s+/g, "-");
      pdf.save(`Planning-${salon}-${monthNames[month]}-${year}.pdf`);
    } finally {
      tableRef.current?.classList.remove("schedule-pdf-mode");
      setExporting(false);
    }
  }

  async function downloadTwoSalonsPdf() {
    if (exporting || !selectedLocationId) return;
    const fallbackSecond = activeLocations.find((location) => location.id !== selectedLocationId)?.id ?? "";
    const secondLocationId = secondPrintLocationId || fallbackSecond;
    if (!secondLocationId || secondLocationId === selectedLocationId) {
      setPlannerMessage("Seleziona un secondo salone diverso per stampare due saloni nello stesso foglio.");
      return;
    }

    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const gap = 5;
      const sectionHeight = (pageHeight - margin * 2 - gap) / 2;
      const sectionWidth = pageWidth - margin * 2;

      const drawSection = (locationId: string, x: number, y: number, width: number, height: number) => {
        const location = locations.find((item) => item.id === locationId);
        const workers = workersForLocation(locationId);
        const scheduleAssignments = assignmentsForLocation(locationId, workers);
        const scheduleCategories = categoriesForLocation(locationId);
        const headerHeight = 14;
        const legendHeight = 11;
        const tableTop = y + headerHeight;
        const tableHeight = height - headerHeight - legendHeight;
        const headerRowsHeight = 9;
        const workerWidth = 44;
        const hoursWidth = 12;
        const dayWidth = (width - workerWidth - hoursWidth) / days;
        const rowHeight = Math.max(4.6, Math.min(7.2, (tableHeight - headerRowsHeight) / Math.max(workers.length, 1)));

        pdf.setDrawColor(225, 216, 220);
        pdf.setLineWidth(0.15);
        pdf.roundedRect(x, y, width, height, 4, 4, "S");

        setPdfFill(pdf, "#F4D8E5");
        pdf.roundedRect(x, y, width, headerHeight, 4, 4, "F");
        setPdfFill(pdf, "#F4D8E5");
        pdf.rect(x, y + headerHeight - 4, width, 4, "F");
        pdf.setTextColor(82, 62, 72);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(`${monthNames[month]} ${year}`.toUpperCase(), x + 4, y + 8);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text(`${location?.name ?? "Salone"} · ${days} giorni · ${workers.length} lavoratori`, x + width - 4, y + 8, { align: "right" });

        setPdfFill(pdf, "#F8F2F5");
        pdf.rect(x, tableTop, width, headerRowsHeight, "F");
        pdf.setDrawColor(204, 204, 204);
        pdf.rect(x, tableTop, width, headerRowsHeight);
        pdf.setTextColor(31, 31, 31);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6);
        pdf.text("Staff", x + 2, tableTop + 5.5);
        pdf.text("Ore", x + workerWidth + 2, tableTop + 5.5);

        monthDays.forEach((day) => {
          const cellX = x + workerWidth + hoursWidth + (day - 1) * dayWidth;
          pdf.line(cellX, tableTop, cellX, tableTop + tableHeight);
          pdf.text(String(day), cellX + dayWidth / 2, tableTop + 3.7, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5);
          pdf.text(weekdayShort[new Date(year, month, day).getDay()], cellX + dayWidth / 2, tableTop + 7.5, { align: "center" });
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6);
        });

        pdf.line(x + workerWidth, tableTop, x + workerWidth, tableTop + tableHeight);
        pdf.line(x + workerWidth + hoursWidth, tableTop, x + workerWidth + hoursWidth, tableTop + tableHeight);

        if (!workers.length) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(120, 120, 120);
          pdf.text("Nessun lavoratore attivo.", x + width / 2, tableTop + headerRowsHeight + 12, { align: "center" });
        }

        workers.forEach((worker, workerIndex) => {
          const rowY = tableTop + headerRowsHeight + workerIndex * rowHeight;
          pdf.setDrawColor(215, 215, 215);
          pdf.line(x, rowY, x + width, rowY);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(rowHeight < 5.5 ? 5 : 5.8);
          pdf.setTextColor(31, 31, 31);
          pdf.text(worker.name.toUpperCase(), x + 2, rowY + rowHeight / 2 + 1.5, { maxWidth: workerWidth - 3 });
          pdf.text(formatHours(workerTotalMinutesFor(worker.id, scheduleAssignments)), x + workerWidth + hoursWidth / 2, rowY + rowHeight / 2 + 1.5, {
            align: "center",
          });

          monthDays.forEach((day) => {
            const cellX = x + workerWidth + hoursWidth + (day - 1) * dayWidth;
            const assignment = scheduleAssignments[assignmentKey(worker.id, day)];
            const category = categories.find((item) => item.id === assignment?.categoryId);
            if (category) {
              setPdfFill(pdf, category.color);
              pdf.rect(cellX + 0.1, rowY + 0.1, dayWidth - 0.2, rowHeight - 0.2, "F");
              setPdfText(pdf, category.textColor);
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(rowHeight < 5.5 ? 4.6 : 5.2);
              pdf.text(category.code, cellX + dayWidth / 2, rowY + rowHeight / 2 + 1.4, { align: "center", maxWidth: dayWidth - 0.4 });
            }
          });
        });

        const bottomLineY = tableTop + headerRowsHeight + workers.length * rowHeight;
        pdf.setDrawColor(215, 215, 215);
        pdf.line(x, bottomLineY, x + width, bottomLineY);

        let cursorX = x + 2;
        let cursorY = y + height - legendHeight + 4;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(5.4);
        scheduleCategories.forEach((category) => {
          const label = `${category.code} - ${category.name}${category.startTime && category.endTime ? ` (${category.startTime}-${category.endTime})` : ""}`;
          const itemWidth = Math.min(width - 4, pdf.getTextWidth(label) + 7);
          if (cursorX + itemWidth > x + width - 2) {
            cursorX = x + 2;
            cursorY += 4.2;
          }
          setPdfFill(pdf, category.color);
          pdf.roundedRect(cursorX, cursorY - 2.6, 2.8, 2.8, 0.6, 0.6, "F");
          pdf.setTextColor(31, 31, 31);
          pdf.text(label, cursorX + 4, cursorY);
          cursorX += itemWidth + 2;
        });
      };

      drawSection(selectedLocationId, margin, margin, sectionWidth, sectionHeight);
      drawSection(secondLocationId, margin, margin + sectionHeight + gap, sectionWidth, sectionHeight);
      pdf.save(`Planning-2-saloni-${monthNames[month]}-${year}.pdf`);
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
      <div className="no-print grid gap-4">
        {!canEditPlanning ? (
          <div className="rounded-[22px] border border-paradise-pink/25 bg-paradise-softPink/35 px-5 py-4 text-sm font-semibold text-[#8F4051]">
            Vista sola lettura: puoi consultare la turnistica e scaricare PDF, ma non modificare celle, categorie o assegnazioni.
          </div>
        ) : null}
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
                value={hasMonthRestriction ? `${month}-${year}` : String(month)}
                onChange={(event) => {
                  if (hasMonthRestriction) {
                    const [nextMonth, nextYear] = event.target.value.split("-").map(Number);
                    setScheduleMonth(nextMonth, nextYear);
                    return;
                  }
                  setScheduleMonth(Number(event.target.value));
                }}
              >
                {hasMonthRestriction
                  ? allowedMonths?.map((item) => (
                      <option key={`${item.year}-${item.month}`} value={`${item.month}-${item.year}`}>
                        {monthNames[item.month]} {item.year}
                      </option>
                    ))
                  : monthNames.map((name, index) => (
                      <option key={name} value={index}>
                        {name}
                      </option>
                    ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Anno</span>
              <Field value={year} onChange={(event) => setScheduleYear(Number(event.target.value))} type="number" disabled={hasMonthRestriction} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadPdf} disabled={exporting || !selectedLocationId}>
                <Download className="size-4" />
                {exporting ? "Creazione..." : "PDF"}
              </Button>
            </div>
          </div>

          <div className="border-t border-black/5 px-6 py-4">
            <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-[#fbf7f9] p-3">
              <label className="min-w-[260px] flex-1 space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Stampa due saloni nello stesso foglio</span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-black/10 bg-white/90 px-4 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                  value={secondPrintLocationId}
                  onChange={(event) => setSecondPrintLocationId(event.target.value)}
                >
                  <option value="">Seleziona secondo salone</option>
                  {activeLocations
                    .filter((location) => location.id !== selectedLocationId)
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button onClick={downloadTwoSalonsPdf} disabled={exporting || !selectedLocationId || activeLocations.length < 2}>
                <Download className="size-4" />
                {exporting ? "Creazione..." : "PDF 2 saloni"}
              </Button>
            </div>
          </div>

          <div className="border-t border-black/5 px-6 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Categorie e orari</p>
                <p className="mt-1 text-xs text-black/45">Seleziona una categoria e clicca sulle celle. Click destro su una categoria per modificarla.</p>
              </div>
              {canManageCategories ? (
                <Button type="button" onClick={openNewCategoryForm} className="min-h-10 px-4">
                  <Plus className="size-4" />
                  Nuova categoria
                </Button>
              ) : null}
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
                onContextMenu={(event) => {
                  if (!canManageCategories) return;
                  event.preventDefault();
                  setCategoryMenu({ categoryId: category.id, x: event.clientX, y: event.clientY });
                }}
              >
                <span className="grid size-6 place-items-center rounded-full bg-white/45 text-[11px] font-black">{category.code}</span>
                {category.name}
                {category.startTime && category.endTime ? ` ${category.startTime}-${category.endTime}` : ""}
              </button>
            ))}
            {visibleCategories.length === 0 ? <p className="rounded-2xl bg-paradise-nude px-4 py-3 text-sm text-black/55">Nessuna categoria per questo salone. Crea il primo orario dal pulsante “Nuova categoria”.</p> : null}
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
            {canEditPlanning && (
              <div className="mt-5 border-t border-black/5 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45 mb-3">Assegnazione Rapida (Massa)</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                  <label className="space-y-2">
                    <span className="text-xs text-black/45">Dipendente</span>
                    <select
                      className="min-h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                      value={bulkWorkerId}
                      onChange={(e) => setBulkWorkerId(e.target.value)}
                    >
                      <option value="all">Tutti i dipendenti</option>
                      {activeWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  
                  <label className="space-y-2">
                    <span className="text-xs text-black/45">Giorni</span>
                    <select
                      className="min-h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                      value={bulkDaysMode}
                      onChange={(e) => setBulkDaysMode(e.target.value)}
                    >
                      <option value="mon-sat">Dal Lunedì al Sabato</option>
                      <option value="mon-fri">Dal Lunedì al Venerdì</option>
                      <option value="all">Tutti i giorni (incluso Domenica)</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs text-black/45">Celle</span>
                    <select
                      className="min-h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                      value={bulkOverwriteMode}
                      onChange={(e) => setBulkOverwriteMode(e.target.value)}
                    >
                      <option value="empty">Solo celle vuote</option>
                      <option value="overwrite">Tutte (sovrascrivi esistenti)</option>
                    </select>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={applyBulkAssignment}
                      className="min-h-10 flex-1 rounded-2xl bg-paradise-pink text-black hover:bg-paradise-pink/80 px-4 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      type="button"
                    >
                      <Sparkles className="size-3.5 animate-pulse-soft" />
                      Applica
                    </button>
                    <button
                      onClick={clearBulkAssignment}
                      className="min-h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 px-3 text-xs font-bold transition flex items-center justify-center"
                      type="button"
                      title="Svuota celle nel mese"
                    >
                      Svuota
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      {plannerMessage ? <p className="no-print rounded-2xl bg-paradise-nude dark:bg-neutral-850 px-4 py-3 text-sm font-medium dark:text-white">{plannerMessage}</p> : null}

      {categoryMenu ? (
        <div className="no-print fixed inset-0 z-40" onClick={() => setCategoryMenu(null)} onContextMenu={(event) => event.preventDefault()}>
          <div
            className="absolute min-w-52 rounded-2xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
            style={{ left: categoryMenu.x, top: categoryMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-paradise-noir transition hover:bg-paradise-softPink/45 dark:text-white"
              onClick={() => {
                const category = categories.find((item) => item.id === categoryMenu.categoryId);
                if (category) openEditCategoryForm(category);
              }}
            >
              <Pencil className="size-4 text-[#B85B68]" />
              Modifica categoria
            </button>
          </div>
        </div>
      ) : null}

      {categoryFormOpen ? (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm" onMouseDown={closeCategoryForm}>
          <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-900" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Configurazione</p>
                <h2 className="mt-2 text-2xl font-semibold">{editingCategoryId ? "Modifica categoria / orario" : "Nuova categoria / orario"}</h2>
                <p className="mt-2 text-sm text-black/50 dark:text-white/50">
                  {editingCategoryId ? "Aggiorna la categoria selezionata." : `Sara salvata solo per ${selectedLocation?.name ?? "il salone selezionato"}.`}
                </p>
              </div>
              <button type="button" onClick={closeCategoryForm} className="grid size-10 shrink-0 place-items-center rounded-full bg-black/5 text-black/45 hover:bg-paradise-softPink/60">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field placeholder="Nome es. Apertura" value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} />
              <Field placeholder="Codice es. A" value={newCategory.code} onChange={(event) => setNewCategory({ ...newCategory, code: event.target.value })} />
              <Field type="time" value={newCategory.startTime} onChange={(event) => setNewCategory({ ...newCategory, startTime: event.target.value })} />
              <Field type="time" value={newCategory.endTime} onChange={(event) => setNewCategory({ ...newCategory, endTime: event.target.value })} />
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3 dark:border-white/10 dark:bg-neutral-800">
                <span className="text-xs font-semibold">Sfondo</span>
                <input type="color" value={newCategory.color} onChange={(event) => setNewCategory({ ...newCategory, color: event.target.value })} />
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3 dark:border-white/10 dark:bg-neutral-800">
                <span className="text-xs font-semibold">Testo</span>
                <input type="color" value={newCategory.textColor} onChange={(event) => setNewCategory({ ...newCategory, textColor: event.target.value })} />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold dark:border-white/10 dark:bg-neutral-800">
              <input
                type="checkbox"
                checked={newCategory.editableTime}
                onChange={(event) => setNewCategory({ ...newCategory, editableTime: event.target.checked })}
              />
              Permetti modifica orario sulla singola cella
            </label>
            <Button className="mt-4 w-full" onClick={saveCategory}>
              {editingCategoryId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              {editingCategoryId ? "Salva categoria" : "Carica orario"}
            </Button>
          </div>
        </div>
      ) : null}
 
      <div ref={tableRef} className="print-surface overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-soft">
        <div className="schedule-title border-b border-black/10 dark:border-white/10 bg-[#F4D8E5] px-6 py-5 text-[#523E48]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Turnistica staff</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">{monthNames[month]} {year}</h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-white/65">{selectedLocation?.name ?? "Salone"}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-white/75">
              <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> {days} giorni</span>
              <span className="inline-flex items-center gap-2"><Users className="size-4" /> {activeWorkers.length} lavoratori</span>
            </div>
          </div>
        </div>
        <div className="schedule-scroll overflow-x-auto">
          <table
            className="schedule-table border-collapse bg-white dark:bg-neutral-900 text-black dark:text-white"
            style={{
              tableLayout: "fixed",
              width: `${220 + 65 + (days * 32)}px`,
            }}
          >
            <thead>
              <tr className="bg-[#f8f2f5] dark:bg-neutral-800">
                <th className="worker-head sticky left-0 z-20 w-[220px] min-w-[220px] max-w-[220px] border border-black/10 dark:border-white/10 bg-[#f8f2f5] dark:bg-neutral-800 px-3 py-3 text-left text-sm font-bold">Staff</th>
                <th className="border border-black/10 dark:border-white/10 bg-[#f8f2f5] dark:bg-neutral-800 px-2 py-3 text-center text-sm font-bold w-[65px] min-w-[65px] max-w-[65px]">Ore</th>
                {monthDays.map((day) => (
                  <th key={day} className="day-head border border-black/10 dark:border-white/10 bg-[#f8f2f5] dark:bg-neutral-800 text-sm font-semibold w-8 min-w-[32px] max-w-[32px]">{day}</th>
                ))}
              </tr>
              <tr className="bg-white dark:bg-neutral-900">
                <th className="worker-head sticky left-0 z-20 w-[220px] min-w-[220px] max-w-[220px] border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900" />
                <th className="border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-[10px] font-bold uppercase text-black/45 dark:text-white/45 w-[65px] min-w-[65px] max-w-[65px]">tot.</th>
                {monthDays.map((day) => (
                  <th key={day} className="day-head border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-xs font-bold text-black/50 dark:text-white/50 w-8 min-w-[32px] max-w-[32px]">
                    {weekdayShort[new Date(year, month, day).getDay()]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeWorkers.length === 0 ? (
                <tr>
                  <td colSpan={days + 2} className="px-6 py-10 text-center text-sm text-black/45 dark:text-white/45">
                    Nessun dipendente attivo in questo salone. Crea un salone attivo e assegna il personale da Dipendenti.
                  </td>
                </tr>
              ) : null}
              {activeWorkers.map((worker, idx) => (
                <tr key={worker.id}>
                  <th className="worker-cell sticky left-0 z-10 w-[220px] min-w-[220px] max-w-[220px] border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 text-left text-sm font-semibold" title={worker.name}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {canEditPlanning && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveWorker(worker.id, "up")}
                              disabled={idx === 0}
                              className={`p-0.5 rounded text-black/40 dark:text-white/40 hover:text-paradise-pink hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition ${idx === 0 ? "opacity-20 cursor-not-allowed" : "cursor-pointer"}`}
                              title="Sposta su"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveWorker(worker.id, "down")}
                              disabled={idx === activeWorkers.length - 1}
                              className={`p-0.5 rounded text-black/40 dark:text-white/40 hover:text-paradise-pink hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition ${idx === activeWorkers.length - 1 ? "opacity-20 cursor-not-allowed" : "cursor-pointer"}`}
                              title="Sposta giù"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>
                        )}
                        <span className="truncate">{worker.name.toUpperCase()}</span>
                      </div>
                      <a
                        href={`/schedules/card?userId=${worker.id}&month=${month + 1}&year=${year}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black/35 dark:text-white/35 hover:text-paradise-pink transition-colors p-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.03] shrink-0"
                        title="Genera cartolina turni"
                      >
                        <Share2 className="size-3.5" />
                      </a>
                    </div>
                  </th>
                  <td className="border border-black/10 dark:border-white/10 bg-[#fbfaf9] dark:bg-neutral-800 px-2 text-center text-sm font-black w-[65px] min-w-[65px] max-w-[65px]">{formatHours(workerTotalMinutes(worker.id))}</td>
                  {monthDays.map((day) => {
                    const assignment = assignments[assignmentKey(worker.id, day)];
                    const category = categories.find((item) => item.id === assignment?.categoryId);
                    const shownStart = assignment?.startTime ?? category?.startTime;
                    const shownEnd = assignment?.endTime ?? category?.endTime;
                    return (
                      <td
                        key={`${worker.id}-${day}`}
                        className={`schedule-cell h-8 w-8 min-w-[32px] max-w-[32px] border border-black/10 dark:border-white/10 text-center text-[10px] font-bold transition ${canEditPlanning ? "cursor-pointer hover:ring-2 hover:ring-paradise-pink/60" : ""}`}
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
        <div className="legend flex flex-wrap gap-3 border-t border-black/10 dark:border-white/10 bg-[#fbfaf9] dark:bg-neutral-800 p-4">
          {visibleCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 text-xs font-semibold text-black dark:text-white">
              <span className="size-4 rounded border border-black/20 dark:border-white/20" style={{ backgroundColor: category.color }} />
              {category.code} - {category.name}
              {category.startTime && category.endTime ? ` (${category.startTime}-${category.endTime})` : ""}
            </div>
          ))}
        </div>
      </div>

      {cellEditor ? (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/35 dark:bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Modifica cella</p>
            <h3 className="mt-2 text-2xl font-semibold dark:text-white">
              {employees.find((worker) => worker.id === cellEditor.workerId)?.name ?? "Lavoratore"} · {cellEditor.day} {monthNames[month].toLowerCase()}
            </h3>
            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">Categoria</span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 px-4 text-sm font-semibold outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20 dark:text-white"
                  value={cellEditor.categoryId}
                  disabled={editorIsExternalCommitment}
                  onChange={(event) => {
                    const category = visibleCategories.find((item) => item.id === event.target.value);
                    setCellEditor((current) =>
                      current
                        ? {
                            ...current,
                            categoryId: event.target.value,
                            startTime: category?.startTime ?? "",
                            endTime: category?.endTime ?? "",
                          }
                        : current,
                    );
                  }}
                >
                  {editorCategory && !visibleCategories.some((category) => category.id === editorCategory.id) ? (
                    <option value={editorCategory.id} className="dark:bg-[#201F24] dark:text-white">
                      {editorCategory.code} - {editorCategory.name} (altro salone)
                    </option>
                  ) : null}
                  {visibleCategories.map((category) => (
                    <option key={category.id} value={category.id} className="dark:bg-[#201F24] dark:text-white">
                      {category.code} - {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">Inizio</span>
                  <Field
                    type="time"
                    value={cellEditor.startTime}
                    disabled={!editorCanChangeTime}
                    onChange={(event) => setCellEditor({ ...cellEditor, startTime: event.target.value })}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">Fine</span>
                  <Field
                    type="time"
                    value={cellEditor.endTime}
                    disabled={!editorCanChangeTime}
                    onChange={(event) => setCellEditor({ ...cellEditor, endTime: event.target.value })}
                  />
                </label>
              </div>
              {editorIsExternalCommitment ? (
                <p className="text-xs font-medium text-black/45 dark:text-white/45">Questo e un impegno gia presente in un altro salone. Serve per non creare doppio turno.</p>
              ) : !editorCanChangeTime ? (
                <p className="text-xs font-medium text-black/45 dark:text-white/45">Questa categoria usa sempre l'orario fisso. Attiva la modifica orario quando crei una categoria nuova.</p>
              ) : null}
              <p className="rounded-2xl bg-paradise-nude dark:bg-neutral-850 px-4 py-3 text-sm text-black/60 dark:text-white/60">
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
