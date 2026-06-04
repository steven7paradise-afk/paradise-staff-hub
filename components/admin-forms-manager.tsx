"use client";

import React, { useState } from "react";
import { 
  Plus, Trash2, Edit, ClipboardList, Eye, Check, X, 
  Sliders, User, MapPin, Calendar, Download, AlertCircle, Play
} from "lucide-react";
import { Badge, Card, Select, Button } from "@/components/ui";

type LocationOption = { id: string; name: string };

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
  allowed_roles: any; // string[] or null
  allowed_location_ids: any; // string[] or null
  fields: any; // FormField[]
  created_at: string;
};

type FormResponse = {
  id: string;
  form_id: string;
  user_id: string;
  user_role: string;
  user_location_name: string | null;
  answers: any; // Record<string, any>
  created_at: string;
  user: {
    name: string;
    email: string;
  };
  form: FormTemplate;
};

const USER_ROLES = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function AdminFormsManager({
  role,
  initialForms,
  locations,
  initialResponses,
}: {
  role: string;
  initialForms: any[];
  locations: LocationOption[];
  initialResponses: any[];
}) {
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";
  const [forms, setForms] = useState<FormTemplate[]>(initialForms);
  const [responses, setResponses] = useState<FormResponse[]>(initialResponses);
  const [activeTab, setActiveTab] = useState<"templates" | "responses">("templates");
  
  // Filter states for responses
  const [filterFormId, setFilterFormId] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Modal / Creator States
  const [showModal, setShowModal] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  
  // Form Field States
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("Generale");
  const [formActive, setFormActive] = useState(true);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedLocations, setAllowedLocations] = useState<string[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);

  // Response Viewer Detail State
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  // Load editing values into state
  const handleOpenEdit = (form: FormTemplate) => {
    setEditingForm(form);
    setFormName(form.name);
    setFormDesc(form.description || "");
    setFormCategory(form.category);
    setFormActive(form.active);
    setAllowedRoles(form.allowed_roles || []);
    setAllowedLocations(form.allowed_location_ids || []);
    setFormFields(form.fields || []);
    setShowModal(true);
  };

  const handleOpenCreate = () => {
    setEditingForm(null);
    setFormName("");
    setFormDesc("");
    setFormCategory("Generale");
    setFormActive(true);
    setAllowedRoles([]);
    setAllowedLocations([]);
    setFormFields([
      { id: "field_1", label: "Domanda 1", type: "text", required: true }
    ]);
    setShowModal(true);
  };

  // Add a question field
  const addField = () => {
    const newId = `field_${Date.now()}`;
    setFormFields([...formFields, { id: newId, label: `Domanda ${formFields.length + 1}`, type: "text", required: true }]);
  };

  // Update a specific field's property
  const updateField = (index: number, key: keyof FormField, value: any) => {
    const updated = [...formFields];
    updated[index] = { ...updated[index], [key]: value };
    setFormFields(updated);
  };

  // Remove a question field
  const removeField = (index: number) => {
    if (formFields.length <= 1) return; // Keep at least one
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  // Handle template submit (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      category: formCategory,
      active: formActive,
      allowed_roles: allowedRoles.length > 0 ? allowedRoles : null,
      allowed_location_ids: allowedLocations.length > 0 ? allowedLocations : null,
      fields: formFields,
    };

    try {
      if (editingForm) {
        // Update
        const res = await fetch(`/api/service-forms/${editingForm.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setForms(forms.map((f) => (f.id === editingForm.id ? updated : f)));
          setShowModal(false);
        }
      } else {
        // Create
        const res = await fetch("/api/service-forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setForms([created, ...forms]);
          setShowModal(false);
        }
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  // Delete form template
  const handleDeleteForm = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo modulo? Verranno eliminati anche tutti i dati ad esso associati.")) return;
    try {
      const res = await fetch(`/api/service-forms/${id}`, { method: "DELETE" });
      if (res.ok) {
        setForms(forms.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  // Allowed roles toggle
  const toggleRole = (role: string) => {
    if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter((r) => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  };

  // Allowed locations toggle
  const toggleLocation = (locId: string) => {
    if (allowedLocations.includes(locId)) {
      setAllowedLocations(allowedLocations.filter((id) => id !== locId));
    } else {
      setAllowedLocations([...allowedLocations, locId]);
    }
  };

  // Filter responses
  const filteredResponses = responses.filter((resp) => {
    const matchesForm = filterFormId === "all" || resp.form_id === filterFormId;
    const searchLower = filterSearch.toLowerCase().trim();
    const matchesUser = 
      !searchLower || 
      resp.user.name.toLowerCase().includes(searchLower) ||
      resp.user.email.toLowerCase().includes(searchLower);
    return matchesForm && matchesUser;
  });

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex gap-2 rounded-2xl bg-black/5 p-1.5 w-fit">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "templates" 
              ? "bg-white text-black shadow-sm" 
              : "text-black/50 hover:text-black/80"
          }`}
        >
          <ClipboardList className="size-4" />
          Moduli disponibili ({forms.length})
        </button>
        <button
          onClick={() => setActiveTab("responses")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "responses" 
              ? "bg-white text-black shadow-sm" 
              : "text-black/50 hover:text-black/80"
          }`}
        >
          <Sliders className="size-4" />
          Risposte ricevute ({responses.length})
        </button>
      </div>

      {activeTab === "templates" ? (
        <Card className="bg-white">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Templates</p>
              <h2 className="mt-1 text-2xl font-semibold">Elenco moduli operativi</h2>
            </div>
            {canManage && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#A74758] px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="size-4" />
                Crea nuovo modulo
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <div 
                key={form.id} 
                className="group relative flex flex-col justify-between rounded-[22px] border border-black/5 bg-[#FBF7F9] p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-black/40">
                      {form.category}
                    </span>
                    <Badge tone={form.active ? "green" : "pink"}>
                      {form.active ? "Attivo" : "Disattivato"}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-black">{form.name}</h3>
                  <p className="mt-1.5 text-sm text-black/55 line-clamp-2">
                    {form.description || "Nessuna descrizione specificata."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {form.allowed_roles ? (
                      form.allowed_roles.map((r: string) => (
                        <span key={r} className="rounded-lg bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-black/60">
                          {r.slice(0, 4)}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-lg bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-black/60">
                        Tutti i ruoli
                      </span>
                    )}

                    {form.allowed_location_ids ? (
                      <span className="rounded-lg bg-[#E8C98B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#A74758]">
                        Sedi limitate
                      </span>
                    ) : (
                      <span className="rounded-lg bg-[#E8C98B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#A74758]">
                        Tutte le sedi
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
                  <span className="text-xs text-black/40">
                    {form.fields?.length || 0} domande
                  </span>
                  {canManage && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenEdit(form)}
                        className="grid size-8 place-items-center rounded-xl bg-white text-black/60 shadow-sm border border-black/5 hover:bg-black/5 transition"
                        title="Modifica"
                      >
                        <Edit className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteForm(form.id)}
                        className="grid size-8 place-items-center rounded-xl bg-white text-red-500 shadow-sm border border-black/5 hover:bg-red-50 transition"
                        title="Elimina"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {forms.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-black/40">
                <AlertCircle className="size-10 mb-3" />
                <p className="font-semibold text-lg">Nessun modulo configurato</p>
                <p className="text-sm mt-1">{canManage ? "Clicca su \"Crea nuovo modulo\" in alto per iniziare." : "Non ci sono moduli disponibili al momento."}</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="bg-white">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Risposte</p>
              <h2 className="mt-1 text-2xl font-semibold">Risposte ricevute dai dipendenti</h2>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-black/50 uppercase tracking-wider block mb-1">Modulo</label>
              <Select value={filterFormId} onChange={(e) => setFilterFormId(e.target.value)}>
                <option value="all">Tutti i moduli</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-black/50 uppercase tracking-wider block mb-1">Cerca Dipendente</label>
              <input
                type="text"
                placeholder="Nome o email..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full h-10 rounded-xl border border-black/10 bg-[#FBF7F9] px-3.5 text-sm transition focus:border-[#A74758] focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-black/5">
            <table className="w-full text-left border-collapse bg-[#FBF7F9]">
              <thead>
                <tr className="border-b border-black/5 text-xs font-bold uppercase tracking-wider text-black/40 bg-black/5">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Modulo</th>
                  <th className="px-5 py-3">Dipendente</th>
                  <th className="px-5 py-3">Sede</th>
                  <th className="px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-sm">
                {filteredResponses.map((resp) => (
                  <tr key={resp.id} className="hover:bg-white transition">
                    <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-black/45" />
                        {new Date(resp.created_at).toLocaleString("it-IT", { 
                          day: "numeric", 
                          month: "short", 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-semibold">
                      {resp.form?.name || "Modulo eliminato"}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-black">{resp.user.name}</span>
                        <span className="text-xs text-black/40">{resp.user.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-black/70">
                      {resp.user_location_name || "Nessuna sede"}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedResponse(resp)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-white px-3.5 py-1.5 text-xs font-semibold shadow-sm hover:bg-black/5 transition"
                      >
                        <Eye className="size-3.5" />
                        Vedi risposte
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredResponses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-black/40">
                      <AlertCircle className="size-8 mx-auto mb-2" />
                      <p className="font-semibold">Nessuna risposta trovata</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CREATE/EDIT TEMPLATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[90vh] w-full max-w-3xl rounded-[28px] bg-white shadow-2xl overflow-hidden border border-black/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 bg-[#FBF7F9] px-6 py-4">
              <h3 className="text-xl font-bold">
                {editingForm ? "Modifica Modulo" : "Crea Nuovo Modulo"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="grid size-8 place-items-center rounded-xl bg-white border border-black/5 text-black/40 hover:bg-black/5 hover:text-black/80 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="col-span-full">
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50">Nome Modulo *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Es. Checklist Apertura Salone"
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 text-sm focus:border-[#A74758] outline-none"
                  />
                </div>
                <div className="col-span-full">
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50">Descrizione</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Scopo di questo modulo..."
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-black/10 p-3 text-sm focus:border-[#A74758] outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50">Categoria</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Es. Operativa, Amministrativa"
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 text-sm focus:border-[#A74758] outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <input
                    id="active"
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="size-5 rounded-lg border-black/10 text-[#A74758] focus:ring-[#A74758]"
                  />
                  <label htmlFor="active" className="text-sm font-semibold cursor-pointer">
                    Modulo Attivo (Visibile allo staff)
                  </label>
                </div>
              </div>

              {/* Target Audience (Roles) */}
              <div className="border-t border-black/5 pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">Chi può compilarlo? (Ruoli)</label>
                <p className="text-xs text-black/40 mb-2">Se non selezioni nulla, tutti i dipendenti potranno compilarlo.</p>
                <div className="flex flex-wrap gap-2">
                  {USER_ROLES.map((role) => {
                    const selected = allowedRoles.includes(role.value);
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => toggleRole(role.value)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          selected 
                            ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                            : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                        }`}
                      >
                        {selected && <Check className="size-3" />}
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Audience (Locations) */}
              <div className="border-t border-black/5 pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-black/50">In quali sedi è disponibile?</label>
                <p className="text-xs text-black/40 mb-2">Se non selezioni alcuna sede, sarà disponibile in tutti i saloni.</p>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => {
                    const selected = allowedLocations.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => toggleLocation(loc.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          selected 
                            ? "bg-[#A74758]/10 border-[#A74758] text-[#A74758]" 
                            : "bg-[#FBF7F9] border-black/5 text-black/60 hover:bg-black/5"
                        }`}
                      >
                        {selected && <Check className="size-3" />}
                        {loc.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions/Fields Builder */}
              <div className="border-t border-black/5 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50">Domande del Formulario</label>
                  <button
                    type="button"
                    onClick={addField}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#A74758] hover:underline"
                  >
                    <Plus className="size-3.5" />
                    Aggiungi domanda
                  </button>
                </div>

                <div className="space-y-4">
                  {formFields.map((field, idx) => (
                    <div 
                      key={field.id} 
                      className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-[#FBF7F9] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-black/40">Domanda {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          disabled={formFields.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          title="Rimuovi"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold uppercase text-black/45">Testo della Domanda</label>
                          <input
                            type="text"
                            required
                            value={field.label}
                            onChange={(e) => updateField(idx, "label", e.target.value)}
                            placeholder="Es. Hai svuotato il magazzino?"
                            className="mt-1 h-9 w-full rounded-lg border border-black/10 px-2.5 text-xs outline-none focus:border-[#A74758]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-black/45">Tipo Risposta</label>
                          <Select
                            value={field.type}
                            onChange={(e) => updateField(idx, "type", e.target.value)}
                            className="mt-1 h-9 w-full rounded-lg border border-black/10 px-2 text-xs"
                          >
                            <option value="text">Testo Breve</option>
                            <option value="textarea">Testo Lungo</option>
                            <option value="number">Valore Numerico</option>
                            <option value="select">Opzioni a Scelta</option>
                            <option value="money">Importo (€)</option>
                            <option value="date">Data</option>
                            <option value="worker">Selezione Collaboratore</option>
                            <option value="file">Caricamento File</option>
                          </Select>
                        </div>
                      </div>

                      {field.type === "select" && (
                        <div>
                          <label className="text-[10px] font-bold uppercase text-black/45 block mb-1">
                            Opzioni disponibili (Separate da virgola)
                          </label>
                          <input
                            type="text"
                            required
                            value={field.options?.join(", ") || ""}
                            onChange={(e) => updateField(idx, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                            placeholder="Es. Ottimo, Buono, Scarso"
                            className="h-9 w-full rounded-lg border border-black/10 px-2.5 text-xs outline-none focus:border-[#A74758]"
                          />
                        </div>
                      )}

                      <div className="mt-1">
                        <label className="text-[10px] font-bold uppercase text-black/45 block">Descrizione / Dettaglio Domanda (Opzionale)</label>
                        <input
                          type="text"
                          value={field.description || ""}
                          onChange={(e) => updateField(idx, "description", e.target.value)}
                          placeholder="Es. Inserisci importo in Euro o seleziona una data"
                          className="mt-1 h-9 w-full rounded-lg border border-black/10 px-2.5 text-xs outline-none focus:border-[#A74758]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id={`required-${field.id}`}
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(idx, "required", e.target.checked)}
                          className="size-4 rounded text-[#A74758] focus:ring-[#A74758]"
                        />
                        <label htmlFor={`required-${field.id}`} className="text-xs font-semibold cursor-pointer">
                          Obbligatorio
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 border-t border-black/5 bg-[#FBF7F9] px-6 py-4">
              <Button type="button" variant="soft" onClick={() => setShowModal(false)}>
                Annulla
              </Button>
              <button
                type="button"
                onClick={handleSubmitForm}
                className="rounded-xl bg-[#A74758] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
              >
                Salva Modulo
              </button>
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
                  Risposta Ricevuta
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
                    <span className="font-semibold">{selectedResponse.user.name}</span>
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
                  (selectedResponse.form.fields as FormField[]).map((field) => {
                    const answer = selectedResponse.answers[field.id];
                    
                    return (
                      <div key={field.id} className="border-b border-black/5 pb-3">
                        <span className="block text-xs font-bold text-black/40">{field.label}</span>
                        
                        <div className="mt-1 text-sm text-black">
                          {answer === undefined || answer === null || answer === "" ? (
                            <span className="text-black/30 italic">Nessuna risposta</span>
                          ) : field.type === "file" && typeof answer === "object" ? (
                            <a
                              href={`/api/service-forms/responses/file?path=${encodeURIComponent(answer.storagePath)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-black/5 bg-[#FBF7F9] px-3 py-1.5 text-xs font-semibold text-[#A74758] shadow-sm hover:bg-[#A74758]/5 transition mt-1"
                            >
                              <Download className="size-3.5" />
                              Scarica: {answer.name}
                            </a>
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
            </div>

            <div className="flex items-center justify-end bg-[#FBF7F9] px-6 py-4 border-t border-black/5">
              <Button type="button" onClick={() => setSelectedResponse(null)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
