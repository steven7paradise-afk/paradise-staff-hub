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
  autoFillFormId,
  autoFillFormName,
}: {
  forms: FormTemplate[];
  employees?: Array<{ id: string; name: string }>;
  initialResponses?: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  autoFillFormId?: string;
  autoFillFormName?: string;
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

  // Derived helper variables for dynamic group participants form
  const candidaturaForm = forms.find(f => f.name.toUpperCase().includes("CANDIDATURA"));
  const participaField = selectedForm?.fields.find(f => f.label.toUpperCase().includes("PARTICIPA"));
  const participaValue = participaField ? answers[participaField.id] : "";
  const isGroupCourse = String(participaValue || "").toUpperCase().includes("GRUP");
  const isCorsistiForm = selectedForm?.name.toUpperCase().includes("CORSISTI");
  const groupCount = parseInt(answers["group_participants_count"] || "2", 10);

  const isDefaultParticipantField = (fieldLabel: string) => {
    const labelUpper = fieldLabel.toUpperCase();
    return labelUpper === "NOME CORSISTA" || labelUpper === "EMAIL CORSISTA" || labelUpper === "NUMERO CORSISTA";
  };

  const responseParticipaField = selectedResponse?.form?.fields 
    ? (selectedResponse.form.fields as any[]).find(f => f.label.toUpperCase().includes("PARTICIPA")) 
    : null;
  const responseParticipaValue = responseParticipaField && selectedResponse?.answers 
    ? selectedResponse.answers[responseParticipaField.id] 
    : "";
  const isResponseGroupCourse = String(responseParticipaValue || "").toUpperCase().includes("GRUP");
  const isResponseCorsistiForm = selectedResponse?.form?.name?.toUpperCase().includes("CORSISTI");
  const responseGroupCount = (() => {
    let count = parseInt(selectedResponse?.answers?.["group_participants_count"] || "0", 10);
    if (isResponseGroupCourse && count === 0 && selectedResponse?.answers) {
      let maxIdx = 0;
      for (let i = 1; i <= 10; i++) {
        if (selectedResponse.answers[`participant_${i}_name`]) {
          maxIdx = i;
        }
      }
      count = maxIdx > 0 ? maxIdx : 2;
    }
    return count;
  })();


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
                  response: resp,
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

  React.useEffect(() => {
    if (autoFillFormId) {
      const match = forms.find(f => f.id === autoFillFormId);
      if (match) {
        handleOpenForm(match);
      }
    } else if (autoFillFormName) {
      const match = forms.find(f => f.name.toUpperCase().includes(autoFillFormName.toUpperCase()));
      if (match) {
        handleOpenForm(match);
      }
    }
  }, [autoFillFormId, autoFillFormName, forms]);

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

    const answersPayload = { ...answers };
    // Replace "Altro" select options with the custom text value typed in the specified input
    Object.keys(answersPayload).forEach((key) => {
      if (answersPayload[key] === "Altro" && answersPayload[key + "_altro"]) {
        answersPayload[key] = answersPayload[key + "_altro"];
        delete answersPayload[key + "_altro"];
      }
    });

    const isGroupCourse = selectedForm.name.toUpperCase().includes("CORSISTI") &&
      Object.entries(answers).some(([key, val]) => {
        const field = selectedForm.fields.find(f => f.id === key);
        return field?.label.toUpperCase().includes("PARTICIPA") && String(val || "").toUpperCase().includes("GRUP");
      });

    if (isGroupCourse && !answersPayload["group_participants_count"]) {
      answersPayload["group_participants_count"] = "2";
    }

    // Non-file answers
    formData.append("answers", JSON.stringify(answersPayload));

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
    <div className="space-y-6 dark staff-forms-page">
      <style dangerouslySetInnerHTML={{__html: `
        body,
        .paradise-theme-root {
          background-color: #0A0A0A !important;
          background: #0A0A0A !important;
        }
        div:has(> .staff-forms-page),
        div:has(> * > .staff-forms-page),
        div:has(> * > * > .staff-forms-page),
        div:has(> * > * > * > .staff-forms-page) {
          background-color: #0A0A0A !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        div:has(> .staff-forms-page) footer {
          border-top-color: rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.35) !important;
        }
      `}} />


      {/* Header Card with Candidacy shortcut */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/5 border border-white/10 rounded-[28px] p-6 mb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Moduli & Form</h1>
          <p className="text-xs sm:text-sm text-white/65 mt-0.5">Compila i moduli operativi del salone o registra una nuova candidatura.</p>
        </div>
        {candidaturaForm && (
          <Button 
            onClick={() => handleOpenForm(candidaturaForm)}
            className="bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 rounded-2xl min-h-12 shrink-0 font-extrabold text-sm"
          >
            <Plus className="size-5 text-paradise-noir" /> Compila Nuova Candidatura
          </Button>
        )}
      </div>

      {/* Prossimi Eventi */}
      {upcomingEvents.length > 0 && (
        <Card className="bg-white/5 border border-white/10 border-l-4 border-l-[#E8C98B] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
            <Calendar className="size-5 text-[#A74758]" />
            <div>
              <h2 className="text-lg font-bold text-white">Prossimi Eventi / Scadenze</h2>
              <p className="text-xs text-white/60">Visualizza le date pianificate compilate nei moduli operativi</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcomingEvents.map((evt, idx) => (
              <div 
                key={`${evt.responseId}-${idx}`}
                onClick={() => setSelectedResponse(evt.response)}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-[#E8C98B]/80 hover:bg-white/10 transition duration-300 cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-[#A74758] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg shadow-sm">
                      {evt.daysLeft === 0 ? "Oggi" : evt.daysLeft === 1 ? "Domani" : `Tra ${evt.daysLeft} giorni`}
                    </span>
                    <span className="text-[10px] text-white/40 font-semibold">{evt.dateLabel}</span>
                  </div>
                  <h4 className="font-bold text-sm text-white mt-2.5 truncate group-hover:text-[#E8C98B] transition">{evt.formName}</h4>
                  <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                    <User className="size-3 text-white/40" /> {evt.userName}
                  </p>
                  {evt.locationName && (
                    <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                      <MapPin className="size-3 text-white/40" /> {evt.locationName}
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                    {(() => {
                      const isEvtCorsistiForm = evt.formName.toUpperCase().includes("CORSISTI");
                      const evtParticipaField = evt.fields.find((f: any) => f.label.toUpperCase().includes("PARTICIPA"));
                      const evtParticipaValue = evtParticipaField ? evt.answers[evtParticipaField.id] : "";
                      const isEvtGroupCourse = String(evtParticipaValue || "").toUpperCase().includes("GRUP");

                      const isDefaultField = (label: string) => {
                        const l = label.toUpperCase();
                        return l === "NOME CORSISTA" || l === "EMAIL CORSISTA" || l === "NUMERO CORSISTA";
                      };

                      const fieldsToRender = evt.fields.filter((f: any) => {
                        if (f.type === "date") return false;
                        if (isEvtCorsistiForm && isEvtGroupCourse && isDefaultField(f.label)) return false;
                        return true;
                      });

                      const renderedFields = fieldsToRender.slice(0, 2).map((field: any) => {
                        const ans = evt.answers[field.id];
                        if (ans === undefined || ans === null || ans === "") return null;
                        return (
                          <div key={field.id} className="text-[11px] truncate">
                            <span className="font-semibold text-white/50">{field.label}: </span>
                            <span className="text-white">{typeof ans === "object" ? ans.name : String(ans)}</span>
                          </div>
                        );
                      });

                      if (isEvtCorsistiForm && isEvtGroupCourse) {
                        const pNames: string[] = [];
                        for (let i = 1; i <= 10; i++) {
                          const name = evt.answers[`participant_${i}_name`];
                          if (name) pNames.push(name);
                        }
                        if (pNames.length > 0) {
                          renderedFields.push(
                            <div key="group_participants" className="text-[11px] truncate">
                              <span className="font-semibold text-white/50">Corsisti: </span>
                              <span className="text-[#E8C98B] font-medium">{pNames.join(", ")}</span>
                            </div>
                          );
                        }
                      }

                      return renderedFields;
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Templates List (Desktop/Tablet) */}
      <div className="hidden sm:grid gap-6 md:grid-cols-2">
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
                "w-full rounded-[32px] p-6 transition-all duration-300 cursor-pointer shadow-md relative overflow-hidden select-none",
                color.bg,
                color.text,
                isExpanded ? "flex flex-col gap-5 animate-in fade-in-50 duration-200" : "h-[96px] flex items-center justify-between"
              )}
            >
              {isExpanded ? (
                <div className="flex flex-col justify-between w-full h-full">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-60">
                          {form.category}
                        </span>
                        <h3 className="text-xl font-extrabold mt-0.5 leading-tight">{form.name}</h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenForm(form);
                        }}
                        className={cn(
                          "size-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0",
                          color.arrowBg,
                          color.arrowText
                        )}
                      >
                        <ArrowUpRight className="size-5.5" />
                      </button>
                    </div>

                    <p className="mt-3.5 text-sm font-semibold opacity-85 leading-relaxed">
                      {form.description || "Nessuna descrizione specificata per questo modulo."}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-black/15">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFormForHistory(form);
                      }}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-white/40 backdrop-blur-sm text-base font-extrabold text-current border border-black/5 active:scale-95 transition"
                    >
                      <Clock className="size-5" />
                      Invii
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenForm(form);
                      }}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-slate-900 text-white text-base font-extrabold active:scale-95 transition"
                    >
                      <Plus className="size-5" />
                      Compila
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 truncate">
                    <DynamicIcon name={form.icon || "ClipboardList"} className="size-6 shrink-0 opacity-70" />
                    <div className="truncate">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-50 block">
                        {form.category}
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold truncate">{form.name}</h3>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "size-12 rounded-full flex items-center justify-center shadow-md shrink-0",
                      color.arrowBg,
                      color.arrowText
                    )}
                  >
                    <ArrowUpRight className="size-5.5" />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {forms.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-white/40 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <AlertCircle className="size-10 text-white/30 mb-3" />
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
          <div className="flex flex-col max-h-[85vh] w-full max-w-xl rounded-[28px] bg-neutral-900 text-white shadow-2xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  {selectedForm.category}
                </span>
                <h3 className="text-lg font-bold text-white">{selectedForm.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setSelectedForm(null)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
                <CheckCircle2 className="size-16 text-emerald-500 animate-bounce" />
                <h3 className="text-xl font-bold mt-4 text-white">Inviato con Successo!</h3>
                <p className="text-sm text-white/60 mt-1">Il modulo è stato salvato e sincronizzato.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {selectedForm.description && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 text-xs text-white/60 leading-relaxed">
                    {selectedForm.description}
                  </div>
                )}

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-950/45 border border-red-500/30 p-3.5 text-sm text-red-200">
                    <AlertCircle className="size-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {selectedForm.fields.map((field) => {
                  if (isCorsistiForm && isGroupCourse && isDefaultParticipantField(field.label)) {
                    return null;
                  }

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-sm font-bold text-white/70 block">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-white/45 -mt-0.5 mb-1 leading-relaxed">{field.description}</p>
                      )}

                      {field.type === "text" && (
                        <input
                          type="text"
                          required={field.required}
                          value={answers[field.id] || ""}
                          onChange={(e) => handleTextChange(field.id, e.target.value)}
                          className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white outline-none focus:border-[#A74758]"
                        />
                      )}

                      {field.type === "textarea" && (
                        <textarea
                          required={field.required}
                          value={answers[field.id] || ""}
                          onChange={(e) => handleTextChange(field.id, e.target.value)}
                          rows={3}
                          className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white outline-none focus:border-[#A74758] resize-none"
                        />
                      )}

                      {field.type === "number" && (
                        <input
                          type="number"
                          required={field.required}
                          value={answers[field.id] || ""}
                          onChange={(e) => handleTextChange(field.id, e.target.value)}
                          className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white outline-none focus:border-[#A74758]"
                        />
                      )}

                      {field.type === "select" && (
                        <div className="space-y-2 w-full">
                          <select
                            required={field.required}
                            value={answers[field.id] || ""}
                            onChange={(e) => handleTextChange(field.id, e.target.value)}
                            className="w-full h-10 rounded-xl bg-neutral-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-[#A74758]"
                          >
                            <option value="" className="bg-neutral-800 text-white">Seleziona un'opzione...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt} className="bg-neutral-800 text-white">{opt}</option>
                            ))}
                          </select>
                          {answers[field.id] === "Altro" && (
                            <input
                              type="text"
                              required={field.required}
                              placeholder="Specifica ruolo..."
                              value={answers[field.id + "_altro"] || ""}
                              onChange={(e) => handleTextChange(field.id + "_altro", e.target.value)}
                              className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white outline-none focus:border-[#A74758]"
                            />
                          )}
                        </div>
                      )}

                      {field.type === "money" && (
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-sm font-semibold text-white/45">€</span>
                          <input
                            type="number"
                            step="0.01"
                            required={field.required}
                            value={answers[field.id] || ""}
                            onChange={(e) => handleTextChange(field.id, e.target.value)}
                            className="w-full h-10 rounded-xl bg-white/5 border border-white/10 pl-8 pr-3.5 text-sm text-white outline-none focus:border-[#A74758]"
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
                          className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white outline-none focus:border-[#A74758]"
                        />
                      )}

                      {field.type === "worker" && (
                        <select
                          required={field.required}
                          value={answers[field.id] || ""}
                          onChange={(e) => handleTextChange(field.id, e.target.value)}
                          className="w-full h-10 rounded-xl bg-neutral-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-[#A74758]"
                        >
                          <option value="" className="bg-neutral-800 text-white">Seleziona collaboratore...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.name} className="bg-neutral-800 text-white">
                              {emp.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === "file" && (
                        <div className="relative flex items-center justify-center w-full min-h-24 border border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-[#A74758]/10 transition group">
                          <input
                            type="file"
                            required={field.required && !files[field.id]}
                            onChange={(e) => handleFileChange(field.id, e)}
                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center p-4 text-center pointer-events-none">
                            <Upload className="size-6 text-white/40 group-hover:text-[#A74758] transition" />
                            <span className="text-xs font-semibold text-white/70 mt-1.5">
                              {files[field.id] ? files[field.id].name : "Carica o trascina un file"}
                            </span>
                            {!files[field.id] && (
                              <span className="text-[10px] text-white/40 mt-0.5">Dimensione max: 15 MB</span>
                            )}
                          </div>
                        </div>
                      )}

                      {field.id === participaField?.id && isGroupCourse && (
                        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                          <label className="text-sm font-bold text-white/70 block">
                            Numero di Corsisti (Partecipanti) <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={answers["group_participants_count"] || "2"}
                            onChange={(e) => {
                              handleTextChange("group_participants_count", e.target.value);
                            }}
                            className="w-full h-10 rounded-xl bg-neutral-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-[#A74758]"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <option key={num} value={String(num)} className="bg-neutral-800 text-white">
                                {num} {num === 1 ? "Corsista" : "Corsisti"}
                              </option>
                            ))}
                          </select>

                          <div className="space-y-6 pt-4 border-t border-white/10">
                            {Array.from({ length: groupCount }).map((_, idx) => {
                              const pIndex = idx + 1;
                              return (
                                <div key={pIndex} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3 text-left">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#A74758]">
                                    Dati Corsista {pIndex}
                                  </h5>

                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-white/60">
                                      Nome Corsista {pIndex} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      required={isGroupCourse}
                                      value={answers[`participant_${pIndex}_name`] || ""}
                                      onChange={(e) => handleTextChange(`participant_${pIndex}_name`, e.target.value)}
                                      className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                                      placeholder={`Nome completo corsista ${pIndex}`}
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-xs font-semibold text-white/60">Email</label>
                                      <input
                                        type="email"
                                        value={answers[`participant_${pIndex}_email`] || ""}
                                        onChange={(e) => handleTextChange(`participant_${pIndex}_email`, e.target.value)}
                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                                        placeholder="Email (opzionale)"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-semibold text-white/60">Telefono</label>
                                      <input
                                        type="text"
                                        value={answers[`participant_${pIndex}_phone`] || ""}
                                        onChange={(e) => handleTextChange(`participant_${pIndex}_phone`, e.target.value)}
                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                                        placeholder="Telefono (opzionale)"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-white/60">Dati Professionali e Altre Info</label>
                                    <textarea
                                      value={answers[`participant_${pIndex}_notes`] || ""}
                                      onChange={(e) => handleTextChange(`participant_${pIndex}_notes`, e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg bg-white/5 border border-white/10 p-2 text-xs text-white outline-none focus:border-[#A74758] resize-none"
                                      placeholder="Dati professionali, mansione o altre informazioni..."
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4 bg-neutral-900 mt-6">
                  <Button
                    type="button"
                    variant="soft"
                    disabled={submitting}
                    onClick={() => setSelectedForm(null)}
                    className="bg-white/5 text-white hover:bg-white/10"
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
          <div className="flex flex-col max-h-[80vh] w-full max-w-2xl rounded-[28px] bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Cronologia e Invii
                </span>
                <h3 className="text-lg font-bold text-white">{selectedFormForHistory.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFormForHistory(null)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-white/60">
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

              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      <th className="px-4 py-2.5">Data Invio</th>
                      <th className="px-4 py-2.5">Dipendente</th>
                      <th className="px-4 py-2.5">Commenti</th>
                      <th className="px-4 py-2.5 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
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
                        <tr key={resp.id} className="hover:bg-white/5 transition">
                          <td className="px-4 py-3 font-semibold text-white/80">
                            {new Date(resp.created_at).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white">
                              {isOwnSubmission ? "Tu" : resp.user?.name || "Collaboratore"}
                            </span>
                            {!isOwnSubmission && (
                              <span className="ml-1 text-[9px] bg-blue-950/50 text-blue-300 border border-blue-900 rounded px-1 font-bold">
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
                              <span className="text-white/35">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedResponse(resp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-white/10 transition"
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
                        <td colSpan={4} className="p-8 text-center text-white/40 italic">
                          Nessun invio presente per questo modulo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end bg-white/5 px-6 py-4 border-t border-white/10">
              <Button type="button" onClick={() => setSelectedFormForHistory(null)} className="bg-white/5 text-white hover:bg-white/10">
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSE DETAIL VIEWER MODAL */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[85vh] w-full max-w-2xl rounded-[28px] bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  Dettagli Invio / Risposta
                </span>
                <h3 className="text-lg font-bold text-white">
                  {selectedResponse.form?.name || "Dettagli Modulo"}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedResponse(null)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submitter Metadata */}
              <div className="grid gap-3 grid-cols-2 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Dipendente</span>
                    <span className="font-semibold text-white">{selectedResponse.user?.name || "Tu"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Sede</span>
                    <span className="font-semibold text-white">{selectedResponse.user_location_name || "Nessuna"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2 border-t border-white/10 pt-2 mt-1">
                  <Calendar className="size-4 text-white/40" />
                  <div>
                    <span className="block text-[10px] font-bold text-white/40 uppercase">Inviato il</span>
                    <span className="font-semibold text-white">
                      {new Date(selectedResponse.created_at).toLocaleString("it-IT")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Answers Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Risposte alle Domande</h4>
                
                {selectedResponse.form?.fields ? (
                  (selectedResponse.form.fields as any[]).map((field) => {
                    if (isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label)) {
                      return null;
                    }

                    const answer = selectedResponse.answers[field.id];
                    
                    return (
                      <div key={field.id} className="border-b border-white/10 pb-3">
                        <span className="block text-xs font-bold text-white/40">{field.label}</span>
                        
                        <div className="mt-1 text-sm text-white">
                          {answer === undefined || answer === null || answer === "" ? (
                            <span className="text-white/30 italic">Nessuna risposta</span>
                          ) : field.type === "file" && typeof answer === "object" ? (
                            <div className="space-y-3 mt-1.5">
                              {/\.(jpg|jpeg|png|webp|gif)$/i.test(answer.name) && (
                                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-w-sm aspect-video flex items-center justify-center group/img">
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
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#A74758] shadow-sm hover:bg-white/10 transition"
                              >
                                <Download className="size-3.5" />
                                Scarica: {answer.name}
                              </a>
                            </div>
                          ) : field.type === "money" ? (
                            <p className="whitespace-pre-line leading-relaxed font-semibold bg-white/5 p-3 rounded-xl border border-white/10 text-[#A74758]">
                              € {(() => {
                                const val = parseFloat(answer);
                                return isNaN(val) ? String(answer) : val.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </p>
                          ) : field.type === "date" ? (
                            <p className="whitespace-pre-line leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/10 text-white">
                              {(() => {
                                const parts = String(answer).split("-");
                                if (parts.length === 3) {
                                  return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                }
                                return String(answer);
                              })()}
                            </p>
                          ) : (
                            <p className="whitespace-pre-line leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/10 text-white">
                              {String(answer)}
                            </p>
                          )}
                        </div>

                        {field.id === responseParticipaField?.id && isResponseGroupCourse && responseGroupCount > 0 && (
                          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            <span className="block text-xs font-bold text-white/40 uppercase tracking-wider">
                              Corsisti Partecipanti ({responseGroupCount})
                            </span>
                            
                            <div className="space-y-4">
                              {Array.from({ length: responseGroupCount }).map((_, idx) => {
                                const pIndex = idx + 1;
                                const pName = selectedResponse.answers[`participant_${pIndex}_name`] || "-";
                                const pEmail = selectedResponse.answers[`participant_${pIndex}_email`] || "";
                                const pPhone = selectedResponse.answers[`participant_${pIndex}_phone`] || "";
                                const pNotes = selectedResponse.answers[`participant_${pIndex}_notes`] || "";

                                return (
                                  <div key={pIndex} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-left">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                                      <span className="text-xs font-bold text-[#A74758]">Corsista {pIndex}</span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-white/40 text-xs block">Nome</span>
                                      <span className="font-semibold text-white">{pName}</span>
                                    </div>
                                    {(pEmail || pPhone) && (
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        {pEmail && (
                                          <div>
                                            <span className="text-white/40 block">Email</span>
                                            <span className="text-white font-medium">{pEmail}</span>
                                          </div>
                                        )}
                                        {pPhone && (
                                          <div>
                                            <span className="text-white/40 block">Telefono</span>
                                            <span className="text-white font-medium">{pPhone}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {pNotes && (
                                      <div className="text-xs border-t border-white/5 pt-1.5 mt-1">
                                        <span className="text-white/40 block">Dati Professionali & Altro</span>
                                        <span className="text-white/80 whitespace-pre-wrap leading-relaxed">{pNotes}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm italic text-white/40">Impossibile mappare le domande (modulo eliminato).</p>
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

            <div className="flex items-center justify-end gap-3 bg-neutral-900 px-6 py-4 border-t border-white/10">
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
              <Button type="button" variant="soft" onClick={() => setSelectedResponse(null)} className="bg-white/5 text-white hover:bg-white/10">
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
