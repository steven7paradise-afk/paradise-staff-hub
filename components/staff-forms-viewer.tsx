"use client";

import React, { useState } from "react";
import { ClipboardList, AlertCircle, CheckCircle2, ChevronRight, X, Loader2, Upload } from "lucide-react";
import { Badge, Card, Button } from "@/components/ui";

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
}: {
  forms: FormTemplate[];
  employees?: Array<{ id: string; name: string }>;
}) {
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  
  // Input answer states (mapped by field ID)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  
  // Submission UI States
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    if (!selectedForm) return;

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
      <div className="rounded-[24px] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-paradise-softPink text-[#A74758]">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Pagina operativa</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Moduli e Form</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">
              Seleziona un modulo tra quelli attivi per compilarlo. Le risposte verranno salvate in tempo reale nel database e condivise con la direzione.
            </p>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <div
            key={form.id}
            onClick={() => handleOpenForm(form)}
            className="group cursor-pointer flex items-center justify-between rounded-[22px] border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#FBF7F9] text-[#A74758] group-hover:bg-[#A74758]/5 transition">
                <ClipboardList className="size-5" />
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
    </div>
  );
}
