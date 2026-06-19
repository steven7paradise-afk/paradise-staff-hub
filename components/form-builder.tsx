"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Trash2, ArrowUp, ArrowDown, ClipboardList, Check, X, 
  GitBranch, ListChecks, Settings2, MonitorSmartphone, Eye, HelpCircle,
  AlertCircle, Smartphone, Monitor, Info, ArrowLeft, ArrowUpRight, DollarSign, Calendar
} from "lucide-react";
import { Badge, Card, Select, Button } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn } from "@/lib/utils";

type LocationOption = { id: string; name: string };
type UserOption = { id: string; name: string; role: string; mansione: string | null };

type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "file" | "money" | "date" | "worker";
  required: boolean;
  options?: string[];
  description?: string;
  show_if?: {
    field_id: string;
    operator: "equals" | "not_equals" | "contains";
    value: string;
  } | null;
};

const USER_ROLES = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

const FORM_ICONS = [
  "ClipboardList", "FileCheck2", "CalendarDays", "Calculator", "CheckSquare", 
  "FileText", "Building2", "Smartphone", "UserRound", "Users", "Mail", 
  "Bell", "Activity", "Star", "Heart", "Smile", "Sparkles", "Coffee", 
  "ShoppingBag", "Utensils", "DollarSign", "MapPin", "Folder", "Package", "ShoppingCart"
];

