"use client";

import { useState } from "react";
import { Check, Send, X, Flag, Calendar, Clock, User, Heart, Coffee, FileText, Sparkles, Plus, AlertCircle, ShieldCheck } from "lucide-react";
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
  medicalCode: string | null;
  sicknessUnjustified: boolean;
};

type WorkerOption = { id: string; name: string; location: string | null };
type ActiveRequestFilter = "JUSTIFY" | RequestRecord["type"];

const typeLabels = { FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", MALATTIA: "Malattia", ALTRO: "Altro" };
const statusLabels = { PENDING: "In attesa", APPROVED: "Approvata", REJECTED: "Rifiutata", FLAGGED: "Segnalata" };

function needsSicknessJustification(request: RequestRecord) {
  return request.type === "MALATTIA" && !request.medicalCode && !request.sicknessUnjustified;
}

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
  const [form, setForm] = useState({ userId: workers[0]?.id ?? "", type: "FERIE", startDate: todayValue, endDate: todayValue, startTime: "", endTime: "", reason: "", approveNow: false, medicalCode: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [medicalDrafts, setMedicalDrafts] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<ActiveRequestFilter>("JUSTIFY");
  const employeeView = role === "DIPENDENTE";
  const canApprove = role === "ADMIN" || role === "SUPER_ADMIN";
  const canCreateForWorkers = role === "ADMIN" || role === "SUPER_ADMIN";
  const orderedRequests = [...requests].sort((a, b) => Number(needsSicknessJustification(b)) - Number(needsSicknessJustification(a)));
  const urgentSicknessRequests = orderedRequests.filter(needsSicknessJustification);
  const archiveRequests = orderedRequests.filter((request) => !needsSicknessJustification(request));
  const pendingRequests = requests.filter((request) => request.status === "PENDING").length;
  const requestSections: Array<{ type: RequestRecord["type"]; title: string; description: string; tone: "pink" | "gold" | "green" | "dark"; items: RequestRecord[] }> = [
    { type: "PERMESSO", title: "Permessi", description: "Entrate posticipate, uscite anticipate e permessi orari.", tone: "pink", items: [] },
    { type: "FERIE", title: "Ferie", description: "Giorni di ferie richiesti o già approvati.", tone: "gold", items: [] },
    { type: "RIPOSO", title: "Riposo", description: "Riposi programmati e richieste di assenza ordinaria.", tone: "green", items: [] },
    { type: "MALATTIA", title: "Malattia", description: "Malattie già giustificate o segnate come non giustificate.", tone: "pink", items: [] },
    { type: "ALTRO", title: "Altro", description: "Richieste fuori categoria standard.", tone: "dark", items: [] },
  ].map((section) => ({
    ...section,
    items: archiveRequests.filter((request) => request.type === section.type),
  }));
  const activeSection = requestSections.find((section) => section.type === activeFilter);
  const filterButtons: Array<{ key: ActiveRequestFilter; label: string; count: number; tone: "pink" | "gold" | "green" | "dark" }> = [
    { key: "JUSTIFY", label: "Da giustificare", count: urgentSicknessRequests.length, tone: "pink" },
    ...requestSections.map((section) => ({ key: section.type, label: section.title, count: section.items.length, tone: section.tone })),
  ];

  async function createRequest() {
    if (!form.startDate || !form.endDate) {
      setMessage("Scegli la data iniziale e finale.");
      return;
    }
    setSaving("create");
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        userId: canCreateForWorkers ? form.userId : undefined,
        medicalCode: form.type === "MALATTIA" ? form.medicalCode : undefined
      }),
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
      medicalCode: savedRequest.medical_code,
      sicknessUnjustified: savedRequest.sickness_unjustified,
    }, ...current]);
    setForm({ userId: workers[0]?.id ?? "", type: "FERIE", startDate: todayValue, endDate: todayValue, startTime: "", endTime: "", reason: "", approveNow: false, medicalCode: "" });
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

  async function updateSicknessJustification(id: string, payload: { medicalCode?: string | null; sicknessUnjustified?: boolean }) {
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Giustificazione malattia non salvata.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === id ? {
      ...request,
      medicalCode: data.leaveRequest.medical_code,
      sicknessUnjustified: data.leaveRequest.sickness_unjustified,
    } : request));
    setMessage(data.leaveRequest.medical_code ? "Protocollo malattia salvato. Assenza giustificata." : "Malattia contrassegnata come non giustificata.");
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
            {form.type === "MALATTIA" && (
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-bold tracking-wide uppercase text-red-600 flex items-center gap-1.5 animate-pulse">
                  <Heart className="size-3.5 text-red-500" /> Codice Certificato Medico (INPS / Ricetta)
                </span>
                <Field
                  placeholder="Inserisci il codice di protocollo del medico (es. INPS123456)..."
                  value={form.medicalCode}
                  onChange={(event) => setForm({ ...form, medicalCode: event.target.value })}
                />
                <p className="text-[10px] text-black/45 leading-normal">
                  In assenza di codice medico, l'assenza rimarrà registrata come non giustificata.
                </p>
              </label>
            )}
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

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-black/5 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Totale</p>
          <p className="mt-1 text-2xl font-black text-paradise-noir">{requests.length}</p>
        </div>
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">Da giustificare</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{urgentSicknessRequests.length}</p>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">In attesa</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{pendingRequests}</p>
        </div>
      </div>

      {requests.length > 0 ? (
        <div className="mb-5 overflow-x-auto rounded-[26px] border border-black/5 bg-white p-2 shadow-sm">
          <div className="flex min-w-max gap-2">
            {filterButtons.map((filter) => {
              const selected = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-[20px] px-4 text-sm font-black transition active:scale-[0.98]",
                    selected ? "bg-paradise-noir text-white shadow-sm" : "bg-neutral-50 text-paradise-noir hover:bg-paradise-nude/50"
                  )}
                >
                  <span>{filter.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      selected ? "bg-white/15 text-white" : filter.tone === "pink" ? "bg-paradise-softPink/70 text-[#B85B68]" : filter.tone === "gold" ? "bg-paradise-gold/20 text-[#9E7A3B]" : filter.tone === "green" ? "bg-emerald-500/10 text-emerald-700" : "bg-black/10 text-black/65"
                    )}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {requests.length === 0 ? (
        <Card className="text-sm text-black/45 border border-black/5 bg-white/70 py-10 text-center">
          <Calendar className="size-8 mx-auto text-black/20 mb-2" />
          Nessuna richiesta inserita in archivio.
        </Card>
      ) : null}

      {activeFilter === "JUSTIFY" ? (
        <section className="mb-6 overflow-hidden rounded-[26px] border border-rose-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Priorità</p>
              <h2 className="mt-1 text-lg font-black text-paradise-noir">Malattie da giustificare</h2>
            </div>
            <Badge tone="pink">{urgentSicknessRequests.length} senza protocollo</Badge>
          </div>
          {urgentSicknessRequests.length === 0 ? (
            <div className="px-5 py-8 text-sm font-semibold text-black/35">
              Nessuna malattia da giustificare.
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {urgentSicknessRequests.map((request) => {
              const isPending = request.status === "PENDING";
              const draft = medicalDrafts[request.id] ?? "";
              return (
                <div key={request.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1fr_minmax(340px,1.2fr)] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
                      <Heart className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-paradise-noir">{request.employee}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">Malattia</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-paradise-noir">
                      <Calendar className="size-3.5 text-black/35" />
                      {formatDate(request.startDate)}
                      <span className="text-black/25">→</span>
                      {formatDate(request.endDate)}
                    </p>
                    {request.reason ? (
                      <p className="mt-1 line-clamp-1 text-xs italic text-black/45">{request.reason}</p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700">
                      <AlertCircle className="size-3.5" />
                      Protocollo obbligatorio
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        type="text"
                        value={draft}
                        placeholder="Es. INPS123456"
                        onChange={(event) => setMedicalDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                        className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10"
                      />
                      <button
                        onClick={async () => {
                          const inputVal = draft.trim();
                          if (!inputVal) return alert("Inserisci un codice valido.");
                          await updateSicknessJustification(request.id, { medicalCode: inputVal });
                          setMedicalDrafts((current) => ({ ...current, [request.id]: "" }));
                        }}
                        disabled={saving === request.id}
                        className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                      >
                        Salva
                      </button>
                      <button
                        onClick={() => updateSicknessJustification(request.id, { sicknessUnjustified: true })}
                        disabled={saving === request.id}
                        className="h-10 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 active:scale-95 disabled:opacity-50"
                      >
                        Non giustificata
                      </button>
                    </div>
                    {canApprove && isPending ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          disabled={saving === request.id}
                          onClick={() => changeStatus(request.id, "APPROVED")}
                          className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Check className="size-3.5" /> Approva
                        </button>
                        <button
                          disabled={saving === request.id}
                          onClick={() => changeStatus(request.id, "REJECTED")}
                          className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X className="size-3.5" /> Rifiuta
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeFilter !== "JUSTIFY" && activeSection ? (
        <section className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-50 ring-1 ring-black/5">
                    {getRequestIcon(activeSection.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Categoria</p>
                    <h2 className="mt-1 text-lg font-black text-paradise-noir">{activeSection.title}</h2>
                    <p className="mt-0.5 text-xs text-black/45">{activeSection.description}</p>
                  </div>
                </div>
                <Badge tone={activeSection.tone}>{activeSection.items.length} richieste</Badge>
              </div>

              {activeSection.items.length === 0 ? (
                <div className="px-5 py-6 text-sm font-semibold text-black/35">
                  Nessuna richiesta in questa categoria.
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {activeSection.items.map((request) => {
          const isPending = request.status === "PENDING";
          const isApproved = request.status === "APPROVED";
          const isRejected = request.status === "REJECTED";
          const isFlagged = request.status === "FLAGGED";

          return (
            <div
              key={request.id}
              className={cn(
                "grid gap-4 px-5 py-4 transition-colors hover:bg-neutral-50/70 xl:grid-cols-[1.2fr_1fr_1.3fr_auto] xl:items-center",
                isRejected && "bg-rose-50/25",
                isFlagged && "bg-amber-50/30"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                  <div className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                    isApproved && "bg-emerald-500/10 border-emerald-500/20",
                    isRejected && "bg-rose-500/10 border-rose-500/20",
                    isFlagged && "bg-paradise-gold/15 border-paradise-gold/30",
                    isPending && "bg-neutral-50 border-neutral-200"
                  )}>
                    {getRequestIcon(request.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-paradise-noir">{employeeView ? typeLabels[request.type] : request.employee}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">
                      {employeeView ? statusLabels[request.status] : typeLabels[request.type]}
                    </p>
                  </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-paradise-noir">
                  <Calendar className="size-3.5 text-black/35" />
                  {formatDate(request.startDate)}
                  <span className="text-black/25">→</span>
                  {formatDate(request.endDate)}
                </p>
                {(request.startTime || request.endTime) ? (
                  <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-black/50">
                    <Clock className="size-3.5 text-black/30" />
                    {request.startTime ?? "--:--"} - {request.endTime ?? "--:--"}
                  </p>
                ) : null}
              </div>

              <div className="min-w-0">
                {request.type === "MALATTIA" ? (
                  <Badge tone={request.medicalCode ? (isApproved ? "green" : "gold") : request.sicknessUnjustified ? "pink" : "gold"}>
                    {request.medicalCode
                      ? (isApproved ? "Malattia Giustificata" : "Malattia (Certificato Inviato)")
                      : request.sicknessUnjustified ? "Non Giustificata" : "Protocollo Mancante"}
                  </Badge>
                ) : (
                  <Badge tone={isApproved ? "green" : isFlagged ? "gold" : "pink"}>
                    {statusLabels[request.status]}
                  </Badge>
                )}
                {request.medicalCode ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="size-3.5" />
                    <span className="font-mono">{request.medicalCode}</span>
                  </p>
                ) : request.sicknessUnjustified ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <AlertCircle className="size-3.5" />
                    Non giustificata
                  </p>
                ) : request.reason ? (
                  <p className="mt-2 line-clamp-1 text-xs italic text-black/45">{request.reason}</p>
                ) : null}
              </div>

              {canApprove && isPending && (
                <div className="flex gap-2">
                  <button
                    disabled={saving === request.id}
                    onClick={() => changeStatus(request.id, "APPROVED")}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Approva
                  </button>
                  <button
                    disabled={saving === request.id}
                    onClick={() => changeStatus(request.id, "REJECTED")}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-600 shadow-sm transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X className="size-3.5" /> Rifiuta
                  </button>
                </div>
              )}

              {role === "RESPONSABILE" && isPending && (
                <div>
                  <button
                    disabled={saving === request.id}
                    onClick={() => changeStatus(request.id, "FLAGGED")}
                    className="w-full flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-paradise-gold/20 border border-paradise-gold/30 text-amber-800 font-bold text-xs shadow-sm hover:bg-paradise-gold/30 transition-colors disabled:opacity-50"
                  >
                    <Flag className="size-3.5" /> Segnala ad Admin
                  </button>
                </div>
              )}
            </div>
          );
                  })}
                </div>
              )}
        </section>
      ) : null}
    </>
  );
}
