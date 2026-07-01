"use client";

import React, { useState } from "react";
import { User, MapPin, Calendar, Download, Archive, ArrowLeft, CheckCircle2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui";
import { ResponseComments } from "@/components/response-comments";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function ResponseDetailView({
  initialResponse,
  currentUserId,
  currentUserName,
  currentUserRole,
  isManager,
}: {
  initialResponse: any;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isManager: boolean;
}) {
  const [response, setResponse] = useState(initialResponse);
  const [success, setSuccess] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [customSelectValue, setCustomSelectValue] = useState<string>("");

  const handleSaveAnswer = async (fieldId: string, newValue: string) => {
    try {
      const updatedAnswers = {
        ...response.answers,
        [fieldId]: newValue,
      };
      const res = await fetch(`/api/service-forms/responses/${response.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: updatedAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data);
        setEditingFieldId(null);
      } else {
        alert("Errore durante il salvataggio.");
      }
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore, riprova.");
    }
  };

  // Derived helper variables for dynamic group participants response viewer
  const responseParticipaField = response?.form?.fields 
    ? (response.form.fields as any[]).find((f: any) => f.label.toUpperCase().includes("PARTICIPA")) 
    : null;
  const responseParticipaValue = responseParticipaField && response?.answers 
    ? (response.answers as any)[responseParticipaField.id] 
    : "";
  const isResponseGroupCourse = String(responseParticipaValue || "").toUpperCase().includes("GRUP");
  const isResponseCorsistiForm = response?.form?.name?.toUpperCase().includes("CORSISTI");
  const responseGroupCount = (() => {
    let count = parseInt((response?.answers as any)?.["group_participants_count"] || "0", 10);
    if (isResponseGroupCourse && count === 0 && response?.answers) {
      let maxIdx = 0;
      for (let i = 1; i <= 10; i++) {
        if ((response.answers as any)[`participant_${i}_name`]) {
          maxIdx = i;
        }
      }
      count = maxIdx > 0 ? maxIdx : 2;
    }
    return count;
  })();

  const isDefaultParticipantField = (fieldLabel: string) => {
    const labelUpper = fieldLabel.toUpperCase();
    return labelUpper === "NOME CORSISTA" || labelUpper === "EMAIL CORSISTA" || labelUpper === "NUMERO CORSISTA";
  };

  const handleArchiveResponse = async () => {
    try {
      const res = await fetch(`/api/service-forms/responses/${response.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (res.ok) {
        setResponse((prev: any) => ({ ...prev, status: "ARCHIVED" }));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        alert("Errore durante il completamento.");
      }
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore, riprova.");
    }
  };

  const backUrl = isManager ? "/settings/forms?tab=responses" : "/service-forms";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href={backUrl}
        className="inline-flex items-center gap-2 text-sm font-semibold text-black/60 hover:text-black transition"
      >
        <ArrowLeft className="size-4" />
        Torna alla gestione
      </Link>

      <div className="rounded-[28px] bg-white border border-black/5 shadow-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/5 bg-[#FBF7F9] px-6 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
              Dettagli Invio / Risposta
            </span>
            <h3 className="text-lg font-bold">
              {response.form?.name || "Dettagli Modulo"}
            </h3>
          </div>
          {response.status === "ARCHIVED" && (
            <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Completato
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Submitter Metadata */}
          <div className="grid gap-3 grid-cols-2 rounded-2xl bg-[#FBF7F9] border border-black/5 p-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-4 text-black/40" />
              <div>
                <span className="block text-[10px] font-bold text-black/40 uppercase">Dipendente</span>
                <span className="font-semibold">{response.user?.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-black/40" />
              <div>
                <span className="block text-[10px] font-bold text-black/40 uppercase">Sede</span>
                <span className="font-semibold">{response.user_location_name || "Nessuna"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 col-span-2 border-t border-black/5 pt-2 mt-1">
              <Calendar className="size-4 text-black/40" />
              <div>
                <span className="block text-[10px] font-bold text-black/40 uppercase">Inviato il</span>
                <span className="font-semibold">
                  {new Date(response.created_at).toLocaleString("it-IT")}
                </span>
              </div>
            </div>
          </div>

          {/* Answers Grid */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black/50">Risposte alle Domande</h4>
            
            {response.form?.fields ? (
              (response.form.fields as any[]).map((field) => {
                if (field.type === "pin") return null;
                if (isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label)) {
                  return null;
                }

                const answer = response.answers[field.id];
                
                return (
                  <div key={field.id} className="border-b border-black/5 pb-3">
                    <span className="block text-xs font-bold text-black/40">{field.label}</span>
                    
                    <div className="mt-1 text-sm text-black">
                      {editingFieldId === field.id ? (
                        <div className="space-y-2 mt-1">
                          {field.type === "textarea" ? (
                            <textarea
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full rounded-xl bg-white border border-[#A74758] p-3 text-sm text-black outline-none focus:border-[#A74758] min-h-[80px]"
                              autoFocus
                            />
                          ) : field.type === "select" ? (
                            <div className="space-y-2.5 w-full">
                              <select
                                value={editingValue}
                                onChange={(e) => {
                                  setEditingValue(e.target.value);
                                  if (e.target.value !== "Altro") {
                                    setCustomSelectValue("");
                                  }
                                }}
                                className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-3 text-sm text-black outline-none focus:border-[#A74758]"
                                autoFocus
                              >
                                <option value="">Seleziona un'opzione...</option>
                                {field.options?.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="Altro">Altro...</option>
                              </select>
                              {editingValue === "Altro" && (
                                <input
                                  type="text"
                                  placeholder="Specifica..."
                                  value={customSelectValue}
                                  onChange={(e) => setCustomSelectValue(e.target.value)}
                                  className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-4 text-sm text-black outline-none focus:border-[#A74758]"
                                />
                              )}
                            </div>
                          ) : (
                            <input
                              type={field.type === "number" || field.type === "money" ? "number" : field.type === "date" ? "date" : "text"}
                              step={field.type === "money" ? "0.01" : undefined}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const finalVal = editingValue === "Altro" ? customSelectValue : editingValue;
                                  handleSaveAnswer(field.id, finalVal);
                                } else if (e.key === "Escape") {
                                  setEditingFieldId(null);
                                }
                              }}
                              className="w-full h-11 rounded-xl bg-white border border-[#A74758] px-4 text-sm text-black outline-none focus:border-[#A74758]"
                              autoFocus
                            />
                          )}
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-black/50 hover:text-black rounded-lg bg-black/5 transition"
                            >
                              <X className="size-3.5" /> Annulla
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const finalVal = editingValue === "Altro" ? customSelectValue : editingValue;
                                handleSaveAnswer(field.id, finalVal);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-[#A74758] transition hover:scale-[1.02]"
                            >
                              <Check className="size-3.5" /> Salva
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            if (field.type !== "file") {
                              setEditingFieldId(field.id);
                              setEditingValue(answer === undefined || answer === null ? "" : String(answer));
                              setCustomSelectValue("");
                            }
                          }}
                          className={cn(
                            "group/answer relative transition-all duration-200 rounded-xl",
                            field.type !== "file" && "cursor-pointer hover:ring-1 hover:ring-[#A74758]/50"
                          )}
                        >
                          {answer === undefined || answer === null || answer === "" ? (
                            <div className="bg-[#FBF7F9] p-3 rounded-xl border border-black/5 flex items-center justify-between">
                              <span className="text-black/30 italic">Nessuna risposta</span>
                              {field.type !== "file" && <Pencil className="size-3.5 text-black/0 group-hover/answer:text-black/30 transition-colors animate-in fade-in duration-200" />}
                            </div>
                          ) : field.type === "file" && typeof answer === "object" ? (
                            <div className="space-y-3 mt-1.5">
                              {/\.(jpg|jpeg|png|webp|gif)$/i.test(answer.name) && (
                                <div className="relative rounded-2xl overflow-hidden border border-black/10 bg-black/5 max-w-sm aspect-video flex items-center justify-center">
                                  <img
                                    src={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                                    alt={answer.name}
                                    className="object-contain max-h-48 w-full"
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
                            <div className="whitespace-pre-line leading-relaxed font-semibold bg-[#FBF7F9] p-3 rounded-xl border border-black/5 text-[#A74758] flex items-center justify-between">
                              <span>
                                € {(() => {
                                  const val = parseFloat(answer);
                                  return isNaN(val) ? String(answer) : val.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()}
                              </span>
                              <Pencil className="size-3.5 text-black/0 group-hover/answer:text-[#A74758]/65 transition-colors animate-in fade-in duration-200" />
                            </div>
                          ) : field.type === "date" ? (
                            <div className="whitespace-pre-line leading-relaxed font-medium bg-[#FBF7F9] p-3 rounded-xl border border-black/5 flex items-center justify-between">
                              <span>
                                {(() => {
                                  const parts = String(answer).split("-");
                                  if (parts.length === 3) {
                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                  }
                                  return String(answer);
                                })()}
                              </span>
                              <Pencil className="size-3.5 text-black/0 group-hover/answer:text-black/30 transition-colors animate-in fade-in duration-200" />
                            </div>
                          ) : (
                            <div className="whitespace-pre-line leading-relaxed font-medium bg-[#FBF7F9] p-3 rounded-xl border border-black/5 flex items-center justify-between">
                              <span>{String(answer)}</span>
                              <Pencil className="size-3.5 text-black/0 group-hover/answer:text-black/30 transition-colors animate-in fade-in duration-200" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {field.id === responseParticipaField?.id && isResponseGroupCourse && responseGroupCount > 0 && (
                      <div className="mt-4 p-4 rounded-2xl bg-[#FBF7F9] border border-black/5 space-y-4">
                        <span className="block text-xs font-bold text-black/40 uppercase tracking-wider text-left">
                          Corsisti Partecipanti ({responseGroupCount})
                        </span>
                        
                        <div className="space-y-4">
                          {Array.from({ length: responseGroupCount }).map((_, idx) => {
                            const pIndex = idx + 1;
                            const pName = (response.answers as any)[`participant_${pIndex}_name`] || "-";
                            const pEmail = (response.answers as any)[`participant_${pIndex}_email`] || "";
                            const pPhone = (response.answers as any)[`participant_${pIndex}_phone`] || "";
                            const pNotes = (response.answers as any)[`participant_${pIndex}_notes`] || "";

                            return (
                              <div key={pIndex} className="p-3.5 rounded-xl bg-white border border-black/5 space-y-2 text-left">
                                <div className="flex items-center justify-between border-b border-black/5 pb-1.5 mb-1.5">
                                  <span className="text-xs font-bold text-[#A74758]">Corsista {pIndex}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-black/40 text-xs block">Nome</span>
                                  <span className="font-semibold text-black">{pName}</span>
                                </div>
                                {(pEmail || pPhone) && (
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    {pEmail && (
                                      <div>
                                        <span className="text-black/40 block">Email</span>
                                        <span className="text-black font-medium">{pEmail}</span>
                                      </div>
                                    )}
                                    {pPhone && (
                                      <div>
                                        <span className="text-black/40 block">Telefono</span>
                                        <span className="text-black font-medium">{pPhone}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {pNotes && (
                                  <div className="text-xs border-t border-black/5 pt-1.5 mt-1">
                                    <span className="text-black/40 block">Dati Professionali & Altro</span>
                                    <span className="text-black/80 whitespace-pre-wrap leading-relaxed">{pNotes}</span>
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
              <p className="text-sm italic text-black/40">Impossibile mappare le domande (modulo eliminato).</p>
            )}
          </div>

          {/* Response Comments */}
          <ResponseComments
            responseId={response.id}
            initialComments={response.comments}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            onCommentsUpdate={(updatedComments) => {
              setResponse((prev: any) => ({ ...prev, comments: updatedComments }));
            }}
          />
        </div>

        <div className="flex items-center justify-between bg-[#FBF7F9] px-6 py-4 border-t border-black/5">
          <div>
            {response.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={handleArchiveResponse}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#A74758] text-white px-4 py-2 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition shadow-sm"
              >
                <Archive className="size-3.5" />
                Marca come Completato
              </button>
            )}
          </div>
          <Link href={backUrl}>
            <Button type="button" variant="soft">
              Chiudi
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
