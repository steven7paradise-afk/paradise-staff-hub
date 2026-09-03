"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CalendarClock, Check, CheckCircle2, ListTodo, LoaderCircle, Plus, Star, Trash2, Upload, UserRound, X } from "lucide-react";
import { activeShiftFollowUps, type ShiftResponsibleAnswer, type ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";
import type { ShiftAppointmentClient } from "@/lib/shift-responsible-appointments";

type SaveStatus = "saving" | "saved" | "error";
type ShiftStaffMember = { id: string; name: string; role: string; photoUrl: string | null; shiftTime: string };
type TaskAssignee = { id: string; name: string; group: "Ufficio" | "Responsabile" };

function answerTypeName(type: ShiftResponsibleQuestion["answerType"]) {
  return ({ SHORT_TEXT: "Risposta breve", TEXT: "Paragrafo", MULTI_TEXT: "Risposte scritte multiple", TIMELINE: "Timeline ora + nota", MULTIPLE_CHOICE: "Scelta multipla", CHECKBOXES: "Caselle di controllo", DROPDOWN: "Elenco a discesa", FILE_UPLOAD: "Caricamento file", LINEAR_SCALE: "Scala lineare", RATING: "Classificazione", MULTIPLE_CHOICE_GRID: "Griglia a scelta multipla", CHECKBOX_GRID: "Griglia con caselle", DATE: "Data", TIME: "Ora", STAFF_NOTE: "Collega allo staff", CLIENT_NOTE: "Collega a cliente", TASK: "Genera task", YES_NO: "SÌ / NO" } as Record<ShiftResponsibleQuestion["answerType"], string>)[type];
}

export function ShiftResponsibleQuestions({ day, questions, shiftStaff, appointmentClients, taskAssignees, initialAnswers, onSaved }: { day: string; questions: ShiftResponsibleQuestion[]; shiftStaff: ShiftStaffMember[]; appointmentClients: ShiftAppointmentClient[]; taskAssignees: TaskAssignee[]; initialAnswers: Record<string, string>; onSaved?: () => void | Promise<void> }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialAnswers);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [, startTransition] = useTransition();

  function answer(questionId: string, value: string) {
    const previousAnswers = answers;
    setAnswers((current) => {
      const next = { ...current, [questionId]: value };
      if (!questionId.includes("::")) {
        Object.keys(next).filter((key) => key.startsWith(`${questionId}::`)).forEach((key) => delete next[key]);
      }
      return next;
    });
    setSaveStatuses((current) => {
      const next = { ...current, [questionId]: "saving" as const };
      if (!questionId.includes("::")) {
        Object.keys(next).filter((key) => key.startsWith(`${questionId}::`)).forEach((key) => delete next[key]);
      }
      return next;
    });
    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-answers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day, questionId, answer: value }),
        });
        const savedAnswers = await response.json() as Record<string, string> & { error?: string };
        if (!response.ok) throw new Error(savedAnswers.error || "Errore");
        if (typeof savedAnswers[questionId] === "string") setAnswers((current) => ({ ...current, [questionId]: savedAnswers[questionId] }));
        setSaveStatuses((current) => ({ ...current, [questionId]: "saved" }));
        void onSaved?.();
      } catch {
        setAnswers(previousAnswers);
        setSaveStatuses((current) => ({ ...current, [questionId]: "error" }));
      }
    });
  }

  function saveWrittenAnswer(questionId: string) {
    const value = drafts[questionId]?.trim();
    if (!value) return;
    const previousAnswers = answers;
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setSaveStatuses((current) => ({ ...current, [questionId]: "saving" }));
    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-answers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day, questionId, answer: value }),
        });
        if (!response.ok) throw new Error("Errore");
        setSaveStatuses((current) => ({ ...current, [questionId]: "saved" }));
        void onSaved?.();
      } catch {
        setAnswers(previousAnswers);
        setSaveStatuses((current) => ({ ...current, [questionId]: "error" }));
      }
    });
  }

  if (questions.length === 0) return null;
  const progressQuestions = questions.filter((question) => question.required !== false);
  const isQuestionComplete = (question: ShiftResponsibleQuestion) => {
    const primaryAnswer = answers[question.id];
    if (!primaryAnswer) return false;
    return activeShiftFollowUps(question, primaryAnswer).every((followUp) => Boolean(answers[`${question.id}::${followUp.key}`]));
  };
  const completedQuestionIds = new Set(questions.filter(isQuestionComplete).map((question) => question.id));
  const completedQuestions = progressQuestions.filter(isQuestionComplete).length;
  const completion = progressQuestions.length ? Math.round((completedQuestions / progressQuestions.length) * 100) : 100;
  const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00`));

  return (
    <section className="mx-auto mt-7 max-w-6xl" aria-label="Domande del turno">
      <div className="mb-6 border-b border-black/[0.08] px-1 pb-6 sm:px-2 sm:pb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#16883a]">Controllo giornaliero</p>
            <p className="mt-1 text-lg font-semibold text-[#171b18] sm:text-xl">Completa il turno</p>
            <p className="mt-1 text-[10px] capitalize text-[#7b847e] sm:text-xs">{dayLabel}</p>
          </div>
          <div className="grid size-14 shrink-0 place-items-center rounded-full border-[5px] border-[#dff7e6] bg-[#effdf3] text-xs font-black text-[#16883a] sm:size-16">{completion}%</div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-[9px] font-bold text-[#7b847e]"><span>{completedQuestions} completate</span><span>{Math.max(progressQuestions.length - completedQuestions, 0)} da completare</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3ebe5]" aria-label={`Completamento ${completion}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
          <div className="h-full rounded-full bg-[#2ed65d] transition-[width] duration-300" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="mb-4 xl:hidden">
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#7b847e]">Vai a una domanda</p>
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Vai a una domanda">
          {questions.map((question, index) => {
            const complete = completedQuestionIds.has(question.id);
            return <a key={question.id} href={`#turno-domanda-${index + 1}`} aria-label={`Vai alla domanda ${index + 1}: ${question.title}`} className={`relative grid size-10 shrink-0 place-items-center rounded-full border text-[10px] font-black ${complete ? "border-[#2ed65d] bg-[#2ed65d] text-white" : "border-black/10 bg-white text-[#7b847e]"}`}>{index + 1}{complete ? <Check className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-white p-0.5 text-[#16883a]" strokeWidth={4} /> : null}</a>;
          })}
        </nav>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden border-r border-black/[0.08] py-2 pr-5 xl:block">
          <p className="px-3 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#7b847e]">Domande del turno</p>
          <nav className="space-y-1" aria-label="Indice delle domande">
            {questions.map((question, index) => {
              const complete = completedQuestionIds.has(question.id);
              return <a key={question.id} href={`#turno-domanda-${index + 1}`} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-[#f3faf5]">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-black ${complete ? "bg-[#2ed65d] text-white" : "bg-[#f0f3f1] text-[#7b847e]"}`}>{complete ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}</span>
                <span className="line-clamp-2 text-[10px] font-semibold leading-snug text-[#4f5752] group-hover:text-[#171b18]">{question.title}</span>
              </a>;
            })}
          </nav>
        </aside>

        <div>
        {questions.map((question, index) => (
          <article id={`turno-domanda-${index + 1}`} key={question.id} className="relative scroll-mt-24 border-b border-black/[0.08] px-1 py-7 transition last:border-b-0 sm:px-3 sm:py-9">
            <div className={`absolute bottom-6 left-0 top-6 w-0.5 rounded-full ${answers[question.id] ? "bg-[#2ed65d]" : "bg-transparent"}`} />
            <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#80868b]">Domanda {index + 1} di {questions.length}</p>
                <h2 className="mt-2 text-sm font-semibold leading-snug text-[#202124] sm:text-base">{question.title}{question.required !== false ? <span className="ml-1 text-[#d93025]">*</span> : null}</h2>
                {question.description ? <p className="mt-1.5 text-[10px] leading-relaxed text-[#5f6368] sm:text-xs">{question.description}</p> : null}
                {question.followUpYes || question.followUpNo || Object.keys(question.followUps ?? {}).length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {question.followUpYes ? <span className="rounded-full bg-[#f2f7ef] px-2 py-1 text-[8px] font-bold uppercase text-[#44842a]">Dopo {question.yesLabel || "Sì"} chiede dettagli</span> : null}
                    {question.followUpNo ? <span className="rounded-full bg-[#fff1f3] px-2 py-1 text-[8px] font-bold uppercase text-[#a45a6a]">Dopo {question.noLabel || "No"} chiede dettagli</span> : null}
                    {Object.keys(question.followUps ?? {}).length ? <span className="rounded-full bg-[#f0fcf4] px-2 py-1 text-[8px] font-bold uppercase text-[#16883a]">Varianti attive</span> : null}
                  </div>
                ) : <span className="mt-2 inline-flex rounded-full bg-[#f1f3f4] px-2 py-1 text-[8px] font-bold uppercase text-[#5f6368]">{answerTypeName(question.answerType)}</span>}
            </div>
            {question.answerType === "YES_NO" ? <AnswerButtons selected={answers[question.id]} yesLabel={question.yesLabel || "Sì"} noLabel={question.noLabel || "No"} onAnswer={(value) => answer(question.id, value)} /> : null}
            {question.answerType === "YES_NO" && answers[question.id] ? <SaveStatusLine status={saveStatuses[question.id] ?? "saved"} /> : null}

            {["MULTIPLE_CHOICE", "DROPDOWN"].includes(question.answerType) ? (
              <MultipleChoiceAnswer
                options={question.options ?? []}
                allowOther={question.answerType === "MULTIPLE_CHOICE" && question.allowOther === true}
                dropdown={question.answerType === "DROPDOWN"}
                selected={answers[question.id]}
                status={saveStatuses[question.id]}
                onAnswer={(value) => answer(question.id, value)}
              />
            ) : null}

            {["SHORT_TEXT", "TEXT", "DATE", "TIME"].includes(question.answerType) ? (
              <WrittenAnswer
                questionId={question.id}
                value={drafts[question.id] ?? ""}
                kind={question.answerType}
                saved={Boolean(answers[question.id]) && answers[question.id] === drafts[question.id]?.trim()}
                status={saveStatuses[question.id]}
                onChange={(value) => {
                  setDrafts((current) => ({ ...current, [question.id]: value }));
                  setSaveStatuses((current) => {
                    const next = { ...current };
                    delete next[question.id];
                    return next;
                  });
                }}
                onSave={() => saveWrittenAnswer(question.id)}
              />
            ) : question.answerType === "MULTI_TEXT" ? <MultiTextAnswer labels={question.options ?? []} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
              : question.answerType === "TIMELINE" ? <TimelineAnswer selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
              : question.answerType === "CHECKBOXES" ? <CheckboxAnswer options={question.options ?? []} allowOther={question.allowOther === true} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
              : ["LINEAR_SCALE", "RATING"].includes(question.answerType) ? <ScaleAnswer question={question} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
                : ["MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(question.answerType) ? <GridAnswer question={question} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
                  : question.answerType === "FILE_UPLOAD" ? <FileUploadAnswer day={day} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
                    : question.answerType === "STAFF_NOTE" ? <StaffNoteAnswer staff={shiftStaff} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
                      : question.answerType === "CLIENT_NOTE" ? <ClientNoteAnswer clients={appointmentClients} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
                        : question.answerType === "TASK" ? <TaskAnswer assignees={taskAssignees} selected={answers[question.id]} status={saveStatuses[question.id]} onAnswer={(value) => answer(question.id, value)} />
            : null}

            {activeShiftFollowUps(question, answers[question.id]).map((followUp) => {
              const answerKey = `${question.id}::${followUp.key}`;
              return <div key={followUp.key} className="responsible-picker mt-4 rounded-lg border border-[#2ed65d]/15 bg-[#f8fbf9] p-4">
                <p className="text-[11px] font-semibold text-[#3c4043]">{followUp.prompt}</p>
                <WrittenAnswer
                  questionId={answerKey}
                  value={drafts[answerKey] ?? ""}
                  saved={Boolean(answers[answerKey]) && answers[answerKey] === drafts[answerKey]?.trim()}
                  status={saveStatuses[answerKey]}
                  onChange={(value) => {
                    setDrafts((current) => ({ ...current, [answerKey]: value }));
                    setSaveStatuses((current) => {
                      const next = { ...current };
                      delete next[answerKey];
                      return next;
                    });
                  }}
                  onSave={() => saveWrittenAnswer(answerKey)}
                />
              </div>;
            })}
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}

function MultipleChoiceAnswer({ options, allowOther, dropdown, selected, status, onAnswer }: { options: string[]; allowOther: boolean; dropdown: boolean; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const [other, setOther] = useState(selected?.startsWith("Altro: ") ? selected.slice(7) : "");
  if (dropdown) return <div className="mt-3 border-t border-black/10 pt-3"><select value={selected ?? ""} onChange={(event) => event.target.value && onAnswer(event.target.value)} className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-xs"><option value="">Seleziona…</option>{options.map((option, index) => <option key={`${option}-${index}`}>{option}</option>)}</select>{selected ? <SaveStatusLine status={status ?? "saved"} /> : null}</div>;
  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option, index) => (
          <button key={`${option}-${index}`} type="button" onClick={() => onAnswer(option)} aria-pressed={selected === option} className={`min-h-11 rounded-lg border px-3 text-left text-[10px] font-semibold transition ${selected === option ? "border-[#2ed65d] bg-[#f0fcf4] text-[#16883a] ring-1 ring-[#2ed65d]/20" : "border-black/10 bg-white text-[#3c4043]"}`}>
            <span className={`mr-2 inline-block size-3 rounded-full border align-[-2px] ${selected === option ? "border-[#2ed65d] bg-[#2ed65d]" : "border-black/25"}`} />{option}
          </button>
        ))}
      </div>
      {allowOther ? (
        <div className="mt-2 flex gap-2">
          <input value={other} onChange={(event) => setOther(event.target.value)} placeholder="Altro…" className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#72dc42]" />
          <button type="button" onClick={() => other.trim() && onAnswer(`Altro: ${other.trim()}`)} disabled={!other.trim() || status === "saving"} className="rounded-xl bg-[#171b18] px-4 text-[9px] font-black text-white disabled:opacity-40">Conferma</button>
        </div>
      ) : null}
      {selected ? <SaveStatusLine status={status ?? "saved"} /> : null}
    </div>
  );
}

function parseMultiText(value?: string) {
  try {
    const parsed = JSON.parse(value || "") as { textEntries?: unknown };
    if (!Array.isArray(parsed.textEntries)) return {};
    return Object.fromEntries(parsed.textEntries.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as { label?: unknown; value?: unknown };
      return typeof entry.label === "string" && typeof entry.value === "string" ? [[entry.label, entry.value] as const] : [];
    }));
  } catch {
    return {};
  }
}

