"use client";

import React, { useState, useMemo } from "react";
import { ClipboardList, AlertCircle, CheckCircle2, ChevronRight, X, Loader2, Upload, Calendar, MapPin, User, Clock, Download, Plus, MessageSquare, Eye, Archive, ArrowUpRight } from "lucide-react";
import { Badge, Card, Button } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ResponseComments } from "@/components/response-comments";
import { cn } from "@/lib/utils";

type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "file" | "money" | "date" | "worker";
  required: boolean;
  options?: string[];
  description?: string;
};

type FormTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  active: boolean;
  fields: FormField[];
};

export function StaffFormsViewer({
  forms,
  employees = [],
  initialResponses = [],
  currentUserId,
  currentUserName,
  currentUserRole,
}: {
  forms: FormTemplate[];
  employees?: Array<{ id: string; name: string }>;
  initialResponses?: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}) {
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [selectedFormForHistory, setSelectedFormForHistory] = useState<FormTemplate | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [responses, setResponses] = useState<any[]>(initialResponses);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(forms[0]?.id ?? null);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleCardClick = (form: FormTemplate) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      handleOpenForm(form);
    } else {
      timerRef.current = setTimeout(() => {
        setSelectedFormForHistory(form);
        timerRef.current = null;
      }, 250);
    }
  };

  const formSubmissions = useMemo(() => {
    if (!selectedFormForHistory) return [];
    return responses.filter((r) => r.form_id === selectedFormForHistory.id);
  }, [responses, selectedFormForHistory]);
  
  // Input answer states (mapped by field ID)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  // Extract upcoming events from active responses containing date fields
  const upcomingEvents = useMemo(() => {
    const events: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    responses.forEach((resp) => {
      if (resp.status === "ARCHIVED") return;

      const fields = resp.form?.fields as FormField[] | null;
      const answersObj = resp.answers as Record<string, any> | null;
      if (!fields || !answersObj) return;

      fields.forEach((field) => {
        if (field.type === "date") {
          const dateVal = answersObj[field.id];
          if (dateVal && typeof dateVal === "string") {
            const eventDate = new Date(dateVal);
            if (!isNaN(eventDate.getTime())) {
              const eventDay = new Date(eventDate);
              eventDay.setHours(0, 0, 0, 0);
              
              if (eventDay >= today) {
                events.push({
                  responseId: resp.id,
                  formName: resp.form.name,
                  userName: resp.user?.name || "Dipendente",
                  locationName: resp.user_location_name,
                  dateValue: dateVal,
                  dateLabel: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(eventDate),
                  daysLeft: Math.ceil((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                  answers: answersObj,
                  fields
                });
              }
            }
          }
        }
      });
    });

    // Sort chronologically
    return events.sort((a, b) => a.dateValue.localeCompare(b.dateValue));
  }, [responses]);
  
  // Submission UI States
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleArchiveResponse = async (responseId: string) => {
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (res.ok) {
        setResponses((prev) => 
          prev.map((r) => r.id === responseId ? { ...r, status: "ARCHIVED" } : r)
        );
        if (selectedResponse && selectedResponse.id === responseId) {
          setSelectedResponse({ ...selectedResponse, status: "ARCHIVED" });
        }
      } else {
        alert("Errore durante il completamento del modulo.");
      }
    } catch (err) {
      console.error("Failed to archive response:", err);
      alert("Si è verificato un errore, riprova.");
    }
  };

  const handleOpenForm = (form: FormTemplate) => {
    setSelectedForm(form);
    setAnswers({});
    setFiles({});
    setSuccess(false);
    setErrorMsg("");
  };

  const handleTextChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [fieldId]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm || submitting) return;

    setSubmitting(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("formId", selectedForm.id);
    
    // Non-file answers
    formData.append("answers", JSON.stringify(answers));

    // File answers
    Object.entries(files).forEach(([fieldId, file]) => {
      formData.append(fieldId, file);
    });

    try {
      const res = await fetch("/api/service-forms/submit", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Errore sconosciuto durante l'invio");
      }

      if (result.response) {
        setResponses((prev) => [result.response, ...prev]);
      }

      setSuccess(true);
      setTimeout(() => {
        setSelectedForm(null);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Si è verificato un errore, riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-[24px] bg-white p-6 shadow-sm hidden sm:block">
        <div className="flex items-start gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-paradise-softPink text-[#A74758]">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Pagina operativa</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Moduli e Form</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">
              Clicca su un modulo per visualizzare la <strong>cronologia degli invii</strong> e i <strong>commenti</strong>. Fai <strong>doppio click</strong> per compilarlo direttamente.
            </p>
          </div>
        </div>
      </div>

      {/* Prossimi Eventi */}
      {upcomingEvents.length > 0 && (
        <Card className="bg-white border-l-4 border-l-[#E8C98B] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-black/5 pb-3">
            <Calendar className="size-5 text-[#A74758]" />
            <div>
              <h2 className="text-lg font-bold text-paradise-noir">Prossimi Eventi / Scadenze</h2>
              <p className="text-xs text-black/55">Visualizza le date pianificate compilate nei moduli operativi</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcomingEvents.map((evt, idx) => (
              <div 
                key={`${evt.responseId}-${idx}`}
                className="flex flex-col justify-between rounded-2xl border border-black/5 bg-[#FBF7F9] p-4 hover:border-[#E8C98B]/55 transition duration-300"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-[#A74758] bg-[#FBF7F9] border border-black/5 px-2 py-0.5 rounded-lg shadow-sm">
                      {evt.daysLeft === 0 ? "Oggi" : evt.daysLeft === 1 ? "Domani" : `Tra ${evt.daysLeft} giorni`}
                    </span>
                    <span className="text-[10px] text-black/40 font-semibold">{evt.dateLabel}</span>
                  </div>
                  <h4 className="font-bold text-sm text-black mt-2.5 truncate">{evt.formName}</h4>
                  <p className="text-xs text-black/60 mt-1 flex items-center gap-1">
                    <User className="size-3 text-black/40" /> {evt.userName}
                  </p>
                  {evt.locationName && (
                    <p className="text-[10px] text-black/40 mt-0.5 flex items-center gap-1">
                      <MapPin className="size-3 text-black/40" /> {evt.locationName}
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-black/5 space-y-1">
                    {evt.fields.filter((f: any) => f.type !== "date").slice(0, 2).map((field: any) => {
                      const ans = evt.answers[field.id];
                      if (ans === undefined || ans === null || ans === "") return null;
                      return (
                        <div key={field.id} className="text-[11px] truncate">
                          <span className="font-semibold text-black/50">{field.label}: </span>
                          <span className="text-black">{typeof ans === "object" ? ans.name : String(ans)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Templates List (Desktop/Tablet) */}
      <div className="hidden sm:grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <div
            key={form.id}
            onClick={() => handleCardClick(form)}
            className="group cursor-pointer flex items-center justify-between rounded-[22px] border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#FBF7F9] text-[#A74758] group-hover:bg-[#A74758]/5 transition">
                <DynamicIcon name={form.icon || "ClipboardList"} className="size-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/35">
                  {form.category}
                </span>
                <h3 className="text-base font-semibold tracking-tight text-black mt-0.5">
                  {form.name}
                </h3>
              </div>
            </div>
            <ChevronRight className="size-5 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/55" />
          </div>
        ))}

        {forms.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-black/45 bg-white/50 rounded-3xl border border-dashed border-black/10">
            <AlertCircle className="size-10 text-black/30 mb-3" />
            <p className="font-semibold text-lg">Nessun modulo disponibile</p>
            <p className="text-sm mt-1">Non ci sono moduli assegnati al tuo ruolo o alla tua sede corrente.</p>
          </div>
        )}
      </div>

      {/* Mobile Stacked Cards Layout (sm:hidden) */}
      <div className="space-y-4 sm:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl">
        {forms.map((form, idx) => {
          const colors = [
            { bg: "bg-[#A1B5FD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
            { bg: "bg-[#FDCB82]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
            { bg: "bg-[#8DE0BD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
            { bg: "bg-[#F7A1C4]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
          ];
          const color = colors[idx % colors.length];
          const isExpanded = expandedFormId === form.id;

          return (
            <div
              key={form.id}
              onClick={() => setExpandedFormId(isExpanded ? null : form.id)}
              className={cn(
                "w-full rounded-[28px] p-5 transition-all duration-300 cursor-pointer shadow-sm relative overflow-hidden select-none",
                color.bg,
                color.text,
                isExpanded ? "flex flex-col gap-4 animate-in fade-in-50 duration-200" : "h-[72px] flex items-center justify-between"
              )}
            >
              {isExpanded ? (
                <div className="flex flex-col justify-between w-full">
                  <div>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                          {form.category}
                        </span>
                        <h3 className="text-base font-extrabold mt-0.5 leading-tight">{form.name}</h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenForm(form);
                        }}
                        className={cn(
                          "size-9 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0",
                          color.arrowBg,
                          color.arrowText
                        )}
                      >
                        <ArrowUpRight className="size-4.5" />
                      </button>
                    </div>

                    <p className="mt-3 text-xs font-semibold opacity-85 leading-relaxed">
                      {form.description || "Nessuna descrizione specificata per questo modulo."}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 pt-3 border-t border-black/10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFormForHistory(form);
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/40 backdrop-blur-sm text-sm font-bold text-current border border-black/5 active:scale-95 transition"
                    >
                      <Clock className="size-4" />
                      Invii
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenForm(form);
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition"
                    >
                      <Plus className="size-4" />
                      Compila
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 truncate">
                    <DynamicIcon name={form.icon || "ClipboardList"} className="size-4 shrink-0 opacity-70" />
                    <h3 className="text-sm font-extrabold truncate">{form.name}</h3>
                  </div>
                  <div
                    className={cn(
                      "size-9 rounded-full flex items-center justify-center shadow-sm shrink-0",
                      color.arrowBg,
                      color.arrowText
                    )}
                  >
                    <ArrowUpRight className="size-4" />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {forms.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center text-white/45 border border-dashed border-white/10 rounded-[28px]">
            <AlertCircle className="size-8 text-white/20 mb-2" />
            <p className="font-bold text-sm">Nessun modulo disponibile</p>
          </div>
        )}
      </div>

      {/* FILL OUT MODAL */}
      {selectedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[85vh] w-full max-w-xl rounded-[28px] bg-white shadow-2xl overflow-hidden border border-black/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 bg-[#FBF7F9] px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  {selectedForm.category}
                </span>
                <h3 className="text-lg font-bold">{selectedForm.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setSelectedForm(null)}
                className="grid size-8 place-items-center rounded-xl bg-white border border-black/5 text-black/40 hover:bg-black/5 hover:text-black/80 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
                <CheckCircle2 className="size-16 text-emerald-500 animate-bounce" />
                <h3 className="text-xl font-bold mt-4">Inviato con Successo!</h3>
                <p className="text-sm text-black/55 mt-1">Il modulo è stato salvato e sincronizzato.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {selectedForm.description && (
                  <div className="rounded-xl bg-[#FBF7F9] border border-black/5 p-3.5 text-xs text-black/60 leading-relaxed">
                    {selectedForm.description}
                  </div>
                )}

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-600">
                    <AlertCircle className="size-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {selectedForm.fields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-sm font-bold text-black/70 block">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-xs text-black/45 -mt-0.5 mb-1 leading-relaxed">{field.description}</p>
                    )}

                    {field.type === "text" && (
                      <input
                        type="text"
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        className="w-full h-10 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                      />
                    )}

                    {field.type === "textarea" && (
                      <textarea
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-[#A74758] resize-none"
                      />
                    )}

                    {field.type === "number" && (
                      <input
                        type="number"
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        className="w-full h-10 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                      />
                    )}

                    {field.type === "select" && (
                      <select
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#A74758] bg-white"
                      >
                        <option value="">Seleziona un'opzione...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {field.type === "money" && (
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-sm font-semibold text-black/45">€</span>
                        <input
                          type="number"
                          step="0.01"
                          required={field.required}
                          value={answers[field.id] || ""}
                          onChange={(e) => handleTextChange(field.id, e.target.value)}
                          className="w-full h-10 rounded-xl border border-black/10 pl-8 pr-3.5 text-sm outline-none focus:border-[#A74758]"
                          placeholder="0.00"
                        />
                      </div>
                    )}

                    {field.type === "date" && (
                      <input
                        type="date"
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        className="w-full h-10 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758] bg-white"
                      />
                    )}

                    {field.type === "worker" && (
                      <select
                        required={field.required}
                        value={answers[field.id] || ""}
                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                        className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#A74758] bg-white"
                      >
                        <option value="">Seleziona collaboratore...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === "file" && (
                      <div className="relative flex items-center justify-center w-full min-h-24 border border-dashed border-black/20 rounded-xl bg-[#FBF7F9] hover:bg-[#A74758]/5 transition group">
                        <input
                          type="file"
                          required={field.required && !files[field.id]}
                          onChange={(e) => handleFileChange(field.id, e)}
                          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center p-4 text-center pointer-events-none">
                          <Upload className="size-6 text-black/35 group-hover:text-[#A74758] transition" />
                          <span className="text-xs font-semibold text-black/55 mt-1.5">
                            {files[field.id] ? files[field.id].name : "Carica o trascina un file"}
                          </span>
                          {!files[field.id] && (
                            <span className="text-[10px] text-black/35 mt-0.5">Dimensione max: 15 MB</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-4 bg-white mt-6">
                  <Button
                    type="button"
                    variant="soft"
                    disabled={submitting}
                    onClick={() => setSelectedForm(null)}
                  >
                    Annulla
                  </Button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      "Invia Risposte"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* HISTORY / SUBMISSIONS LIST MODAL */}
      {selectedFormForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[80vh] w-full max-w-2xl rounded-[28px] bg-white shadow-2xl overflow-hidden border border-black/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 bg-[#FBF7F9] px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Cronologia e Invii
                </span>
                <h3 className="text-lg font-bold">{selectedFormForHistory.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFormForHistory(null)}
                className="grid size-8 place-items-center rounded-xl bg-white border border-black/5 text-black/40 hover:bg-black/5 hover:text-black/80 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-black/55">
                  Visualizza le risposte inviate da te o quelle in cui sei stato taggato/notificato.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenForm(selectedFormForHistory);
                    setSelectedFormForHistory(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] text-white px-3.5 py-2 text-xs font-semibold hover:scale-[1.02] transition"
                >
                  <Plus className="size-3.5" />
                  Compila Nuovo
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-black/5 bg-[#FBF7F9]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 bg-black/5 text-[10px] font-bold uppercase tracking-wider text-black/40">
                      <th className="px-4 py-2.5">Data Invio</th>
                      <th className="px-4 py-2.5">Dipendente</th>
                      <th className="px-4 py-2.5">Commenti</th>
                      <th className="px-4 py-2.5 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-xs">
                    {formSubmissions.map((resp) => {
                      const commentsCount = Array.isArray(resp.comments) 
                        ? resp.comments.length 
                        : typeof resp.comments === "string" 
                          ? (() => {
                              try { return JSON.parse(resp.comments || "[]").length; } catch { return 0; }
                            })()
                          : 0;
                      const isOwnSubmission = resp.user_id === currentUserId;

                      return (
                        <tr key={resp.id} className="hover:bg-white transition">
                          <td className="px-4 py-3 font-semibold text-black/80">
                            {new Date(resp.created_at).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-black">
                              {isOwnSubmission ? "Tu" : resp.user?.name || "Collaboratore"}
                            </span>
                            {!isOwnSubmission && (
                              <span className="ml-1 text-[9px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1 font-bold">
                                Ricevuto
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {commentsCount > 0 ? (
                              <span className="font-bold text-[#A74758] flex items-center gap-1">
                                <MessageSquare className="size-3" />
                                {commentsCount}
                              </span>
                            ) : (
                              <span className="text-black/35">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedResponse(resp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-black/5 bg-white px-2.5 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-black/5 transition"
                            >
                              <Eye className="size-3" />
                              Vedi e Rispondi
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {formSubmissions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-black/40 italic">
                          Nessun invio presente per questo modulo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end bg-[#FBF7F9] px-6 py-4 border-t border-black/5">
              <Button type="button" onClick={() => setSelectedFormForHistory(null)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSE DETAIL VIEWER MODAL */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[85vh] w-full max-w-2xl rounded-[28px] bg-white shadow-2xl overflow-hidden border border-black/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 bg-[#FBF7F9] px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Dettagli Invio / Risposta
                </span>
                <h3 className="text-lg font-bold">
                  {selectedResponse.form?.name || "Dettagli Modulo"}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedResponse(null)}
                className="grid size-8 place-items-center rounded-xl bg-white border border-black/5 text-black/40 hover:bg-black/5 hover:text-black/80 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submitter Metadata */}
              <div className="grid gap-3 grid-cols-2 rounded-2xl bg-[#FBF7F9] border border-black/5 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-black/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-black/40 uppercase">Dipendente</span>
                    <span className="font-semibold">{selectedResponse.user?.name || "Tu"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-black/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-black/40 uppercase">Sede</span>
                    <span className="font-semibold">{selectedResponse.user_location_name || "Nessuna"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2 border-t border-black/5 pt-2 mt-1">
                  <Calendar className="size-4 text-black/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-black/40 uppercase">Inviato il</span>
                    <span className="font-semibold">
                      {new Date(selectedResponse.created_at).toLocaleString("it-IT")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Answers Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-black/50">Risposte alle Domande</h4>
                
                {selectedResponse.form?.fields ? (
                  (selectedResponse.form.fields as any[]).map((field) => {
                    const answer = selectedResponse.answers[field.id];
                    
                    return (
                      <div key={field.id} className="border-b border-black/5 pb-3">
                        <span className="block text-xs font-bold text-black/40">{field.label}</span>
                        
                        <div className="mt-1 text-sm text-black">
                          {answer === undefined || answer === null || answer === "" ? (
                            <span className="text-black/30 italic">Nessuna risposta</span>
                          ) : field.type === "file" && typeof answer === "object" ? (
                            <div className="space-y-3 mt-1.5">
                              {/\.(jpg|jpeg|png|webp|gif)$/i.test(answer.name) && (
                                <div className="relative rounded-2xl overflow-hidden border border-black/10 bg-black/5 max-w-sm aspect-video flex items-center justify-center group/img">
                                  <img
                                    src={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                    alt={answer.name}
                                    className="object-contain max-h-48 w-full transition group-hover/img:scale-[1.02]"
                                  />
                                </div>
                              )}
                              <a
                                href={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-black/5 bg-[#FBF7F9] px-3 py-1.5 text-xs font-semibold text-[#A74758] shadow-sm hover:bg-[#A74758]/5 transition"
                              >
                                <Download className="size-3.5" />
                                Scarica: {answer.name}
                              </a>
                            </div>
                          ) : field.type === "money" ? (
                            <p className="whitespace-pre-line leading-relaxed font-semibold bg-[#FBF7F9] p-3 rounded-xl border border-black/5 text-[#A74758]">
                              € {(() => {
                                const val = parseFloat(answer);
                                return isNaN(val) ? String(answer) : val.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </p>
                          ) : field.type === "date" ? (
                            <p className="whitespace-pre-line leading-relaxed font-medium bg-[#FBF7F9] p-3 rounded-xl border border-black/5">
                              {(() => {
                                const parts = String(answer).split("-");
                                if (parts.length === 3) {
                                  return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                }
                                return String(answer);
                              })()}
                            </p>
                          ) : (
                            <p className="whitespace-pre-line leading-relaxed font-medium bg-[#FBF7F9] p-3 rounded-xl border border-black/5">
                              {String(answer)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm italic text-black/40">Impossibile mappare le domande (modulo eliminato).</p>
                )}
              </div>

              {/* Response Comments */}
              <ResponseComments
                responseId={selectedResponse.id}
                initialComments={selectedResponse.comments}
                currentUserName={currentUserName}
                currentUserRole={currentUserRole}
                onCommentsUpdate={(updatedComments) => {
                  setResponses((prev) =>
                    prev.map((r) =>
                      r.id === selectedResponse.id
                        ? { ...r, comments: updatedComments }
                        : r
                    )
                  );
                  setSelectedResponse((prev: any) => {
                    if (!prev) return null;
                    return { ...prev, comments: updatedComments };
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 bg-[#FBF7F9] px-6 py-4 border-t border-black/5">
              {selectedResponse.status !== "ARCHIVED" && (
                <button
                  type="button"
                  onClick={() => {
                    handleArchiveResponse(selectedResponse.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] text-white px-4 py-2 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition shadow-sm"
                >
                  <Archive className="size-3.5" />
                  Marca come Completato
                </button>
              )}
              <Button type="button" variant="soft" onClick={() => setSelectedResponse(null)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
