"use client";

import React, { useState, useMemo } from "react";
import { 
  Plus, Trash2, Edit, ClipboardList, Eye, Check, X, 
  Sliders, User, MapPin, Calendar, Download, AlertCircle, Play,
  Archive, Undo, Inbox, ArrowUpRight, GitBranch, ListChecks, Settings2, MonitorSmartphone,
  ShoppingCart, UserPlus, ChevronRight
} from "lucide-react";
import { Badge, Card, Select, Button } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ResponseComments } from "@/components/response-comments";
import { cn } from "@/lib/utils";
import Link from "next/link";

type LocationOption = { id: string; name: string };

type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "file" | "money" | "date" | "worker" | "worker_multi" | "checkbox" | "pin";
  required: boolean;
  options?: string[];
  description?: string;
  show_if?: {
    field_id: string;
    operator: "equals" | "not_equals" | "contains";
    value: string;
  } | null;
  show_ifs?: {
    field_id: string;
    operator: "equals" | "not_equals" | "contains";
    value: string;
  }[];
  position?: { x: number; y: number };
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
  notify_roles: any; // string[] or null
  notify_user_ids: any; // string[] or null
  created_at: string;
};

type FormResponse = {
  id: string;
  form_id: string;
  user_id: string;
  user_role: string;
  user_location_name: string | null;
  answers: any; // Record<string, any>
  status: string;
  comments?: any;
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

const FORM_ICONS = [
  "ClipboardList", "FileCheck2", "CalendarDays", "Calculator", "CheckSquare", 
  "FileText", "Building2", "Smartphone", "UserRound", "Users", "Mail", 
  "Bell", "Activity", "Star", "Heart", "Smile", "Sparkles", "Coffee", 
  "ShoppingBag", "Utensils", "DollarSign", "MapPin", "Folder", "Package"
];

export function AdminFormsManager({
  role,
  initialForms,
  locations,
  initialResponses,
  users = [],
  initialTab = "templates",
  currentUserName = "Direzione",
}: {
  role: string;
  initialForms: any[];
  locations: LocationOption[];
  initialResponses: any[];
  users?: Array<{ id: string; name: string; role: string; mansione: string | null }>;
  initialTab?: "templates" | "responses" | "upcoming";
  currentUserName?: string;
}) {
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";
  const [forms, setForms] = useState<FormTemplate[]>(initialForms);
  const candidaturaForm = useMemo(() => forms.find(f => f.name.toUpperCase().includes("CANDIDATURA") && f.active), [forms]);
  const [responses, setResponses] = useState<FormResponse[]>(initialResponses);
  const [activeTab, setActiveTab] = useState<"templates" | "responses" | "upcoming">(initialTab);
  const [responseSubTab, setResponseSubTab] = useState<"active" | "archived">("active");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(initialForms[0]?.id ?? null);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(initialResponses[0]?.id ?? null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  
  // Filter states for responses
  const [filterFormId, setFilterFormId] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Derived helper variables for dynamic group participants response viewer
  const responseParticipaField = selectedResponse?.form?.fields 
    ? (selectedResponse.form.fields as FormField[]).find(f => f.label.toUpperCase().includes("PARTICIPA")) 
    : null;
  const responseParticipaValue = responseParticipaField && selectedResponse?.answers 
    ? (selectedResponse.answers as any)[responseParticipaField.id] 
    : "";
  const isResponseGroupCourse = String(responseParticipaValue || "").toUpperCase().includes("GRUP");
  const isResponseCorsistiForm = selectedResponse?.form?.name?.toUpperCase().includes("CORSISTI");
  const responseGroupCount = (() => {
    let count = parseInt((selectedResponse?.answers as any)?.["group_participants_count"] || "0", 10);
    if (isResponseGroupCourse && count === 0 && selectedResponse?.answers) {
      let maxIdx = 0;
      for (let i = 1; i <= 10; i++) {
        if ((selectedResponse.answers as any)[`participant_${i}_name`]) {
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

  // Filter responses
  const filteredResponses = responses.filter((resp) => {
    const matchesTab = responseSubTab === "archived" 
      ? resp.status === "ARCHIVED" 
      : resp.status !== "ARCHIVED";
    const matchesForm = filterFormId === "all" || resp.form_id === filterFormId;
    const searchLower = filterSearch.toLowerCase().trim();
    const matchesUser = 
      !searchLower || 
      resp.user.name.toLowerCase().includes(searchLower) ||
      resp.user.email.toLowerCase().includes(searchLower);
    return matchesTab && matchesForm && matchesUser;
  });

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

    return events.sort((a, b) => a.dateValue.localeCompare(b.dateValue));
  }, [responses]);

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
      }
    } catch (err) {
      console.error("Failed to archive response:", err);
    }
  };

  const handleRestoreResponse = async (responseId: string) => {
    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NEW" }),
      });
      if (res.ok) {
        setResponses((prev) => 
          prev.map((r) => r.id === responseId ? { ...r, status: "NEW" } : r)
        );
        if (selectedResponse && selectedResponse.id === responseId) {
          setSelectedResponse({ ...selectedResponse, status: "NEW" });
        }
      }
    } catch (err) {
      console.error("Failed to restore response:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between w-full">
        <div className="flex flex-wrap sm:flex-nowrap gap-2 rounded-2xl bg-black/5 p-1.5 w-full sm:w-fit">
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
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "upcoming" 
                ? "bg-white text-black shadow-sm" 
                : "text-black/50 hover:text-black/80"
            }`}
          >
            <Calendar className="size-4" />
            Prossimi eventi ({upcomingEvents.length})
          </button>
        </div>

        <Link 
          href="/service-forms/to-verify"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-[#e8b1bf]/45 bg-[#FFF7F9] px-4 py-2.5 text-xs font-black text-[#A74758] shadow-sm hover:bg-white hover:border-black/10 transition duration-200"
        >
          <ClipboardList className="size-3.5 animate-pulse text-[#C66170]" />
          Moduli da verificare ➔
        </Link>
      </div>

      {activeTab === "templates" ? (
        <Card className="bg-white">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Templates</p>
              <h2 className="mt-1 text-2xl font-semibold">Elenco moduli operativi</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {candidaturaForm && (
                <Link
                  href={`/service-forms?fillId=${candidaturaForm.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] px-4 py-2.5 text-sm font-bold text-paradise-noir transition hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
                >
                  <Plus className="size-4 text-paradise-noir" />
                  Compila Nuova Candidatura
                </Link>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#A74758] px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="size-4" />
                  Crea nuovo modulo
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 hidden sm:grid">
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
                  <div className="flex items-center gap-2.5 mt-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-[#A74758]/10 text-[#A74758]">
                      <DynamicIcon name={form.icon || "ClipboardList"} className="size-4.5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-black">{form.name}</h3>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-black/40">
                      {form.fields?.length || 0} domande
                    </span>
                    {form.active && (
                      <Link
                        href={`/service-forms?fillId=${form.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#A74758]/10 px-2.5 py-1 text-xs font-bold text-[#A74758] hover:bg-[#A74758]/20 transition ml-2"
                        title="Compila Modulo"
                      >
                        <Play className="size-3" />
                        Compila
                      </Link>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Link
                        href={`/settings/forms/edit/${form.id}`}
                        className="grid size-8 place-items-center rounded-xl bg-white text-black/60 shadow-sm border border-black/5 hover:bg-black/5 transition"
                        title="Modifica"
                      >
                        <Edit className="size-3.5" />
                      </Link>
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

          {/* Templates List (Mobile Stacked Cards) */}
          <div className="space-y-4 sm:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl">
            {forms.map((form, idx) => {
              const colors = [
                { bg: "bg-[#A1B5FD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#FDCB82]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#8DE0BD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#F7A1C4]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
              ];
              const color = colors[idx % colors.length];
              const isExpanded = expandedTemplateId === form.id;

              return (
                <div
                  key={form.id}
                  onClick={() => setExpandedTemplateId(isExpanded ? null : form.id)}
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
                          {canManage && (
                            <Link
                              href={`/settings/forms/edit/${form.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "size-9 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0",
                                color.arrowBg,
                                color.arrowText
                              )}
                            >
                              <ArrowUpRight className="size-4.5" />
                            </Link>
                          )}
                        </div>

                        <p className="mt-3 text-xs font-semibold opacity-85 leading-relaxed">
                          {form.description || "Nessuna descrizione specificata."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5 opacity-90">
                          <span className={cn("rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase border border-current/15")}>
                            {form.active ? "Attivo" : "Disattivato"}
                          </span>
                          <span className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase border border-current/15">
                            {form.fields?.length || 0} domande
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 pt-3 border-t border-black/10 w-full">
                        {form.active && (
                          <Link
                            href={`/service-forms?fillId=${form.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-black text-sm font-bold active:scale-95 transition"
                          >
                            <Play className="size-4" />
                            Compila modulo
                          </Link>
                        )}
                        {canManage && (
                          <div className="grid grid-cols-2 gap-3 w-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteForm(form.id);
                              }}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-red-700 text-sm font-bold active:scale-95 transition border border-red-500/10"
                            >
                              <Trash2 className="size-4" />
                              Elimina
                            </button>
                            <Link
                              href={`/settings/forms/edit/${form.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition"
                            >
                              <Edit className="size-4" />
                              Modifica
                            </Link>
                          </div>
                        )}
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
        </Card>
      ) : activeTab === "responses" ? (
        <Card className="bg-white">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Risposte</p>
                <h2 className="mt-1 text-2xl font-semibold">Risposte ricevute dai dipendenti</h2>
              </div>
              
              {/* Sub-tabs for Active vs Archived */}
              <div className="flex gap-2 rounded-xl bg-black/5 p-1 w-fit mt-3">
                <button
                  onClick={() => setResponseSubTab("active")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    responseSubTab === "active" 
                      ? "bg-white text-black shadow-sm" 
                      : "text-black/50 hover:text-black/80"
                  }`}
                >
                  <Inbox className="size-3.5" />
                  Risposte Attive
                </button>
                <button
                  onClick={() => setResponseSubTab("archived")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    responseSubTab === "archived" 
                      ? "bg-white text-black shadow-sm" 
                      : "text-black/50 hover:text-black/80"
                  }`}
                >
                  <Archive className="size-3.5" />
                  Archiviate
                </button>
              </div>
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

          <div className="overflow-x-auto rounded-2xl border border-black/5 hidden sm:block">
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
                    <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setSelectedResponse(resp)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-black/5 transition"
                      >
                        <Eye className="size-3.5" />
                        Vedi risposte
                      </button>
                      {responseSubTab === "active" ? (
                        <button
                          onClick={() => handleArchiveResponse(resp.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-red-100 transition"
                        >
                          <Archive className="size-3.5" />
                          Archivia
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestoreResponse(resp.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-black/5 transition"
                        >
                          <Undo className="size-3.5" />
                          Ripristina
                        </button>
                      )}
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

          {/* Responses List (Mobile Stacked Cards) */}
          <div className="space-y-4 sm:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl">
            {filteredResponses.map((resp, idx) => {
              const colors = [
                { bg: "bg-[#A1B5FD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#FDCB82]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#8DE0BD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#F7A1C4]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
              ];
              const color = colors[idx % colors.length];
              const isExpanded = expandedResponseId === resp.id;

              return (
                <div
                  key={resp.id}
                  onClick={() => setExpandedResponseId(isExpanded ? null : resp.id)}
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
                              {resp.user_location_name || "Nessuna sede"}
                            </span>
                            <h3 className="text-base font-extrabold mt-0.5 leading-tight">
                              {resp.form?.name || "Modulo eliminato"}
                            </h3>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResponse(resp);
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

                        <div className="mt-4 space-y-2 text-xs font-semibold opacity-85">
                          <p suppressHydrationWarning>
                            <span className="opacity-60">Dipendente:</span> {resp.user.name}
                          </p>
                          <p>
                            <span className="opacity-60">Email:</span> {resp.user.email}
                          </p>
                          <p>
                            <span className="opacity-60">Inviato il:</span>{" "}
                            {new Date(resp.created_at).toLocaleString("it-IT", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 pt-3 border-t border-black/10">
                        {responseSubTab === "active" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveResponse(resp.id);
                            }}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-red-700 text-sm font-bold active:scale-95 transition border border-red-500/10"
                          >
                            <Archive className="size-4" />
                            Archivia
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreResponse(resp.id);
                            }}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/40 backdrop-blur-sm text-sm font-bold text-current border border-black/5 active:scale-95 transition"
                          >
                            <Undo className="size-4" />
                            Ripristina
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResponse(resp);
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition"
                        >
                          <Eye className="size-4" />
                          Vedi risposte
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col truncate pr-4">
                        <h3 className="text-sm font-extrabold truncate">{resp.form?.name || "Modulo eliminato"}</h3>
                        <p className="text-[10px] font-bold opacity-60 truncate">
                          {resp.user.name} • {new Date(resp.created_at).toLocaleDateString("it-IT")}
                        </p>
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

            {filteredResponses.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center text-white/45 border border-dashed border-white/10 rounded-[28px]">
                <AlertCircle className="size-8 text-white/20 mb-2" />
                <p className="font-bold text-sm">Nessuna risposta trovata</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="bg-white">
          <div className="mb-6 hidden sm:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Timeline</p>
            <h2 className="mt-1 text-2xl font-semibold">Prossimi eventi in agenda</h2>
            <p className="text-sm text-black/55 mt-1">Date e attività future pianificate estratte dai moduli dello staff.</p>
          </div>

          <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {upcomingEvents.map((evt, idx) => (
              <div 
                key={`${evt.responseId}-${idx}`}
                onClick={() => {
                  const resp = responses.find(r => r.id === evt.responseId);
                  if (resp) setSelectedResponse(resp);
                }}
                className="flex flex-col justify-between rounded-2xl border border-black/5 bg-[#FBF7F9] p-5 hover:border-[#E8C98B] hover:bg-black/[0.02] transition shadow-sm cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-[#A74758] bg-[#A74758]/5 px-2 py-0.5 rounded-lg shadow-sm border border-[#A74758]/10">
                      {evt.daysLeft === 0 ? "Oggi" : evt.daysLeft === 1 ? "Domani" : `Tra ${evt.daysLeft} giorni`}
                    </span>
                    <span className="text-xs text-black/45 font-semibold">{evt.dateLabel}</span>
                  </div>
                  <h4 className="font-bold text-base text-black mt-3 truncate group-hover:text-[#A74758] transition">{evt.formName}</h4>
                  <div className="text-xs text-black/60 mt-1.5 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <User className="size-3.5 text-black/40" /> {evt.userName}
                    </p>
                    {evt.locationName && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-black/40" /> {evt.locationName}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/5 space-y-1.5">
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

                      const renderedFields = fieldsToRender.slice(0, 3).map((field: any) => {
                        const ans = evt.answers[field.id];
                        if (ans === undefined || ans === null || ans === "") return null;
                        return (
                          <div key={field.id} className="text-xs">
                            <span className="font-semibold text-black/50">{field.label}: </span>
                            <span className="text-black">{typeof ans === "object" ? ans.name : String(ans)}</span>
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
                            <div key="group_participants" className="text-xs">
                              <span className="font-semibold text-black/50">Corsisti: </span>
                              <span className="text-[#A74758] font-semibold">{pNames.join(", ")}</span>
                            </div>
                          );
                        }
                      }

                      return renderedFields;
                    })()}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-black/5 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      const resp = responses.find(r => r.id === evt.responseId);
                      if (resp) setSelectedResponse(resp);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-black/60 hover:text-black hover:underline"
                  >
                    <Eye className="size-3.5" /> Dettagli
                  </button>
                  <button
                    onClick={() => handleArchiveResponse(evt.responseId)}
                    className="inline-flex items-center gap-1 rounded-xl bg-white border border-black/5 px-2.5 py-1.5 text-xs font-bold text-red-500 shadow-sm hover:bg-red-50 transition"
                  >
                    <Archive className="size-3.5" /> Archivia
                  </button>
                </div>
              </div>
            ))}

            {upcomingEvents.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-black/40">
                <Calendar className="size-10 text-black/30 mb-3" />
                <p className="font-semibold text-lg">Nessun evento futuro</p>
                <p className="text-sm mt-1">Non ci sono eventi attivi o date future inserite nei moduli compilati.</p>
              </div>
            )}
          </div>

          {/* Upcoming List (Mobile Stacked Cards) */}
          <div className="space-y-4 sm:hidden bg-[#0A0A0A] rounded-[32px] p-5 border border-white/5 shadow-2xl">
            {upcomingEvents.map((evt, idx) => {
              const colors = [
                { bg: "bg-[#A1B5FD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#FDCB82]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#8DE0BD]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
                { bg: "bg-[#F7A1C4]", text: "text-[#1E293B]", arrowBg: "bg-white", arrowText: "text-[#1E293B]" },
              ];
              const color = colors[idx % colors.length];
              const isExpanded = expandedEventId === evt.responseId;

              return (
                <div
                  key={`${evt.responseId}-${idx}`}
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.responseId)}
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
                              {evt.daysLeft === 0 ? "Oggi" : evt.daysLeft === 1 ? "Domani" : `Tra ${evt.daysLeft} giorni`}
                            </span>
                            <h3 className="text-base font-extrabold mt-0.5 leading-tight">
                              {evt.formName}
                            </h3>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const resp = responses.find(r => r.id === evt.responseId);
                              if (resp) setSelectedResponse(resp);
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

                        <div className="mt-4 space-y-2 text-xs font-semibold opacity-85">
                          <p>
                            <span className="opacity-60">Scadenza:</span> {evt.dateLabel}
                          </p>
                          <p>
                            <span className="opacity-60">Dipendente:</span> {evt.userName}
                          </p>
                          {evt.locationName && (
                            <p>
                              <span className="opacity-60">Sede:</span> {evt.locationName}
                            </p>
                          )}
                          <div className="mt-2 pt-2 border-t border-black/5 space-y-1">
                            {evt.fields.filter((f: any) => f.type !== "date").slice(0, 2).map((field: any) => {
                              const ans = evt.answers[field.id];
                              if (ans === undefined || ans === null || ans === "") return null;
                              return (
                                <div key={field.id} className="text-[11px]">
                                  <span className="opacity-60">{field.label}:</span>{" "}
                                  <span>{typeof ans === "object" ? ans.name : String(ans)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 pt-3 border-t border-black/10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveResponse(evt.responseId);
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-red-700 text-sm font-bold active:scale-95 transition border border-red-500/10"
                        >
                          <Archive className="size-4" />
                          Archivia
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const resp = responses.find(r => r.id === evt.responseId);
                            if (resp) setSelectedResponse(resp);
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition"
                        >
                          <Eye className="size-4" />
                          Dettagli
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col truncate pr-4">
                        <h3 className="text-sm font-extrabold truncate">{evt.formName}</h3>
                        <p className="text-[10px] font-bold opacity-60 truncate">
                          {evt.userName} • {evt.daysLeft === 0 ? "Oggi" : evt.daysLeft === 1 ? "Domani" : `Tra ${evt.daysLeft} gg`} ({evt.dateLabel})
                        </p>
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

            {upcomingEvents.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center text-white/45 border border-dashed border-white/10 rounded-[28px]">
                <Calendar className="size-8 text-white/20 mb-2" />
                <p className="font-bold text-sm">Nessun evento futuro</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Visual Canvas and editor elements removed - handled by dynamic full-page builder route */}
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
                    if (field.type === "pin") return null;
                    if (isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label)) {
                      return null;
                    }

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

                        {field.id === responseParticipaField?.id && isResponseGroupCourse && responseGroupCount > 0 && (
                          <div className="mt-4 p-4 rounded-2xl bg-[#FBF7F9] border border-black/5 space-y-4">
                            <span className="block text-xs font-bold text-black/40 uppercase tracking-wider">
                              Corsisti Partecipanti ({responseGroupCount})
                            </span>
                            
                            <div className="space-y-4">
                              {Array.from({ length: responseGroupCount }).map((_, idx) => {
                                const pIndex = idx + 1;
                                const pName = (selectedResponse.answers as any)[`participant_${pIndex}_name`] || "-";
                                const pEmail = (selectedResponse.answers as any)[`participant_${pIndex}_email`] || "";
                                const pPhone = (selectedResponse.answers as any)[`participant_${pIndex}_phone`] || "";
                                const pNotes = (selectedResponse.answers as any)[`participant_${pIndex}_notes`] || "";

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

                {selectedResponse.answers?._signature ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">Firma PIN verificata</span>
                    <p className="mt-1 text-sm font-bold text-emerald-950">{selectedResponse.answers._signature.user_name}</p>
                    <p className="text-xs text-emerald-700">
                      Firmato il {new Date(selectedResponse.answers._signature.signed_at).toLocaleString("it-IT")}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Response Comments */}
              <ResponseComments
                responseId={selectedResponse.id}
                initialComments={selectedResponse.comments}
                currentUserName={currentUserName}
                currentUserRole={role}
                onCommentsUpdate={(updatedComments) => {
                  setResponses((prev) =>
                    prev.map((r) =>
                      r.id === selectedResponse.id
                        ? { ...r, comments: updatedComments }
                        : r
                    )
                  );
                  setSelectedResponse((prev) => {
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

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm transition-all duration-300">
          <Card className="w-full max-w-2xl shadow-2xl border border-black/10 bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-200 hover:-translate-y-0">
            <div className="mb-6 flex justify-between items-start border-b border-black/5 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A74758]">Configurazione Iniziale</p>
                <h2 className="mt-1 text-2xl font-bold text-black">Seleziona Tipo di Modulo</h2>
              </div>
              <button 
                type="button"
                className="grid size-9 place-items-center rounded-xl border border-black/10 text-black hover:bg-black/5 transition-colors" 
                onClick={() => setShowTemplateModal(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-sm text-black/50 mb-5 leading-relaxed">
              Scegli una preimpostazione per velocizzare la creazione del tuo modulo. Ciascun modello configurerà automaticamente i campi e le categorie necessarie.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Option 1: Standard */}
              <Link
                href="/settings/forms/edit/new"
                onClick={() => setShowTemplateModal(false)}
                className="group relative flex flex-col justify-between rounded-[22px] border border-black/5 bg-[#FBF7F9] p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-[#A74758]/20"
              >
                <div>
                  <div className="size-10 rounded-2xl bg-black/5 flex items-center justify-center text-black mb-4 group-hover:scale-105 transition-transform">
                    <ClipboardList className="size-5" />
                  </div>
                  <h3 className="font-bold text-black text-sm">Modulo Standard</h3>
                  <p className="text-[11px] text-black/45 mt-1.5 leading-relaxed">
                    Crea un modulo vuoto da configurare da zero secondo le tue esigenze personali.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] font-bold text-[#A74758] group-hover:gap-1.5 transition-all">
                  Inizia <ChevronRight className="size-3.5" />
                </div>
              </Link>

              {/* Option 2: Ordine */}
              <Link
                href="/settings/forms/edit/new?template=order"
                onClick={() => setShowTemplateModal(false)}
                className="group relative flex flex-col justify-between rounded-[22px] border border-black/5 bg-[#FBF7F9] p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-[#A74758]/20"
              >
                <div>
                  <div className="size-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-4 group-hover:scale-105 transition-transform">
                    <ShoppingCart className="size-5" />
                  </div>
                  <h3 className="font-bold text-black text-sm">Modulo Ordine</h3>
                  <p className="text-[11px] text-black/45 mt-1.5 leading-relaxed">
                    Preconfigurato con campi cliente e importi. Abilita automaticamente il tracciamento nella dashboard Ordini.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] font-bold text-[#A74758] group-hover:gap-1.5 transition-all">
                  Inizia <ChevronRight className="size-3.5" />
                </div>
              </Link>

              {/* Option 3: Talent System */}
              <Link
                href="/settings/forms/edit/new?template=talent"
                onClick={() => setShowTemplateModal(false)}
                className="group relative flex flex-col justify-between rounded-[22px] border border-black/5 bg-[#FBF7F9] p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-[#A74758]/20"
              >
                <div>
                  <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-105 transition-transform">
                    <UserPlus className="size-5" />
                  </div>
                  <h3 className="font-bold text-black text-sm">Talent System</h3>
                  <p className="text-[11px] text-black/45 mt-1.5 leading-relaxed">
                    Preconfigurato con tutti i campi anagrafici e professionali richiesti per la registrazione nel recruitment.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] font-bold text-[#A74758] group-hover:gap-1.5 transition-all">
                  Inizia <ChevronRight className="size-3.5" />
                </div>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