export function FormBuilder({
  initialForm,
  locations,
  users,
}: {
  initialForm: any | null;
  locations: LocationOption[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"builder" | "settings" | "preview">("builder");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states
  const [formName, setFormName] = useState(initialForm?.name || "");
  const [formDesc, setFormDesc] = useState(initialForm?.description || "");
  const [formCategory, setFormCategory] = useState(initialForm?.category || "Generale");
  const [formActive, setFormActive] = useState(initialForm ? initialForm.active : true);
  const [formIcon, setFormIcon] = useState(initialForm?.icon || "ClipboardList");
  const [allowedRoles, setAllowedRoles] = useState<string[]>(initialForm?.allowed_roles || []);
  const [allowedLocations, setAllowedLocations] = useState<string[]>(initialForm?.allowed_location_ids || []);
  const [notifyRoles, setNotifyRoles] = useState<string[]>(initialForm?.notify_roles || []);
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>(initialForm?.notify_user_ids || []);
  const [formFields, setFormFields] = useState<FormField[]>(
    initialForm?.fields || [{ id: `field_${Date.now()}`, label: "Domanda 1", type: "text", required: true }]
  );

  // Inspector and Visual states
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(formFields[0]?.id || null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [previewFiles, setPreviewFiles] = useState<Record<string, File>>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const [svgLines, setSvgLines] = useState<Array<{ d: string; fromId: string; toId: string }>>([]);

  const selectedFieldIndex = formFields.findIndex(f => f.id === selectedFieldId);
  const selectedField = selectedFieldIndex !== -1 ? formFields[selectedFieldIndex] : null;

  // Toggle roles / locations helper functions
  const toggleRole = (r: string) => {
    setAllowedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };
  const toggleLocation = (id: string) => {
    setAllowedLocations(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleNotifyRole = (r: string) => {
    setNotifyRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };
  const toggleNotifyUser = (id: string) => {
    setNotifyUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Add / Remove fields
  const addField = () => {
    const newId = `field_${Date.now()}`;
    const newField: FormField = {
      id: newId,
      label: `Domanda ${formFields.length + 1}`,
      type: "text",
      required: true
    };
    setFormFields([...formFields, newField]);
    setSelectedFieldId(newId);
  };

  const removeField = (id: string) => {
    if (formFields.length <= 1) return;
    const updated = formFields.filter(f => f.id !== id);
    // Also clean up show_if conditions that reference this deleted field
    const cleaned = updated.map(f => {
      if (f.show_if?.field_id === id) {
        return { ...f, show_if: null };
      }
      return f;
    });
    setFormFields(cleaned);
    if (selectedFieldId === id) {
      setSelectedFieldId(cleaned[0]?.id || null);
    }
  };

  // Update fields helper
  const updateFieldProperty = (key: keyof FormField, value: any) => {
    if (selectedFieldIndex === -1) return;
    const updated = [...formFields];
    updated[selectedFieldIndex] = { ...updated[selectedFieldIndex], [key]: value };
    setFormFields(updated);
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const updated = [...formFields];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setFormFields(updated);
  };

  const moveFieldDown = (index: number) => {
    if (index === formFields.length - 1) return;
    const updated = [...formFields];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setFormFields(updated);
  };

  // Connect visual nodes layout (SVG calculation)
  const calculateLines = () => {
    if (!canvasRef.current || activeTab !== "builder") return;

    const containerRect = canvasRef.current.getBoundingClientRect();
    const newLines: Array<{ d: string; fromId: string; toId: string }> = [];

    formFields.forEach((field) => {
      if (field.show_if?.field_id) {
        const sourceEl = document.getElementById(`node-${field.show_if.field_id}`);
        const targetEl = document.getElementById(`node-${field.id}`);

        if (sourceEl && targetEl) {
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          // Connect from right center of source node to left center of target node
          const x1 = sourceRect.right - containerRect.left;
          const y1 = sourceRect.top + (sourceRect.height / 2) - containerRect.top;

          const x2 = targetRect.left - containerRect.left;
          const y2 = targetRect.top + (targetRect.height / 2) - containerRect.top;

          // Draw a smooth bezier curve
          const controlOffset = Math.max(Math.abs(x2 - x1) * 0.5, 40);
          const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

          newLines.push({ d, fromId: field.show_if.field_id, toId: field.id });
        }
      }
    });

    setSvgLines(newLines);
  };

  useLayoutEffect(() => {
    if (activeTab === "builder") {
      calculateLines();
      
      // Listen to window resizing or changes
      window.addEventListener("resize", calculateLines);
      
      // Run recalculation after a short delay to account for layouts settling
      const timer = setTimeout(calculateLines, 100);

      return () => {
        window.removeEventListener("resize", calculateLines);
        clearTimeout(timer);
      };
    }
  }, [formFields, activeTab, selectedFieldId]);

  // Handle Save
  const handleSave = async () => {
    if (!formName.trim()) {
      setErrorMsg("Il nome del modulo è obbligatorio.");
      setActiveTab("settings");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      category: formCategory.trim(),
      active: formActive,
      icon: formIcon,
      allowed_roles: allowedRoles.length > 0 ? allowedRoles : null,
      allowed_location_ids: allowedLocations.length > 0 ? allowedLocations : null,
      notify_roles: notifyRoles.length > 0 ? notifyRoles : null,
      notify_user_ids: notifyUserIds.length > 0 ? notifyUserIds : null,
      fields: formFields,
    };

    try {
      const url = initialForm ? `/api/service-forms/${initialForm.id}` : "/api/service-forms";
      const method = initialForm ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante il salvataggio.");
      }

      router.push("/settings/forms?tab=templates");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Qualcosa è andato storto. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  // Preview form logical validation
  const isFieldVisibleInPreview = (field: FormField) => {
    if (!field.show_if?.field_id) return true;
    const actualValue = String(previewAnswers[field.show_if.field_id] ?? "").toLowerCase().trim();
    const expectedValue = String(field.show_if.value ?? "").toLowerCase().trim();
    
    if (!expectedValue) return Boolean(actualValue);
    if (field.show_if.operator === "contains") return actualValue.includes(expectedValue);
    if (field.show_if.operator === "not_equals") return actualValue !== expectedValue;
    return actualValue === expectedValue;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sub-header navigation bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 bg-[#FBF7F9] p-4 rounded-2xl mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/settings/forms?tab=templates")}
            className="grid size-10 place-items-center rounded-xl bg-white border border-black/5 text-black/50 hover:bg-black/5 hover:text-black transition"
            title="Torna alla gestione moduli"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold truncate max-w-[200px] sm:max-w-xs">{formName || "Nuovo Modulo"}</h2>
            <p className="text-xs text-black/40 font-medium">Categoria: <span className="font-semibold">{formCategory || "Generale"}</span></p>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex items-center justify-center p-1 bg-black/5 rounded-xl self-center sm:self-auto">
          <button
            onClick={() => setActiveTab("builder")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "builder" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <GitBranch className="size-3.5" />
            Console Flusso
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "settings" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <Settings2 className="size-3.5" />
            Impostazioni
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "preview" ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
            )}
          >
            <MonitorSmartphone className="size-3.5" />
            Anteprima
          </button>
        </div>

        {/* Action button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A74758] px-5 py-2 text-xs font-bold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva Modulo"}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 text-red-700 border border-red-100 p-3 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main workspace panels */}
      <div className="flex-1 rounded-[24px] border border-black/5 bg-white shadow-sm overflow-hidden min-h-0">
        
        {/* TAB 1: VISUAL NODES BUILDER */}
        {activeTab === "builder" && (
          <div className="flex h-full min-h-0 divide-x divide-black/5">
            {/* Visual Canvas Area (Left) */}
            <div 
              ref={canvasRef}
              className="flex-1 overflow-auto bg-[#111017] p-8 relative min-w-0"
              style={{
                backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)",
                backgroundSize: "24px 24px"
              }}
            >
              {/* Connection overlay lines */}
              <svg className="absolute inset-0 size-full pointer-events-none z-0">
                <defs>
                  <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A74758" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#ff8bb2" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#A74758" stopOpacity="0.4" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                {svgLines.map((line, idx) => (
                  <path
                    key={idx}
                    d={line.d}
                    fill="none"
                    stroke="url(#glow-grad)"
                    strokeWidth="3.5"
                    filter="url(#glow)"
                    strokeDasharray="4 2"
                    className="animate-[dash_30s_linear_infinite]"
                    style={{
                      strokeDashoffset: 100,
                    }}
                  />
                ))}
              </svg>

              <style jsx global>{`
                @keyframes dash {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
              `}</style>

              <div className="relative z-10 flex flex-col items-center gap-16 min-w-max py-10 px-6">
                
                {/* Start node */}
                <div className="w-48 rounded-[20px] bg-white/5 border border-white/10 p-3 text-center text-white/50 text-xs font-bold tracking-wider uppercase select-none">
                  Avvio Formulario
                </div>

                {/* Nodes Stack */}
                <div className="flex flex-row items-center gap-24">
                  {formFields.map((field, index) => {
                    const isSelected = field.id === selectedFieldId;
                    const isConditional = Boolean(field.show_if?.field_id);
                    const sourceIndex = formFields.findIndex(f => f.id === field.show_if?.field_id);

                    return (
                      <div key={field.id} className="flex items-center">
                        <div
                          id={`node-${field.id}`}
                          onClick={() => setSelectedFieldId(field.id)}
                          className={cn(
                            "w-64 rounded-[24px] border p-4 shadow-xl text-white cursor-pointer select-none transition-all duration-300",
                            isSelected 
                              ? "bg-slate-900 border-[#A74758] shadow-[#A74758]/10 ring-2 ring-[#A74758]/20 scale-[1.03]" 
                              : isConditional 
                                ? "bg-[#1E1A22] border-[#A74758]/35 hover:border-[#A74758]/70"
                                : "bg-[#1B1A20] border-white/10 hover:border-white/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[9px] font-black text-white/70">
                              Q{index + 1}
                            </span>
                            <span className={cn(
                              "rounded-lg px-2 py-0.5 text-[9px] font-bold",
                              isConditional ? "bg-[#A74758]/20 text-[#ff8bb2]" : "bg-white/10 text-white/40"
                            )}>
                              {isConditional ? `Da Q${sourceIndex + 1}` : "Sempre visibile"}
                            </span>
                          </div>

                          <h4 className="mt-3 text-sm font-extrabold leading-tight line-clamp-2 min-h-[36px] text-white">
                            {field.label || `Domanda ${index + 1}`}
                          </h4>

                          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] font-bold text-white/45">
                            <span className="uppercase">{field.type}</span>
                            <span>{field.required ? "Obbligatoria" : "Facoltativa"}</span>
                          </div>

                          {/* Node action buttons inside canvas */}
                          <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-white/5 pt-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFieldUp(index);
                              }}
                              disabled={index === 0}
                              className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition"
                              title="Sposta a sinistra/prima"
                            >
                              <ArrowUp className="-rotate-90 size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFieldDown(index);
                              }}
                              disabled={index === formFields.length - 1}
                              className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition"
                              title="Sposta a destra/dopo"
                            >
                              <ArrowDown className="-rotate-90 size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.id);
                              }}
                              disabled={formFields.length <= 1}
                              className="p-1 text-red-400 hover:text-red-300 disabled:opacity-20 transition ml-2"
                              title="Elimina domanda"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick actions bar */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={addField}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-paradise-softPink border border-paradise-pink/25 px-6 text-xs font-bold text-[#A74758] transition hover:scale-[1.02]"
                  >
                    <Plus className="size-4 text-[#A74758]" />
                    Aggiungi Nuova Domanda
                  </button>
                </div>

              </div>
            </div>

            {/* Question Inspector Panel (Right) */}
            <div className="w-80 overflow-y-auto bg-white p-5 shrink-0 flex flex-col justify-between">
              {selectedField ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5">
                    <div>
                      <p className="text-[10px] font-bold text-black/35 uppercase tracking-wider">Proprietà Domanda</p>
                      <h4 className="text-sm font-bold text-black">Domanda Q{selectedFieldIndex + 1}</h4>
                    </div>
                    <Badge tone="dark">{selectedField.id.slice(0, 8)}</Badge>
                  </div>

                  {/* Text Label */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Testo Domanda *</label>
                    <input
                      type="text"
                      required
                      value={selectedField.label}
                      onChange={(e) => updateFieldProperty("label", e.target.value)}
                      placeholder="Es. Inserisci il codice ordine"
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-[#A74758]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Sottotitolo / Descrizione</label>
                    <input
                      type="text"
                      value={selectedField.description || ""}
                      onChange={(e) => updateFieldProperty("description", e.target.value)}
                      placeholder="Istruzioni per la compilazione..."
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-[#A74758]"
                    />
                  </div>

                  {/* Response Type */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Tipo Risposta</label>
                    <Select
                      value={selectedField.type}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        updateFieldProperty("type", newType);
                        if (newType === "select") {
                          updateFieldProperty("options", ["Sì", "No"]);
                        } else {
                          updateFieldProperty("options", undefined);
                        }
                      }}
                      className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-2 text-xs"
                    >
                      <option value="text">Testo Breve</option>
                      <option value="textarea">Testo Lungo</option>
                      <option value="number">Numero</option>
                      <option value="select">Opzioni Scelta Singola</option>
                      <option value="money">Importo (€)</option>
                      <option value="date">Data</option>
                      <option value="worker">Collaboratore</option>
                      <option value="file">File (PDF/Foto)</option>
                    </Select>
                  </div>

                  {/* Select Options */}
                  {selectedField.type === "select" && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-black/50 block">Opzioni a Scelta (Virgola)</label>
                      <input
                        type="text"
                        required
                        value={selectedField.options?.join(", ") || ""}
                        onChange={(e) => updateFieldProperty(
                          "options", 
                          e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                        )}
                        placeholder="Es. Sì, No, Forse"
                        className="mt-1.5 h-9 w-full rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-[#A74758]"
                      />
                    </div>
                  )}

                  {/* Required Checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id={`inspect-req-${selectedField.id}`}
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={(e) => updateFieldProperty("required", e.target.checked)}
                      className="size-4 rounded border-black/10 text-[#A74758] focus:ring-[#A74758]"
                    />
                    <label htmlFor={`inspect-req-${selectedField.id}`} className="text-xs font-semibold cursor-pointer text-black/80">
                      Risposta Obbligatoria
                    </label>
                  </div>

                  {/* Conditional Logic (show_if) */}
                  <div className="border-t border-black/5 pt-4 mt-2">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">Visibilità Condizionale</h5>
                    
                    {selectedFieldIndex === 0 ? (
                      <p className="text-[11px] text-black/35 leading-relaxed bg-black/5 p-2.5 rounded-xl border border-black/5">
                        La prima domanda (Q1) deve essere sempre visibile allo staff.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            id="cond-toggle"
                            type="checkbox"
                            checked={Boolean(selectedField.show_if)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Default to previous question
                                const prevField = formFields[selectedFieldIndex - 1];
                                updateFieldProperty("show_if", {
                                  field_id: prevField.id,
                                  operator: "equals",
                                  value: ""
                                });
                              } else {
                                updateFieldProperty("show_if", null);
                              }
                            }}
                            className="size-4 rounded border-black/10 text-[#A74758] focus:ring-[#A74758]"
                          />
                          <label htmlFor="cond-toggle" className="text-xs font-semibold cursor-pointer text-black/80">
                            Imposta condizioni
                          </label>
                        </div>

                        {selectedField.show_if && (
                          <div className="space-y-3 bg-[#FBF7F9] p-3 rounded-2xl border border-black/5">
                            {/* Source Question Select */}
                            <div>
                              <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Mostra se risponde a</label>
                              <Select
                                value={selectedField.show_if.field_id}
                                onChange={(e) => {
                                  const updatedCond = { ...selectedField.show_if!, field_id: e.target.value, value: "" };
                                  updateFieldProperty("show_if", updatedCond);
                                }}
                                className="h-8.5 w-full rounded-lg border border-black/10 px-2 text-xs"
                              >
                                {formFields.slice(0, selectedFieldIndex).map((f, i) => (
                                  <option key={f.id} value={f.id}>Q{i + 1} - {f.label}</option>
                                ))}
                              </Select>
                            </div>

                            {/* Operator */}
                            <div>
                              <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Logica</label>
                              <Select
                                value={selectedField.show_if.operator}
                                onChange={(e) => {
                                  const updatedCond = { ...selectedField.show_if!, operator: e.target.value as any };
                                  updateFieldProperty("show_if", updatedCond);
                                }}
                                className="h-8.5 w-full rounded-lg border border-black/10 px-2 text-xs"
                              >
                                <option value="equals">è uguale a</option>
                                <option value="not_equals">è diverso da</option>
                                <option value="contains">contiene</option>
                              </Select>
                            </div>

                            {/* Expected Value */}
                            <div>
                              <label className="text-[9px] font-bold uppercase text-black/45 block mb-1">Valore della risposta</label>
                              {(() => {
                                const sourceField = formFields.find(f => f.id === selectedField.show_if?.field_id);
                                if (sourceField?.type === "select" && sourceField.options?.length) {
                                  return (
                                    <Select
                                      value={selectedField.show_if.value}
                                      onChange={(e) => {
                                        const updatedCond = { ...selectedField.show_if!, value: e.target.value };
                                        updateFieldProperty("show_if", updatedCond);
                                      }}
                                      className="h-8.5 w-full rounded-lg border border-black/10 px-2 text-xs"
                                    >
                                      <option value="">Qualsiasi opzione</option>
                                      {sourceField.options.map(o => (
                                        <option key={o} value={o}>{o}</option>
                                      ))}
                                    </Select>
                                  );
                                }
                                return (
                                  <input
                                    type="text"
                                    value={selectedField.show_if.value}
                                    onChange={(e) => {
                                      const updatedCond = { ...selectedField.show_if!, value: e.target.value };
                                      updateFieldProperty("show_if", updatedCond);
                                    }}
                                    placeholder="Lascia vuoto per qualsiasi valore"
                                    className="h-8.5 w-full rounded-lg border border-black/10 px-2.5 text-xs outline-none focus:border-[#A74758]"
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-black/40">
                  <Info className="size-8 text-black/20 mb-2" />
                  <p className="font-semibold text-xs">Nessuna domanda selezionata</p>
                  <p className="text-[10px] mt-0.5">Clicca su un blocco domanda per regolarne le impostazioni.</p>
                </div>
              )}

              {/* Bottom stats summary */}
              <div className="border-t border-black/5 pt-4 mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-black/50">
                  <span>Totale domande:</span>
                  <span className="font-bold text-black">{formFields.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-black/50 mt-1">
                  <span>Collegamenti attivi:</span>
                  <span className="font-bold text-[#A74758]">{formFields.filter(f => f.show_if).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL SETTINGS */}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-black border-b border-black/5 pb-3">Impostazioni Generali</h3>
            
            <div className="grid gap-5 md:grid-cols-2">
              {/* Form Name */}
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">Nome Modulo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Es. Modulo Richiesta Materiale"
                  className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                />
              </div>

              {/* Form Description */}
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">Descrizione scopo modulo</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Scrivi qui a cosa serve questo modulo e chi deve compilarlo..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-black/10 p-3.5 text-sm outline-none focus:border-[#A74758] resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Categoria Modulo</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Es. Ordini, Operativo, Amministrazione"
                  className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-[#A74758]"
                />
                {formCategory.toLowerCase() === "ordini" && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 p-3 text-xs leading-relaxed">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <span>
                      <b>Collegamento Ordini Attivo:</b> Le risposte compilate per questo modulo verranno visualizzate come card tracciabili nella dashboard **Ordini** (`/orders`).
                    </span>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 md:mt-8">
                <input
                  id="form-active-toggle"
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="size-5 rounded-lg border-black/10 text-[#A74758] focus:ring-[#A74758]"
                />
                <label htmlFor="form-active-toggle" className="text-sm font-semibold cursor-pointer text-black">
                  Modulo Attivo (Visibile allo staff)
                </label>
              </div>
            </div>

            {/* Icon selection */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block mb-2">Icona del Modulo</label>
              <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-10 max-h-36 overflow-y-auto p-3 border border-black/5 bg-[#FBF7F9] rounded-2xl">
                {FORM_ICONS.map((iconName) => {
                  const selected = formIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormIcon(iconName)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-xl border p-2 transition hover:scale-105 active:scale-95",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758] shadow-sm font-bold" 
                          : "bg-white border-black/5 text-black/60 hover:bg-black/5"
                      )}
                      title={iconName}
                    >
                      <DynamicIcon name={iconName} className="size-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allowed Roles */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Chi può compilarlo? (Ruoli)</label>
              <p className="text-xs text-black/40 mb-3">Se non ne selezioni nessuno, tutti i membri dello staff lo vedranno.</p>
              <div className="flex flex-wrap gap-2.5">
                {USER_ROLES.map((role) => {
                  const selected = allowedRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleRole(role.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allowed Locations */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">In quali saloni è disponibile?</label>
              <p className="text-xs text-black/40 mb-3">Se non ne selezioni nessuno, sarà visibile in tutte le sedi.</p>
              <div className="flex flex-wrap gap-2.5">
                {locations.map((loc) => {
                  const selected = allowedLocations.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => toggleLocation(loc.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notified Roles */}
            <div className="border-t border-black/5 pt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Chi riceve notifiche all'invio? (Ruoli)</label>
              <p className="text-xs text-black/40 mb-3">Verranno inviate notifiche push/in-app ai membri del personale con questi ruoli.</p>
              <div className="flex flex-wrap gap-2.5">
                {USER_ROLES.map((role) => {
                  const selected = notifyRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleNotifyRole(role.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                          : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notified Specific Users */}
            <div className="border-t border-black/5 pt-5 pb-10">
              <label className="text-xs font-bold uppercase tracking-wider text-black/50 block">Notifica collaboratori specifici</label>
              <p className="text-xs text-black/40 mb-3">Seleziona dipendenti specifici da avvisare sempre all'invio del modulo.</p>
              <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 max-h-48 overflow-y-auto p-3.5 border border-black/5 bg-[#FBF7F9] rounded-2xl">
                {users.map((u) => {
                  const selected = notifyUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleNotifyUser(u.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition hover:bg-black/5",
                        selected 
                          ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758] font-bold" 
                          : "bg-white border-black/5 text-black/75"
                      )}
                    >
                      <div className={cn(
                        "grid size-4 place-items-center rounded border transition",
                        selected ? "bg-[#A74758] border-[#A74758] text-white" : "border-black/20"
                      )}>
                        {selected && <Check className="size-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{u.name}</p>
                        {u.mansione && <p className="text-[10px] text-black/45 truncate mt-0.5">{u.mansione}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STAFF INTERACTIVE PREVIEW */}
        {activeTab === "preview" && (
          <div className="h-full flex flex-col items-center bg-[#FAF8FA] p-6 relative overflow-y-auto">
            {/* Device selector */}
            <div className="flex gap-2 rounded-xl bg-black/5 p-1 mb-5">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                  previewDevice === "desktop" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                )}
              >
                <Monitor className="size-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                  previewDevice === "mobile" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                )}
              >
                <Smartphone className="size-3.5" />
                Cellulare
              </button>
            </div>

            {/* Interactive container */}
            <div 
              className={cn(
                "bg-neutral-900 rounded-[28px] border border-white/10 text-white shadow-2xl p-6 transition-all duration-300 w-full flex flex-col",
                previewDevice === "mobile" ? "max-w-sm aspect-[9/16] min-h-[580px]" : "max-w-2xl min-h-[400px]"
              )}
            >
              {/* Header inside device */}
              <div className="border-b border-white/10 pb-4 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A74758]">
                  {formCategory || "Generale"}
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DynamicIcon name={formIcon} className="size-5 shrink-0" />
                  {formName || "Modulo senza titolo"}
                </h3>
                {formDesc && (
                  <p className="mt-2 text-xs text-white/50 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5">
                    {formDesc}
                  </p>
                )}
              </div>

              {/* Dynamic form preview rendering */}
              <div className="flex-1 space-y-5 overflow-y-auto pr-1">
                {formFields.filter(isFieldVisibleInPreview).map((field, idx) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-xs font-bold text-white/70 block">
                      {field.label || `Domanda ${idx + 1}`} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-[11px] text-white/45 -mt-0.5 leading-relaxed">{field.description}</p>
                    )}

                    {field.type === "text" && (
                      <input
                        type="text"
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                      />
                    )}

                    {field.type === "textarea" && (
                      <textarea
                        rows={2}
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full rounded-lg bg-white/5 border border-white/10 p-2.5 text-xs text-white outline-none focus:border-[#A74758] resize-none"
                      />
                    )}

                    {field.type === "number" && (
                      <input
                        type="number"
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                      />
                    )}

                    {field.type === "select" && (
                      <select
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-9 rounded-lg bg-neutral-800 border border-white/10 px-2 text-xs text-white outline-none focus:border-[#A74758]"
                      >
                        <option value="">Seleziona un'opzione...</option>
                        {field.options?.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )}

                    {field.type === "money" && (
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-semibold text-white/45">€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={previewAnswers[field.id] || ""}
                          onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full h-9 rounded-lg bg-white/5 border border-white/10 pl-7 pr-3 text-xs text-white outline-none focus:border-[#A74758]"
                        />
                      </div>
                    )}

                    {field.type === "date" && (
                      <input
                        type="date"
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-xs text-white outline-none focus:border-[#A74758]"
                      />
                    )}

                    {field.type === "worker" && (
                      <select
                        value={previewAnswers[field.id] || ""}
                        onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-9 rounded-lg bg-neutral-800 border border-white/10 px-2 text-xs text-white outline-none focus:border-[#A74758]"
                      >
                        <option value="">Seleziona un collaboratore...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.role.slice(0, 4)})</option>
                        ))}
                      </select>
                    )}

                    {field.type === "file" && (
                      <div className="rounded-lg border border-dashed border-white/20 p-3 text-center bg-white/5">
                        <p className="text-[10px] text-white/60">Simula caricamento file (.png, .pdf...)</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit simulation */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => alert("Simulazione invio completata! I dati sono corretti.")}
                  className="w-full h-10 rounded-xl bg-[#A74758] text-xs font-bold hover:scale-[0.98] transition"
                >
                  Simula Invio Modulo
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
