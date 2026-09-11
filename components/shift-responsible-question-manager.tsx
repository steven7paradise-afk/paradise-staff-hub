"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronUp, Circle, Copy, GripVertical, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { ShiftResponsibleQuestion } from "@/lib/shift-responsible-questions";

type GeneratorScope = "OPENING" | "SERVICE" | "CLOSING" | "COMPLETE";

const generatorScopes: Array<{ value: GeneratorScope; label: string; description: string }> = [
  { value: "OPENING", label: "Apertura", description: "Preparazione, personale e agenda" },
  { value: "SERVICE", label: "Durante il turno", description: "Clienti, team e anomalie" },
  { value: "CLOSING", label: "Chiusura", description: "Cassa, ordine e consegne" },
  { value: "COMPLETE", label: "Completo", description: "Dall'apertura alla chiusura" },
];

const questionTypes: Array<{ value: ShiftResponsibleQuestion["answerType"]; label: string; icon: string }> = [
  { value: "SHORT_TEXT", label: "Risposta breve", icon: "—" },
  { value: "TEXT", label: "Paragrafo", icon: "≡" },
  { value: "MULTI_TEXT", label: "Risposte scritte multiple", icon: "☷" },
  { value: "TIMELINE", label: "Timeline ora + nota", icon: "◷+" },
  { value: "MULTIPLE_CHOICE", label: "Scelta multipla", icon: "◉" },
  { value: "CHECKBOXES", label: "Caselle di controllo", icon: "☑" },
  { value: "DROPDOWN", label: "Elenco a discesa", icon: "⌄" },
  { value: "FILE_UPLOAD", label: "Caricamento di file", icon: "⇧" },
  { value: "LINEAR_SCALE", label: "Scala lineare", icon: "•••" },
  { value: "RATING", label: "Classificazione", icon: "☆" },
  { value: "MULTIPLE_CHOICE_GRID", label: "Griglia a scelta multipla", icon: "▦" },
  { value: "CHECKBOX_GRID", label: "Griglia con caselle", icon: "▦" },
  { value: "DATE", label: "Data", icon: "▣" },
  { value: "TIME", label: "Ora", icon: "◷" },
  { value: "STAFF_NOTE", label: "Collega allo staff", icon: "♙" },
  { value: "CLIENT_NOTE", label: "Collega a cliente", icon: "♧" },
  { value: "TASK", label: "Genera task", icon: "✓+" },
  { value: "YES_NO", label: "SÌ / NO", icon: "✓" },
];

function questionTypeLabel(answerType: ShiftResponsibleQuestion["answerType"]) {
  return questionTypes.find((type) => type.value === answerType)?.label ?? "SÌ / NO";
}

