"use client";

import { useState } from "react";
import { Check, Send, X, Flag, Calendar, Clock, Heart, Coffee, FileText, Sparkles, Plus, AlertCircle, ShieldCheck, Eye, BellRing, UserRound, Hourglass } from "lucide-react";
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
  employeeResponse: string | null;
  employeeAcknowledgedAt: string | null;
  medicalCode: string | null;
  sicknessUnjustified: boolean;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
};

type WorkerOption = { id: string; name: string; location: string | null };
type ActiveRequestFilter = "JUSTIFY" | "LATE" | RequestRecord["type"];

const typeLabels = { FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", MALATTIA: "Malattia", ALTRO: "Altro" };
const statusLabels = { PENDING: "In attesa", APPROVED: "Approvata", REJECTED: "Rifiutata", FLAGGED: "Segnalata" };

function isAutomaticLateRequest(request: RequestRecord) {
  return request.reason?.startsWith("RITARDO AUTOMATICO — ") ?? false;
}

function requestTypeLabel(request: RequestRecord) {
  return isAutomaticLateRequest(request) ? "Ritardo" : typeLabels[request.type];
}

function requestStatusLabel(request: RequestRecord) {
  if (!isAutomaticLateRequest(request)) return statusLabels[request.status];
  if (request.status === "APPROVED") return "Gestito dall’amministrazione";
  return "Da gestire";
}

function needsSicknessJustification(request: RequestRecord) {
  return request.type === "MALATTIA" && !request.medicalCode;
}

function requestFilterForRecord(request: RequestRecord): ActiveRequestFilter {
  if (needsSicknessJustification(request)) return "JUSTIFY";
  if (isAutomaticLateRequest(request)) return "LATE";
  return request.type;
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
  automaticLate = false,
  employeeResponse = false,
}: {
  value: string;
  onChange: (value: string) => void;
  automaticLate?: boolean;
  employeeResponse?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">
        {employeeResponse ? "La tua risposta (facoltativa)" : automaticLate ? "Comunicazione al dipendente" : "Motivo / nota admin"}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={employeeResponse ? "Puoi spiegare il motivo del ritardo o lasciare un messaggio..." : automaticLate ? "Esempio: Recati in amministrazione, oppure scrivi un messaggio libero..." : "Scrivi il motivo dell'approvazione o del rifiuto..."}
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
  canAcknowledge,
  saving,
  medicalDraft,
  decisionDraft,
  onMedicalDraftChange,
  onDecisionDraftChange,
  onChangeStatus,
  onAcknowledge,
  onUpdateSickness,
  onClose,
}: {
  request: RequestRecord;
  canApprove: boolean;
  canFlag: boolean;
  canAcknowledge: boolean;
  saving: string | null;
  medicalDraft: string;
  decisionDraft: string;
  onMedicalDraftChange: (value: string) => void;
  onDecisionDraftChange: (value: string) => void;
  onChangeStatus: (id: string, status: "APPROVED" | "REJECTED" | "FLAGGED", lateAccountingMode?: "ACTUAL" | "PENALTY_30") => void;
  onAcknowledge: (id: string) => void;
  onUpdateSickness: (id: string, payload: { medicalCode?: string | null; sicknessUnjustified?: boolean }) => void;
  onClose?: () => void;
}) {
  const isPending = request.status === "PENDING";
  const automaticLate = isAutomaticLateRequest(request);
  const workerNote = request.reason?.trim() || "Nessuna nota lavoratore";
  const adminNote = request.adminNote?.trim() || "Nessuna nota admin";
  const canEmployeeAcknowledge = canAcknowledge && automaticLate && !request.employeeAcknowledgedAt;
  const canEditDecision = ((canApprove || canFlag) && isPending) || canEmployeeAcknowledge;

  return (
    <aside className="overflow-hidden rounded-[30px] border border-paradise-pink/20 bg-white shadow-[0_24px_70px_rgba(92,44,67,0.10)] lg:sticky lg:top-5">
      <div className="relative flex items-start justify-between gap-4 overflow-hidden border-b border-paradise-pink/15 bg-gradient-to-br from-white via-[#fffafd] to-paradise-softPink/45 px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-paradise-pink/10 blur-2xl" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Dettaglio richiesta</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-paradise-noir sm:text-4xl">
            Ciao <span className="text-paradise-pink">{request.employee}</span>,
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-black/60 sm:text-base">
            {automaticLate ? "ti informiamo che questa comunicazione è stata registrata." : "qui trovi tutti i dettagli della tua richiesta."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black sm:text-sm",
              request.status === "APPROVED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              request.status === "PENDING" && "border-amber-200 bg-amber-50 text-amber-700",
              request.status === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-700",
              request.status === "FLAGGED" && "border-orange-200 bg-orange-50 text-orange-700",
            )}>
              <Eye className="size-4" /> {requestStatusLabel(request)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-paradise-pink/20 bg-paradise-pink/10 px-3.5 py-2 text-xs font-black text-paradise-pink sm:text-sm">
              <Clock className="size-4" /> {requestTypeLabel(request)}
            </span>
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-2xl border border-black/10 bg-white text-black/55 lg:hidden" aria-label="Chiudi dettaglio richiesta">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 bg-[#fffdfd] px-4 py-5 sm:space-y-5 sm:px-7 sm:py-7">
        <div className="rounded-2xl border border-paradise-pink/15 bg-white p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-paradise-noir">
            <Calendar className="size-4 text-paradise-pink" /> Periodo e orario
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black text-paradise-noir sm:text-lg">
            <Calendar className="size-5 text-paradise-pink" />
            {formatDate(request.startDate)} <span className="text-black/25">→</span> {formatDate(request.endDate)}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-black/60 sm:text-base">
            <Clock className="size-5 text-paradise-pink" />
            {request.startTime || request.endTime ? `${request.startTime ?? "--:--"} - ${request.endTime ?? "--:--"}` : "Intera giornata"}
            <span className="text-black/30">•</span>
            {daysLabel(request)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-paradise-pink/15 bg-white p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45"><Send className="size-4 text-paradise-pink" /> Inviata il</p>
            <p className="mt-1 text-sm font-black text-paradise-noir">{formatDateTime(request.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-paradise-pink/15 bg-white p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45"><Eye className="size-4 text-paradise-pink" /> Stato richiesta</p>
            <p className="mt-1 text-sm font-black text-paradise-noir">{requestStatusLabel(request)}</p>
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
            ) : (
              <div className="mt-3 grid gap-2">
                <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-black text-rose-700">
                  <AlertCircle className="size-4" />
                  Non giustificata — codice INPS assente
                </p>
                <input
                  type="text"
                  value={medicalDraft}
                  placeholder="Codice protocollo medico"
                  onChange={(event) => onMedicalDraftChange(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10"
                />
                <div className="grid gap-2">
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
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="rounded-2xl border border-paradise-pink/15 bg-white p-4 sm:p-5">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45"><Hourglass className="size-4 text-paradise-pink" /> {automaticLate ? "Dettaglio del ritardo" : "Motivo lavoratore"}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-black/65 sm:text-base">{workerNote}</p>
          </div>
          <div className={cn(
            "rounded-2xl border p-4 sm:p-5",
            request.adminNote ? "border-paradise-pink/30 bg-gradient-to-r from-paradise-pink/10 to-paradise-softPink/30" : "border-paradise-pink/10 bg-neutral-50"
          )}>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45"><FileText className="size-4 text-paradise-pink" /> {automaticLate ? "Comunicazione amministrazione" : "Motivo approvazione / nota admin"}</p>
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-paradise-pink/15 bg-white/65 px-3 py-2.5 text-sm font-semibold leading-6 text-black/65 sm:text-base">{adminNote}</p>
          </div>
          {automaticLate ? (
            <div className={cn(
              "rounded-2xl border p-4 sm:p-5",
              request.employeeAcknowledgedAt ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60",
            )}>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45">
                <Eye className={cn("size-4", request.employeeAcknowledgedAt ? "text-emerald-600" : "text-amber-600")} />
                Presa visione del dipendente
              </p>
              <p className="mt-2 text-sm font-black text-paradise-noir">
                {request.employeeAcknowledgedAt ? `Confermata il ${formatDateTime(request.employeeAcknowledgedAt)}` : "Non ancora confermata"}
              </p>
              {request.employeeResponse ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">Risposta del dipendente</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-black/65">{request.employeeResponse}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-paradise-pink/15 bg-white p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/45"><UserRound className="size-4 text-paradise-pink" /> {automaticLate ? "Gestione amministrazione" : "Approvazione"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/30">{automaticLate ? "Gestita da" : "Approvata da"}</p>
              <p className="mt-1 text-sm font-black text-paradise-noir">{request.status === "APPROVED" ? request.approvedBy ?? "Non registrato" : automaticLate ? "Da confermare" : "Non ancora approvata"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/30">{automaticLate ? "Gestita il" : "Approvata il"}</p>
              <p className="mt-1 text-sm font-black text-paradise-noir">{request.status === "APPROVED" ? formatDateTime(request.approvedAt) : "—"}</p>
            </div>
          </div>
        </div>

        {canEditDecision ? (
          <div className="rounded-2xl border border-paradise-pink/25 bg-gradient-to-br from-white to-paradise-softPink/35 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-paradise-pink/15 text-paradise-pink">
                <BellRing className="size-6" />
              </span>
              <div>
                <p className="text-base font-black uppercase tracking-wide text-paradise-noir">{canEmployeeAcknowledge ? "Presa visione" : automaticLate ? "Gestione del ritardo" : "Gestione richiesta"}</p>
                <p className="mt-1 text-sm font-medium leading-5 text-black/55">
                  {canEmployeeAcknowledge ? "Conferma di aver letto questa comunicazione e, se vuoi, lascia una risposta." : automaticLate ? "Registra la gestione del ritardo e comunica con il dipendente." : "Valuta la richiesta e comunica la decisione al dipendente."}
                </p>
              </div>
            </div>
            <DecisionNoteField value={decisionDraft} onChange={onDecisionDraftChange} automaticLate={automaticLate} employeeResponse={canEmployeeAcknowledge} />
            {canEmployeeAcknowledge ? (
              <button
                disabled={saving === request.id}
                onClick={() => onAcknowledge(request.id)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-paradise-pink to-[#ef4f91] px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(236,72,140,0.24)] transition hover:brightness-95 disabled:opacity-50"
              >
                <Check className="size-4" /> Sì, ho preso visione
              </button>
            ) : canApprove ? (
              <div className={cn("mt-3 grid gap-2", !automaticLate && "sm:grid-cols-2")}>
                {automaticLate ? (
                  <div className="mb-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                    Scegli come conteggiare il ritardo nelle ore del dipendente.
                  </div>
                ) : null}
                <button
                  disabled={saving === request.id}
                  onClick={() => onChangeStatus(request.id, "APPROVED", automaticLate ? "ACTUAL" : undefined)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-paradise-pink to-[#ef4f91] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(236,72,140,0.24)] transition hover:brightness-95 disabled:opacity-50 sm:text-sm"
                >
                  <Check className="size-3.5" /> {automaticLate ? "Conta dall’ora timbrata" : "Approva"}
                </button>
                {automaticLate ? (
                  <button
                    disabled={saving === request.id}
                    onClick={() => onChangeStatus(request.id, "APPROVED", "PENALTY_30")}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-xs font-black text-amber-800 transition hover:bg-amber-50 disabled:opacity-50 sm:text-sm"
                  >
                    <Clock className="size-3.5" /> Mantieni prassi -30 minuti
                  </button>
                ) : null}
                {!automaticLate ? <button
                  disabled={saving === request.id}
                  onClick={() => onChangeStatus(request.id, "REJECTED")}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-paradise-pink/25 bg-white px-4 text-xs font-black text-paradise-pink transition hover:bg-paradise-softPink/30 disabled:opacity-50 sm:text-sm"
                >
                  <X className="size-3.5" /> Rifiuta
                </button> : null}
              </div>
            ) : null}
            {canFlag ? (
              <button
                disabled={saving === request.id}
                onClick={() => onChangeStatus(request.id, "FLAGGED")}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-paradise-gold/30 bg-paradise-gold/20 text-xs font-black text-amber-800 transition hover:bg-paradise-gold/30 disabled:opacity-50 sm:text-sm"
              >
                <Flag className="size-3.5" /> Segnala ad Admin
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-2xl border border-paradise-pink/10 bg-gradient-to-r from-paradise-softPink/25 to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <Heart className="size-5 shrink-0 text-paradise-pink" />
            <div>
              <p className="text-sm font-semibold text-black/65">Grazie per la collaborazione.</p>
              <p className="text-xs font-black text-paradise-noir">Insieme manteniamo un ambiente di lavoro organizzato e puntuale.</p>
            </div>
          </div>
          <p className="shrink-0 text-sm font-black tracking-[0.28em] text-paradise-noir">PARADISE</p>
        </div>
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
  const newestInitialRequest = [...initialRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  const [requests, setRequests] = useState(initialRequests);
  const [openForm, setOpenForm] = useState(false);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({ userId: workers[0]?.id ?? "", type: "FERIE", startDate: todayValue, endDate: todayValue, startTime: "", endTime: "", reason: "", approveNow: false, medicalCode: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [medicalDrafts, setMedicalDrafts] = useState<Record<string, string>>({});
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<ActiveRequestFilter>(newestInitialRequest ? requestFilterForRecord(newestInitialRequest) : "JUSTIFY");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(newestInitialRequest?.id ?? null);
  const employeeView = role === "DIPENDENTE";
  const canApprove = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const canCreateForWorkers = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const orderedRequests = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const urgentSicknessRequests = orderedRequests.filter(needsSicknessJustification);
  const archiveRequests = orderedRequests.filter((request) => !needsSicknessJustification(request));
  const pendingRequests = requests.filter((request) => request.status === "PENDING").length;
  const requestSections = ([
    { key: "LATE", title: "Ritardi", description: "Timbrature oltre la tolleranza da approvare o rifiutare.", tone: "gold", items: [] },
    { key: "PERMESSO", title: "Permessi", description: "Entrate posticipate, uscite anticipate e permessi orari.", tone: "pink", items: [] },
    { key: "FERIE", title: "Ferie", description: "Giorni di ferie richiesti o già approvati.", tone: "gold", items: [] },
    { key: "RIPOSO", title: "Riposo", description: "Riposi programmati e richieste di assenza ordinaria.", tone: "green", items: [] },
    { key: "MALATTIA", title: "Malattia", description: "Malattie già giustificate o segnate come non giustificate.", tone: "pink", items: [] },
    { key: "ALTRO", title: "Altro", description: "Richieste fuori categoria standard.", tone: "dark", items: [] },
  ] as Array<{ key: Exclude<ActiveRequestFilter, "JUSTIFY">; title: string; description: string; tone: "pink" | "gold" | "green" | "dark"; items: RequestRecord[] }>).map((section) => ({
    ...section,
    items: archiveRequests.filter((request) => section.key === "LATE"
      ? isAutomaticLateRequest(request)
      : request.type === section.key && !isAutomaticLateRequest(request)),
  }));
  const activeSection = requestSections.find((section) => section.key === activeFilter);
  const filterButtons: Array<{ key: ActiveRequestFilter; label: string; count: number; tone: "pink" | "gold" | "green" | "dark" }> = [
    { key: "JUSTIFY", label: "Da giustificare", count: urgentSicknessRequests.length, tone: "pink" },
    ...requestSections.map((section) => ({ key: section.key, label: section.title, count: section.items.length, tone: section.tone })),
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
    const savedRecord: RequestRecord = {
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
      employeeResponse: savedRequest.employee_response ?? null,
      employeeAcknowledgedAt: savedRequest.employee_acknowledged_at ?? null,
      medicalCode: savedRequest.medical_code,
      sicknessUnjustified: savedRequest.sickness_unjustified,
      createdAt: savedRequest.created_at,
      approvedBy: savedRequest.approver?.name ?? null,
      approvedAt: savedRequest.approved_at ?? null,
    };
    setRequests((current) => [savedRecord, ...current]);
    setSelectedRequestId(savedRecord.id);
    setActiveFilter(requestFilterForRecord(savedRecord));
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

  async function changeStatus(id: string, status: "APPROVED" | "REJECTED" | "FLAGGED", lateAccountingMode?: "ACTUAL" | "PENALTY_30") {
    const selectedRequest = requests.find((request) => request.id === id);
    const automaticLate = selectedRequest ? isAutomaticLateRequest(selectedRequest) : false;
    const adminNote = decisionDrafts[id]?.trim() ?? "";
    if (status === "REJECTED" && !adminNote) {
      setMessage("Scrivi il motivo del rifiuto prima di salvare.");
      return;
    }
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: adminNote || null, lateAccountingMode }),
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
    if (automaticLate && status === "APPROVED") {
      const accountingMessage = lateAccountingMode === "ACTUAL"
        ? "Ore conteggiate dall’ora effettiva della timbratura."
        : "Mantenuta la prassi -30 minuti.";
      setMessage(`${adminNote ? "Presa visione confermata e comunicazione inviata al dipendente." : "Presa visione confermata."} ${accountingMessage}`);
      return;
    }
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
    if (payload.medicalCode && activeFilter === "JUSTIFY") {
      setActiveFilter("MALATTIA");
      setSelectedRequestId(id);
    }
    setMessage(data.leaveRequest.medical_code ? "Protocollo malattia salvato. Assenza giustificata." : "Malattia contrassegnata come non giustificata.");
  }

  async function acknowledgeLateRequest(id: string) {
    const employeeResponse = decisionDrafts[id]?.trim() ?? "";
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledge: true, employeeResponse: employeeResponse || null }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Presa visione non salvata.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === id ? {
      ...request,
      employeeResponse: data.leaveRequest.employee_response,
      employeeAcknowledgedAt: data.leaveRequest.employee_acknowledged_at,
    } : request));
    setDecisionDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setMessage(employeeResponse ? "Presa visione e risposta inviate all’amministrazione." : "Presa visione confermata.");
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
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Approvate / confermate</p>
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
                  onClick={() => {
                    setActiveFilter(filter.key);
                    setSelectedRequestId(null);
                  }}
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
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
          <div className="min-w-0">
            {selectedRequest ? (
              <RequestDetailPanel
                request={selectedRequest}
                canApprove={canApprove}
                canFlag={role === "RESPONSABILE"}
                canAcknowledge={employeeView}
                saving={saving}
                medicalDraft={medicalDrafts[selectedRequest.id] ?? ""}
                decisionDraft={decisionDrafts[selectedRequest.id] ?? ""}
                onMedicalDraftChange={(value) => setMedicalDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
                onDecisionDraftChange={(value) => setDecisionDrafts((current) => ({ ...current, [selectedRequest.id]: value }))}
                onChangeStatus={(id, status, lateAccountingMode) => changeStatus(id, status, lateAccountingMode)}
                onAcknowledge={(id) => acknowledgeLateRequest(id)}
                onUpdateSickness={async (id, payload) => {
                  await updateSicknessJustification(id, payload);
                  setMedicalDrafts((current) => ({ ...current, [id]: "" }));
                }}
              />
            ) : (
              <div className="rounded-[28px] border border-black/5 bg-white px-6 py-16 text-center shadow-sm">
                <Calendar className="mx-auto size-9 text-black/15" />
                <p className="mt-3 text-sm font-bold text-black/35">Nessuna richiesta in questa categoria.</p>
              </div>
            )}
          </div>

          <section className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm lg:sticky lg:top-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Elenco richieste</p>
                <h2 className="mt-1 text-lg font-black text-paradise-noir">{activeFilter === "JUSTIFY" ? "Da giustificare" : activeSection?.title}</h2>
                <p className="mt-0.5 text-xs text-black/45">
                  Seleziona una voce per mostrarne il dettaglio.
                </p>
              </div>
              <Badge tone={activeFilter === "JUSTIFY" ? "pink" : activeSection?.tone ?? "dark"}>{visibleRequests.length} richieste</Badge>
            </div>

            {visibleRequests.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-semibold text-black/35">
                Nessuna richiesta in questa sezione.
              </div>
            ) : (
              <div className="max-h-[72dvh] space-y-2 overflow-y-auto p-3">
                  {visibleRequests.map((request) => {
                    const isSelected = selectedRequest?.id === request.id;
                    const hasSicknessProblem = needsSicknessJustification(request);

                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => setSelectedRequestId(request.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition hover:border-paradise-pink/30 hover:bg-paradise-softPink/10",
                          isSelected ? "border-paradise-pink/50 bg-paradise-softPink/20 shadow-sm ring-2 ring-paradise-pink/10" : "border-black/5 bg-white"
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-neutral-50">
                            {getRequestIcon(request.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-paradise-noir">{employeeView ? requestTypeLabel(request) : request.employee}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">{employeeView ? request.employee : requestTypeLabel(request)}</p>
                              </div>
                              {!isSelected ? <span className="shrink-0 text-lg text-black/20">›</span> : null}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge tone={statusTone(request.status)}>{requestStatusLabel(request)}</Badge>
                              {hasSicknessProblem ? <Badge tone="pink">Manca protocollo</Badge> : null}
                            </div>
                            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-black/60">
                              <Calendar className="size-3.5 text-black/30" />
                              {formatDate(request.startDate)} <span className="text-black/20">→</span> {formatDate(request.endDate)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-black/45">
                              {request.adminNote?.trim() || request.reason?.trim() || "Nessuna nota inserita"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
