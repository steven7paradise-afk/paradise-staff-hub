"use client";

import { useState } from "react";
import { Check, Send, X, Flag, Calendar, Clock, Heart, Coffee, FileText, Sparkles, Plus, AlertCircle, ShieldCheck } from "lucide-react";
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
  adminNote: string | null;
  medicalCode: string | null;
  sicknessUnjustified: boolean;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Non registrata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayRange(request: RequestRecord) {
  const dateRange = `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;
  if (!request.startTime || !request.endTime) return dateRange;
  return `${dateRange}, ${request.startTime} - ${request.endTime}`;
}

function daysLabel(request: RequestRecord) {
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return days === 1 ? "1 giorno" : `${days} giorni`;
}

function statusTone(status: RequestRecord["status"]): "pink" | "gold" | "green" | "dark" {
  if (status === "APPROVED") return "green";
  if (status === "PENDING") return "gold";
  if (status === "FLAGGED") return "gold";
  return "pink";
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

function RequestMetaPanel({ request }: { request: RequestRecord }) {
  const approved = request.status === "APPROVED";
  const workerNote = request.reason?.trim() || "Nessuna nota lavoratore";
  const adminNote = request.adminNote?.trim() || "Nessuna nota admin";

  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-white/80 p-3 text-xs shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Inviata da</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{request.employee}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Inviata il</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{formatDateTime(request.createdAt)}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Stato richiesta</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{statusLabels[request.status]}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Approvata da</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{approved ? request.approvedBy ?? "Non registrato" : "Non ancora approvata"}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Approvata il</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{approved ? formatDateTime(request.approvedAt) : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Periodo richiesto</p>
          <p className="mt-0.5 font-bold text-paradise-noir">{displayRange(request)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-paradise-nude/35 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Note lavoratore</p>
          <p className="mt-0.5 whitespace-pre-wrap font-semibold leading-relaxed text-black/65">{workerNote}</p>
        </div>
        <div className={cn(
          "rounded-xl px-3 py-2",
          request.adminNote ? "bg-paradise-pink/20 ring-1 ring-paradise-pink/30" : "bg-neutral-50"
        )}>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Nota admin</p>
          <p className="mt-0.5 whitespace-pre-wrap font-semibold leading-relaxed text-black/65">{adminNote}</p>
        </div>
      </div>
    </div>
  );
}

function DecisionNoteField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">
        Motivo / nota admin
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Scrivi il motivo dell'approvazione o del rifiuto..."
        rows={2}
        className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-paradise-noir outline-none transition focus:border-paradise-pink focus:ring-2 focus:ring-paradise-pink/20"
      />
    </label>
  );
}

function RequestDetailPanel({
  request,
  canApprove,
  canFlag,
  saving,
  medicalDraft,
  decisionDraft,
  onMedicalDraftChange,
  onDecisionDraftChange,
  onChangeStatus,
  onUpdateSickness,
  onClose,
}: {
  request: RequestRecord;
  canApprove: boolean;
  canFlag: boolean;
  saving: string | null;
  medicalDraft: string;
  decisionDraft: string;
  onMedicalDraftChange: (value: string) => void;
  onDecisionDraftChange: (value: string) => void;
  onChangeStatus: (id: string, status: "APPROVED" | "REJECTED" | "FLAGGED") => void;
  onUpdateSickness: (id: string, payload: { medicalCode?: string | null; sicknessUnjustified?: boolean }) => void;
  onClose?: () => void;
}) {
  const isPending = request.status === "PENDING";
  const workerNote = request.reason?.trim() || "Nessuna nota lavoratore";
  const adminNote = request.adminNote?.trim() || "Nessuna nota admin";
  const canEditDecision = (canApprove || canFlag) && isPending;

  return (
    <aside className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm lg:sticky lg:top-5">
      <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Dettaglio richiesta</p>
          <h2 className="mt-1 text-xl font-black text-paradise-noir">{request.employee}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={statusTone(request.status)}>{statusLabels[request.status]}</Badge>
            <Badge tone="pink">{typeLabels[request.type]}</Badge>
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-2xl border border-black/10 bg-white text-black/55 lg:hidden" aria-label="Chiudi dettaglio richiesta">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-2xl bg-[#FAF7F9] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Periodo e orario</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-black text-paradise-noir">
            <Calendar className="size-4 text-black/35" />
            {formatDate(request.startDate)} <span className="text-black/25">→</span> {formatDate(request.endDate)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-black/55">
            <Clock className="size-4 text-black/30" />
            {request.startTime || request.endTime ? `${request.startTime ?? "--:--"} - ${request.endTime ?? "--:--"}` : "Intera giornata"}
            <span className="text-black/30">•</span>
            {daysLabel(request)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-2xl border border-black/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Inviata il</p>
            <p className="mt-1 text-sm font-black text-paradise-noir">{formatDateTime(request.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-black/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Stato richiesta</p>
            <p className="mt-1 text-sm font-black text-paradise-noir">{statusLabels[request.status]}</p>
          </div>
        </div>

        {request.type === "MALATTIA" ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
              <Heart className="size-3.5" />
              Giustificazione malattia
            </p>
            {request.medicalCode ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-black text-emerald-800">
                <ShieldCheck className="size-4" />
                {request.medicalCode}
              </p>
            ) : request.sicknessUnjustified ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-black text-rose-700">
                <AlertCircle className="size-4" />
                Non giustificata
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                <input
                  type="text"
                  value={medicalDraft}
                  placeholder="Codice protocollo medico"
                  onChange={(event) => onMedicalDraftChange(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={saving === request.id}
                    onClick={() => {
                      const inputVal = medicalDraft.trim();
                      if (!inputVal) return alert("Inserisci un codice valido.");
                      onUpdateSickness(request.id, { medicalCode: inputVal });
                    }}
                    className="h-11 rounded-xl bg-rose-600 px-4 text-xs font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    Salva codice
                  </button>
                  <button
                    type="button"
                    disabled={saving === request.id}
                    onClick={() => onUpdateSickness(request.id, { sicknessUnjustified: true })}
                    className="h-11 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Non giustificata
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="rounded-2xl border border-black/5 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Motivo lavoratore</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-black/65">{workerNote}</p>
          </div>
          <div className={cn(
            "rounded-2xl border p-3",
            request.adminNote ? "border-paradise-pink/30 bg-paradise-pink/10" : "border-black/5 bg-neutral-50"
          )}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Motivo approvazione / nota admin</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-black/65">{adminNote}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Approvazione</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/30">Approvata da</p>
              <p className="mt-1 text-sm font-black text-paradise-noir">{request.status === "APPROVED" ? request.approvedBy ?? "Non registrato" : "Non ancora approvata"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/30">Approvata il</p>
              <p className="mt-1 text-sm font-black text-paradise-noir">{request.status === "APPROVED" ? formatDateTime(request.approvedAt) : "—"}</p>
            </div>
          </div>
        </div>

        {canEditDecision ? (
          <div className="rounded-2xl border border-paradise-pink/20 bg-paradise-softPink/20 p-3">
            <DecisionNoteField value={decisionDraft} onChange={onDecisionDraftChange} />
            {canApprove ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  disabled={saving === request.id}
                  onClick={() => onChangeStatus(request.id, "APPROVED")}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Check className="size-3.5" /> Approva
                </button>
                <button
                  disabled={saving === request.id}
                  onClick={() => onChangeStatus(request.id, "REJECTED")}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <X className="size-3.5" /> Rifiuta
                </button>
              </div>
            ) : null}
            {canFlag ? (
              <button
                disabled={saving === request.id}
                onClick={() => onChangeStatus(request.id, "FLAGGED")}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-paradise-gold/30 bg-paradise-gold/20 text-xs font-black text-amber-800 transition hover:bg-paradise-gold/30 disabled:opacity-50"
              >
                <Flag className="size-3.5" /> Segnala ad Admin
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
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
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<ActiveRequestFilter>("JUSTIFY");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const employeeView = role === "DIPENDENTE";
  const canApprove = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const canCreateForWorkers = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const orderedRequests = [...requests].sort((a, b) => Number(needsSicknessJustification(b)) - Number(needsSicknessJustification(a)));
  const urgentSicknessRequests = orderedRequests.filter(needsSicknessJustification);
  const archiveRequests = orderedRequests.filter((request) => !needsSicknessJustification(request));
  const pendingRequests = requests.filter((request) => request.status === "PENDING").length;
  const requestSections = ([
    { type: "PERMESSO", title: "Permessi", description: "Entrate posticipate, uscite anticipate e permessi orari.", tone: "pink", items: [] },
    { type: "FERIE", title: "Ferie", description: "Giorni di ferie richiesti o già approvati.", tone: "gold", items: [] },
    { type: "RIPOSO", title: "Riposo", description: "Riposi programmati e richieste di assenza ordinaria.", tone: "green", items: [] },
    { type: "MALATTIA", title: "Malattia", description: "Malattie già giustificate o segnate come non giustificate.", tone: "pink", items: [] },
    { type: "ALTRO", title: "Altro", description: "Richieste fuori categoria standard.", tone: "dark", items: [] },
  ] as Array<{ type: RequestRecord["type"]; title: string; description: string; tone: "pink" | "gold" | "green" | "dark"; items: RequestRecord[] }>).map((section) => ({
    ...section,
    items: archiveRequests.filter((request) => request.type === section.type),
  }));
  const activeSection = requestSections.find((section) => section.type === activeFilter);
  const filterButtons: Array<{ key: ActiveRequestFilter; label: string; count: number; tone: "pink" | "gold" | "green" | "dark" }> = [
    { key: "JUSTIFY", label: "Da giustificare", count: urgentSicknessRequests.length, tone: "pink" },
    ...requestSections.map((section) => ({ key: section.type, label: section.title, count: section.items.length, tone: section.tone })),
  ];
  const visibleRequests = activeFilter === "JUSTIFY" ? urgentSicknessRequests : activeSection?.items ?? [];
  const selectedRequest = requests.find((request) => request.id === selectedRequestId && visibleRequests.some((item) => item.id === request.id)) ?? visibleRequests[0] ?? null;
  const approvedRequests = requests.filter((request) => request.status === "APPROVED").length;

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
      adminNote: savedRequest.admin_note,
      medicalCode: savedRequest.medical_code,
      sicknessUnjustified: savedRequest.sickness_unjustified,
      createdAt: savedRequest.created_at,
      approvedBy: savedRequest.approver?.name ?? null,
      approvedAt: savedRequest.approved_at ?? null,
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
    const adminNote = decisionDrafts[id]?.trim() ?? "";
    if (status === "REJECTED" && !adminNote) {
      setMessage("Scrivi il motivo del rifiuto prima di salvare.");
      return;
    }
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: adminNote || null }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Operazione non salvata.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === id ? {
      ...request,
      status: data.leaveRequest.status,
      adminNote: data.leaveRequest.admin_note,
      approvedBy: data.leaveRequest.approver?.name ?? null,
      approvedAt: data.leaveRequest.approved_at ?? null,
    } : request));
    setDecisionDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
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
    <div className="operations-liquid-page requests-liquid min-h-[calc(100dvh-12rem)] rounded-[32px] border border-white/70 p-4 shadow-[0_18px_55px_rgba(61,35,49,0.08)] backdrop-blur-2xl sm:p-6">
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-black/5 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Totale</p>
          <p className="mt-1 text-2xl font-black text-paradise-noir">{requests.length}</p>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">In attesa</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{pendingRequests}</p>
        </div>
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Approvate</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{approvedRequests}</p>
        </div>
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">Da giustificare</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{urgentSicknessRequests.length}</p>
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

      {requests.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">
                  {activeFilter === "JUSTIFY" ? "Priorità" : "Categoria"}
                </p>
                <h2 className="mt-1 text-lg font-black text-paradise-noir">
                  {activeFilter === "JUSTIFY" ? "Malattie da giustificare" : activeSection?.title}
                </h2>
                <p className="mt-0.5 text-xs text-black/45">
                  {activeFilter === "JUSTIFY" ? "Richieste malattia senza protocollo o conferma." : activeSection?.description}
                </p>
              </div>
              <Badge tone={activeFilter === "JUSTIFY" ? "pink" : activeSection?.tone ?? "dark"}>{visibleRequests.length} richieste</Badge>
            </div>

            {visibleRequests.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-semibold text-black/35">
                Nessuna richiesta in questa sezione.
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(180px,1.1fr)_140px_minmax(210px,1fr)_120px_170px_86px] gap-3 border-b border-black/5 bg-neutral-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/35 xl:grid">
                  <span>Dipendente</span>
                  <span>Tipo</span>
                  <span>Periodo</span>
                  <span>Stato</span>
                  <span>Approvazione</span>
                  <span className="text-right">Azioni</span>
                </div>
                <div className="divide-y divide-black/5">
                  {visibleRequests.map((request) => {
                    const isSelected = selectedRequest?.id === request.id;
                    const isPending = request.status === "PENDING";
                    const isApproved = request.status === "APPROVED";
                    const isRejected = request.status === "REJECTED";
                    const isFlagged = request.status === "FLAGGED";
                    const hasSicknessProblem = needsSicknessJustification(request);

                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => {
                          setSelectedRequestId(request.id);
                          setMobileDetailOpen(true);
                        }}
                        className={cn(
                          "grid w-full gap-3 px-5 py-4 text-left transition hover:bg-neutral-50/70 xl:grid-cols-[minmax(180px,1.1fr)_140px_minmax(210px,1fr)_120px_170px_86px] xl:items-center",
                          isSelected && "bg-paradise-softPink/20 ring-1 ring-inset ring-paradise-pink/40",
                          isRejected && !isSelected && "bg-rose-50/25",
                          isFlagged && !isSelected && "bg-amber-50/30"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                            isApproved && "border-emerald-500/20 bg-emerald-500/10",
                            isRejected && "border-rose-500/20 bg-rose-500/10",
                            isFlagged && "border-paradise-gold/30 bg-paradise-gold/15",
                            isPending && "border-neutral-200 bg-neutral-50"
                          )}>
                            {getRequestIcon(request.type)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-paradise-noir">{employeeView ? typeLabels[request.type] : request.employee}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">
                              {employeeView ? request.employee : typeLabels[request.type]}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={request.type === "FERIE" ? "gold" : request.type === "RIPOSO" ? "green" : request.type === "ALTRO" ? "dark" : "pink"}>{typeLabels[request.type]}</Badge>
                          {hasSicknessProblem ? <Badge tone="pink">Manca protocollo</Badge> : null}
                        </div>

                        <div className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3 xl:border-0 xl:bg-transparent xl:p-0">
                          <p className="flex items-center gap-2 text-sm font-bold text-paradise-noir">
                            <Calendar className="size-3.5 text-black/35" />
                            {formatDate(request.startDate)}
                            <span className="text-black/25">→</span>
                            {formatDate(request.endDate)}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-black/50">
                            <Clock className="size-3.5 text-black/30" />
                            {request.startTime || request.endTime ? `${request.startTime ?? "--:--"} - ${request.endTime ?? "--:--"}` : "Intera giornata"}
                            <span className="text-black/30">•</span>
                            {daysLabel(request)}
                          </p>
                        </div>

                        <div>
                          <Badge tone={statusTone(request.status)}>{statusLabels[request.status]}</Badge>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-paradise-noir">
                            {isApproved ? request.approvedBy ?? "Non registrato" : isPending ? "Da approvare" : statusLabels[request.status]}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-black/40">
                            {isApproved ? formatDateTime(request.approvedAt) : request.adminNote?.trim() || request.reason?.trim() || "Nessuna nota"}
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <span className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-paradise-noir shadow-sm">
                            Apri
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <div className="hidden lg:block">
            {selectedRequest ? (
              <RequestDetailPanel
                request={selectedRequest}
                canApprove={canApprove}
                canFlag={role === "RESPONSABILE"}
                saving={saving}
                medicalDraft={medicalDrafts[selectedRequest.id] ?? ""}
                decisionDraft={decisionDrafts[selectedRequest.id] ?? ""}
                onMedicalDraftChange={(value) => setMedicalDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
                onDecisionDraftChange={(value) => setDecisionDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
                onChangeStatus={(id, status) => changeStatus(id, status)}
                onUpdateSickness={async (id, payload) => {
                  await updateSicknessJustification(id, payload);
                  setMedicalDrafts((current) => ({ ...current, [id]: "" }));
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {mobileDetailOpen && selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 backdrop-blur-sm lg:hidden">
          <div className="max-h-[88dvh] w-full overflow-y-auto rounded-[28px] bg-[#F8F3F6]">
            <RequestDetailPanel
              request={selectedRequest}
              canApprove={canApprove}
              canFlag={role === "RESPONSABILE"}
              saving={saving}
              medicalDraft={medicalDrafts[selectedRequest.id] ?? ""}
              decisionDraft={decisionDrafts[selectedRequest.id] ?? ""}
              onMedicalDraftChange={(value) => setMedicalDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
              onDecisionDraftChange={(value) => setDecisionDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
              onChangeStatus={(id, status) => changeStatus(id, status)}
              onUpdateSickness={async (id, payload) => {
                await updateSicknessJustification(id, payload);
                setMedicalDrafts((current) => ({ ...current, [id]: "" }));
              }}
              onClose={() => setMobileDetailOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
