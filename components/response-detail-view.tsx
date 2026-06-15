"use client";

import React, { useState } from "react";
import { User, MapPin, Calendar, Download, Archive, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ResponseComments } from "@/components/response-comments";
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
                if (isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label)) {
                  return null;
                }

                const answer = response.answers[field.id];
                
                return (
                  <div key={field.id} className="border-b border-black/5 pb-3">
                    <span className="block text-xs font-bold text-black/40">{field.label}</span>
                    
                    <div className="mt-1 text-sm text-black">
                      {answer === undefined || answer === null || answer === "" ? (
                        <span className="text-black/30 italic">Nessuna risposta</span>
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