export function ShiftResponsibleQuestionManager({ initialQuestions }: { initialQuestions: ShiftResponsibleQuestion[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [answerType, setAnswerType] = useState<ShiftResponsibleQuestion["answerType"]>("MULTIPLE_CHOICE");
  const [options, setOptions] = useState(["", ""]);
  const [rows, setRows] = useState(["", ""]);
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(5);
  const [required, setRequired] = useState(true);
  const [allowOther, setAllowOther] = useState(false);
  const [followUpYes, setFollowUpYes] = useState("");
  const [followUpNo, setFollowUpNo] = useState("");
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [yesLabel, setYesLabel] = useState("Sì");
  const [noLabel, setNoLabel] = useState("No");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorScope, setGeneratorScope] = useState<GeneratorScope>("COMPLETE");
  const [generatorInstructions, setGeneratorInstructions] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<ShiftResponsibleQuestion[]>([]);
  const [generatorMode, setGeneratorMode] = useState<"ai" | "template" | null>(null);
  const [applyMode, setApplyMode] = useState<"append" | "replace">("append");
  const [generatorError, setGeneratorError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: "before" | "after" } | null>(null);

  function openNew() {
    setGeneratorOpen(false);
    setEditingId("new");
    setTitle("");
    setDescription("");
    setAnswerType("MULTIPLE_CHOICE");
    setOptions(["", ""]);
    setRows(["", ""]);
    setScaleMin(1);
    setScaleMax(5);
    setRequired(true);
    setAllowOther(false);
    setFollowUpYes("");
    setFollowUpNo("");
    setFollowUps({});
    setYesLabel("Sì");
    setNoLabel("No");
  }

  async function generateQuestionnaire() {
    setIsGenerating(true);
    setGeneratorError("");
    setGeneratedQuestions([]);
    try {
      const response = await fetch("/api/shift-responsible-questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: generatorScope, instructions: generatorInstructions }),
      });
      const data = await response.json() as { questions?: ShiftResponsibleQuestion[]; mode?: "ai" | "template"; error?: string };
      if (!response.ok || !data.questions?.length) throw new Error(data.error || "Impossibile generare il questionario");
      setGeneratedQuestions(data.questions);
      setGeneratorMode(data.mode || "template");
    } catch (error) {
      setGeneratorError(error instanceof Error ? error.message : "Impossibile generare il questionario");
    } finally {
      setIsGenerating(false);
    }
  }

  function applyGeneratedQuestions() {
    if (!generatedQuestions.length) return;
    if (applyMode === "replace" && questions.length && !window.confirm("Sostituire tutte le domande attuali con quelle generate?")) return;
    const stamp = Date.now();
    const prepared = generatedQuestions.map((question, index) => ({ ...question, id: `question-${stamp}-${index}` }));
    const next = applyMode === "append" ? [...questions, ...prepared].slice(0, 30) : prepared;

    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        const saved = await response.json() as ShiftResponsibleQuestion[];
        setQuestions(saved);
        setGeneratedQuestions([]);
        setGeneratorOpen(false);
        setStatus(`${prepared.length} domande salvate nel database`);
      } catch {
        setGeneratorError("Impossibile salvare le domande generate. Riprova.");
      }
    });
  }

  function openEdit(question: ShiftResponsibleQuestion) {
    setEditingId(question.id);
    setTitle(question.title);
    setDescription(question.description);
    setAnswerType(question.answerType);
    setOptions(question.options?.length ? question.options : ["", ""]);
    setRows(question.rows?.length ? question.rows : ["", ""]);
    setScaleMin(question.scaleMin ?? 1);
    setScaleMax(question.scaleMax ?? 5);
    setRequired(question.required !== false);
    setAllowOther(question.allowOther === true);
    setFollowUpYes(question.followUpYes);
    setFollowUpNo(question.followUpNo);
    setFollowUps(question.followUps ?? {});
    setYesLabel(question.yesLabel || "Sì");
    setNoLabel(question.noLabel || "No");
  }

  function saveQuestion() {
    const cleanTitle = title.trim();
    const cleanOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
    const cleanRows = Array.from(new Set(rows.map((row) => row.trim()).filter(Boolean)));
    const needsOptions = ["MULTI_TEXT", "MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(answerType);
    const needsRows = ["MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(answerType);
    const allowedFollowUpKeys = new Set(
      ["MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN"].includes(answerType)
        ? [...cleanOptions.map((_, index) => `OPTION_${index}`), ...(["MULTIPLE_CHOICE", "CHECKBOXES"].includes(answerType) && allowOther ? ["OTHER"] : [])]
        : ["LINEAR_SCALE", "RATING"].includes(answerType)
          ? Array.from({ length: scaleMax - (answerType === "RATING" ? 1 : scaleMin) + 1 }, (_, index) => `VALUE_${index + (answerType === "RATING" ? 1 : scaleMin)}`)
          : answerType === "YES_NO" ? [] : ["ANY"],
    );
    const cleanFollowUps = Object.fromEntries(Object.entries(followUps).flatMap(([key, prompt]) => allowedFollowUpKeys.has(key) && prompt.trim() ? [[key, prompt.trim()]] : []));
    if (!cleanTitle || (needsOptions && cleanOptions.length < (answerType === "MULTI_TEXT" ? 1 : 2)) || (needsRows && cleanRows.length < 1)) return;
    const next = editingId === "new"
      ? [...questions, {
          id: `question-${Date.now()}`,
          title: cleanTitle,
          description: description.trim(),
          answerType,
          options: needsOptions ? cleanOptions : [],
          rows: needsRows ? cleanRows : [],
          scaleMin,
          scaleMax,
          required,
          allowOther: ["MULTIPLE_CHOICE", "CHECKBOXES"].includes(answerType) && allowOther,
          followUpYes: answerType === "YES_NO" ? followUpYes.trim() : "",
          followUpNo: answerType === "YES_NO" ? followUpNo.trim() : "",
          followUps: cleanFollowUps,
          yesLabel: answerType === "YES_NO" ? yesLabel.trim() || "Sì" : undefined,
          noLabel: answerType === "YES_NO" ? noLabel.trim() || "No" : undefined,
        }]
      : questions.map((question) => question.id === editingId ? {
          ...question,
          title: cleanTitle,
          description: description.trim(),
          answerType,
          options: needsOptions ? cleanOptions : [],
          rows: needsRows ? cleanRows : [],
          scaleMin,
          scaleMax,
          required,
          allowOther: ["MULTIPLE_CHOICE", "CHECKBOXES"].includes(answerType) && allowOther,
          followUpYes: answerType === "YES_NO" ? followUpYes.trim() : "",
          followUpNo: answerType === "YES_NO" ? followUpNo.trim() : "",
          followUps: cleanFollowUps,
          yesLabel: answerType === "YES_NO" ? yesLabel.trim() || "Sì" : undefined,
          noLabel: answerType === "YES_NO" ? noLabel.trim() || "No" : undefined,
        } : question);

    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        const saved = await response.json() as ShiftResponsibleQuestion[];
        setQuestions(saved);
        setEditingId(null);
        setStatus("Domande salvate");
      } catch {
        setStatus("Impossibile salvare");
      }
    });
  }

  function duplicateQuestion() {
    if (!editingId || editingId === "new") return;
    const source = questions.find((question) => question.id === editingId);
    if (!source) return;
    const next = [...questions, { ...source, id: `question-${Date.now()}`, title: `${source.title} (copia)` }];
    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        const saved = await response.json() as ShiftResponsibleQuestion[];
        setQuestions(saved);
        setEditingId(null);
        setStatus("Domanda duplicata e salvata");
      } catch {
        setStatus("Impossibile duplicare la domanda");
      }
    });
  }

  function deleteQuestion() {
    if (!editingId || editingId === "new") return;
    const questionToDelete = questions.find((question) => question.id === editingId);
    if (!questionToDelete) return;
    if (!window.confirm(`Eliminare la domanda “${questionToDelete.title}”?`)) return;

    const next = questions.filter((question) => question.id !== editingId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        const saved = await response.json() as ShiftResponsibleQuestion[];
        setQuestions(saved);
        setEditingId(null);
        setStatus("Domanda eliminata dal database");
      } catch {
        setStatus("Impossibile eliminare la domanda");
      }
    });
  }

  function persistQuestionOrder(next: ShiftResponsibleQuestion[]) {
    const previous = questions;
    setQuestions(next);
    setStatus("Salvataggio del nuovo ordine…");

    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsible-questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error("Errore");
        const saved = await response.json() as ShiftResponsibleQuestion[];
        setQuestions(saved);
        setStatus("Ordine delle domande salvato");
      } catch {
        setQuestions(previous);
        setStatus("Impossibile salvare il nuovo ordine");
      }
    });
  }

  function moveQuestionToIndex(fromIndex: number, toIndex: number) {
    if (isPending || fromIndex < 0 || toIndex < 0 || fromIndex >= questions.length || toIndex >= questions.length || fromIndex === toIndex) return;
    const next = [...questions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persistQuestionOrder(next);
  }

  function moveDraggedQuestion(targetId: string, placement: "before" | "after") {
    if (!draggedQuestionId || draggedQuestionId === targetId || isPending) return;
    const next = questions.filter((question) => question.id !== draggedQuestionId);
    const moved = questions.find((question) => question.id === draggedQuestionId);
    const targetIndex = next.findIndex((question) => question.id === targetId);
    if (!moved || targetIndex < 0) return;
    next.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, moved);
    persistQuestionOrder(next);
  }

  const usesOptions = ["MULTI_TEXT", "MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(answerType);
  const usesRows = ["MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(answerType);
  const minimumOptions = answerType === "MULTI_TEXT" ? 1 : 2;
  const maximumOptions = answerType === "MULTI_TEXT" ? 10 : 12;
  const validOptions = new Set(options.map((option) => option.trim()).filter(Boolean)).size >= minimumOptions;
  const validRows = !usesRows || rows.some((row) => row.trim());
  const followUpVariants = ["MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN"].includes(answerType) && !usesRows
    ? [...options.map((option, index) => ({ key: `OPTION_${index}`, label: `Dopo “${option.trim() || `Opzione ${index + 1}`}”, chiedi` })), ...(["MULTIPLE_CHOICE", "CHECKBOXES"].includes(answerType) && allowOther ? [{ key: "OTHER", label: "Dopo “Altro”, chiedi" }] : [])]
    : ["LINEAR_SCALE", "RATING"].includes(answerType)
      ? Array.from({ length: scaleMax - (answerType === "RATING" ? 1 : scaleMin) + 1 }, (_, index) => { const value = index + (answerType === "RATING" ? 1 : scaleMin); return { key: `VALUE_${value}`, label: `Dopo ${value}, chiedi` }; })
      : answerType === "YES_NO" ? [] : [{ key: "ANY", label: "Dopo la risposta, chiedi" }];

  return (
    <section className="min-h-screen bg-[#f4f1fa] px-3 py-8 sm:px-8 sm:py-12 xl:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-black/10 border-t-[7px] border-t-[#a45a7d] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a45a7d]">Modulo del responsabile</p>
            <h2 className="mt-1 text-2xl font-bold text-[#202124] sm:text-3xl">Domande del turno</h2>
            <p className="mt-2 text-xs text-[#5f6368]">Crea e ordina le domande che il responsabile compilerà durante la giornata.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setGeneratorOpen((open) => !open);
                setGeneratorError("");
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#a45a7d]/20 bg-[#f8edf3] px-4 text-[10px] font-black text-[#874363]"
            >
              <Sparkles className="size-4" /> Genera questionario
            </button>
            <button type="button" onClick={openNew} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#a45a7d] px-4 text-[10px] font-black text-white shadow-sm">
              <Plus className="size-4" /> Aggiungi
            </button>
          </div>
          </div>
        </div>

        {generatorOpen ? (
          <div className="mt-5 rounded-[24px] border border-[#a8ff78]/60 bg-white p-4 shadow-[0_16px_45px_rgba(73,120,50,0.09)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#44842a]">Generatore intelligente</p>
                <h3 className="mt-1 text-lg font-black text-[#1d1d1f]">Che controllo vuoi preparare?</h3>
                <p className="mt-1 text-[10px] font-medium text-black/45">Genera un'anteprima modificabile. Le domande attuali non cambiano finché non confermi.</p>
              </div>
              <button type="button" onClick={() => setGeneratorOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full bg-black/5 text-black/45" aria-label="Chiudi generatore"><X className="size-4" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {generatorScopes.map((scope) => (
                <button key={scope.value} type="button" onClick={() => setGeneratorScope(scope.value)} aria-pressed={generatorScope === scope.value} className={`min-h-20 rounded-2xl border p-3 text-left transition ${generatorScope === scope.value ? "border-[#76d747] bg-[#f2ffe9] ring-2 ring-[#a8ff78]/50" : "border-black/8 bg-[#fafafa]"}`}>
                  <span className="block text-[11px] font-black text-black/80">{scope.label}</span>
                  <span className="mt-1 block text-[9px] leading-snug text-black/45">{scope.description}</span>
                </button>
              ))}
            </div>

            <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.12em] text-black/45">Indicazioni aggiuntive <span className="font-medium normal-case tracking-normal">(facoltative)</span></label>
            <textarea value={generatorInstructions} onChange={(event) => setGeneratorInstructions(event.target.value)} rows={3} maxLength={800} placeholder="Esempio: includi ritardi, reclami clienti e controllo prodotti mancanti" className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs outline-none focus:border-[#76d747]" />
            <button type="button" onClick={generateQuestionnaire} disabled={isGenerating} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#242124] px-5 text-[10px] font-black text-white disabled:opacity-55 sm:w-auto">
              <Sparkles className={`size-4 ${isGenerating ? "animate-pulse" : ""}`} /> {isGenerating ? "Sto preparando le domande…" : "Genera anteprima"}
            </button>

            {generatorError ? <p role="alert" className="mt-3 rounded-xl bg-[#fff0f2] px-3 py-2 text-[10px] font-bold text-[#a83f54]">{generatorError}</p> : null}

            {generatedQuestions.length ? (
              <div className="mt-5 rounded-2xl bg-[#f7f7f7] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-black/80">{generatedQuestions.length} domande pronte</p>
                    <p className="text-[9px] font-medium text-black/40">{generatorMode === "ai" ? "Generate in base alle tue indicazioni" : "Modello professionale pronto all'uso"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1">
                    <button type="button" onClick={() => setApplyMode("append")} className={`rounded-lg px-3 py-2 text-[9px] font-black ${applyMode === "append" ? "bg-[#414141] text-white" : "text-black/45"}`}>Aggiungi</button>
                    <button type="button" onClick={() => setApplyMode("replace")} className={`rounded-lg px-3 py-2 text-[9px] font-black ${applyMode === "replace" ? "bg-[#414141] text-white" : "text-black/45"}`}>Sostituisci</button>
                  </div>
                </div>
                <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {generatedQuestions.map((question, index) => (
                    <li key={`${question.id}-${index}`} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-black/5 text-[8px] font-black text-black/45">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-black/75">{question.title}</p>
                        <p className="mt-0.5 text-[8px] font-bold uppercase text-[#a45a7d]">{questionTypeLabel(question.answerType)}{question.followUpYes || question.followUpNo ? " · con approfondimento" : ""}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={applyGeneratedQuestions} disabled={isPending} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#a8ff78] px-5 text-[10px] font-black text-[#26331f] disabled:opacity-50">
                  <Check className="size-4" /> {applyMode === "append" ? "Aggiungi alla lista e salva" : "Sostituisci e salva"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {editingId ? (
          <div className="relative mt-5 rounded-xl border border-black/15 border-l-[6px] border-l-[#a45a7d] bg-white shadow-md">
            <div className="flex justify-center border-b border-black/[0.06] py-1 text-black/25" aria-hidden="true"><GripVertical className="size-5 rotate-90" /></div>
            <div className="p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
                <div>
                  <label className="sr-only" htmlFor="shift-question-title">Domanda</label>
                  <input id="shift-question-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Domanda senza titolo" className="h-14 w-full border-b-2 border-[#a45a7d] bg-[#f8f9fa] px-4 text-base font-medium text-[#202124] outline-none transition focus:bg-[#f5eef2]" />
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrizione della domanda (facoltativa)" rows={2} className="mt-2 w-full resize-none border-b border-black/20 bg-transparent px-4 py-2 text-xs text-[#5f6368] outline-none focus:border-[#a45a7d]" />
                </div>
                <select value={answerType} onChange={(event) => setAnswerType(event.target.value as ShiftResponsibleQuestion["answerType"])} className="h-14 w-full rounded-lg border border-black/15 bg-white px-4 text-xs font-medium text-[#3c4043] outline-none focus:border-[#a45a7d]">
                  {questionTypes.map((type) => <option key={type.value} value={type.value}>{type.icon}  {type.label}</option>)}
                </select>
              </div>

              <div className="mt-6">
                {usesOptions ? (
                  <div className="space-y-2">
                    {usesRows ? <div className="mb-5 rounded-lg bg-[#faf7f9] p-3"><p className="mb-2 text-[9px] font-black uppercase tracking-wide text-[#874363]">Righe della griglia</p>{rows.map((row, index) => <div key={index} className="flex items-center gap-2"><input value={row} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Riga ${index + 1}`} className="h-9 min-w-0 flex-1 border-b border-black/20 bg-transparent px-1 text-xs outline-none focus:border-[#a45a7d]" /><button type="button" onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={rows.length <= 1} className="grid size-8 place-items-center rounded-full text-black/35 disabled:opacity-20" aria-label={`Elimina riga ${index + 1}`}><X className="size-4" /></button></div>)}<button type="button" onClick={() => setRows((current) => [...current, ""])} className="mt-2 text-[10px] font-bold text-[#874363]">+ Aggiungi riga</button></div> : null}
                    <p className="text-[9px] font-black uppercase tracking-wide text-[#874363]">{usesRows ? "Colonne" : answerType === "DROPDOWN" ? "Voci dell'elenco" : answerType === "MULTI_TEXT" ? "Voci da compilare" : "Opzioni di risposta"}</p>
                    {options.map((option, index) => (
                      <div key={index} className="grid grid-cols-[24px_minmax(0,1fr)_36px] items-center gap-2">
                        {answerType === "MULTI_TEXT" ? <span className="grid size-5 place-items-center rounded bg-[#f5eaf0] text-[8px] font-black text-[#874363]">{index + 1}</span> : <Circle className="size-5 text-black/25" />}
                        <input value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={answerType === "MULTI_TEXT" ? `Nome della voce ${index + 1}` : `Opzione ${index + 1}`} maxLength={120} className="h-10 min-w-0 border-b border-black/20 bg-transparent px-1 text-xs text-[#3c4043] outline-none focus:border-[#a45a7d]" />
                        <button type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={options.length <= minimumOptions} className="grid size-9 place-items-center rounded-full text-black/40 hover:bg-black/5 disabled:opacity-20" aria-label={`Elimina ${answerType === "MULTI_TEXT" ? "voce" : "opzione"} ${index + 1}`}><X className="size-4" /></button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pl-8 text-[11px]">
                      <button type="button" onClick={() => setOptions((current) => [...current, ""])} disabled={options.length >= maximumOptions} className="py-2 font-medium text-[#5f6368] hover:text-[#a45a7d] disabled:opacity-35">{answerType === "MULTI_TEXT" ? `Aggiungi voce (${options.length}/10)` : "Aggiungi opzione"}</button>
                      {answerType !== "DROPDOWN" && answerType !== "MULTI_TEXT" && !usesRows ? <><span className="text-black/30">o</span><button type="button" onClick={() => setAllowOther(true)} disabled={allowOther} className="py-2 font-medium text-[#a45a7d] disabled:text-black/30">aggiungi “Altro”</button></> : null}
                    </div>
                    {allowOther ? <div className="flex items-center gap-2 pl-0"><Circle className="size-5 text-black/25" /><span className="flex-1 border-b border-black/15 py-2 text-xs text-[#5f6368]">Altro…</span><button type="button" onClick={() => setAllowOther(false)} className="grid size-9 place-items-center rounded-full text-black/40 hover:bg-black/5" aria-label="Rimuovi opzione Altro"><X className="size-4" /></button></div> : null}
                    {!validOptions ? <p className="pl-8 text-[9px] font-bold text-[#b33e53]">{answerType === "MULTI_TEXT" ? "Inserisci almeno una voce." : "Inserisci almeno due risposte."}</p> : null}
                    {!validRows ? <p className="text-[9px] font-bold text-[#b33e53]">Inserisci almeno una riga.</p> : null}
                  </div>
                ) : answerType === "YES_NO" ? (
                  <div className="space-y-2">
                    <label className="flex min-h-11 items-center gap-3"><Circle className="size-5 shrink-0 text-black/25" /><span className="sr-only">Etichetta risposta Sì</span><input value={yesLabel} onChange={(event) => setYesLabel(event.target.value)} maxLength={80} placeholder="Sì" className="h-10 min-w-0 flex-1 border-b border-black/20 bg-transparent px-1 text-xs text-[#3c4043] outline-none focus:border-[#a45a7d]" /></label>
                    <label className="flex min-h-11 items-center gap-3"><Circle className="size-5 shrink-0 text-black/25" /><span className="sr-only">Etichetta risposta No</span><input value={noLabel} onChange={(event) => setNoLabel(event.target.value)} maxLength={80} placeholder="No" className="h-10 min-w-0 flex-1 border-b border-black/20 bg-transparent px-1 text-xs text-[#3c4043] outline-none focus:border-[#a45a7d]" /></label>
                    <div className="mt-5 grid gap-3 rounded-lg bg-[#faf7f9] p-4 sm:grid-cols-2">
                      <label><span className="text-[9px] font-black uppercase tracking-wide text-[#44842a]">Dopo {yesLabel.trim() || "Sì"}, chiedi</span><input value={followUpYes} onChange={(event) => setFollowUpYes(event.target.value)} placeholder="Domanda successiva facoltativa" className="mt-2 h-10 w-full border-b border-black/15 bg-white px-3 text-xs outline-none focus:border-[#a45a7d]" /></label>
                      <label><span className="text-[9px] font-black uppercase tracking-wide text-[#a45a6a]">Dopo {noLabel.trim() || "No"}, chiedi</span><input value={followUpNo} onChange={(event) => setFollowUpNo(event.target.value)} placeholder="Domanda successiva facoltativa" className="mt-2 h-10 w-full border-b border-black/15 bg-white px-3 text-xs outline-none focus:border-[#a45a7d]" /></label>
                    </div>
                  </div>
                ) : answerType === "LINEAR_SCALE" ? <div className="flex flex-wrap items-end gap-3"><label className="text-[9px] font-bold text-[#5f6368]">Da<select value={scaleMin} onChange={(event) => setScaleMin(Number(event.target.value))} className="ml-2 h-10 rounded-lg border border-black/15 bg-white px-3 text-xs"><option value={0}>0</option><option value={1}>1</option></select></label><label className="text-[9px] font-bold text-[#5f6368]">a<select value={scaleMax} onChange={(event) => setScaleMax(Number(event.target.value))} className="ml-2 h-10 rounded-lg border border-black/15 bg-white px-3 text-xs">{[2,3,4,5,6,7,8,9,10].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="flex gap-2">{Array.from({ length: scaleMax - scaleMin + 1 }, (_, index) => index + scaleMin).map((value) => <span key={value} className="grid size-8 place-items-center rounded-full border border-black/15 text-[9px]">{value}</span>)}</div></div>
                  : answerType === "RATING" ? <div className="flex gap-2 text-3xl text-[#a45a7d]">★★★★★</div>
                    : answerType === "FILE_UPLOAD" ? <div className="rounded-lg border border-dashed border-[#a45a7d]/35 bg-[#faf7f9] px-4 py-6 text-center text-xs text-[#5f6368]">Il file sarà caricato su Google Drive.</div>
                      : answerType === "STAFF_NOTE" ? <div className="rounded-xl border border-black/10 bg-[#faf7f9] p-4"><p className="text-xs font-semibold text-[#5f6368]">Ogni persona in turno avrà la propria nota separata.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white px-3 py-4 text-xs font-semibold text-[#3c4043]">Nome lavoratore</div><div className="rounded-lg bg-white px-3 py-4 text-xs text-black/35">Nota dedicata…</div></div></div>
                      : answerType === "CLIENT_NOTE" ? <div className="rounded-xl border border-black/10 bg-[#faf7f9] p-4"><p className="text-xs font-semibold text-[#5f6368]">Aggiungi fino a 10 clienti scegliendole dagli appuntamenti di Buenos Aires della giornata.</p><div className="mt-3 space-y-2">{[1, 2].map((row) => <div key={row} className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white px-3 py-4 text-xs text-black/45">Cliente {row}…</div><div className="rounded-lg bg-white px-3 py-4 text-xs text-black/35">Nota dedicata…</div></div>)}</div></div>
                      : answerType === "TASK" ? <div className="rounded-xl border border-black/10 bg-[#faf7f9] p-4"><p className="text-xs font-semibold text-[#5f6368]">Il responsabile scriverà la task e cercherà Ufficio o Responsabili digitando le iniziali.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]"><div className="rounded-lg bg-white px-3 py-4 text-xs text-black/35">Scrivi l’attività…</div><div className="rounded-lg bg-white px-3 py-4 text-xs text-black/35">Digita le iniziali…</div></div></div>
                      : answerType === "TIMELINE" ? <div className="rounded-xl border border-black/10 bg-[#faf7f9] p-4"><p className="text-xs font-semibold text-[#5f6368]">Aggiungi fino a 10 eventi con ora e nota libera.</p><div className="relative mt-3 grid grid-cols-[64px_1fr] gap-3 rounded-lg bg-white p-3 before:absolute before:bottom-0 before:left-[43px] before:top-0 before:w-px before:bg-[#e7cbd8]"><span className="relative z-10 rounded-lg bg-[#f5eaf0] px-2 py-3 text-center text-[10px] font-black text-[#874363]">10:30</span><span className="px-2 py-3 text-xs text-black/35">Nota dell’evento…</span></div></div>
                      : answerType === "DATE" ? <input type="date" disabled className="h-11 rounded-lg border border-black/15 bg-white px-3 text-xs" />
                        : answerType === "TIME" ? <input type="time" disabled className="h-11 rounded-lg border border-black/15 bg-white px-3 text-xs" />
                          : <div className="h-12 w-full max-w-md border-b border-dotted border-black/35 px-1 py-3 text-xs text-black/35">{answerType === "SHORT_TEXT" ? "Risposta breve" : "Testo della risposta"}</div>}
                {answerType !== "YES_NO" ? (
                  <div className="mt-5 rounded-xl border border-[#a45a7d]/10 bg-[#faf7f9] p-4">
                    <p className="text-[9px] font-black uppercase tracking-wide text-[#874363]">Varianti della domanda <span className="font-medium normal-case tracking-normal text-black/40">(facoltative)</span></p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {followUpVariants.map((variant) => <label key={variant.key}><span className="text-[9px] font-bold text-[#5f6368]">{variant.label}</span><input value={followUps[variant.key] ?? ""} onChange={(event) => setFollowUps((current) => ({ ...current, [variant.key]: event.target.value }))} maxLength={160} placeholder="Domanda successiva facoltativa" className="mt-1.5 h-10 w-full border-b border-black/15 bg-white px-3 text-xs outline-none focus:border-[#a45a7d]" /></label>)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/10 px-4 py-3 sm:px-6">
              {editingId !== "new" ? <button type="button" onClick={duplicateQuestion} disabled={isPending} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 disabled:opacity-40" aria-label="Duplica domanda"><Copy className="size-5" /></button> : null}
              {editingId !== "new" ? <button type="button" onClick={deleteQuestion} disabled={isPending} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#fff1f3] hover:text-[#b33e53] disabled:opacity-40" aria-label="Elimina domanda"><Trash2 className="size-5" /></button> : null}
              <span className="mx-1 h-8 w-px bg-black/10" />
              <label className="flex min-h-10 items-center gap-2 px-2 text-[10px] font-bold text-[#3c4043]"><span>Obbligatoria</span><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="size-5 accent-[#a45a7d]" /></label>
              <button type="button" onClick={() => setEditingId(null)} className="min-h-10 rounded-lg px-4 text-[10px] font-black text-[#5f6368] hover:bg-black/5">Annulla</button>
              <button type="button" onClick={saveQuestion} disabled={isPending || !title.trim() || (usesOptions && !validOptions) || !validRows} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#a45a7d] px-5 text-[10px] font-black text-white shadow-sm disabled:opacity-40"><Check className="size-4" /> Salva</button>
            </div>
          </div>
        ) : null}

        {questions.length > 1 ? (
          <p className="mt-4 flex items-center gap-2 px-1 text-[10px] font-semibold text-[#5f6368]">
            <GripVertical className="size-4 text-[#a45a7d]" /> Trascina una domanda sopra o sotto per cambiarne l'ordine.
          </p>
        ) : null}
        <div className={`${questions.length > 1 ? "mt-2" : "mt-4"} space-y-3`}>
          {questions.map((question, index) => (
            <article
              key={question.id}
              draggable={!isPending}
              onDragStart={(event) => {
                setDraggedQuestionId(question.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", question.id);
              }}
              onDragEnd={() => {
                setDraggedQuestionId(null);
                setDropTarget(null);
              }}
              onDragOver={(event) => {
                if (!draggedQuestionId || draggedQuestionId === question.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const bounds = event.currentTarget.getBoundingClientRect();
                const placement = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
                setDropTarget((current) => current?.id === question.id && current.placement === placement ? current : { id: question.id, placement });
              }}
              onDrop={(event) => {
                event.preventDefault();
                const placement = dropTarget?.id === question.id ? dropTarget.placement : "before";
                moveDraggedQuestion(question.id, placement);
                setDraggedQuestionId(null);
                setDropTarget(null);
              }}
              className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-[#a45a7d]/35 hover:shadow-md ${draggedQuestionId === question.id ? "scale-[0.99] border-[#a45a7d]/30 opacity-45" : "border-black/10"} ${dropTarget?.id === question.id && dropTarget.placement === "before" ? "before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-1 before:bg-[#a45a7d]" : ""} ${dropTarget?.id === question.id && dropTarget.placement === "after" ? "after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-1 after:bg-[#a45a7d]" : ""}`}
            >
              <div className="flex items-start gap-4 p-4 sm:p-5">
                <span className="hidden size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-black/30 hover:bg-[#f8edf3] hover:text-[#874363] active:cursor-grabbing sm:grid" title="Trascina per riordinare" aria-hidden="true"><GripVertical className="size-5" /></span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f5eaf0] text-[10px] font-black text-[#874363]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#202124]">{question.title}</h3>
                  <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-[#5f6368]">{questionTypeLabel(question.answerType)}</span>
                </div>
                {question.description ? <p className="mt-1.5 text-[10px] leading-relaxed text-[#5f6368]">{question.description}</p> : null}
                {question.followUpYes || question.followUpNo || Object.keys(question.followUps ?? {}).length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-bold uppercase text-[#874363]">
                    {question.followUpYes ? <span className="rounded-full bg-[#f8edf3] px-2 py-1">Segue dopo {question.yesLabel || "Sì"}</span> : null}
                    {question.followUpNo ? <span className="rounded-full bg-[#f8edf3] px-2 py-1">Segue dopo {question.noLabel || "No"}</span> : null}
                    {Object.keys(question.followUps ?? {}).length ? <span className="rounded-full bg-[#f8edf3] px-2 py-1">{Object.keys(question.followUps ?? {}).length} variant{Object.keys(question.followUps ?? {}).length === 1 ? "e" : "i"}</span> : null}
                  </div>
                ) : null}
                {question.options?.length ? <div className="mt-3 space-y-1.5">{question.options.slice(0, 3).map((option, optionIndex) => <div key={`${option}-${optionIndex}`} className="flex items-center gap-2 text-[9px] text-[#5f6368]"><Circle className="size-3.5 text-black/25" />{option}</div>)}</div> : null}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-2.5 sm:px-5">
                <span className="text-[9px] font-medium text-[#80868b]">{question.required === false ? "Facoltativa" : "Obbligatoria"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveQuestionToIndex(index, index - 1)} disabled={index === 0 || isPending} className="grid size-10 place-items-center rounded-lg text-[#874363] hover:bg-[#f8edf3] disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Sposta “${question.title}” sopra`}><ChevronUp className="size-4" /></button>
                  <button type="button" onClick={() => moveQuestionToIndex(index, index + 1)} disabled={index === questions.length - 1 || isPending} className="grid size-10 place-items-center rounded-lg text-[#874363] hover:bg-[#f8edf3] disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Sposta “${question.title}” sotto`}><ChevronDown className="size-4" /></button>
                  <button type="button" onClick={() => openEdit(question)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[10px] font-black text-[#874363] hover:bg-[#f8edf3]"><Pencil className="size-3.5" /> Modifica</button>
                </div>
              </div>
            </article>
          ))}
          {questions.length === 0 ? <p className="rounded-xl border border-dashed border-[#a45a7d]/30 bg-white px-4 py-10 text-center text-xs font-semibold text-[#5f6368]">Aggiungi la prima domanda del turno.</p> : null}
        </div>
        {status ? <p role="status" className="mt-3 rounded-lg bg-white px-3 py-2 text-right text-[10px] font-bold text-[#5f6368] shadow-sm">{status}</p> : null}
      </div>
    </section>
  );
}
