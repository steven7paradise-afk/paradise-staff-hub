"use client";

import React, { useState } from "react";
import { User, MapPin, Calendar, Download, Archive, ArrowLeft, CheckCircle2, Pencil, Check, X, ExternalLink, ShoppingBag, CreditCard, Coins, History, StickyNote } from "lucide-react";
import { Button } from "@/components/ui";
import { ResponseComments } from "@/components/response-comments";
import { cn } from "@/lib/utils";
import Link from "next/link";

function serviceFormFileUrl(answer: any) {
  return answer?.driveFileUrl || answer?.webViewLink || answer?.url || (answer?.storagePath ? `/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}` : "#");
}

export function ResponseDetailView({
  initialResponse,
  currentUserId,
  currentUserName,
  currentUserRole,
  isManager,
  backUrl: requestedBackUrl,
  shopifyOrder,
}: {
  initialResponse: any;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isManager: boolean;
  backUrl?: string;
  shopifyOrder?: {
    code: string;
    adminUrl: string | null;
    clientName: string | null;
    totalPrice: number | null;
    lineItems: Array<{ title: string; quantity: number; price: number }>;
    note: string | null;
    financialStatus: string | null;
    paymentMethod: string;
    paymentGateways: string[];
    paymentBreakdown: Array<{ method: string; gateway: string; amount: number }>;
  } | null;
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

  const backUrl = requestedBackUrl || (isManager ? "/settings/forms?tab=responses" : "/service-forms");
  const internalNoteText = typeof response.internal_notes === "string"
    ? response.internal_notes
    : response.internal_notes && typeof response.internal_notes === "object"
      ? String(response.internal_notes.text || response.internal_notes.note || "")
      : "";
  const activityLog = Array.isArray(response.activity_log) ? response.activity_log : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back button */}
      <Link
        href={backUrl}
        className="inline-flex items-center gap-2 text-sm font-semibold text-black/60 hover:text-black transition"
      >
        <ArrowLeft className="size-4" />
        Torna alla gestione
      </Link>

      {shopifyOrder ? (
        <section className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111017] text-white shadow-xl">
          <div className="flex flex-col gap-5 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#F0A1AF]">
                  <ShoppingBag className="size-3.5" /> Ordine Shopify
                </span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase text-emerald-300">
                  {String(shopifyOrder.financialStatus || "stato assente") === "paid" ? "Pagato" : shopifyOrder.financialStatus || "Stato assente"}
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-black">Ordine #{shopifyOrder.code.replace(/^#/, "")}</h2>
              <p className="mt-1 text-sm font-semibold text-white/50">{shopifyOrder.clientName || "Cliente non indicata"}</p>
            </div>
            <div className="flex items-center gap-4 sm:text-right">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Totale ordine</p>
                <p className="mt-1 text-3xl font-black">{(shopifyOrder.totalPrice || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
              </div>
              {shopifyOrder.adminUrl ? (
                <a href={shopifyOrder.adminUrl} target="_blank" rel="noreferrer" className="grid size-12 place-items-center rounded-2xl bg-white text-black transition hover:bg-[#F0A1AF]" aria-label="Apri ordine su Shopify">
                  <ExternalLink className="size-5" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Prodotti e servizi</p>
              <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                {shopifyOrder.lineItems.length ? shopifyOrder.lineItems.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="font-bold">{item.title}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                    <span className="font-black">{(item.price * item.quantity).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                  </div>
                )) : <p className="px-4 py-4 text-sm text-white/45">Nessun prodotto disponibile.</p>}
              </div>
              {shopifyOrder.note ? (
                <div className="mt-4 rounded-2xl border border-[#F0A1AF]/20 bg-[#F0A1AF]/10 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#F0A1AF]"><StickyNote className="size-4" /> Nota ordine Shopify</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{shopifyOrder.note}</p>
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Pagamento rilevato</p>
              <div className="mt-3 space-y-2">
                {shopifyOrder.paymentBreakdown.length ? shopifyOrder.paymentBreakdown.map((payment, index) => {
                  const PaymentIcon = payment.method === "CONTANTI" ? Coins : CreditCard;
                  return (
                    <div key={`${payment.gateway}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-white/10"><PaymentIcon className="size-4" /></span>
                        <div><p className="text-sm font-black">{payment.method === "CONTANTI" ? "Contanti" : payment.method === "CASHMATIC" ? "Cashmatic" : "Carta"}</p><p className="text-[10px] font-bold text-white/35">{payment.gateway}</p></div>
                      </div>
                      <p className="font-black">{payment.amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                    </div>
                  );
                }) : <p className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-white/45">Metodo {shopifyOrder.paymentMethod}</p>}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
                                    src={serviceFormFileUrl(answer)}
                                    alt={answer.name}
                                    className="object-contain max-h-48 w-full"
                                  />
                                </div>
                              )}
                              <a
                                href={serviceFormFileUrl(answer)}
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
          {(internalNoteText || activityLog.length) ? (
            <div className="grid gap-4 border-t border-black/5 pt-5 md:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-[#FBF7F9] p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#A74758]"><StickyNote className="size-4" /> Note interne</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">{internalNoteText || "Nessuna nota interna."}</p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-[#FBF7F9] p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#A74758]"><History className="size-4" /> Cronologia</p>
                <div className="mt-3 space-y-3">
                  {activityLog.length ? activityLog.slice().reverse().map((entry: any, index: number) => (
                    <div key={index} className="border-l-2 border-[#A74758]/25 pl-3 text-xs">
                      <p className="font-bold text-black/70">{entry.note || entry.type || "Aggiornamento"}</p>
                      <p className="mt-0.5 text-black/35">{entry.by || "Staff"}{entry.at ? ` · ${new Date(entry.at).toLocaleString("it-IT")}` : ""}</p>
                    </div>
                  )) : <p className="text-sm text-black/40">Nessuna attività registrata.</p>}
                </div>
              </div>
            </div>
          ) : null}

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