type TimelineEntry = { time: string; note: string };

function parseTimeline(value?: string): TimelineEntry[] {
  try {
    const parsed = JSON.parse(value || "") as { timelineEntries?: unknown };
    if (!Array.isArray(parsed.timelineEntries)) return [];
    return parsed.timelineEntries.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as { time?: unknown; note?: unknown };
      return typeof entry.time === "string" && typeof entry.note === "string" ? [{ time: entry.time, note: entry.note }] : [];
    }).slice(0, 10).sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

function TimelineAnswer({ selected, status, onAnswer }: { selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const savedEntries = parseTimeline(selected);
  const [rows, setRows] = useState<TimelineEntry[]>(savedEntries.length ? savedEntries : [{ time: "", note: "" }]);
  const prepared = rows.map((row) => ({ time: row.time, note: row.note.trim() })).sort((a, b) => a.time.localeCompare(b.time));
  const complete = prepared.length > 0 && prepared.every((row) => /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) && row.note.length > 0);
  const serialized = JSON.stringify({ timelineEntries: prepared });
  const savedSerialized = JSON.stringify({ timelineEntries: savedEntries });
  const isSaved = Boolean(selected) && serialized === savedSerialized;

  return <div className="mt-4 border-t border-black/[0.06] pt-4">
    <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[25px] before:top-6 before:w-px before:bg-[#b7eac5] sm:before:left-[37px]">
      {rows.map((row, index) => <div key={index} className="relative grid grid-cols-[52px_minmax(0,1fr)_36px] gap-2 rounded-xl border border-black/10 bg-[#f8fbf9] p-2 sm:grid-cols-[76px_minmax(0,1fr)_40px] sm:gap-3 sm:p-3">
        <input type="time" value={row.time} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, time: event.target.value } : item))} aria-label={`Ora evento ${index + 1}`} className="relative z-10 h-11 min-w-0 rounded-lg border border-[#2ed65d]/20 bg-[#eefbf2] px-1 text-[9px] font-black text-[#16883a] outline-none focus:border-[#2ed65d] sm:px-2 sm:text-[10px]" />
        <textarea value={row.note} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, note: event.target.value } : item))} rows={2} maxLength={1000} aria-label={`Nota evento ${index + 1}`} placeholder="Scrivi una nota libera…" className="min-h-11 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#2ed65d]" />
        <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length <= 1} className="grid size-9 place-items-center self-center rounded-full text-black/35 hover:bg-[#fff1f3] hover:text-[#b33e53] disabled:opacity-20" aria-label={`Elimina evento ${index + 1}`}><Trash2 className="size-4" /></button>
      </div>)}
    </div>
    {rows.length < 10 ? <button type="button" onClick={() => setRows((current) => [...current, { time: "", note: "" }])} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#2ed65d]/20 bg-[#f0fcf4] px-4 text-[9px] font-black text-[#16883a]"><Plus className="size-4" />Aggiungi ora e nota ({rows.length}/10)</button> : null}
    <div className="mt-3 flex items-center justify-end gap-2">
      {status === "saving" || status === "error" ? <SaveStatusLine status={status} /> : isSaved ? <SaveStatusLine status="saved" /> : null}
      <button type="button" onClick={() => onAnswer(serialized)} disabled={!complete || status === "saving" || isSaved} className="min-h-10 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">{status === "saving" ? "Salvataggio…" : isSaved ? "Timeline salvata" : status === "error" ? "Riprova" : "Salva timeline"}</button>
    </div>
  </div>;
}

