"use client";

import React, { useMemo, useState } from "react";
import { 
  Heart, 
  Calendar, 
  Search, 
  User, 
  Check, 
  X, 
  AlertCircle, 
  ShieldCheck, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  UserRound,
  ExternalLink
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type SickRequest = {
  id: string;
  userId: string;
  employeeName: string;
  employeePhoto: string | null;
  employeeFiscalCode: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
  medicalCode: string | null;
  sicknessUnjustified: boolean;
};

type WorkerOption = { id: string; name: string; photoUrl: string | null };

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
}

function calculateDays(start: string, end: string) {
  const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

export function MalattieManager({
  initialRequests,
  workers,
  currentRole,
  monthLabel,
  prevMonthUrl,
  nextMonthUrl,
}: {
  initialRequests: SickRequest[];
  workers: WorkerOption[];
  currentRole: string;
  monthLabel: string;
  prevMonthUrl: string;
  nextMonthUrl: string;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [inpsVerifier, setInpsVerifier] = useState<{ employeeName: string; fiscalCode: string; protocolCode: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"cf" | "protocol" | null>(null);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = req.reason?.toLowerCase().includes(query) || req.medicalCode?.toLowerCase().includes(query);
        const matchUser = req.employeeName.toLowerCase().includes(query);
        if (!matchTitle && !matchUser) return false;
      }
      if (selectedWorkerId && req.userId !== selectedWorkerId) {
        return false;
      }
      return true;
    });
  }, [requests, searchQuery, selectedWorkerId]);

  // Statistics calculations based on filtered requests
  const stats = useMemo(() => {
    let totalDays = 0;
    let justifiedCount = 0;
    let unjustifiedCount = 0;

    filteredRequests.forEach((req) => {
      const days = calculateDays(req.startDate, req.endDate);
      totalDays += days;
      if (req.medicalCode) {
        justifiedCount += days;
      } else {
        unjustifiedCount += days;
      }
    });

    return { totalDays, justifiedCount, unjustifiedCount };
  }, [filteredRequests]);

  const workerStats = useMemo(() => {
    return workers.map((worker) => {
      // Find all sick requests for this worker in the currently selected period (filteredRequests)
      const workerRequests = filteredRequests.filter((r) => r.userId === worker.id);
      const totalRequests = workerRequests.length;
      
      let totalDays = 0;
      let justifiedDays = 0;
      let unjustifiedDays = 0;
      
      workerRequests.forEach((req) => {
        const days = calculateDays(req.startDate, req.endDate);
        totalDays += days;
        if (req.medicalCode) {
          justifiedDays += days;
        } else {
          unjustifiedDays += days;
        }
      });

      // status: 'none' (no sick leave), 'justified' (has sick leave, all are justified), 'unjustified' (has sick leave, at least one unjustified)
      const status = totalDays === 0 
        ? "none" 
        : (unjustifiedDays === 0 ? "justified" : "unjustified");

      return {
        id: worker.id,
        name: worker.name,
        photoUrl: worker.photoUrl,
        days: totalDays,
        count: totalRequests,
        status,
        justifiedDays,
        unjustifiedDays
      };
    }).sort((a, b) => {
      // Sort: show unjustified first (red), then justified (green), then none (present) sorted by name
      if (a.status === "unjustified" && b.status !== "unjustified") return -1;
      if (a.status !== "unjustified" && b.status === "unjustified") return 1;
      if (a.status === "justified" && b.status === "none") return -1;
      if (a.status === "none" && b.status === "justified") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredRequests, workers]);

  async function handleUpdateCode(id: string, code: string) {
    setSavingId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicalCode: code || null })
      });
      if (!res.ok) throw new Error("Errore durante l'aggiornamento.");
      const data = await res.json();
      setRequests((curr) => curr.map((r) => r.id === id ? { ...r, medicalCode: data.leaveRequest.medical_code } : r));
      setMessage("Codice medico aggiornato con successo.");
    } catch (err) {
      alert("Impossibile salvare il codice certificato. Riprova.");
    } finally {
      setSavingId("");
    }
  }

  async function handleStatusChange(id: string, status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED") {
    setSavingId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Errore durante l'aggiornamento.");
      const data = await res.json();
      setRequests((curr) => curr.map((r) => r.id === id ? { ...r, status: data.leaveRequest.status } : r));
      setMessage("Stato della richiesta aggiornato con successo.");
    } catch (err) {
      alert("Impossibile aggiornare lo stato. Riprova.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Statistics Card */}
      <section className="relative overflow-hidden rounded-[36px] bg-[#050608] pt-12 pb-5 px-5 text-white shadow-2xl p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(239,68,68,0.22),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(251,146,60,0.18),transparent_30%),linear-gradient(135deg,#050608,#0f172a_62%,#0f172a)]" />
        <div className="absolute -left-24 top-8 size-80 rounded-full border border-white/10" />
        <div className="absolute -left-12 top-16 size-64 rounded-full border border-white/10" />
        
        <div className="relative flex flex-col gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
              <Activity className="size-4 text-red-300 animate-pulse" />
              Gestione Assenze & Malattie
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Registro Malattie Staff
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
              Pannello amministrativo per monitorare i giorni di malattia dello staff, verificare i codici di protocollo INPS e controllare le assenze giustificate.
            </p>
            
            {/* Month Selector */}
            <div className="mt-6 flex items-center gap-2">
              <Button
                onClick={() => router.push(prevMonthUrl)}
                className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95 p-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="rounded-2xl bg-white px-4 py-2 text-xs font-black capitalize text-black min-w-[120px] text-center shadow-md">
                {monthLabel}
              </span>
              <Button
                onClick={() => router.push(nextMonthUrl)}
                className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95 p-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/10 to-rose-500/2 text-rose-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Giorni Malattia Totali</span>
                <Heart className="size-4 opacity-80" />
              </div>
              <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                {stats.totalDays} giorni
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-emerald-500/2 text-emerald-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Malattia Giustificata</span>
                <ShieldCheck className="size-4 opacity-80" />
              </div>
              <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                {stats.justifiedCount} giorni
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/15 bg-gradient-to-br from-red-500/10 to-red-500/2 text-red-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Assenza Non Giustificata</span>
                <AlertCircle className="size-4 opacity-80 animate-pulse" />
              </div>
              <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                {stats.unjustifiedCount} giorni
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Card */}
      {workerStats.length > 0 && (
        <Card className="p-6 bg-white shadow-xl border border-black/5 dark:bg-[#121212] dark:border-white/5">
          <div className="flex items-center gap-2 mb-4 border-b border-black/5 dark:border-white/5 pb-3">
            <TrendingUp className="size-5 text-red-500" />
            <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
              Analisi e Report Dipendenti
            </h2>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workerStats.map((stat, idx) => {
              const isUnjustified = stat.status === "unjustified";
              const isJustified = stat.status === "justified";
              const isNone = stat.status === "none";

              return (
                <div 
                  key={idx} 
                  className={cn(
                    "flex items-center gap-3.5 p-4 rounded-3xl border transition hover:scale-[1.02] duration-300",
                    isUnjustified && "bg-rose-50/60 border-rose-200/80 dark:bg-rose-950/10 dark:border-rose-900/30 text-rose-900 dark:text-rose-200",
                    isJustified && "bg-emerald-50/60 border-emerald-200/80 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200",
                    isNone && "bg-neutral-50/50 border-neutral-200/50 dark:bg-white/[0.01] dark:border-white/5 text-neutral-800 dark:text-neutral-200"
                  )}
                >
                  {stat.photoUrl ? (
                    <img
                      src={stat.photoUrl}
                      alt={stat.name}
                      className={cn(
                        "size-12 rounded-full object-cover shadow-sm shrink-0 border-2",
                        isUnjustified && "border-rose-300",
                        isJustified && "border-emerald-300",
                        isNone && "border-neutral-200"
                      )}
                    />
                  ) : (
                    <div 
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full text-sm font-black border shrink-0",
                        isUnjustified && "bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
                        isJustified && "bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
                        isNone && "bg-neutral-100 border-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      )}
                    >
                      {stat.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-snug">{stat.name}</p>
                    
                    <div className="mt-1 flex flex-col gap-1">
                      {isNone ? (
                        <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 leading-none">
                          <Check className="size-3 shrink-0" /> Nessuna assenza
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {stat.justifiedDays > 0 && (
                            <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 leading-none">
                              <ShieldCheck className="size-3 shrink-0 text-emerald-500" /> Giustificati: {stat.justifiedDays} gg
                            </span>
                          )}
                          {stat.unjustifiedDays > 0 && (
                            <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5 leading-none">
                              <AlertCircle className="size-3 shrink-0 text-rose-500 animate-pulse" /> Ingiustificati: {stat.unjustifiedDays} gg
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters section */}
      <Card className="p-4 bg-white shadow-md border border-black/5 dark:bg-[#121212] dark:border-white/5 flex flex-col sm:flex-row gap-4 items-center">
        {/* Search bar */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Cerca per dipendente, codice ricetta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-semibold outline-none focus:border-red-500 transition"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-black/30 dark:text-white/30" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-black/30 dark:text-white/30 hover:text-black/60">
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Employee Dropdown filter */}
        <div className="w-full sm:w-64">
          <Select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full h-11 text-xs"
          >
            <option value="">Tutti i dipendenti</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {message && (
        <p className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 px-5 py-3 text-xs font-bold text-emerald-800 animate-in fade-in">
          {message}
        </p>
      )}

      {/* Main Grid / List */}
      <Card className="overflow-hidden bg-white shadow-xl border border-black/5 dark:bg-[#121212] dark:border-white/5 p-0">
        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-black/45 dark:text-white/45">
              Nessuna pratica di malattia registrata nel periodo selezionato.
            </div>
          ) : (
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[#FAF7F9] dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45 border-b border-black/5 dark:border-white/5">
                <tr>
                  <th className="px-5 py-4">Dipendente</th>
                  <th className="px-5 py-4">Periodo</th>
                  <th className="px-5 py-4 text-center">Giorni</th>
                  <th className="px-5 py-4">Certificato INPS (Giustificativo)</th>
                  <th className="px-5 py-4">Motivazione dello Staff</th>
                  <th className="px-5 py-4">Approvazione / Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-[#121212]">
                {filteredRequests.map((req) => {
                  const daysCount = calculateDays(req.startDate, req.endDate);
                  const isPending = req.status === "PENDING";
                  const isApproved = req.status === "APPROVED";
                  const isRejected = req.status === "REJECTED";
                  const isFlagged = req.status === "FLAGGED";

                  return (
                    <tr key={req.id} className="align-top hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          {req.employeePhoto ? (
                            <img
                              src={req.employeePhoto}
                              alt={req.employeeName}
                              className="size-8 rounded-full object-cover border border-black/10 shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="flex size-8 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-black shadow-sm shrink-0">
                              {req.employeeName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-black dark:text-white block leading-tight">{req.employeeName}</span>
                            {req.employeeFiscalCode ? (
                              <div className="flex items-center gap-1.5 mt-1 shrink-0">
                                <span className="text-[9.5px] font-mono font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded uppercase select-all">
                                  {req.employeeFiscalCode}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(req.employeeFiscalCode || "");
                                    setMessage(`Codice Fiscale di ${req.employeeName} copiato negli appunti!`);
                                  }}
                                  className="text-[9px] font-black text-cyan-600 hover:text-cyan-700 active:scale-95 transition shrink-0"
                                  title="Copia Codice Fiscale"
                                >
                                  Copia
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-wide">Dipendente</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-black dark:text-white">
                          <span>{formatDate(req.startDate)}</span>
                          <span className="text-black/30">→</span>
                          <span>{formatDate(req.endDate)}</span>
                        </div>
                        {req.startTime && (
                          <span className="text-[10px] text-black/45 block mt-1">Orario: {req.startTime} - {req.endTime}</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center font-black text-black dark:text-white">
                        {daysCount}
                      </td>

                      <td className="px-5 py-4 max-w-[280px]">
                        <div className="space-y-2">
                          {req.medicalCode ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                                <span className="font-mono">{req.medicalCode}</span>
                              </div>
                              <button
                                onClick={() => {
                                  setInpsVerifier({
                                    employeeName: req.employeeName,
                                    fiscalCode: req.employeeFiscalCode || "",
                                    protocolCode: req.medicalCode || "",
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 border border-cyan-200 dark:border-cyan-800 bg-cyan-50/10 px-2 py-1 rounded-lg transition"
                                title="Apri assistente verifica INPS"
                              >
                                <ExternalLink className="size-3" /> Verifica INPS
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200 animate-pulse">
                              <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
                              <span>Senza Certificato</span>
                            </div>
                          )}

                          {/* Quick Edit Input for medical code */}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Inserisci o modifica codice"
                              defaultValue={req.medicalCode || ""}
                              id={`admin-code-input-${req.id}`}
                              className="h-8 w-44 rounded-lg border border-black/10 bg-transparent px-2 text-xs outline-none focus:border-red-500"
                            />
                            <button
                              onClick={() => {
                                const inputVal = (document.getElementById(`admin-code-input-${req.id}`) as HTMLInputElement)?.value?.trim() || "";
                                handleUpdateCode(req.id, inputVal);
                              }}
                              disabled={savingId === req.id}
                              className="h-8 px-2.5 rounded-lg bg-neutral-900 text-white text-[11px] font-bold active:scale-95 transition shrink-0 hover:bg-neutral-800"
                            >
                              Salva
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-[220px]">
                        <p className="text-xs text-black/75 dark:text-white/75 leading-relaxed break-words">
                          {req.reason ? `"${req.reason}"` : "Nessuna nota inserita."}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <select
                            value={req.status}
                            disabled={savingId === req.id}
                            onChange={(e) => handleStatusChange(req.id, e.target.value as any)}
                            className={cn(
                              "h-9 w-full rounded-xl border px-3 text-xs font-bold outline-none transition shadow-sm cursor-pointer",
                              req.status === "APPROVED" && "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400",
                              req.status === "REJECTED" && "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400",
                              req.status === "PENDING" && "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400",
                              req.status === "FLAGGED" && "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-900/30 dark:text-orange-400"
                            )}
                          >
                            <option value="PENDING" className="text-black bg-white dark:bg-[#121212] dark:text-white">In attesa</option>
                            <option value="APPROVED" className="text-black bg-white dark:bg-[#121212] dark:text-white">Approvata</option>
                            <option value="REJECTED" className="text-black bg-white dark:bg-[#121212] dark:text-white">Rifiutata</option>
                            <option value="FLAGGED" className="text-black bg-white dark:bg-[#121212] dark:text-white">Segnalata</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {inpsVerifier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-[#121212] border border-black/10 dark:border-white/10 shadow-2xl rounded-3xl relative">
            <button 
              onClick={() => setInpsVerifier(null)} 
              className="absolute right-4 top-4 size-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-black/50 dark:text-white/50 transition"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4 mb-5">
              <ShieldCheck className="size-6 text-cyan-600" />
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white">Assistente Verifica INPS</h3>
                <p className="text-[11px] text-black/40 dark:text-white/40 font-semibold">{inpsVerifier.employeeName}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Fiscal Code field */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/40 dark:text-white/40">1. Codice Fiscale</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-neutral-50 dark:bg-white/[0.02] border border-black/10 dark:border-white/10 px-3 py-2 rounded-xl text-xs font-mono font-bold text-black dark:text-white select-all">
                    {inpsVerifier.fiscalCode || "NON IMPOSTATO"}
                  </div>
                  {inpsVerifier.fiscalCode ? (
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(inpsVerifier.fiscalCode);
                        setCopiedField("cf");
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className={cn(
                        "h-9 px-4 rounded-xl text-xs font-bold text-white shrink-0 shadow-sm transition-all duration-300",
                        copiedField === "cf" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-cyan-600 hover:bg-cyan-700"
                      )}
                    >
                      {copiedField === "cf" ? "Copiato!" : "Copia"}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-rose-500 font-bold">Imposta nel profilo</span>
                  )}
                </div>
              </div>

              {/* Protocol Code field */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/40 dark:text-white/40">2. Numero Protocollo (PUC)</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-neutral-50 dark:bg-white/[0.02] border border-black/10 dark:border-white/10 px-3 py-2 rounded-xl text-xs font-mono font-bold text-black dark:text-white select-all">
                    {inpsVerifier.protocolCode}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(inpsVerifier.protocolCode);
                      setCopiedField("protocol");
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className={cn(
                      "h-9 px-4 rounded-xl text-xs font-bold text-white shrink-0 shadow-sm transition-all duration-300",
                      copiedField === "protocol" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-cyan-600 hover:bg-cyan-700"
                    )}
                  >
                    {copiedField === "protocol" ? "Copiato!" : "Copia"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 flex gap-3">
              <Button
                onClick={() => setInpsVerifier(null)}
                className="flex-1 h-10 rounded-xl text-xs font-bold border border-black/10 bg-transparent text-black hover:bg-neutral-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
              >
                Chiudi
              </Button>
              <a
                href="https://serviziweb2.inps.it/AS0207/AttestatiMalCittadino/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 rounded-xl text-xs font-bold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 flex items-center justify-center gap-1.5 shadow-md"
              >
                <ExternalLink className="size-3.5" /> Apri Portale INPS
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
