"use client";

import { ShiftDeadlineCountdown } from "@/components/shift-deadline-countdown";
import type { ShiftResponsiblePreview } from "@/lib/shift-responsible-preview";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Clock3, LockKeyhole, RefreshCw, ShieldCheck, UserRoundCheck } from "lucide-react";
import { ShiftResponsibleQuestions } from "@/components/shift-responsible-questions";
import type { ShiftResponsibleAccessDay } from "@/lib/shift-responsible-access";
import type { ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";
import type { ShiftAppointmentClient } from "@/lib/shift-responsible-appointments";

type Person = {
  id: string;
  name: string;
  photoUrl: string | null;
  shiftTime: string;
  attendanceStatus: string;
  clockIn: string | null;
};

type ShiftStaffMember = {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  shiftTime: string;
  clockIn?: string | null;
  delayMinutes?: number | null;
  attendanceStatus?: "IN" | "BREAK" | "OUT" | "NOT_CLOCKED" | "FERIE" | "MALATTIA" | "RIPOSO";
  pauseSummary?: string | null;
  workedHoursFormatted?: string | null;
  showAttendanceDetails?: boolean;
};

type TaskAssignee = { id: string; name: string; group: "Ufficio" | "Responsabile" };

type AccessResponse = {
  dayAccess: ShiftResponsibleAccessDay;
  selectedResponsibleId?: string;
  canEdit: boolean;
  currentUserId: string;
  requesterNames?: Record<string, string>;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function localDate(day: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${day}T12:00:00`));
}

function localTime(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(value));
}

export function ShiftResponsibleWorkspace({ day, currentUserId, currentUserName, selectedResponsibleId, people, questions, shiftStaff, appointmentClients, taskAssignees, initialAnswers, initialAccess, initialCanEdit, upcomingResponsibles }: {
  day: string;
  currentUserId: string;
  currentUserName: string;
  upcomingResponsibles: ShiftResponsiblePreview[];
  selectedResponsibleId?: string;
  people: Person[];
  questions: ShiftResponsibleQuestion[];
  shiftStaff: ShiftStaffMember[];
  appointmentClients: ShiftAppointmentClient[];
  taskAssignees: TaskAssignee[];
  initialAnswers: Record<string, string>;
  initialAccess: ShiftResponsibleAccessDay;
  initialCanEdit: boolean;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [canEdit, setCanEdit] = useState(initialCanEdit);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>(() => Object.fromEntries([...people.map((person) => [person.id, person.name] as const), [currentUserId, currentUserName]]));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [effectiveResponsibleId, setEffectiveResponsibleId] = useState(selectedResponsibleId);
  const isSelected = currentUserId === effectiveResponsibleId;
  const acknowledgement = access.acknowledgements[currentUserId];
  const permission = access.permissions[currentUserId];

  const refreshAccess = useCallback(async () => {
    const response = await fetch(`/api/shift-responsible-access?day=${encodeURIComponent(day)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as AccessResponse;
    setAccess(data.dayAccess);
    setCanEdit(data.canEdit);
    setEffectiveResponsibleId(data.selectedResponsibleId);
    if (data.requesterNames) setRequesterNames((current) => ({ ...current, ...data.requesterNames }));
  }, [day]);

  useEffect(() => {
    void refreshAccess();
    const timer = window.setInterval(() => void refreshAccess(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshAccess]);

  function runAction(action: "ACKNOWLEDGE" | "REQUEST" | "DECIDE", extra?: { requesterId: string; decision: "APPROVED" | "DENIED" }) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/shift-responsible-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, day, ...extra }),
      });
      const data = await response.json() as AccessResponse & { error?: string };
      if (!response.ok) {
        setMessage(data.error || "Operazione non riuscita");
        return;
      }
      setAccess(data.dayAccess);
      setCanEdit(data.canEdit);
    setEffectiveResponsibleId(data.selectedResponsibleId);
      if (data.requesterNames) setRequesterNames((current) => ({ ...current, ...data.requesterNames }));
      setMessage(action === "REQUEST" ? "Richiesta inviata al responsabile di turno" : action === "DECIDE" ? "Richiesta aggiornata" : "Presa visione registrata");
    });
  }

  const pendingRequests = Object.entries(access.permissions).filter(([, item]) => item.status === "PENDING");

  let gateTitle = "Presa visione responsabile";
  let gateText = "Conferma la presa visione per compilare il controllo del turno.";
  let gateAction: "ACKNOWLEDGE" | "REQUEST" | null = "ACKNOWLEDGE";
  let gateButton = "Attiva presa visione";
  if (!effectiveResponsibleId && permission?.status !== "APPROVED") {
    gateTitle = "In attesa del responsabile";
    gateText = "La compilazione si attiva dopo la timbratura del responsabile; nel suo giorno di riposo, dopo quella del vice in servizio.";
    gateAction = null;
  } else if (!isSelected && permission?.status !== "APPROVED") {
    gateTitle = permission?.status === "PENDING" ? "Permesso in attesa" : permission?.status === "DENIED" ? "Permesso non approvato" : "Accesso in sola lettura";
    gateText = permission?.status === "PENDING" ? "Il responsabile di turno ha ricevuto la richiesta." : "Chiedi al responsabile di turno il permesso per scrivere.";
    gateAction = permission?.status === "PENDING" ? null : "REQUEST";
    gateButton = permission?.status === "DENIED" ? "Invia una nuova richiesta" : "Richiedi permesso";
  } else if (!acknowledgement) {
    gateText = isSelected ? "Sei il responsabile assegnato oggi. Conferma prima di iniziare." : "Permesso approvato. Conferma la presa visione per iniziare.";
  }

  return (
    <section id="turno-oggi" className="mx-auto min-h-[calc(100vh-120px)] max-w-7xl scroll-mt-20 pb-8 sm:pb-10">
      <header className="mb-4 rounded-2xl border border-[#eadfe5] bg-white px-5 py-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9b365b]">Verbale di fine giornata</p>
        <h1 className="mt-2 text-xl font-bold capitalize tracking-tight text-[#392936] sm:text-2xl">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(new Date(`${day}T12:00:00Z`))}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm text-neutral-600">Responsabile di turno: <strong className="text-[#392936]">{people.find(person => person.id === effectiveResponsibleId)?.name || "In attesa della timbratura"}</strong></p>
          <span className="rounded-md bg-[#f0edef] px-2 py-1 text-[10px] font-semibold tracking-wide text-neutral-600">DA TURNISTICA</span>
        </div>
        <ShiftDeadlineCountdown day={day} />
      </header>
      <section className="hidden md:grid grid-cols-2 gap-2 border-b border-black/[0.08] px-1 pb-3 sm:gap-3 sm:px-2 lg:grid-cols-4" aria-label="Responsabili di oggi e dei prossimi giorni">
        {people.map((person, index) => {
          const selected = Boolean(person && person.id === effectiveResponsibleId);
          const seen = person ? access.acknowledgements[person.id] : undefined;
          return (
            <article key={person?.id ?? `empty-${index}`} className="flex min-w-0 flex-col items-center px-1.5 py-2 text-center sm:px-2">
              <div className={`relative grid size-12 place-items-center overflow-hidden rounded-full border-2 bg-[#eef1ef] text-sm font-black text-[#1c2720] transition sm:size-14 lg:size-16 ${selected ? "border-[#2ed65d] shadow-[0_8px_22px_rgba(46,214,93,0.2)]" : "border-[#dce3de]"}`}>
                {person?.photoUrl ? <img src={person.photoUrl} alt={`Foto di ${person.name}`} className={`size-full object-cover ${selected ? "" : "saturate-[0.82]"}`} /> : person ? initials(person.name) : "—"}
              </div>
              <h2 className="mt-2 line-clamp-2 min-h-[18px] w-full text-[7px] font-extrabold uppercase leading-[1.2] text-[#171b18] min-[390px]:text-[8px] sm:text-[10px] lg:text-xs">{person?.name || "Posto disponibile"}</h2>
              {selected && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[9px] font-bold text-white sm:text-xs"><ShieldCheck className="size-3 shrink-0" aria-hidden="true" />Compila oggi</span>}
              <p className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[7px] text-[#7b847e] min-[390px]:text-[8px] sm:text-[10px]"><Clock3 className="size-2.5" />{person?.shiftTime || "Non programmato"}</p>
              {person ? (
                <div className="mt-1.5 w-full border-t border-black/[0.07] pt-1.5 text-[6px] leading-relaxed text-[#7b847e] min-[390px]:text-[7px] sm:text-[9px]">
                  <p className={`font-black uppercase ${seen ? "text-[#1cab48]" : "text-[#929a95]"}`}>{seen ? "Presa visione attiva" : "Presa visione non attiva"}</p>
                  <p>{seen ? `${localDate(day)} · ${localTime(seen.at)}` : "Data e ora: —"}</p>
                  <p className="font-bold text-[#313833]">{seen?.shiftStatus || person.attendanceStatus}</p>
                  <p>Entrata: {seen?.clockIn || person.clockIn || "—"}</p>
                </div>
              ) : null}
            </article>
          );
        })}
        {upcomingResponsibles.map((preview, index) => {
          const plannedPerson = people.find(person => person.name === preview.name);
          const plannedShift = preview.people.find(person => person.name === preview.name);
          return <article key={preview.day} className="flex min-w-0 flex-col items-center px-1.5 py-2 text-center sm:px-2">
            <div className={`grid size-12 place-items-center overflow-hidden rounded-full border-2 sm:size-14 lg:size-16 ${preview.name ? "border-[#d8aec3] bg-[#faeaf2] text-[#94395e]" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
              {plannedPerson?.photoUrl ? <img src={plannedPerson.photoUrl} alt={`Foto di ${preview.name}`} className="size-full object-cover" /> : <Clock3 className="size-7" aria-hidden="true" />}
            </div>
            <p className="mt-2 text-xs font-bold uppercase text-[#94395e]">{index === 0 ? "Domani" : "Dopodomani"}</p>
            <p className="mt-1 text-xs text-neutral-500">{localDate(preview.day)}</p>
            <h2 className="mt-2 text-xs font-extrabold uppercase text-[#171b18]">{preview.name || "Subentro da definire"}</h2>
            {plannedShift && <p className="mt-1 text-xs text-neutral-600">{plannedShift.start} – {plannedShift.end}</p>}
            <div className="mt-1.5 w-full border-t border-black/[0.07] pt-1.5 text-xs leading-relaxed text-neutral-600">
              <p>{preview.detail}</p>
              {!preview.name && preview.people.map(person => <p key={person.name} className="mt-1"><strong>{person.name}</strong> · {person.category}{person.start && person.end ? ` · ${person.start}–${person.end}` : ""}</p>)}
            </div>
          </article>;
        })}
      </section>

      {isSelected && pendingRequests.length ? (
        <section className="mx-auto mt-6 max-w-4xl rounded-2xl border border-[#f0c36d] bg-[#fff8e6] p-4 shadow-sm" aria-label="Richieste di permesso">
          <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#9b6500]" /><h2 className="text-sm font-black text-[#4b390e]">Richieste da autorizzare</h2></div>
          <div className="mt-3 space-y-2">
            {pendingRequests.map(([requesterId]) => <div key={requesterId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><p className="text-xs font-bold text-[#3c4043]">{requesterNames[requesterId] || "Altro responsabile"} vuole modificare il turno</p><div className="flex gap-2"><button disabled={isPending} onClick={() => runAction("DECIDE", { requesterId, decision: "DENIED" })} className="min-h-10 rounded-lg border border-black/10 px-4 text-[10px] font-black">Rifiuta</button><button disabled={isPending} onClick={() => runAction("DECIDE", { requesterId, decision: "APPROVED" })} className="min-h-10 rounded-lg bg-[#414141] px-4 text-[10px] font-black text-white">Approva</button></div></div>)}
          </div>
        </section>
      ) : null}

      <div className={`relative ${!canEdit ? "min-h-[430px]" : ""}`}>
          <div className={!canEdit ? "pointer-events-none select-none opacity-[0.18] blur-[1px]" : ""} aria-hidden={!canEdit}>
          <ShiftResponsibleQuestions overview responsibleName={people.find(person => person.id === effectiveResponsibleId)?.name} day={day} questions={questions} shiftStaff={shiftStaff} appointmentClients={appointmentClients} taskAssignees={taskAssignees} initialAnswers={initialAnswers} onSaved={refreshAccess} />
        </div>
        {!canEdit ? (
          <div className="absolute inset-x-0 top-8 z-10 mx-auto grid min-h-[380px] max-w-4xl place-items-center rounded-[28px] border border-[#2ed65d]/20 bg-[#172019]/95 px-6 text-center text-white shadow-2xl backdrop-blur sm:min-h-[430px]">
            <div className="max-w-md">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10"><LockKeyhole className="size-6" /></span>
              <h2 className="mt-5 text-lg font-black uppercase tracking-wide">{gateTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/70">{gateText}</p>
              {gateAction ? <button type="button" disabled={isPending} onClick={() => runAction(gateAction)} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2ed65d] px-6 text-xs font-black text-[#102116] shadow-[0_10px_28px_rgba(46,214,93,0.28)] transition hover:bg-[#46df71] disabled:opacity-50">{gateAction === "REQUEST" ? <UserRoundCheck className="size-4" /> : <Check className="size-4" />}{isPending ? "Attendi…" : gateButton}</button> : <button type="button" onClick={() => void refreshAccess()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-xs font-bold"><RefreshCw className="size-4" />Aggiorna stato</button>}
              {message ? <p role="status" className="mt-4 text-[10px] font-bold text-[#d9ffc7]">{message}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

    </section>
  );
}
