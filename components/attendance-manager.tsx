"use client";

import { useState, useMemo } from "react";
import { Pencil, Plus, Save, X, Clock, Coffee, UserCheck, FileEdit, Search, CalendarDays, LogOut, MapPin, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Select } from "@/components/ui";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Worker = { id: string; name: string; location: string; photoUrl?: string | null };
type AttendanceLog = {
  id: string;
  userId: string;
  employee: string;
  location: string;
  device: string;
  type: string;
  timestamp: string;
  time: string;
  note: string;
  photoUrl?: string | null;
};

type AttendanceGroup = {
  id: string;
  userId: string;
  employee: string;
  location: string;
  dateStr: string;
  entrata?: AttendanceLog;
  pausa?: AttendanceLog;
  rientro?: AttendanceLog;
  uscita?: AttendanceLog;
  lastLog?: AttendanceLog;
  allLogs: AttendanceLog[];
};

const typeLabels: Record<string, string> = {
  ENTRATA: "Entrata",
  PAUSA: "Pausa",
  RIENTRO: "Rientro",
  USCITA: "Uscita"
};

const typeStyles: Record<string, string> = {
  ENTRATA: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  PAUSA: "bg-amber-400/15 text-amber-700 border-amber-400/25",
  RIENTRO: "bg-sky-400/15 text-sky-700 border-sky-400/25",
  USCITA: "bg-neutral-900/5 text-neutral-800 border-neutral-900/10",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function inputTimestamp(timestamp = new Date().toISOString()) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function visibleClockTime(log?: AttendanceLog) {
  if (!log) return "--";
  const actualMatch = log.note?.match(/Ora rilevata\s+(\d{2}:\d{2}:\d{2})/i);
  return actualMatch?.[1] ?? log.time;
}

export function AttendanceManager({ 
  workers, 
  initialLogs,
  readOnly = false
}: { 
  workers: Worker[]; 
  initialLogs: AttendanceLog[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterLocation, setFilterLocation] = useState("ALL");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const [draft, setDraft] = useState({
    userId: workers[0]?.id ?? "",
    type: "ENTRATA",
    timestamp: inputTimestamp(),
    note: "",
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    
    // Filter logs that belong to today
    const todayLogs = logs.filter(log => {
      const datePart = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(log.timestamp));
      return datePart === todayStr;
    });

    // Group today's logs by worker and derive a strict state from the valid sequence.
    const logsByEmployee = new Map<string, AttendanceLog[]>();
    for (const log of todayLogs) {
      logsByEmployee.set(log.userId, [...(logsByEmployee.get(log.userId) ?? []), log]);
    }

    const states = Array.from(logsByEmployee.values()).map((employeeLogs) =>
      deriveAttendanceState(employeeLogs as any)
    );

    const activeWorkers = states.filter(
      state => state.status === "IN"
    ).length;

    const onBreakWorkers = states.filter(
      state => state.status === "BREAK"
    ).length;

    const manualCorrections = logs.filter(
      log => log.device.toLowerCase().includes("manuale") || log.device.toLowerCase().includes("correzione")
    ).length;

    return {
      todayCount: todayLogs.length,
      activeWorkers,
      onBreakWorkers,
      manualCorrections
    };
  }, [logs]);

  // Compute break duration helper for groups
  const getBreakDurationForGroup = (group: { pausa?: AttendanceLog; rientro?: AttendanceLog }) => {
    if (!group.pausa || !group.rientro) return null;
    const pausaTime = new Date(group.pausa.timestamp).getTime();
    const rientroTime = new Date(group.rientro.timestamp).getTime();
    const durationMs = rientroTime - pausaTime;
    if (durationMs <= 0) return null;
    const mins = Math.round(durationMs / (1000 * 60));
    return `${mins} min`;
  };

  const peopleById = useMemo(() => {
    const people = new Map<string, Worker>();
    workers.forEach((worker) => people.set(worker.id, worker));
    logs.forEach((log) => {
      if (!people.has(log.userId)) {
        people.set(log.userId, { id: log.userId, name: log.employee, location: log.location, photoUrl: log.photoUrl });
      }
    });
    return people;
  }, [logs, workers]);

  // Group all logs by employee (userId) and date (YYYY-MM-DD)
  const groupedLogs = useMemo(() => {
    const groups: Record<string, AttendanceGroup> = {};

    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const log of sortedLogs) {
      const datePart = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(log.timestamp));
      const groupKey = `${log.userId}-${datePart}`;
      const workerProfile = peopleById.get(log.userId);

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          userId: log.userId,
          employee: workerProfile?.name ?? log.employee,
          location: workerProfile?.location ?? log.location,
          dateStr: datePart,
          allLogs: []
        };
      }

      groups[groupKey].allLogs.push(log);
    }

    const normalizedGroups = Object.values(groups).map((group) => {
      const state = deriveAttendanceState(group.allLogs as any);
      const lastBreak = state.breaks[state.breaks.length - 1];
      return {
        ...group,
        entrata: state.firstEntry as AttendanceLog | undefined,
        pausa: (lastBreak?.pausa ?? state.activePause) as AttendanceLog | undefined,
        rientro: lastBreak?.rientro as AttendanceLog | undefined,
        uscita: state.lastExit as AttendanceLog | undefined,
        lastLog: state.lastValidLog as AttendanceLog | undefined,
      };
    });

    return normalizedGroups.sort((a, b) => {
      const dateDiff = new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.employee.localeCompare(b.employee);
    });
  }, [logs, peopleById]);

  const todayKey = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()), []);

  const todayRosterGroups = useMemo(() => {
    const byWorker = new Map<string, AttendanceGroup>();

    groupedLogs
      .filter((group) => group.dateStr === todayKey)
      .forEach((group) => byWorker.set(group.userId, group));

    workers.forEach((worker) => {
      if (!byWorker.has(worker.id)) {
        byWorker.set(worker.id, {
          id: `${worker.id}-${todayKey}`,
          userId: worker.id,
          employee: worker.name,
          location: worker.location,
          dateStr: todayKey,
          allLogs: [],
        });
      }
    });

    const statusWeight = (group: AttendanceGroup) => {
      if (group.lastLog?.type === "ENTRATA" || group.lastLog?.type === "RIENTRO") return 0;
      if (group.lastLog?.type === "PAUSA") return 1;
      if (group.lastLog?.type === "USCITA") return 2;
      return 3;
    };

    return Array.from(byWorker.values()).sort((a, b) => {
      const statusDiff = statusWeight(a) - statusWeight(b);
      if (statusDiff !== 0) return statusDiff;
      const locationDiff = a.location.localeCompare(b.location);
      if (locationDiff !== 0) return locationDiff;
      return a.employee.localeCompare(b.employee);
    });
  }, [groupedLogs, todayKey, workers]);

  const locations = useMemo(() => {
    return Array.from(new Set(
      todayRosterGroups
        .map((group) => group.location)
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }, [todayRosterGroups]);

  // Filter grouped logs based on search, location and type
  const filteredGroups = useMemo(() => {
    return todayRosterGroups.filter(group => {
      const matchesSearch = group.employee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = filterLocation === "ALL" || group.location === filterLocation;
      const matchesType = (() => {
        if (filterType === "ALL") return true;
        if (filterType === "ENTRATA") return !!group.entrata;
        if (filterType === "PAUSA") return !!group.pausa;
        if (filterType === "RIENTRO") return !!group.rientro;
        if (filterType === "USCITA") return !!group.uscita;
        return true;
      })();
      return matchesSearch && matchesLocation && matchesType;
    });
  }, [todayRosterGroups, searchQuery, filterLocation, filterType]);

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const selectedWorker = selectedWorkerId ? peopleById.get(selectedWorkerId) : null;
  const selectedWorkerGroups = useMemo(() => {
    if (!selectedWorkerId) return [];
    return groupedLogs
      .filter((group) => group.userId === selectedWorkerId)
      .sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());
  }, [groupedLogs, selectedWorkerId]);

  const selectedMonth = useMemo(() => ({ year: calendarYear, month: calendarMonth }), [calendarYear, calendarMonth]);

  const selectedMonthDays = useMemo(() => {
    const first = new Date(selectedMonth.year, selectedMonth.month, 1);
    const days = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    return [
      ...Array.from({ length: offset }, (_, index) => ({ key: `empty-${index}`, day: 0, dateStr: "" })),
      ...Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const date = new Date(selectedMonth.year, selectedMonth.month, day);
        return {
          key: date.toISOString(),
          day,
          dateStr: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date),
        };
      }),
    ];
  }, [selectedMonth]);

  const toggleDropdown = (id: string) => {
    setActiveDropdownId(activeDropdownId === id ? null : id);
  };

  function createLogForGroup(type: string, userId: string, dateStr: string) {
    setEditingId(null);
    const targetDate = new Date(dateStr);
    const now = new Date();
    targetDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
    
    setDraft({
      userId: userId,
      type: type,
      timestamp: inputTimestamp(targetDate.toISOString()),
      note: ""
    });
    setMessage("");
    setOpen(true);
  }

  function openWorkerMonthly(userId: string) {
    setSelectedWorkerId(userId);
    setActiveDropdownId(null);
    setCalendarMonth(new Date().getMonth());
    setCalendarYear(new Date().getFullYear());
  }

  function WorkerAvatar({ worker, name, size = "md" }: { worker?: Worker; name: string; size?: "md" | "lg" }) {
    const [imageFailed, setImageFailed] = useState(false);
    const sizeClass = size === "lg" ? "size-16" : "size-12";
    if (worker?.photoUrl && !imageFailed) {
      return (
        <div className={`${sizeClass} overflow-hidden rounded-2xl border-2 border-white/80 bg-paradise-softPink shadow-sm`}>
          <img src={resolveDrivePhotoUrl(worker.photoUrl)} alt={name} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        </div>
      );
    }
    return (
      <div className={`${sizeClass} grid place-items-center rounded-2xl border-2 border-white/80 bg-paradise-softPink text-sm font-black text-black shadow-sm`}>
        {initials(name)}
      </div>
    );
  }

  function createLog() {
    setEditingId(null);
    setDraft({ userId: workers[0]?.id ?? "", type: "ENTRATA", timestamp: inputTimestamp(), note: "" });
    setMessage("");
    setOpen(true);
  }

  function editLog(log: AttendanceLog) {
    setEditingId(log.id);
    setDraft({ userId: log.userId, type: log.type, timestamp: inputTimestamp(log.timestamp), note: log.note });
    setMessage("");
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(editingId ? `/api/attendance/manual/${editingId}` : "/api/attendance/manual", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, timestamp: new Date(draft.timestamp).toISOString() }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Timbratura non salvata.");
      return;
    }
    setMessage(editingId ? "Timbratura modificata correttamente." : "Timbratura aggiunta correttamente.");
    setOpen(false);
    const worker = workers.find((item) => item.id === draft.userId);
    const fallbackWorker = peopleById.get(draft.userId);
    const updated: AttendanceLog = {
      id: data.id,
      userId: draft.userId,
      employee: worker?.name ?? fallbackWorker?.name ?? "",
      location: worker?.location ?? fallbackWorker?.location ?? "",
      device: editingId ? "Correzione manuale Admin" : "Inserimento manuale Admin",
      type: draft.type,
      timestamp: data.timestamp,
      time: data.time,
      note: data.note ?? "",
      photoUrl: worker?.photoUrl ?? fallbackWorker?.photoUrl ?? null,
    };
    setLogs((current) => editingId ? current.map((log) => log.id === editingId ? updated : log) : [updated, ...current]);
    router.refresh();
  }

  async function deleteCurrentLog() {
    if (!editingId) return;
    const confirmed = window.confirm("Vuoi eliminare definitivamente questa timbratura?");
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/attendance/manual/${editingId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    setDeleting(false);

    if (!response.ok) {
      setMessage(data.error ?? "Timbratura non eliminata.");
      return;
    }

    setLogs((current) => current.filter((log) => log.id !== editingId));
    setMessage("Timbratura eliminata correttamente.");
    setOpen(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <>
      {/* Premium Stats Grid */}
      <div className="mb-6 grid grid-cols-4 gap-2 sm:gap-4 animate-in fade-in duration-500">
        <Card className="flex min-h-[92px] flex-col items-center justify-center gap-1 bg-white/70 p-2 text-center backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md sm:min-h-0 sm:flex-row sm:justify-start sm:gap-4 sm:p-5 sm:text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-paradise-softPink/40 text-paradise-pink dark:bg-paradise-pink/15 sm:size-12">
            <Clock className="size-5 text-[#A74758] dark:text-[#F4A3C4] sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-black/55 dark:text-white/55 sm:text-xs sm:tracking-wide">Timbrature Oggi</p>
            <h3 className="mt-0.5 text-xl font-bold text-black dark:text-white sm:text-2xl">{stats.todayCount}</h3>
          </div>
        </Card>
        
        <Card className="flex min-h-[92px] flex-col items-center justify-center gap-1 bg-white/70 p-2 text-center backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md sm:min-h-0 sm:flex-row sm:justify-start sm:gap-4 sm:p-5 sm:text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 sm:size-12">
            <UserCheck className="size-5 text-emerald-600 dark:text-emerald-400 sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-black/55 dark:text-white/55 sm:text-xs sm:tracking-wide">Dipendenti in Sede</p>
            <h3 className="mt-0.5 text-xl font-bold text-black dark:text-white sm:text-2xl">{stats.activeWorkers}</h3>
          </div>
        </Card>

        <Card className="flex min-h-[92px] flex-col items-center justify-center gap-1 bg-white/70 p-2 text-center backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md sm:min-h-0 sm:flex-row sm:justify-start sm:gap-4 sm:p-5 sm:text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-paradise-gold/15 text-paradise-gold sm:size-12">
            <Coffee className="size-5 text-[#9E7A3B] dark:text-paradise-gold sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-black/55 dark:text-white/55 sm:text-xs sm:tracking-wide">In Pausa</p>
            <h3 className="mt-0.5 text-xl font-bold text-black dark:text-white sm:text-2xl">{stats.onBreakWorkers}</h3>
          </div>
        </Card>

        <Card className="flex min-h-[92px] flex-col items-center justify-center gap-1 bg-white/70 p-2 text-center backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md sm:min-h-0 sm:flex-row sm:justify-start sm:gap-4 sm:p-5 sm:text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 sm:size-12">
            <FileEdit className="size-5 text-blue-600 dark:text-blue-400 sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-black/55 dark:text-white/55 sm:text-xs sm:tracking-wide">Variazioni Manuali</p>
            <h3 className="mt-0.5 text-xl font-bold text-black dark:text-white sm:text-2xl">{stats.manualCorrections}</h3>
          </div>
        </Card>
      </div>

      {/* Action Bar with Search & Filters */}
      <Card className="mb-6 p-4 bg-white/80 dark:bg-[#1B1A1F]/80 border-black/5 dark:border-white/5 shadow-sm flex flex-wrap gap-4 items-center justify-between hover:translate-y-0">
        <div className="flex flex-1 min-w-[280px] gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 size-4 text-black/40 dark:text-white/40" />
            <Field 
              type="text" 
              placeholder="Cerca dipendente per nome..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 min-h-11 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 focus:bg-white dark:bg-black/20"
            />
          </div>
          
          <div className="w-[180px]">
            <Select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="min-h-11 rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20"
            >
              <option value="ALL" className="dark:bg-[#1B1A1F]">Tutti i tipi</option>
              <option value="ENTRATA" className="dark:bg-[#1B1A1F]">Entrata</option>
              <option value="PAUSA" className="dark:bg-[#1B1A1F]">Pausa</option>
              <option value="RIENTRO" className="dark:bg-[#1B1A1F]">Rientro</option>
              <option value="USCITA" className="dark:bg-[#1B1A1F]">Uscita</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {message ? (
            <span className="rounded-xl bg-paradise-nude px-4 py-2 text-xs font-semibold text-[#8B4452] dark:bg-neutral-800 dark:text-white animate-in fade-in duration-300">
              {message}
            </span>
          ) : null}
          {!readOnly && (
            <Button onClick={createLog} disabled={workers.length === 0} className="min-h-11 w-full sm:w-auto">
              <Plus className="size-4" /> Aggiungi timbratura
            </Button>
          )}
        </div>
      </Card>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {["ALL", ...locations].map((location) => {
          const active = filterLocation === location;
          return (
            <button
              key={location}
              type="button"
              onClick={() => setFilterLocation(location)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                active
                  ? "border-paradise-pink bg-paradise-pink text-white shadow-sm shadow-paradise-pink/20"
                  : "border-black/10 bg-white text-black/65 hover:border-paradise-pink/50 hover:text-paradise-pink dark:border-white/10 dark:bg-white/5 dark:text-white/70"
              }`}
            >
              {location === "ALL" ? "Tutti" : location}
            </button>
          );
        })}
      </div>

      {/* Visual attendance board */}
      <Card className="overflow-visible border border-black/5 bg-white p-5 text-black shadow-sm hover:translate-y-0 dark:border-white/10 dark:bg-[#17161B] dark:text-white">
        {filteredGroups.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/45 dark:text-white/45">
            Nessuna timbratura registrata corrispondente ai criteri di ricerca.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-paradise-pink">Presenze salone</p>
                <h2 className="text-2xl font-black">Persone attualmente in sede</h2>
              </div>
              <p className="rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-xs font-bold text-black/55 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                Clicca foto o nome per andamento mensile
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredGroups.map((group) => {
                const breakDuration = getBreakDurationForGroup(group);
                const worker = peopleById.get(group.userId);
                const attendanceState = deriveAttendanceState(group.allLogs as any);
                const hasInvalidLogs = attendanceState.invalidLogs.length > 0;
                const isInShift = attendanceState.status === "IN";
                const isOnBreak = attendanceState.status === "BREAK";
                const isPresent = isInShift || isOnBreak;
                const statusLabel = hasInvalidLogs ? "Da controllare" : isOnBreak ? "In pausa" : isInShift ? "In turno" : group.uscita ? "Turno chiuso" : "Non di turno";
                
                return (
                  <div key={group.id} className={`relative rounded-[22px] border bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/5 ${
                    isPresent
                      ? "border-paradise-pink/25"
                      : "border-black/10 opacity-85 dark:border-white/10"
                  }`}>
                    <button type="button" onClick={() => openWorkerMonthly(group.userId)} className="group w-full text-left">
                      <div className={`aspect-square overflow-hidden rounded-[18px] bg-paradise-softPink ${!isPresent ? "grayscale" : ""}`}>
                        {worker?.photoUrl ? (
                          <img
                            src={resolveDrivePhotoUrl(worker.photoUrl)}
                            alt={group.employee}
                            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${!isPresent ? "opacity-55" : ""}`}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className={`grid h-full place-items-center bg-gradient-to-br from-paradise-softPink to-paradise-pink/70 text-4xl font-black text-black ${!isPresent ? "opacity-55" : ""}`}>
                            {initials(group.employee)}
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black text-paradise-pink">{visibleClockTime(group.entrata)}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                            hasInvalidLogs
                              ? "bg-red-50 text-red-700"
                              : isOnBreak
                              ? "bg-amber-50 text-amber-700"
                              : isInShift
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {statusLabel}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 text-sm font-black uppercase leading-tight text-black dark:text-white">{group.employee}</h3>
                        <p className="mt-1 text-xs font-bold text-black/45 dark:text-white/50">{new Intl.DateTimeFormat("it-IT").format(new Date(group.dateStr))}</p>
                      </div>
                    </button>

                    <div className="mt-3 space-y-2 text-xs font-bold text-black/65 dark:text-white/70">
                      <div className="flex items-start gap-1.5">
                        <Clock className="mt-0.5 size-3.5 text-black/35 dark:text-white/40" />
                        <div>
                          <p>Ingresso: <span className="text-black dark:text-white">{visibleClockTime(group.entrata)}</span></p>
                          <p className="text-[11px] text-black/40 dark:text-white/45">{group.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Coffee className="size-3.5 text-black/35 dark:text-white/40" />
                        <p>
                          Pausa: <span className="text-black dark:text-white">{group.pausa ? `${visibleClockTime(group.pausa)}${group.rientro ? ` - ${visibleClockTime(group.rientro)}` : " in corso"}` : "--"}</span>
                          {breakDuration ? <span className="text-black/40 dark:text-white/45"> · {breakDuration}</span> : null}
                        </p>
                      </div>
                      {hasInvalidLogs ? (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] font-black text-red-700">
                          Sequenza da controllare: {attendanceState.invalidLogs.map((log) => `${typeLabels[log.type] ?? log.type} ${visibleClockTime(log as AttendanceLog)}`).join(", ")}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <LogOut className="size-3.5 text-black/35 dark:text-white/40" />
                        <p>Uscita: <span className="text-black dark:text-white">{visibleClockTime(group.uscita)}</span></p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openWorkerMonthly(group.userId)}
                          className="flex-1 rounded-xl bg-paradise-pink px-2 py-2 text-xs font-black text-white transition hover:bg-[#D84E99]"
                        >
                          Mensile
                        </button>
                        {!readOnly ? (
                          <div className="relative">
                            <Button 
                              variant="soft" 
                              onClick={() => toggleDropdown(group.id)} 
                              className="min-h-9 rounded-xl border-black/10 bg-black/[0.03] px-2 text-xs text-black shadow-none hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                          {activeDropdownId === group.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveDropdownId(null)} />
                              <div className="absolute right-0 bottom-full z-20 mb-2 w-56 rounded-2xl border border-black/10 bg-white py-1.5 text-left shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 dark:border-white/10 dark:bg-[#1B1A1F]">
                                {group.entrata ? (
                                  <button
                                    onClick={() => {
                                      editLog(group.entrata!);
                                      setActiveDropdownId(null);
                                    }}
                                    className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-1.5 rounded-full bg-emerald-500" />
                                      Modifica Entrata
                                    </span>
                                    <span className="text-black/40 dark:text-white/40">{group.entrata.time}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      createLogForGroup("ENTRATA", group.userId, group.dateStr);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#A74758] hover:bg-[#A74758]/5 flex items-center gap-1.5"
                                  >
                                    <Plus className="size-3" /> Aggiungi Entrata
                                  </button>
                                )}

                                {group.pausa ? (
                                  <button
                                    onClick={() => {
                                      editLog(group.pausa!);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-1.5 rounded-full bg-amber-500" />
                                      Modifica Pausa
                                    </span>
                                    <span className="text-black/40 dark:text-white/40">{group.pausa.time}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      createLogForGroup("PAUSA", group.userId, group.dateStr);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#A74758] hover:bg-[#A74758]/5 flex items-center gap-1.5"
                                  >
                                    <Plus className="size-3" /> Aggiungi Pausa
                                  </button>
                                )}

                                {group.rientro ? (
                                  <button
                                    onClick={() => {
                                      editLog(group.rientro!);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-1.5 rounded-full bg-amber-500" />
                                      Modifica Rientro
                                    </span>
                                    <span className="text-black/40 dark:text-white/40">{group.rientro.time}</span>
                                  </button>
                                ) : group.pausa ? (
                                  <button
                                    onClick={() => {
                                      createLogForGroup("RIENTRO", group.userId, group.dateStr);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#A74758] hover:bg-[#A74758]/5 flex items-center gap-1.5"
                                  >
                                    <Plus className="size-3" /> Aggiungi Rientro
                                  </button>
                                ) : null}

                                {group.uscita ? (
                                  <button
                                    onClick={() => {
                                      editLog(group.uscita!);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-1.5 rounded-full bg-neutral-500" />
                                      Modifica Uscita
                                    </span>
                                    <span className="text-black/40 dark:text-white/40">{group.uscita.time}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      createLogForGroup("USCITA", group.userId, group.dateStr);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#A74758] hover:bg-[#A74758]/5 flex items-center gap-1.5"
                                  >
                                    <Plus className="size-3" /> Aggiungi Uscita
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => createLogForGroup("USCITA", group.userId, group.dateStr)}
                          className="w-full rounded-xl border border-black/10 bg-white hover:bg-black/[0.02] dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5 dark:text-white/60 px-2 py-2 text-xs font-black text-black/60 transition shadow-sm text-center"
                        >
                          Fine turno
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {selectedWorker ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-2 backdrop-blur-sm sm:p-4">
          <Card className="max-h-[94vh] w-full max-w-7xl overflow-hidden border border-black/10 bg-white p-0 shadow-2xl hover:translate-y-0 dark:border-white/10 dark:bg-[#17161B]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 p-5 dark:border-white/10">
              <div className="flex items-center gap-4">
                <WorkerAvatar worker={selectedWorker} name={selectedWorker.name} size="lg" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-paradise-pink">Andamento mensile</p>
                  <h2 className="text-2xl font-black text-black dark:text-white">{selectedWorker.name}</h2>
                  <p className="text-sm font-semibold text-black/45 dark:text-white/45">{selectedWorker.location}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkerId(null)}
                className="grid size-10 place-items-center rounded-2xl border border-black/10 text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[calc(94vh-110px)] overflow-auto p-3 sm:p-5">
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {(["ENTRATA", "PAUSA", "RIENTRO", "USCITA"] as const).map((type) => (
                  <div key={type} className={`rounded-2xl border px-3 py-2 text-xs font-black sm:px-4 sm:py-3 sm:text-sm ${typeStyles[type]}`}>
                    {typeLabels[type]} · {selectedWorkerGroups
                      .filter((group) => {
                        const d = new Date(group.dateStr);
                        return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
                      })
                      .reduce((total, group) => total + group.allLogs.filter((log) => log.type === type).length, 0)}
                  </div>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Calendario timbrature</p>
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="grid size-8 place-items-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-black dark:text-white transition"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <h3 className="text-xl font-black capitalize text-black dark:text-white min-w-[140px] text-center">
                      {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(selectedMonth.year, selectedMonth.month, 1))}
                    </h3>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="grid size-8 place-items-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-black dark:text-white transition"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-paradise-softPink px-4 py-2 text-xs font-black text-black">
                  <CalendarDays className="size-4" /> Clicca un giorno per modificare
                </div>
              </div>

              <div className="grid grid-cols-7 overflow-hidden rounded-[18px] border border-black/10 bg-white dark:border-white/10 dark:bg-black/20 sm:rounded-[24px]">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                  <div key={day} className="border-b border-black/5 bg-black/[0.02] px-1 py-2 text-center text-[9px] font-black uppercase tracking-widest text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45 sm:px-3 sm:text-[10px]">
                    {day}
                  </div>
                ))}
                {selectedMonthDays.map((item) => {
                  const group = selectedWorkerGroups.find((entry) => entry.dateStr === item.dateStr);
                  if (!item.day) return <div key={item.key} className="min-h-28 border-r border-b border-black/5 bg-black/[0.01] dark:border-white/10 sm:min-h-36" />;
                  return (
                    <div key={item.key} className="min-h-28 border-r border-b border-black/5 p-1.5 dark:border-white/10 sm:min-h-36 sm:p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="grid size-7 place-items-center rounded-full bg-white text-xs font-black text-black shadow-sm dark:bg-white/10 dark:text-white sm:size-8 sm:text-sm">{item.day}</span>
                        {group ? <span className="size-2 rounded-full bg-emerald-500" /> : <span className="size-2 rounded-full bg-black/10 dark:bg-white/15" />}
                      </div>
                      {group ? (
                        <div className="space-y-1">
                          {(["ENTRATA", "PAUSA", "RIENTRO", "USCITA"] as const).map((type) => {
                            const log = group.allLogs.find((entry) => entry.type === type);
                            return (
                              <button
                                key={type}
                                type="button"
                                disabled={readOnly && !log}
                                onClick={() => {
                                  if (readOnly) return;
                                  if (log) editLog(log);
                                  else createLogForGroup(type, group.userId, group.dateStr);
                                }}
                                className={`grid w-full grid-cols-1 gap-0.5 rounded-xl border px-1.5 py-1 text-left text-[9px] font-bold sm:grid-cols-[1fr_auto] sm:items-center sm:gap-2 sm:px-2 sm:text-[11px] ${log ? typeStyles[type] : "border-black/5 bg-black/[0.02] text-black/35 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/35"}`}
                              >
                                <span className="truncate">{typeLabels[type]}</span>
                                <span className="font-black">{log ? visibleClockTime(log) : "+"}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => createLogForGroup("ENTRATA", selectedWorker.id, item.dateStr)}
                          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-black/10 px-1 py-2 text-[9px] font-black text-black/35 transition hover:border-paradise-pink hover:text-paradise-pink disabled:hover:border-black/10 disabled:hover:text-black/35 dark:border-white/10 dark:text-white/35 sm:mt-5 sm:px-2 sm:py-3 sm:text-[11px]"
                        >
                          <Plus className="size-3" /> Aggiungi
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Edit/Create Premium Dialog Modal */}
      {open && !readOnly ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 dark:bg-black/60 p-4 backdrop-blur-sm transition-all duration-300">
          <Card className="w-full max-w-xl shadow-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1B1A1F] overflow-hidden animate-in fade-in zoom-in-95 duration-200 hover:-translate-y-0">
            <div className="mb-6 flex justify-between items-start border-b border-black/5 dark:border-white/5 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-paradise-pink dark:text-[#F4A3C4]">Gestione Registro</p>
                <h2 className="mt-1 text-2xl font-bold text-black dark:text-white">{editingId ? "Modifica Timbratura" : "Nuova Timbratura"}</h2>
              </div>
              <button 
                className="grid size-9 place-items-center rounded-xl border border-black/10 dark:border-white/10 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2 block">
                <span className="text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60">Lavoratore</span>
                <Select value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })}>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id} className="dark:bg-[#1B1A1F] dark:text-white">
                      {worker.name} ({worker.location})
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60">Tipo</span>
                <Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                  <option value="ENTRATA" className="dark:bg-[#1B1A1F] dark:text-white">Entrata</option>
                  <option value="PAUSA" className="dark:bg-[#1B1A1F] dark:text-white">Pausa</option>
                  <option value="RIENTRO" className="dark:bg-[#1B1A1F] dark:text-white">Rientro</option>
                  <option value="USCITA" className="dark:bg-[#1B1A1F] dark:text-white">Uscita</option>
                </Select>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60">Data e ora</span>
                <Field type="datetime-local" value={draft.timestamp} onChange={(event) => setDraft({ ...draft, timestamp: event.target.value })} />
              </label>

              <label className="space-y-1.5 sm:col-span-2 block">
                <span className="text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60">Nota</span>
                <Field value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Es. uscita dimenticata, rientro posticipato..." />
              </label>
            </div>

            {message ? (
              <p className="mt-4 rounded-xl bg-paradise-nude text-xs font-semibold px-4 py-3 dark:bg-neutral-800 dark:text-white text-[#8B4452]">
                {message}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-black/5 pt-4 dark:border-white/5">
              {editingId ? (
                <Button
                  variant="soft"
                  onClick={deleteCurrentLog}
                  disabled={saving || deleting}
                  className="flex-1 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 sm:flex-initial"
                >
                  <Trash2 className="size-4" /> {deleting ? "Eliminazione..." : "Elimina"}
                </Button>
              ) : <span />}
              <div className="flex flex-1 justify-end gap-3 sm:flex-initial">
                <Button variant="soft" onClick={() => setOpen(false)} disabled={deleting} className="flex-1 sm:flex-initial">Annulla</Button>
                <Button className="flex-1 sm:flex-initial" onClick={save} disabled={saving || deleting}>
                <Save className="size-4" /> {saving ? "Salvataggio..." : "Salva Timbratura"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
