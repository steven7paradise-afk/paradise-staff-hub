"use client";

import { useState } from "react";
import { Check, Send, X, Flag, Calendar, Clock, User, Heart, Coffee, FileText, Sparkles, Plus } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type RequestRecord = {
  id: string;
  employee: string;
  type: "FERIE" | "PERMESSO" | "RIPOSO" | "MALATTIA" | "ALTRO";
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
};

type WorkerOption = { id: string; name: string; location: string | null };

const typeLabels = { FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", MALATTIA: "Malattia", ALTRO: "Altro" };
const statusLabels = { PENDING: "In attesa", APPROVED: "Approvata", REJECTED: "Rifiutata", FLAGGED: "Segnalata" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function displayRange(request: RequestRecord) {
  const dateRange = `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;
  if (!request.startTime || !request.endTime) return dateRange;
  return `${dateRange}, ${request.startTime} - ${request.endTime}`;
}

function getRequestIcon(type: string) {
  switch (type) {
    case "FERIE":
      return <Sparkles className="size-4 text-paradise-gold" />;
    case "PERMESSO":
      return <Clock className="size-4 text-[#B85B68]" />;
    case "MALATTIA":
      return <Heart className="size-4 text-red-500 animate-pulse" style={{ animationDuration: '3s' }} />;
    case "RIPOSO":
      return <Coffee className="size-4 text-amber-700" />;
    default:
      return <FileText className="size-4 text-blue-500" />;
  }
}

function DatePickerStable({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const current = value ? new Date(`${value}T00:00:00.000Z`) : null;
  const today = new Date();
  const selectedYear = current?.getUTCFullYear() ?? today.getFullYear();
  const selectedMonth = current ? current.getUTCMonth() + 1 : today.getMonth() + 1;
  const selectedDay = current?.getUTCDate() ?? today.getDate();
  const years = Array.from({ length: 5 }, (_, index) => today.getFullYear() - 1 + index);
  const days = Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, index) => index + 1);

  function update(day: number, month: number, year: number) {
    const safeDay = Math.min(day, new Date(year, month, 0).getDate());
    onChange(`${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
  }

  return (
    <label className="space-y-2">
      <span className="text-xs font-bold tracking-wide uppercase text-black/55">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        <Select value={selectedDay} onChange={(event) => update(Number(event.target.value), selectedMonth, selectedYear)}>
          {days.map((day) => <option key={day} value={day}>{day}</option>)}
        </Select>
        <Select value={selectedMonth} onChange={(event) => update(selectedDay, Number(event.target.value), selectedYear)}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}
        </Select>
        <Select value={selectedYear} onChange={(event) => update(selectedDay, selectedMonth, Number(event.target.value))}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </Select>
      </div>
    </label>
  );
}

export function RequestManager({ initialRequests, role, workers }: { initialRequests: RequestRecord[]; role: Role; workers: WorkerOption[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [openForm, setOpenForm] = useState(false);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({ userId: workers[0]?.id ?? "", type: "FERIE", startDate: todayValue, endDate: todayValue, startTime: "", endTime: "", reason: "", approveNow: false });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const employeeView = role === "DIPENDENTE";
  const canApprove = role === "ADMIN" || role === "SUPER_ADMIN";
  const canCreateForWorkers = role === "ADMIN" || role === "SUPER_ADMIN";

  async function createRequest() {
    if (!form.startDate || !form.endDate) {
      setMessage("Scegli la data iniziale e finale.");
      return;
    }
    setSaving("create");
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: canCreateForWorkers ? form.userId : undefined }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Richiesta non salvata.");
      return;
    }
    const savedRequest = data.leaveRequest ?? data;
    setRequests((current) => [{
      id: savedRequest.id,
      employee: savedRequest.user.name,
      type: savedRequest.type,
      startDate: savedRequest.start_date,
      endDate: savedRequest.end_date,
      startTime: savedRequest.start_time,
      endTime: savedRequest.end_time,
      reason: savedRequest.reason,
      status: savedRequest.status,
    }, ...current]);
    setForm({ userId: workers[0]?.id ?? "", type: "FERIE", startDate: todayValue, endDate: todayValue, startTime: "", endTime: "", reason: "", approveNow: false });
    setOpenForm(false);
    if (savedRequest.status === "APPROVED") {
      if (data.calendarSync?.skipped) {
        setMessage(`Richiesta approvata e inserita nel planning. Calendar non sincronizzato: ${data.calendarSync.reason}`);
      } else {
        setMessage("Richiesta approvata, inserita nel planning e sincronizzata su Google Calendar.");
      }
      return;
    }
    setMessage("Richiesta inviata correttamente.");
  }

  async function changeStatus(id: string, status: "APPROVED" | "REJECTED" | "FLAGGED") {
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Operazione non salvata.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status: data.leaveRequest.status } : request));
    if (status === "APPROVED" && data.calendarSync?.skipped) {
      setMessage(`Richiesta approvata e inserita nel planning. Calendar non sincronizzato: ${data.calendarSync.reason}`);
      return;
    }
    setMessage(status === "APPROVED" ? "Richiesta approvata, inserita nel planning e sincronizzata su Google Calendar." : "Stato richiesta aggiornato.");
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button 
          onClick={() => setOpenForm((current) => !current)}
          className="rounded-[20px] bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury transition-all duration-300"
        >
          {openForm ? <X className="size-4" /> : <Plus className="size-4" />} 
          {openForm ? "Annulla" : (canCreateForWorkers ? "Aggiungi richiesta" : "Invia nuova richiesta")}
        </Button>
      </div>

      {openForm ? (
        <Card className="mb-6 border border-white/50 bg-white/95 shadow-soft max-w-4xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="mb-4 border-b border-black/5 pb-4">
            <h2 className="text-base font-bold text-paradise-noir flex items-center gap-2">
              <Calendar className="size-5 text-[#B85B68]" />
              {canCreateForWorkers ? "Compila ferie / permesso per dipendente" : "Invia richiesta personale"}
            </h2>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {canCreateForWorkers ? (
              <label className="space-y-2">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Dipendente</span>
                <Select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}>
                  {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}{worker.location ? ` - ${worker.location}` : ""}</option>)}
                </Select>
              </label>
            ) : null}
            <label className="space-y-2">
              <span className="text-xs font-bold tracking-wide uppercase text-black/55">Tipo Richiesta</span>
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-bold tracking-wide uppercase text-black/55">Motivo / Note</span>
              <Field placeholder="Descrivi il motivo della richiesta..." value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </label>
            <DatePickerStable label="Data Inizio (Dal)" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate, endDate: form.endDate < startDate ? startDate : form.endDate })} />
            <DatePickerStable label="Data Fine (Al)" value={form.endDate} onChange={(endDate) => setForm({ ...form, endDate })} />
            <label className="space-y-2">
              <span className="text-xs font-bold tracking-wide uppercase text-black/55">Ora Inizio (Opzionale)</span>
              <Field type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold tracking-wide uppercase text-black/55">Ora Fine (Opzionale)</span>
              <Field type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </label>
            {canCreateForWorkers ? (
              <label className="flex items-center gap-3 rounded-2xl bg-paradise-nude/40 border border-paradise-pink/20 px-4 py-3 text-sm font-semibold select-none sm:col-span-2 hover:bg-paradise-nude/65 transition-colors cursor-pointer">
                <input type="checkbox" className="size-4 accent-[#B85B68]" checked={form.approveNow} onChange={(event) => setForm({ ...form, approveNow: event.target.checked })} />
                Approva immediatamente e sincronizza sul planning
              </label>
            ) : null}
          </div>

          <div className="mt-5 flex justify-end">
            <Button className="w-full sm:w-auto" onClick={createRequest} disabled={saving === "create"}>
              <Send className="size-4 animate-pulse" /> {saving === "create" ? "Invio..." : canCreateForWorkers ? "Salva Richiesta" : "Invia Richiesta"}
            </Button>
          </div>
        </Card>
      ) : null}

      {message ? (
        <p className="mb-6 rounded-[20px] bg-gradient-to-r from-paradise-softPink/30 to-paradise-nude/40 border border-paradise-pink/20 px-5 py-3 text-sm font-semibold text-[#B85B68] animate-in fade-in">
          {message}
        </p>
      ) : null}

      {/* Grid of leave requests */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {requests.length === 0 ? (
          <Card className="text-sm text-black/45 border border-black/5 bg-white/70 py-10 text-center col-span-full">
            <Calendar className="size-8 mx-auto text-black/20 mb-2" />
            Nessuna richiesta inserita in archivio.
          </Card>
        ) : null}
        
        {requests.map((request) => {
          const isPending = request.status === "PENDING";
          const isApproved = request.status === "APPROVED";
          const isRejected = request.status === "REJECTED";
          const isFlagged = request.status === "FLAGGED";
          
          return (
            <Card 
              key={request.id}
              className={cn(
                "relative overflow-hidden p-5 border transition-all duration-300 hover:shadow-luxury bg-white/95",
                isApproved && "border-emerald-500/30 bg-gradient-to-br from-white to-emerald-500/5",
                isRejected && "border-rose-500/20 bg-gradient-to-br from-white to-rose-500/5",
                isFlagged && "border-paradise-gold/30 bg-gradient-to-br from-white to-paradise-gold/5",
                isPending && "border-black/5"
              )}
            >
              {/* Colored status line indicator */}
              <div 
                className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  isApproved && "bg-emerald-500",
                  isRejected && "bg-rose-500",
                  isFlagged && "bg-paradise-gold",
                  isPending && "bg-neutral-300"
                )}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {/* Category icon indicator */}
                  <div className={cn(
                    "flex size-9 items-center justify-center rounded-xl shadow-sm border",
                    isApproved && "bg-emerald-500/10 border-emerald-500/20",
                    isRejected && "bg-rose-500/10 border-rose-500/20",
                    isFlagged && "bg-paradise-gold/15 border-paradise-gold/30",
                    isPending && "bg-neutral-50 border-neutral-200"
                  )}>
                    {getRequestIcon(request.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-paradise-noir">
                      {typeLabels[request.type] || request.type}
                    </h3>
                    <p className="text-[10px] text-black/40 font-semibold tracking-wide uppercase mt-0.5">
                      Categoria
                    </p>
                  </div>
                </div>

                <Badge tone={isApproved ? "green" : isFlagged ? "gold" : "pink"}>
                  {statusLabels[request.status]}
                </Badge>
              </div>

              {/* Date details and duration */}
              <div className="mt-4 rounded-xl border border-black/5 bg-neutral-50/50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-paradise-noir">
                  <Calendar className="size-3.5 text-black/35" />
                  <span>{formatDate(request.startDate)}</span>
                  <span className="text-black/30">→</span>
                  <span>{formatDate(request.endDate)}</span>
                </div>
                
                {(request.startTime || request.endTime) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-black/55 border-t border-black/5 pt-2">
                    <Clock className="size-3.5 text-black/35" />
                    <span>Orario: <strong>{request.startTime ?? "--:--"} - {request.endTime ?? "--:--"}</strong></span>
                  </div>
                )}
              </div>

              {/* Notes block */}
              <div className="mt-4 min-h-[48px] rounded-xl border border-neutral-100 bg-neutral-50/30 px-3.5 py-2.5 text-xs text-black/60 italic leading-relaxed">
                {request.reason ? `"${request.reason}"` : "Nessuna motivazione inserita."}
              </div>

              {/* Employee ID tag if manager view */}
              {!employeeView && (
                <div className="mt-4 flex items-center gap-2.5 border-t border-black/5 pt-3.5">
                  <div className="flex size-7.5 items-center justify-center rounded-full bg-paradise-pink/20 text-[#B85B68] text-xs font-extrabold shadow-sm border border-paradise-pink/30">
                    {request.employee.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-paradise-noir leading-none">{request.employee}</p>
                    <p className="text-[9px] text-black/40 font-semibold uppercase tracking-wide mt-0.5">Dipendente</p>
                  </div>
                </div>
              )}

              {/* Manager decision actions */}
              {canApprove && isPending && (
                <div className="mt-5 flex gap-2 border-t border-black/5 pt-4">
                  <button 
                    disabled={saving === request.id} 
                    onClick={() => changeStatus(request.id, "APPROVED")}
                    className="flex-1 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-sm hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Approva
                  </button>
                  <button 
                    disabled={saving === request.id} 
                    onClick={() => changeStatus(request.id, "REJECTED")}
                    className="flex-1 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold text-xs shadow-sm hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    <X className="size-3.5" /> Rifiuta
                  </button>
                </div>
              )}

              {role === "RESPONSABILE" && isPending && (
                <div className="mt-4 border-t border-black/5 pt-4">
                  <button 
                    disabled={saving === request.id} 
                    onClick={() => changeStatus(request.id, "FLAGGED")}
                    className="w-full flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-paradise-gold/20 border border-paradise-gold/30 text-amber-800 font-bold text-xs shadow-sm hover:bg-paradise-gold/30 transition-colors disabled:opacity-50"
                  >
                    <Flag className="size-3.5" /> Segnala ad Admin
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