function MultiTextAnswer({ labels, selected, status, onAnswer }: { labels: string[]; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const savedValues = parseMultiText(selected);
  const [values, setValues] = useState<Record<string, string>>(savedValues);
  const prepared = labels.map((label) => ({ label, value: values[label]?.trim() || "" }));
  const serialized = JSON.stringify({ textEntries: prepared });
  const savedSerialized = JSON.stringify({ textEntries: labels.map((label) => ({ label, value: savedValues[label]?.trim() || "" })) });
  const complete = prepared.length > 0 && prepared.every((entry) => entry.value);
  const isSaved = Boolean(selected) && serialized === savedSerialized;

  return <div className="mt-4 border-t border-black/[0.06] pt-4"><div className="grid gap-3 sm:grid-cols-2">{labels.map((label, index) => <label key={`${label}-${index}`} className="rounded-xl border border-black/10 bg-[#f8fbf9] p-3"><span className="text-[9px] font-black uppercase tracking-wide text-[#16883a]">{label}</span><textarea value={values[label] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [label]: event.target.value }))} rows={2} maxLength={1000} placeholder={`Scrivi ${label.toLocaleLowerCase("it")}…`} className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#2ed65d]" /></label>)}</div><div className="mt-3 flex items-center justify-end gap-2">{status === "saving" || status === "error" ? <SaveStatusLine status={status} /> : isSaved ? <SaveStatusLine status="saved" /> : null}<button type="button" onClick={() => onAnswer(serialized)} disabled={!complete || status === "saving" || isSaved} className="min-h-10 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">{status === "saving" ? "Salvataggio…" : isSaved ? "Risposte salvate" : status === "error" ? "Riprova" : "Salva risposte"}</button></div></div>;
}

