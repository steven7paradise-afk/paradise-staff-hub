"use client";

import { useState, useMemo } from "react";
import { Pencil, Plus, Save, X, Clock, Coffee, UserCheck, FileEdit, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Select } from "@/components/ui";

type Worker = { id: string; name: string; location: string };
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
};

const typeLabels: Record<string, string> = {
  ENTRATA: "Entrata",
  PAUSA: "Pausa",
  RIENTRO: "Rientro",
  USCITA: "Uscita"
};

function inputTimestamp(timestamp = new Date().toISOString()) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
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
      const datePart = log.timestamp.split("T")[0];
      return datePart === todayStr;
    });

    // Group logs by worker to find their latest status
    const latestStatusByEmployee: Record<string, { type: string; timestamp: string }> = {};
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (const log of sortedLogs) {
      latestStatusByEmployee[log.employee] = { type: log.type, timestamp: log.timestamp };
    }

    const activeWorkers = Object.values(latestStatusByEmployee).filter(
      status => status.type === "ENTRATA" || status.type === "RIENTRO"
    ).length;

    const onBreakWorkers = Object.values(latestStatusByEmployee).filter(
      status => status.type === "PAUSA"
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

  // Compute break duration helper
  const getBreakDuration = useMemo(() => {
    return (log: AttendanceLog) => {
      if (log.type !== "RIENTRO") return null;
      const logTime = new Date(log.timestamp).getTime();
      const previousPause = logs
        .filter(l => l.employee === log.employee && l.type === "PAUSA" && new Date(l.timestamp).getTime() < logTime)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (!previousPause) return null;
      const durationMs = logTime - new Date(previousPause.timestamp).getTime();
      const mins = Math.round(durationMs / (1000 * 60));
      return `${mins} min`;
    };
  }, [logs]);

  // Filter logs based on search and type
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.employee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "ALL" || log.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [logs, searchQuery, filterType]);

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
    const updated: AttendanceLog = {
      id: data.id,
      userId: draft.userId,
      employee: worker?.name ?? "",
      location: worker?.location ?? "",
      device: editingId ? "Correzione manuale Admin" : "Inserimento manuale Admin",
      type: draft.type,
      timestamp: data.timestamp,
      time: data.time,
      note: data.note ?? "",
    };
    setLogs((current) => editingId ? current.map((log) => log.id === editingId ? updated : log) : [updated, ...current]);
    router.refresh();
  }

  return (
    <>
      {/* Premium Stats Grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-500">
        <Card className="flex items-center gap-4 bg-white/70 backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm p-5 hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-paradise-softPink/40 dark:bg-paradise-pink/15 text-paradise-pink">
            <Clock className="size-6 text-[#A74758] dark:text-[#F4A3C4]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-black/55 dark:text-white/55 uppercase tracking-wide">Timbrature Oggi</p>
            <h3 className="text-2xl font-bold mt-0.5 text-black dark:text-white">{stats.todayCount}</h3>
          </div>
        </Card>
        
        <Card className="flex items-center gap-4 bg-white/70 backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm p-5 hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <UserCheck className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-black/55 dark:text-white/55 uppercase tracking-wide">Dipendenti in Sede</p>
            <h3 className="text-2xl font-bold mt-0.5 text-black dark:text-white">{stats.activeWorkers}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-white/70 backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm p-5 hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-paradise-gold/15 text-paradise-gold">
            <Coffee className="size-6 text-[#9E7A3B] dark:text-paradise-gold" />
          </div>
          <div>
            <p className="text-xs font-semibold text-black/55 dark:text-white/55 uppercase tracking-wide">In Pausa</p>
            <h3 className="text-2xl font-bold mt-0.5 text-black dark:text-white">{stats.onBreakWorkers}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-white/70 backdrop-blur-md dark:bg-[#1B1A1F]/70 border-black/5 dark:border-white/5 shadow-sm p-5 hover:translate-y-[-2px] hover:shadow-md transition-all duration-300">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
            <FileEdit className="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-black/55 dark:text-white/55 uppercase tracking-wide">Variazioni Manuali</p>
            <h3 className="text-2xl font-bold mt-0.5 text-black dark:text-white">{stats.manualCorrections}</h3>
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

      {/* Premium Table Layout */}
      <Card className="overflow-hidden p-0 border border-black/5 dark:border-white/10 shadow-sm hover:translate-y-0">
        {filteredLogs.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/45 dark:text-white/45">
            Nessuna timbratura registrata corrispondente ai criteri di ricerca.
          </p>
        ) : (
          <>
            {/* Desktop Table Header */}
            <div className={`hidden md:grid gap-4 bg-black/[0.02] dark:bg-white/[0.01] px-6 py-4 border-b border-black/5 dark:border-white/5 text-xs font-bold uppercase tracking-wider text-black/55 dark:text-white/55 ${readOnly ? "grid-cols-[1.5fr_0.8fr_1fr_1.2fr_1.8fr]" : "grid-cols-[1.5fr_0.8fr_1fr_1.2fr_1.8fr_auto]"}`}>
              <div>Dipendente</div>
              <div>Stato</div>
              <div>Data e Ora</div>
              <div>Durata Pausa</div>
              <div>Nota / Dispositivo</div>
              {!readOnly && <div className="text-right">Azioni</div>}
            </div>

            {/* Logs List */}
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {filteredLogs.map((log) => {
                const breakDuration = getBreakDuration(log);
                
                return (
                  <div key={log.id} className="transition-all duration-150 hover:bg-black/[0.005] dark:hover:bg-white/[0.005]">
                    {/* Desktop Row */}
                    <div className={`hidden md:grid gap-4 items-center px-6 py-4 ${readOnly ? "grid-cols-[1.5fr_0.8fr_1fr_1.2fr_1.8fr]" : "grid-cols-[1.5fr_0.8fr_1fr_1.2fr_1.8fr_auto]"}`}>
                      <div>
                        <p className="font-semibold text-black dark:text-white text-[15px]">{log.employee}</p>
                        <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">{log.location}</p>
                      </div>
                      
                      <div>
                        <Badge tone={log.type === "ENTRATA" || log.type === "RIENTRO" ? "green" : log.type === "PAUSA" ? "gold" : "dark"}>
                          {typeLabels[log.type]}
                        </Badge>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium text-black/80 dark:text-white/80">{new Intl.DateTimeFormat("it-IT").format(new Date(log.timestamp))}</p>
                        <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">{log.time}</p>
                      </div>

                      <div>
                        {breakDuration ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-paradise-gold/10 text-[#9E7A3B] dark:text-paradise-gold border border-paradise-gold/20">
                            <Coffee className="size-3" />
                            {breakDuration}
                          </span>
                        ) : (
                          <span className="text-xs text-black/30 dark:text-white/30">—</span>
                        )}
                      </div>

                      <div className="text-xs pr-2">
                        <p className="font-medium text-black/60 dark:text-white/60 line-clamp-1">{log.device}</p>
                        {log.note ? (
                          <p className="text-black/40 dark:text-white/40 mt-0.5 italic line-clamp-1">"{log.note}"</p>
                        ) : null}
                      </div>

                      {!readOnly && (
                        <div className="text-right">
                          <Button variant="soft" onClick={() => editLog(log)} className="min-h-9 px-3.5 py-1.5 text-xs rounded-xl shadow-none">
                            <Pencil className="size-3.5 mr-1" /> Modifica
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Mobile Card Row */}
                    <div className="md:hidden block p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-black dark:text-white text-[15px]">{log.employee}</p>
                          <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">{log.location}</p>
                        </div>
                        <Badge tone={log.type === "ENTRATA" || log.type === "RIENTRO" ? "green" : log.type === "PAUSA" ? "gold" : "dark"}>
                          {typeLabels[log.type]}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                        <div>
                          <span className="text-[11px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider block">Data e Ora</span>
                          <span className="font-medium text-black/80 dark:text-white/80">{new Intl.DateTimeFormat("it-IT").format(new Date(log.timestamp))} - {log.time}</span>
                        </div>
                        {breakDuration && (
                          <div>
                            <span className="text-[11px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider block">Durata Pausa</span>
                            <span className="font-semibold text-[#9E7A3B] dark:text-paradise-gold flex items-center gap-1 mt-0.5">
                              <Coffee className="size-3.5" /> {breakDuration}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs pt-2 border-t border-black/5 dark:border-white/5 space-y-1">
                        <p className="font-medium text-black/60 dark:text-white/60">{log.device}</p>
                        {log.note ? (
                          <p className="text-black/45 dark:text-white/45 italic">Nota: "{log.note}"</p>
                        ) : null}
                      </div>

                      {!readOnly && (
                        <div className="flex pt-2">
                          <Button variant="soft" className="w-full min-h-10 rounded-xl" onClick={() => editLog(log)}>
                            <Pencil className="size-4 mr-1.5" /> Modifica
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

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

            <div className="mt-6 flex justify-end gap-3 border-t border-black/5 dark:border-white/5 pt-4">
              <Button variant="soft" onClick={() => setOpen(false)} className="flex-1 sm:flex-initial">Annulla</Button>
              <Button className="flex-1 sm:flex-initial" onClick={save} disabled={saving}>
                <Save className="size-4" /> {saving ? "Salvataggio..." : "Salva Timbratura"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