function CheckboxAnswer({ options, allowOther, selected, status, onAnswer }: { options: string[]; allowOther: boolean; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const parsed = (() => { try { const value = JSON.parse(selected || "[]"); return Array.isArray(value) ? value as string[] : []; } catch { return []; } })();
  const [other, setOther] = useState("");
  function toggle(value: string) {
    const next = parsed.includes(value) ? parsed.filter((item) => item !== value) : [...parsed, value];
    if (next.length) onAnswer(JSON.stringify(next));
  }
  return <div className="mt-4 border-t border-black/[0.06] pt-4"><div className="grid gap-2 sm:grid-cols-2">{options.map((option, index) => <button key={`${option}-${index}`} type="button" onClick={() => toggle(option)} aria-pressed={parsed.includes(option)} className={`min-h-11 rounded-lg border px-3 text-left text-[10px] font-semibold ${parsed.includes(option) ? "border-[#2ed65d] bg-[#f0fcf4] text-[#16883a]" : "border-black/10 bg-white text-[#3c4043]"}`}><span className={`mr-2 inline-grid size-4 place-items-center rounded border ${parsed.includes(option) ? "border-[#2ed65d] bg-[#2ed65d] text-white" : "border-black/25"}`}>{parsed.includes(option) ? "✓" : ""}</span>{option}</button>)}</div>{allowOther ? <div className="mt-2 flex gap-2"><input value={other} onChange={(event) => setOther(event.target.value)} placeholder="Altro…" className="h-10 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 text-xs" /><button type="button" disabled={!other.trim()} onClick={() => onAnswer(JSON.stringify([...parsed.filter((item) => !item.startsWith("Altro: ")), `Altro: ${other.trim()}`]))} className="rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">Aggiungi</button></div> : null}{selected ? <SaveStatusLine status={status ?? "saved"} /> : null}</div>;
}

function ScaleAnswer({ question, selected, status, onAnswer }: { question: ShiftResponsibleQuestion; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const min = question.answerType === "RATING" ? 1 : question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  return <div className="mt-4 border-t border-black/[0.06] pt-4"><div className="flex flex-wrap gap-2">{Array.from({ length: max - min + 1 }, (_, index) => index + min).map((value) => <button key={value} type="button" onClick={() => onAnswer(String(value))} aria-pressed={selected === String(value)} className={`grid size-11 place-items-center rounded-lg border text-sm font-black ${selected === String(value) ? "border-[#2ed65d] bg-[#f0fcf4] text-[#16883a]" : "border-black/10 bg-white text-black/55"}`}>{question.answerType === "RATING" ? <Star className={`size-5 ${selected && Number(selected) >= value ? "fill-[#2ed65d] text-[#2ed65d]" : "text-black/25"}`} /> : value}</button>)}</div>{selected ? <SaveStatusLine status={status ?? "saved"} /> : null}</div>;
}

function GridAnswer({ question, selected, status, onAnswer }: { question: ShiftResponsibleQuestion; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const parsed = (() => { try { const value = JSON.parse(selected || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string | string[]> : {}; } catch { return {}; } })();
  function choose(row: string, option: string) {
    const current = parsed[row];
    const value = question.answerType === "CHECKBOX_GRID" ? Array.isArray(current) ? (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]) : [option] : option;
    onAnswer(JSON.stringify({ ...parsed, [row]: value }));
  }
  return <div className="mt-4 overflow-x-auto border-t border-black/[0.06] pt-4"><table className="min-w-full text-[9px]"><thead><tr><th className="p-2 text-left" />{question.options?.map((option, optionIndex) => <th key={`${option}-${optionIndex}`} className="min-w-20 p-2 text-center font-bold text-black/55">{option}</th>)}</tr></thead><tbody>{question.rows?.map((row, rowIndex) => <tr key={`${row}-${rowIndex}`} className="border-t border-black/[0.06]"><th className="p-2 text-left font-bold text-black/65">{row}</th>{question.options?.map((option, optionIndex) => { const current = parsed[row]; const active = Array.isArray(current) ? current.includes(option) : current === option; return <td key={`${option}-${optionIndex}`} className="p-2 text-center"><button type="button" onClick={() => choose(row, option)} aria-pressed={active} className={`mx-auto grid size-8 place-items-center border ${question.answerType === "CHECKBOX_GRID" ? "rounded-md" : "rounded-full"} ${active ? "border-[#2ed65d] bg-[#f0fcf4] text-[#16883a]" : "border-black/20 bg-white"}`}>{active ? "✓" : ""}</button></td>; })}</tr>)}</tbody></table>{selected ? <SaveStatusLine status={status ?? "saved"} /> : null}</div>;
}

function FileUploadAnswer({ day, selected, status, onAnswer }: { day: string; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const file = (() => { try { return JSON.parse(selected || "null") as { name?: string; url?: string } | null; } catch { return null; } })();
  async function upload(selectedFile?: File) {
    if (!selectedFile) return;
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.append("file", selectedFile); form.append("day", day);
      const response = await fetch("/api/shift-responsible-answers/upload", { method: "POST", body: form });
      const data = await response.json() as { error?: string; name?: string; url?: string; driveFileId?: string; type?: string };
      if (!response.ok) throw new Error(data.error || "Caricamento non riuscito");
      onAnswer(JSON.stringify(data));
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Caricamento non riuscito"); }
    finally { setUploading(false); }
  }
  return <div className="mt-3 border-t border-black/10 pt-3"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[10px] font-black text-black/65"><Upload className="size-4" />{uploading ? "Caricamento…" : file?.name || "Carica file"}<input type="file" className="hidden" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} /></label>{file?.url ? <a href={file.url} target="_blank" rel="noreferrer" className="ml-3 text-[9px] font-bold text-[#2ed65d] underline">Apri su Drive</a> : null}{error ? <p role="alert" className="mt-2 text-[9px] font-bold text-[#b33e53]">{error}</p> : null}{selected ? <SaveStatusLine status={status ?? "saved"} /> : null}</div>;
}

function WrittenAnswer({ questionId, value, kind = "TEXT", saved, status, onChange, onSave }: { questionId: string; value: string; kind?: ShiftResponsibleQuestion["answerType"]; saved: boolean; status?: SaveStatus; onChange: (value: string) => void; onSave: () => void }) {
  return (
    <div className="mt-2" data-question-id={questionId}>
      {kind === "TEXT" ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Scrivi qui la risposta…" rows={3} maxLength={1000} className="w-full resize-none border-0 border-b-2 border-black/20 bg-[#f8f9fa] px-3 py-3 text-xs font-medium text-[#202124] outline-none focus:border-[#2ed65d]" />
        : <input type={kind === "DATE" ? "date" : kind === "TIME" ? "time" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Scrivi qui la risposta…" maxLength={1000} className="h-11 w-full border-0 border-b-2 border-black/20 bg-[#f8f9fa] px-3 text-xs font-medium text-[#202124] outline-none focus:border-[#2ed65d]" />}
      <div className="mt-2 flex items-center justify-end gap-2">
        {status || saved ? <SaveStatusLine status={status ?? "saved"} /> : null}
        <button type="button" onClick={onSave} disabled={!value.trim() || status === "saving" || saved} className="min-h-9 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">
          {status === "saving" ? "Salvataggio…" : saved ? "Salvata" : status === "error" ? "Riprova" : "Salva risposta"}
        </button>
      </div>
    </div>
  );
}

function parseStaffNotes(value?: string) {
  try {
    const parsed = JSON.parse(value || "") as { staffNotes?: unknown; staffId?: unknown; name?: unknown; note?: unknown };
    if (Array.isArray(parsed.staffNotes)) {
      return Object.fromEntries(parsed.staffNotes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { staffId?: unknown; note?: unknown };
        return typeof entry.staffId === "string" && typeof entry.note === "string" ? [[entry.staffId, entry.note] as const] : [];
      }));
    }
    if (typeof parsed.staffId === "string" && typeof parsed.name === "string") {
      return { [parsed.staffId]: typeof parsed.note === "string" ? parsed.note : "" };
    }
  } catch { /* risposta non ancora salvata */ }
  return {};
}

function StaffNoteAnswer({ staff, selected, status, onAnswer }: { staff: ShiftStaffMember[]; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const savedNotes = parseStaffNotes(selected);
  const [notes, setNotes] = useState<Record<string, string>>(savedNotes);
  const preparedNotes = staff.flatMap((person) => {
    const note = notes[person.id]?.trim();
    return note ? [{ staffId: person.id, name: person.name, note }] : [];
  });
  const serialized = JSON.stringify({ staffNotes: preparedNotes });
  const savedSerialized = JSON.stringify({ staffNotes: staff.flatMap((person) => {
    const note = savedNotes[person.id]?.trim();
    return note ? [{ staffId: person.id, name: person.name, note }] : [];
  }) });
  const isSaved = Boolean(selected) && serialized === savedSerialized;

  if (!staff.length) {
    return <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-[#f8f9fa] px-4 py-6 text-center text-[10px] font-semibold text-[#5f6368]">Nessun membro dello staff risulta programmato in questo turno.</div>;
  }

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-4">
      <div className="space-y-2">
        {staff.map((person) => (
          <label key={person.id} className="grid gap-3 rounded-xl border border-black/10 bg-white p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] sm:items-center">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ececec] text-black/35">{person.photoUrl ? <img src={person.photoUrl} alt="" className="size-full object-cover" /> : <UserRound className="size-4" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-[#202124]">{person.name}</span><span className="mt-0.5 block truncate text-[8px] text-[#5f6368]">{person.role} · {person.shiftTime}</span></span>
            </span>
            <span><span className="sr-only">Nota per {person.name}</span><textarea value={notes[person.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [person.id]: event.target.value }))} rows={2} maxLength={400} placeholder={`Nota per ${person.name}…`} className="w-full resize-none rounded-lg border border-black/10 bg-[#f8f9fa] px-3 py-2.5 text-xs outline-none focus:border-[#2ed65d] focus:bg-white" /></span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {status === "saving" || status === "error" ? <SaveStatusLine status={status} /> : isSaved ? <SaveStatusLine status="saved" /> : null}
        <button type="button" onClick={() => onAnswer(serialized)} disabled={!preparedNotes.length || status === "saving" || isSaved} className="min-h-10 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">{status === "saving" ? "Salvataggio…" : isSaved ? "Note salvate" : status === "error" ? "Riprova" : "Salva note staff"}</button>
      </div>
    </div>
  );
}

function parseClientNote(value?: string) {
  try {
    const parsed = JSON.parse(value || "") as { clientNotes?: unknown; appointmentId?: unknown; note?: unknown };
    if (Array.isArray(parsed.clientNotes)) {
      return parsed.clientNotes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { appointmentId?: unknown; note?: unknown };
        return typeof entry.appointmentId === "string" && typeof entry.note === "string"
          ? [{ appointmentId: entry.appointmentId, note: entry.note }]
          : [];
      }).slice(0, 10);
    }
    if (typeof parsed.appointmentId === "string") {
      return [{ appointmentId: parsed.appointmentId, note: typeof parsed.note === "string" ? parsed.note : "" }];
    }
  } catch {
    // Risposta non ancora salvata.
  }
  return [];
}

function ClientNoteAnswer({ clients, selected, status, onAnswer }: { clients: ShiftAppointmentClient[]; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const saved = parseClientNote(selected);
  const [rows, setRows] = useState(saved.length ? saved : [{ appointmentId: "", note: "" }]);
  const preparedNotes = rows.flatMap((row) => {
    const client = clients.find((item) => item.id === row.appointmentId);
    return client && row.note.trim() ? [{ appointmentId: client.id, name: client.name, time: client.time, service: client.service, note: row.note.trim() }] : [];
  });
  const serialized = JSON.stringify({ clientNotes: preparedNotes });
  const savedSerialized = JSON.stringify({ clientNotes: saved.flatMap((row) => {
    const client = clients.find((item) => item.id === row.appointmentId);
    return client && row.note.trim() ? [{ appointmentId: client.id, name: client.name, time: client.time, service: client.service, note: row.note.trim() }] : [];
  }) });
  const isSaved = Boolean(selected) && serialized === savedSerialized;

  if (!clients.length) {
    return <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-[#f8f9fa] px-4 py-6 text-center text-[10px] font-semibold text-[#5f6368]">Nessuna cliente risulta negli appuntamenti di Buenos Aires oggi.</div>;
  }

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-4">
      <div className="space-y-3">
        {rows.map((row, index) => {
          const client = clients.find((item) => item.id === row.appointmentId);
          const selectedIds = new Set(rows.map((item) => item.appointmentId).filter(Boolean));
          return <div key={index} className="rounded-xl border border-black/10 bg-[#f8fbf9] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-wide text-[#16883a]">Cliente {index + 1}</p>{rows.length > 1 ? <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="grid size-9 place-items-center rounded-full text-black/40 hover:bg-[#fff1f3] hover:text-[#b33e53]" aria-label={`Rimuovi cliente ${index + 1}`}><Trash2 className="size-4" /></button> : null}</div>
            <select value={row.appointmentId} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { appointmentId: event.target.value, note: "" } : item))} aria-label={`Cliente ${index + 1} dagli appuntamenti`} className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#3c4043] outline-none focus:border-[#2ed65d]">
              <option value="">Seleziona una cliente…</option>
              {clients.filter((item) => item.id === row.appointmentId || !selectedIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.time} · {item.name} · {item.service}</option>)}
            </select>
            {client ? <div className="mt-2 flex items-center gap-2 text-[9px] text-[#5f6368]"><CalendarClock className="size-4 shrink-0 text-[#2ed65d]" /><span>{client.time} · {client.service}</span></div> : null}
            <textarea value={row.note} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, note: event.target.value } : item))} disabled={!client} rows={2} maxLength={1000} aria-label={`Nota cliente ${index + 1}`} placeholder={client ? `Trascrivi la nota per ${client.name}…` : "Prima seleziona una cliente"} className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-3 text-xs outline-none focus:border-[#2ed65d] disabled:cursor-not-allowed disabled:opacity-50" />
          </div>;
        })}
      </div>
      {rows.length < 10 && rows.length < clients.length ? <button type="button" onClick={() => setRows((current) => [...current, { appointmentId: "", note: "" }])} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#2ed65d]/20 bg-[#f0fcf4] px-4 text-[9px] font-black text-[#16883a]"><Plus className="size-4" />Aggiungi un’altra cliente</button> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        {status === "saving" || status === "error" ? <SaveStatusLine status={status} /> : isSaved ? <SaveStatusLine status="saved" /> : null}
        <button type="button" onClick={() => onAnswer(serialized)} disabled={!preparedNotes.length || preparedNotes.length !== rows.length || status === "saving" || isSaved} className="min-h-10 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40">{status === "saving" ? "Salvataggio…" : isSaved ? "Note salvate" : status === "error" ? "Riprova" : "Salva note clienti"}</button>
      </div>
    </div>
  );
}

function parseTaskAnswer(value?: string) {
  try {
    const parsed = JSON.parse(value || "") as { taskId?: unknown; taskTitle?: unknown; assignees?: unknown; aiComment?: unknown };
    return {
      taskId: typeof parsed.taskId === "string" ? parsed.taskId : "",
      taskTitle: typeof parsed.taskTitle === "string" ? parsed.taskTitle : "",
      aiComment: typeof parsed.aiComment === "string" ? parsed.aiComment : "",
      assignees: Array.isArray(parsed.assignees) ? parsed.assignees.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const person = item as { id?: unknown; name?: unknown; group?: unknown };
        return typeof person.id === "string" && typeof person.name === "string" && (person.group === "Ufficio" || person.group === "Responsabile")
          ? [{ id: person.id, name: person.name, group: person.group as TaskAssignee["group"] }]
          : [];
      }) : [],
    };
  } catch {
    return { taskId: "", taskTitle: "", aiComment: "", assignees: [] as TaskAssignee[] };
  }
}

function matchesInitials(person: TaskAssignee, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("it");
  const normalizedName = person.name.toLocaleLowerCase("it");
  const initials = normalizedName.split(/\s+/).filter(Boolean).map((part) => part[0]).join("");
  return normalizedName.includes(normalizedQuery) || initials.startsWith(normalizedQuery);
}

function TaskAnswer({ assignees, selected, status, onAnswer }: { assignees: TaskAssignee[]; selected?: string; status?: SaveStatus; onAnswer: (value: string) => void }) {
  const saved = parseTaskAnswer(selected);
  const [taskTitle, setTaskTitle] = useState(saved.taskTitle);
  const [selectedPeople, setSelectedPeople] = useState<TaskAssignee[]>(saved.assignees);
  const [query, setQuery] = useState("");
  const results = query.trim().length >= 2
    ? assignees.filter((person) => !selectedPeople.some((selectedPerson) => selectedPerson.id === person.id) && matchesInitials(person, query)).slice(0, 6)
    : [];

  if (saved.taskId) {
    return <div className="mt-4 rounded-xl border border-[#78c85c]/35 bg-[#f1faed] p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dff4d6] text-[#347a27]"><Check className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-black text-[#2f5f27]">Task creata</p><p className="mt-1 text-xs font-semibold text-[#26331f]">{saved.taskTitle}</p><p className="mt-1 text-[9px] text-[#4f6849]">Assegnata a {saved.assignees.map((person) => person.name).join(", ")}</p>{saved.aiComment ? <div className="mt-3 rounded-lg bg-white/70 p-3"><p className="text-[8px] font-black uppercase tracking-wide text-[#16883a]">Commento IA nella task</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[9px] leading-relaxed text-[#4f5f4a]">{saved.aiComment}</p></div> : null}<a href={`/tasks?task=${encodeURIComponent(saved.taskId)}`} className="mt-3 inline-flex text-[9px] font-black text-[#16883a] underline">Apri la task</a></div></div></div>;
  }

  return <div className="mt-4 border-t border-black/[0.06] pt-4"><label className="block"><span className="text-[9px] font-black uppercase tracking-wide text-[#16883a]">Attività da creare</span><textarea value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} rows={3} maxLength={500} placeholder="Scrivi cosa deve essere fatto…" className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-[#f8f9fa] px-3 py-3 text-xs outline-none focus:border-[#2ed65d] focus:bg-white" /></label><div className="relative mt-3"><label className="block"><span className="text-[9px] font-black uppercase tracking-wide text-[#16883a]">Assegna a più persone</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digita almeno 2 iniziali…" autoComplete="off" className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#2ed65d]" /></label>{query.trim().length >= 2 ? <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">{results.length ? results.map((person) => <button key={person.id} type="button" onClick={() => { setSelectedPeople((current) => [...current, person]); setQuery(""); }} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-black/[0.05] px-3 text-left last:border-0 hover:bg-[#f8fbf9]"><span className="text-[10px] font-bold text-[#3c4043]">{person.name}</span><span className="rounded-full bg-[#eefbf2] px-2 py-1 text-[8px] font-black text-[#16883a]">{person.group}</span></button>) : <p className="px-3 py-4 text-[10px] font-semibold text-[#5f6368]">Nessun risultato per queste iniziali.</p>}</div> : null}</div>{selectedPeople.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedPeople.map((person) => <span key={person.id} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#eefbf2] pl-3 pr-1 text-[9px] font-black text-[#16883a]">{person.name}<button type="button" onClick={() => setSelectedPeople((current) => current.filter((item) => item.id !== person.id))} className="grid size-7 place-items-center rounded-full hover:bg-white" aria-label={`Rimuovi ${person.name}`}><X className="size-3.5" /></button></span>)}</div> : <p className="mt-2 text-[9px] text-[#80868b]">L’elenco rimane nascosto finché non digiti le iniziali. Puoi aggiungere più persone.</p>}<div className="mt-4 flex items-center justify-end gap-2">{status ? <SaveStatusLine status={status} /> : null}<button type="button" onClick={() => onAnswer(JSON.stringify({ taskTitle: taskTitle.trim(), assignees: selectedPeople }))} disabled={!taskTitle.trim() || !selectedPeople.length || status === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2ed65d] px-4 text-[9px] font-black text-white disabled:opacity-40"><ListTodo className="size-4" />{status === "saving" ? "Creazione e commento IA…" : status === "error" ? "Riprova" : "Crea task con commento IA"}</button></div></div>;
}

function AnswerButtons({ selected, yesLabel, noLabel, onAnswer }: { selected?: string; yesLabel: string; noLabel: string; onAnswer: (value: ShiftResponsibleAnswer) => void }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {(["YES", "NO"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onAnswer(value)}
          aria-pressed={selected === value}
          className={`relative flex min-h-12 items-center rounded-lg border px-4 text-left text-xs font-semibold transition ${selected === value ? "border-[#2ed65d] bg-[#f0fcf4] text-[#16883a] ring-1 ring-[#2ed65d]/20" : "border-black/15 bg-white text-[#3c4043] hover:bg-[#f8f9fa]"}`}
        >
          <span className={`mr-3 grid size-4 place-items-center rounded-full border ${selected === value ? "border-[#2ed65d] bg-[#2ed65d] text-white" : "border-black/30"}`}>{selected === value ? <Check className="size-2.5" strokeWidth={3} /> : null}</span>
          {value === "YES" ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  );
}

function SaveStatusLine({ status }: { status: SaveStatus }) {
  const config = status === "saving"
    ? { label: "Salvataggio…", icon: <LoaderCircle className="size-3 animate-spin" /> }
    : status === "error"
      ? { label: "Non salvata. Riprova.", icon: <AlertCircle className="size-3" /> }
      : { label: "Risposta salvata", icon: <CheckCircle2 className="size-3" /> };

  return (
    <p role={status === "error" ? "alert" : "status"} className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold ${status === "error" ? "text-[#a83f54]" : "text-black/45"}`}>
      {config.icon}
      {config.label}
    </p>
  );
}
