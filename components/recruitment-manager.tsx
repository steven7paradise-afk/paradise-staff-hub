"use client";

import { useState } from "react";
import { 
  Search, Plus, X, User, Phone, Mail, Calendar, Briefcase, 
  MapPin, Star, ClipboardList, CheckCircle, TrendingUp, Video, 
  Award, Trash2, UserCheck, SlidersHorizontal, Sparkles, Clock, 
  ArrowRight, Heart, Check, Building
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  birth_date: string | null | Date;
  profession: string;
  city: string | null;
  availability: string;
  preferred_location: string;
  experience: string;
  cv_url: string | null;
  instagram_url: string | null;
  initial_notes: string | null;
  status: string;
  
  // Step 2: Videochiamata
  video_done: boolean;
  video_date: string | null | Date;
  video_interviewer_id: string | null;
  video_impression: number | null;
  video_like: string | null;
  video_has_experience: string | null;
  video_prev_work: string | null;
  video_communication: string | null;
  video_motivation: string | null;
  video_notes: string | null;
  video_score: number | null;
  
  // Step 3: Colloquio in sede
  interview_done: boolean;
  interview_date: string | null | Date;
  interview_location: string | null;
  interview_interviewer_id: string | null;
  interview_presentation: string | null;
  interview_look_curato: boolean | null;
  interview_communication: number | null;
  interview_education: number | null;
  interview_confidence: number | null;
  interview_energy: number | null;
  interview_practical_test: boolean | null;
  interview_notes: string | null;
  interview_score: number | null;
  
  // Step 5: Giudizio & hiring status
  final_judgment: string | null;
  employee_created: boolean;
  created_user_id: string | null;
  created_at: string | Date;
};

type Location = { id: string; name: string };
type Manager = { id: string; name: string; role: string };

const COLUMNS = [
  "Nuova candidatura",
  "Da chiamare",
  "Videochiamata fissata",
  "Videochiamata completata",
  "Colloquio in sede",
  "In attesa",
  "Assunti",
  "Non ci interessa"
];

const PRESET_PROFESSIONS = [
  "Estetista",
  "Onicotecnica",
  "Receptionist",
  "Lashemaker",
  "Apprendista Estetista",
  "Massaggiatrice",
  "Store Manager",
  "Responsabile",
  "Altro"
];

export function RecruitmentManager({
  initialCandidates,
  locations,
  managers,
  userRole
}: {
  initialCandidates: any[];
  locations: Location[];
  managers: Manager[];
  userRole: string;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProfession, setFilterProfession] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "video" | "interview" | "hire">("info");
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New candidate form state
  const [newCandidate, setNewCandidate] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    birth_date: "",
    profession: "Estetista",
    city: "",
    availability: "Immediata",
    preferred_location: locations[0]?.name ?? "Tutte",
    experience: "1-3 anni",
    cv_url: "",
    instagram_url: "",
    initial_notes: ""
  });

  // Onboarding (Hiring) form state
  const [onboardingForm, setOnboardingForm] = useState({
    pin: "",
    role: "DIPENDENTE",
    sede_id: locations[0]?.id ?? "",
    whatsapp_phone: "",
    contract_start: new Date().toISOString().slice(0, 10),
    employee_status: "In prova",
    manager_id: "",
    hr_notes: "",
    access_list: [] as string[]
  });

  const [hiredResult, setHiredResult] = useState<{
    success: boolean;
    name: string;
    email: string;
    temporaryPassword?: string;
    pin?: string;
  } | null>(null);

  const isEditable = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "RESPONSABILE";
  const isAuthorizedToHire = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = fullName.includes(query) || 
      c.profession.toLowerCase().includes(query) || 
      c.email.toLowerCase().includes(query) ||
      (c.city && c.city.toLowerCase().includes(query));

    const matchesProfession = !filterProfession || c.profession === filterProfession;
    const matchesLocation = !filterLocation || c.preferred_location === filterLocation;

    return matchesSearch && matchesProfession && matchesLocation;
  });

  // Handle Drag / Move Candidate
  async function moveCandidate(id: string, newStatus: string) {
    if (!isEditable) return;
    try {
      const response = await fetch(`/api/recruitment/candidates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        const updated = await response.json();
        setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
        if (activeCandidate?.id === id) {
          setActiveCandidate((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error("Error moving candidate:", err);
    }
  }

  // Handle Add Candidate Submit
  async function handleAddCandidateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/recruitment/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCandidate)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore nella creazione del candidato.");
      }
      setCandidates((prev) => [data, ...prev]);
      setShowAddModal(false);
      setNewCandidate({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        birth_date: "",
        profession: "Estetista",
        city: "",
        availability: "Immediata",
        preferred_location: locations[0]?.name ?? "Tutte",
        experience: "1-3 anni",
        cv_url: "",
        instagram_url: "",
        initial_notes: ""
      });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Update Candidate Details
  async function handleUpdateCandidateDetails(updatedData: Partial<Candidate>) {
    if (!activeCandidate) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/recruitment/candidates/${activeCandidate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'aggiornamento.");
      }
      setCandidates((prev) => prev.map((c) => c.id === activeCandidate.id ? data : c));
      setActiveCandidate(data);
      setSuccessMsg("Valutazione salvata con successo!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Candidate
  async function handleDeleteCandidate(id: string) {
    if (!isAuthorizedToHire) return;
    if (!confirm("Sei sicuro di voler eliminare questa candidatura? L'azione è irreversibile.")) return;

    try {
      const response = await fetch(`/api/recruitment/candidates/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== id));
        setActiveCandidate(null);
      } else {
        const data = await response.json();
        alert(data.error || "Impossibile eliminare il candidato.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore durante l'eliminazione.");
    }
  }

  // Onboarding (Hiring) submission
  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCandidate) return;
    setErrorMsg("");
    setSubmitting(true);
    setHiredResult(null);

    try {
      const payload = {
        name: `${activeCandidate.first_name} ${activeCandidate.last_name}`,
        email: activeCandidate.email,
        role: onboardingForm.role,
        sede_id: onboardingForm.sede_id || null,
        pin: onboardingForm.pin,
        whatsapp_phone: onboardingForm.whatsapp_phone || null,
        contract_start: onboardingForm.contract_start ? new Date(onboardingForm.contract_start) : null,
        employee_status: onboardingForm.employee_status,
        manager_id: onboardingForm.manager_id || null,
        access_list: onboardingForm.access_list,
        hr_notes: onboardingForm.hr_notes || null
      };

      const response = await fetch(`/api/recruitment/candidates/${activeCandidate.id}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore durante il completamento dell'assunzione.");
      }

      setHiredResult({
        success: true,
        name: payload.name,
        email: payload.email,
        temporaryPassword: data.user.temporaryPassword,
        pin: onboardingForm.pin
      });

      // Update candidate in local state
      setCandidates((prev) => prev.map((c) => c.id === activeCandidate.id ? { 
        ...c, 
        status: "Assunti", 
        final_judgment: "Assunto", 
        employee_created: true, 
        created_user_id: data.user.id 
      } : c));

      setActiveCandidate((prev) => prev ? { 
        ...prev, 
        status: "Assunti", 
        final_judgment: "Assunto", 
        employee_created: true, 
        created_user_id: data.user.id 
      } : null);

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const toggleAccess = (access: string) => {
    setOnboardingForm(prev => {
      const current = prev.access_list;
      const updated = current.includes(access) 
        ? current.filter(a => a !== access) 
        : [...current, access];
      return { ...prev, access_list: updated };
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white/70 p-4 rounded-3xl border border-black/5 dark:bg-neutral-900/40 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="absolute left-4 top-3.5 size-4 text-black/40 dark:text-white/40" />
            <Field 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca candidato, professione..." 
              className="pl-11 min-h-11"
            />
          </div>
          <div className="min-w-[150px]">
            <Select 
              value={filterProfession} 
              onChange={(e) => setFilterProfession(e.target.value)}
              className="min-h-11"
            >
              <option value="">Tutte le mansioni</option>
              {PRESET_PROFESSIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Select 
              value={filterLocation} 
              onChange={(e) => setFilterLocation(e.target.value)}
              className="min-h-11"
            >
              <option value="">Tutte le sedi</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </Select>
          </div>
        </div>

        {isEditable && (
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury transition-all duration-300 rounded-2xl min-h-11"
          >
            <Plus className="size-4" /> Nuovo Candidato
          </Button>
        )}
      </div>

      {/* Kanban Board Container */}
      <div className="overflow-x-auto pb-4 luxury-scroll">
        <div className="flex gap-4 min-w-[1600px] h-[calc(100vh-270px)] min-h-[500px]">
          {COLUMNS.map((columnName) => {
            const columnCandidates = filteredCandidates.filter((c) => c.status === columnName);
            
            return (
              <div 
                key={columnName}
                className="flex flex-col w-[280px] bg-neutral-50/50 dark:bg-neutral-950/20 border border-black/5 dark:border-white/5 rounded-3xl p-3 h-full overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-paradise-pink" />
                    <span className="font-bold text-xs uppercase tracking-wider text-neutral-600 dark:text-neutral-300">{columnName}</span>
                  </div>
                  <span className="text-[11px] font-extrabold bg-paradise-softPink/60 text-[#B85B68] rounded-full px-2 py-0.5 min-w-5 text-center">
                    {columnCandidates.length}
                  </span>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 luxury-scroll">
                  {columnCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-black/5 dark:border-white/5 rounded-2xl text-center text-xs text-neutral-400">
                      Nessun candidato
                    </div>
                  ) : (
                    columnCandidates.map((candidate) => (
                      <div 
                        key={candidate.id}
                        onClick={() => {
                          setActiveCandidate(candidate);
                          setActiveTab("info");
                          setErrorMsg("");
                          setSuccessMsg("");
                          setHiredResult(null);
                          // Initialize onboarding with preset name, etc.
                          setOnboardingForm({
                            pin: "",
                            role: "DIPENDENTE",
                            sede_id: locations.find(l => l.name === candidate.preferred_location)?.id || locations[0]?.id || "",
                            whatsapp_phone: candidate.phone || "",
                            contract_start: new Date().toISOString().slice(0, 10),
                            employee_status: "In prova",
                            manager_id: "",
                            hr_notes: "",
                            access_list: []
                          });
                        }}
                        className="group relative bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98"
                      >
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-start gap-1">
                            <h3 className="font-bold text-sm text-paradise-noir dark:text-white line-clamp-1 group-hover:text-paradise-pink transition-colors">
                              {candidate.first_name} {candidate.last_name}
                            </h3>
                            {candidate.employee_created && (
                              <Badge tone="green">Assunto</Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded px-1.5 py-0.5">
                              {candidate.profession}
                            </span>
                            <span className="text-[10px] font-semibold bg-paradise-softPink/20 text-[#B85B68] rounded px-1.5 py-0.5">
                              {candidate.experience}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-neutral-500">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="size-3 text-neutral-400" />
                              <span className="line-clamp-1">{candidate.preferred_location}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone className="size-3 text-neutral-400" />
                              <span>{candidate.phone}</span>
                            </div>
                          </div>

                          {/* Assessment Scores mini review */}
                          {(candidate.video_score || candidate.interview_score) && (
                            <div className="pt-2 border-t border-black/5 dark:border-white/5 flex gap-2.5">
                              {candidate.video_score && (
                                <div className="flex items-center gap-0.5 text-[10px] font-medium text-neutral-500">
                                  <Video className="size-3 text-paradise-pink" />
                                  <span>{candidate.video_score}/10</span>
                                </div>
                              )}
                              {candidate.interview_score && (
                                <div className="flex items-center gap-0.5 text-[10px] font-medium text-neutral-500">
                                  <Award className="size-3 text-amber-500" />
                                  <span>{candidate.interview_score}/10</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Move Quick Dropdown or arrows */}
                        {isEditable && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <select
                              value={candidate.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                moveCandidate(candidate.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] border border-black/10 bg-white dark:bg-neutral-800 rounded px-1 outline-none py-0.5 cursor-pointer text-neutral-600 dark:text-neutral-300"
                            >
                              {COLUMNS.map((col) => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: ADD CANDIDATE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl p-0 border border-white/50 bg-white/95 dark:bg-neutral-900/95 shadow-luxury overflow-hidden rounded-[30px]">
            <div className="flex items-start justify-between border-b border-black/5 dark:border-white/5 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-paradise-pink">TALENT ACQUISITION</p>
                <h2 className="mt-1 text-xl font-bold text-paradise-noir dark:text-white">Nuova Candidatura</h2>
              </div>
              <button 
                className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white dark:bg-neutral-800 dark:border-white/10 shadow-sm transition hover:bg-paradise-nude active:scale-95" 
                onClick={() => setShowAddModal(false)}
              >
                <X className="size-5 text-black/70 dark:text-white/70" />
              </button>
            </div>

            <form onSubmit={handleAddCandidateSubmit} className="max-h-[70vh] overflow-y-auto p-6 space-y-4 luxury-scroll">
              {errorMsg && (
                <div className="p-3.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Nome *</span>
                  <Field 
                    required
                    value={newCandidate.first_name}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="E.g. Maria"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Cognome *</span>
                  <Field 
                    required
                    value={newCandidate.last_name}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="E.g. Rossi"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Telefono *</span>
                  <Field 
                    required
                    value={newCandidate.phone}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="E.g. +39 345..."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Email *</span>
                  <Field 
                    required
                    type="email"
                    value={newCandidate.email}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="E.g. maria.rossi@gmail.com"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Mansione *</span>
                  <Select 
                    value={newCandidate.profession}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, profession: e.target.value }))}
                  >
                    {PRESET_PROFESSIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Esperienza *</span>
                  <Select 
                    value={newCandidate.experience}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, experience: e.target.value }))}
                  >
                    <option value="Nessuna">Nessuna esperienza</option>
                    <option value="Meno di 1 anno">Meno di 1 anno</option>
                    <option value="1-3 anni">1-3 anni</option>
                    <option value="3-5 anni">3-5 anni</option>
                    <option value="Più di 5 anni">Più di 5 anni</option>
                  </Select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Sede Preferita *</span>
                  <Select 
                    value={newCandidate.preferred_location}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, preferred_location: e.target.value }))}
                  >
                    <option value="Tutte">Qualsiasi sede</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Disponibilità *</span>
                  <Select 
                    value={newCandidate.availability}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, availability: e.target.value }))}
                  >
                    <option value="Immediata">Immediata</option>
                    <option value="1 settimana">1 settimana</option>
                    <option value="2 settimane">2 settimane</option>
                    <option value="1 mese">1 mese</option>
                    <option value="Altro">Altro</option>
                  </Select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data di Nascita</span>
                  <Field 
                    type="date"
                    value={newCandidate.birth_date}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Città di Residenza</span>
                  <Field 
                    value={newCandidate.city}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="E.g. Milano"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">URL CV (Drive / Dropbox)</span>
                  <Field 
                    value={newCandidate.cv_url}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, cv_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Link Instagram</span>
                  <Field 
                    value={newCandidate.instagram_url}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, instagram_url: e.target.value }))}
                    placeholder="https://instagram.com/..."
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Iniziali / Copia Lettera</span>
                <textarea 
                  value={newCandidate.initial_notes}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, initial_notes: e.target.value }))}
                  placeholder="Scrivi qualcosa sulla candidatura..."
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                />
              </label>

              <div className="pt-4 flex justify-end gap-3 border-t border-black/5 dark:border-white/5">
                <Button type="button" variant="soft" onClick={() => setShowAddModal(false)}>
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-gradient-to-r from-paradise-pink to-[#ffa8dd] text-paradise-noir font-bold"
                >
                  {submitting ? "Creazione..." : "Crea Candidato"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: CANDIDATE DETAIL & EVALUATION TABS */}
      {activeCandidate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl p-0 border border-white/50 bg-white/95 dark:bg-neutral-900/95 shadow-luxury overflow-hidden rounded-[30px] flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-black/5 dark:border-white/5 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900 px-6 py-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Valutazione Candidato</span>
                  <h2 className="text-xl font-bold text-paradise-noir dark:text-white flex items-center gap-2">
                    {activeCandidate.first_name} {activeCandidate.last_name}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge tone={activeCandidate.status === "Assunti" ? "green" : activeCandidate.status === "Non ci interessa" ? "dark" : "pink"}>
                    {activeCandidate.status}
                  </Badge>
                  {activeCandidate.employee_created && (
                    <Badge tone="gold">Profilo Staff Collegato</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAuthorizedToHire && (
                  <button 
                    onClick={() => handleDeleteCandidate(activeCandidate.id)}
                    className="grid size-10 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition"
                    title="Elimina candidatura"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button 
                  className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white dark:bg-neutral-800 dark:border-white/10 shadow-sm transition hover:bg-paradise-nude active:scale-95" 
                  onClick={() => setActiveCandidate(null)}
                >
                  <X className="size-5 text-black/70 dark:text-white/70" />
                </button>
              </div>
            </div>

            {/* Tab selection links */}
            <div className="flex border-b border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-950/20 px-6 py-2 gap-2 shrink-0">
              <button 
                onClick={() => { setActiveTab("info"); setErrorMsg(""); setSuccessMsg(""); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === "info" 
                    ? "bg-white dark:bg-neutral-800 text-paradise-pink border border-black/5 dark:border-white/10 shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="size-3.5" />
                  <span>Info Base (Step 1)</span>
                </div>
              </button>
              <button 
                onClick={() => { setActiveTab("video"); setErrorMsg(""); setSuccessMsg(""); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === "video" 
                    ? "bg-white dark:bg-neutral-800 text-paradise-pink border border-black/5 dark:border-white/10 shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Video className="size-3.5" />
                  <span>Video Call (Step 2)</span>
                  {activeCandidate.video_done && <Check className="size-3.5 text-emerald-500" />}
                </div>
              </button>
              <button 
                onClick={() => { setActiveTab("interview"); setErrorMsg(""); setSuccessMsg(""); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === "interview" 
                    ? "bg-white dark:bg-neutral-800 text-paradise-pink border border-black/5 dark:border-white/10 shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Award className="size-3.5" />
                  <span>Colloquio Sede (Step 3)</span>
                  {activeCandidate.interview_done && <Check className="size-3.5 text-emerald-500" />}
                </div>
              </button>
              <button 
                onClick={() => { setActiveTab("hire"); setErrorMsg(""); setSuccessMsg(""); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === "hire" 
                    ? "bg-white dark:bg-neutral-800 text-paradise-pink border border-black/5 dark:border-white/10 shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck className="size-3.5" />
                  <span>Assunzione (Step 5)</span>
                </div>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 luxury-scroll">
              {errorMsg && (
                <div className="mb-4 p-3.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900">
                  {successMsg}
                </div>
              )}

              {/* TAB 1: INFO BASE */}
              {activeTab === "info" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Mansione</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{activeCandidate.profession}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Esperienza</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{activeCandidate.experience}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Disponibilità</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{activeCandidate.availability}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Sede Preferita</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{activeCandidate.preferred_location}</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Telefono</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1">
                        <Phone className="size-3 text-neutral-400" />
                        {activeCandidate.phone}
                      </span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Email</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1 break-all">
                        <Mail className="size-3 text-neutral-400" />
                        {activeCandidate.email}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Data di Nascita</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">
                        {activeCandidate.birth_date ? new Date(activeCandidate.birth_date).toLocaleDateString("it-IT") : "Non fornito"}
                      </span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Città di Residenza</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{activeCandidate.city || "Non fornito"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    {activeCandidate.cv_url && (
                      <a 
                        href={activeCandidate.cv_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-paradise-softPink/30 border border-paradise-pink/20 text-[#B85B68] rounded-2xl py-3 text-xs font-bold hover:bg-paradise-softPink/50 transition"
                      >
                        <ClipboardList className="size-4" /> Visualizza Curriculum Vitae (CV)
                      </a>
                    )}
                    {activeCandidate.instagram_url && (
                      <a 
                        href={activeCandidate.instagram_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-2xl py-3 text-xs font-bold transition"
                      >
                        <Sparkles className="size-4 text-pink-500" /> Profilo Instagram Candidato
                      </a>
                    )}
                  </div>

                  {activeCandidate.initial_notes && (
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-5 rounded-2xl border border-black/5 dark:border-white/5 space-y-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Note Iniziali</span>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{activeCandidate.initial_notes}</p>
                    </div>
                  )}

                  {isEditable && (
                    <div className="pt-4 border-t border-black/5 dark:border-white/5">
                      <label className="block space-y-1.5 max-w-sm">
                        <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Sposta Fase Candidatura</span>
                        <Select
                          value={activeCandidate.status}
                          onChange={(e) => moveCandidate(activeCandidate.id, e.target.value)}
                        >
                          {COLUMNS.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </Select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VIDEO CALL */}
              {activeTab === "video" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                    <div>
                      <h3 className="font-bold text-base text-paradise-noir dark:text-white">Step 2: Videochiamata conoscitiva</h3>
                      <p className="text-xs text-neutral-400">Valuta il primo contatto online con la candidata</p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/10">
                      <input 
                        type="checkbox" 
                        disabled={!isEditable}
                        checked={activeCandidate.video_done}
                        onChange={(e) => handleUpdateCandidateDetails({ video_done: e.target.checked })}
                        className="rounded text-paradise-pink focus:ring-paradise-pink"
                      />
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Call Completata</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data Video Call</span>
                      <Field 
                        type="datetime-local"
                        disabled={!isEditable}
                        defaultValue={activeCandidate.video_date ? new Date(new Date(activeCandidate.video_date).getTime() - new Date().getTimezoneOffset()*60*1000).toISOString().slice(0, 16) : ""}
                        onBlur={(e) => {
                          if (e.target.value) handleUpdateCandidateDetails({ video_date: new Date(e.target.value) });
                        }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Responsabile Call</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.video_interviewer_id || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ video_interviewer_id: e.target.value })}
                      >
                        <option value="">Seleziona...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Voto Call (1-10)</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.video_score || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ video_score: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Nessuno</option>
                        {[...Array(10)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Esperienza Effettiva</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.video_has_experience || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ video_has_experience: e.target.value })}
                      >
                        <option value="">Seleziona...</option>
                        <option value="Sì">Sì, autonoma</option>
                        <option value="Poca">Poca / Da formare</option>
                        <option value="No">No esperienza</option>
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Mi piace?</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.video_like || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ video_like: e.target.value })}
                      >
                        <option value="">Seleziona...</option>
                        <option value="Sì">Sì, molto</option>
                        <option value="No">No, scartare</option>
                        <option value="Da valutare">Da rivedere / Dubbio</option>
                      </Select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Lavori Precedenti</span>
                      <Field 
                        disabled={!isEditable}
                        value={activeCandidate.video_prev_work || ""}
                        onChange={(e) => setActiveCandidate(prev => prev ? { ...prev, video_prev_work: e.target.value } : null)}
                        onBlur={(e) => handleUpdateCandidateDetails({ video_prev_work: e.target.value })}
                        placeholder="Dove ha lavorato e per quanto tempo?"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Motivazione</span>
                      <Field 
                        disabled={!isEditable}
                        value={activeCandidate.video_motivation || ""}
                        onChange={(e) => setActiveCandidate(prev => prev ? { ...prev, video_motivation: e.target.value } : null)}
                        onBlur={(e) => handleUpdateCandidateDetails({ video_motivation: e.target.value })}
                        placeholder="Perché vuole lavorare a Paradise?"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Capacità Comunicativa</span>
                      <Field 
                        disabled={!isEditable}
                        value={activeCandidate.video_communication || ""}
                        onChange={(e) => setActiveCandidate(prev => prev ? { ...prev, video_communication: e.target.value } : null)}
                        onBlur={(e) => handleUpdateCandidateDetails({ video_communication: e.target.value })}
                        placeholder="Come parla, italiano, tono di voce, presenza..."
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Prima impressione (1-5)</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.video_impression || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ video_impression: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Seleziona...</option>
                        {[...Array(5)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} / 5</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Videochiamata</span>
                    <textarea 
                      disabled={!isEditable}
                      value={activeCandidate.video_notes || ""}
                      onChange={(e) => setActiveCandidate(prev => prev ? { ...prev, video_notes: e.target.value } : null)}
                      onBlur={(e) => handleUpdateCandidateDetails({ video_notes: e.target.value })}
                      placeholder="Scrivi le impressioni rilevate durante la video call..."
                      rows={3}
                      className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                    />
                  </label>

                  {isEditable && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="soft" 
                        onClick={() => moveCandidate(activeCandidate.id, "Non ci interessa")}
                        className="text-rose-600 border border-rose-100 hover:bg-rose-50"
                      >
                        Scarta Candidato
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => moveCandidate(activeCandidate.id, "Colloquio in sede")}
                        className="bg-neutral-800 text-white hover:bg-black"
                      >
                        Fissa Colloquio Sede <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: COLLOQUIO IN SEDE */}
              {activeTab === "interview" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                    <div>
                      <h3 className="font-bold text-base text-paradise-noir dark:text-white">Step 3: Colloquio dal vivo in sede</h3>
                      <p className="text-xs text-neutral-400">Valuta il colloquio in presenza e la prova pratica</p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/10">
                      <input 
                        type="checkbox" 
                        disabled={!isEditable}
                        checked={activeCandidate.interview_done}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_done: e.target.checked })}
                        className="rounded text-paradise-pink focus:ring-paradise-pink"
                      />
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Colloquio Completato</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data Colloquio</span>
                      <Field 
                        type="datetime-local"
                        disabled={!isEditable}
                        defaultValue={activeCandidate.interview_date ? new Date(new Date(activeCandidate.interview_date).getTime() - new Date().getTimezoneOffset()*60*1000).toISOString().slice(0, 16) : ""}
                        onBlur={(e) => {
                          if (e.target.value) handleUpdateCandidateDetails({ interview_date: new Date(e.target.value) });
                        }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Sede Colloquio</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_location || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_location: e.target.value })}
                      >
                        <option value="">Seleziona Sede...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>{loc.name}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Responsabile Presente</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_interviewer_id || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_interviewer_id: e.target.value })}
                      >
                        <option value="">Seleziona...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Voto Finale (1-10)</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_score || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_score: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Nessuno</option>
                        {[...Array(10)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Bella Presentazione</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_presentation || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_presentation: e.target.value })}
                      >
                        <option value="">Seleziona...</option>
                        <option value="Sì">Sì, ottima</option>
                        <option value="Da migliorare">Da migliorare</option>
                        <option value="No">No, inadatta</option>
                      </Select>
                    </label>

                    <div className="flex flex-col gap-2 pt-5">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          disabled={!isEditable}
                          checked={activeCandidate.interview_look_curato || false}
                          onChange={(e) => handleUpdateCandidateDetails({ interview_look_curato: e.target.checked })}
                          className="rounded text-paradise-pink focus:ring-paradise-pink"
                        />
                        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Look Curato & Professionale</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          disabled={!isEditable}
                          checked={activeCandidate.interview_practical_test || false}
                          onChange={(e) => handleUpdateCandidateDetails({ interview_practical_test: e.target.checked })}
                          className="rounded text-paradise-pink focus:ring-paradise-pink"
                        />
                        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Prova Pratica Superata</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-neutral-500 block">Comunicazione</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_communication || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_communication: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Seleziona...</option>
                        {[...Array(5)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} / 5</option>
                        ))}
                      </Select>
                    </label>
                    
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-neutral-500 block">Educazione</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_education || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_education: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Seleziona...</option>
                        {[...Array(5)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} / 5</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-neutral-500 block">Sicurezza</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_confidence || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_confidence: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Seleziona...</option>
                        {[...Array(5)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} / 5</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-neutral-500 block">Energia Paradise</span>
                      <Select 
                        disabled={!isEditable}
                        value={activeCandidate.interview_energy || ""}
                        onChange={(e) => handleUpdateCandidateDetails({ interview_energy: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Seleziona...</option>
                        {[...Array(5)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} / 5</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Colloquio & Feedback Prova Pratica</span>
                    <textarea 
                      disabled={!isEditable}
                      value={activeCandidate.interview_notes || ""}
                      onChange={(e) => setActiveCandidate(prev => prev ? { ...prev, interview_notes: e.target.value } : null)}
                      onBlur={(e) => handleUpdateCandidateDetails({ interview_notes: e.target.value })}
                      placeholder="Inserisci note dettagliate sul colloquio dal vivo..."
                      rows={3}
                      className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                    />
                  </label>

                  {isEditable && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="soft" 
                        onClick={() => moveCandidate(activeCandidate.id, "Non ci interessa")}
                        className="text-rose-600 border border-rose-100 hover:bg-rose-50"
                      >
                        Scarta Candidato
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => { setActiveTab("hire"); setErrorMsg(""); setSuccessMsg(""); }}
                        className="bg-gradient-to-r from-paradise-pink to-[#ffa8dd] text-paradise-noir font-bold"
                      >
                        Procedi ad Assunzione <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: GIUDIZIO E ASSUNZIONE */}
              {activeTab === "hire" && (
                <div className="space-y-6">
                  {hiredResult ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-3xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
                      <div className="size-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                        <CheckCircle className="size-8 text-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-neutral-800 dark:text-white">Assunzione Completata con Successo!</h4>
                        <p className="text-xs text-neutral-500">Il profilo dipendente è stato creato ed è ora attivo.</p>
                      </div>

                      <div className="max-w-md mx-auto bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 rounded-2xl p-4 text-left space-y-3 shadow-sm text-sm">
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase block">Nome Dipendente</span>
                          <span className="font-bold text-neutral-700 dark:text-neutral-200">{hiredResult.name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase block">Email di Accesso</span>
                          <span className="font-bold text-neutral-700 dark:text-neutral-200">{hiredResult.email}</span>
                        </div>
                        <div className="pt-2 border-t border-black/5 flex justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Password Provvisoria</span>
                            <code className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-xs select-all">
                              {hiredResult.temporaryPassword}
                            </code>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase block">PIN Personale</span>
                            <code className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-xs select-all">
                              {hiredResult.pin}
                            </code>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-rose-500 font-medium max-w-sm mx-auto">
                        * Copia queste credenziali e inviale manualmente al collaboratore. Non saranno più mostrate per motivi di sicurezza.
                      </p>

                      <Button onClick={() => setActiveCandidate(null)} className="bg-neutral-800 text-white">
                        Chiudi Scheda
                      </Button>
                    </div>
                  ) : activeCandidate.employee_created ? (
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-6 border border-black/5 dark:border-white/5 rounded-3xl text-center space-y-3">
                      <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                        <Check className="size-6" />
                      </div>
                      <h4 className="font-bold text-neutral-800 dark:text-white">Collaboratore Già Assunto</h4>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        Questa candidata è stata già assunta e trasformata in un collaboratore interno del salone.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Judgment Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-black/5 dark:border-white/5">
                        <label className="space-y-1">
                          <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Giudizio Finale</span>
                          <Select
                            disabled={!isEditable}
                            value={activeCandidate.final_judgment || ""}
                            onChange={(e) => handleUpdateCandidateDetails({ final_judgment: e.target.value })}
                          >
                            <option value="">Scegli Giudizio...</option>
                            <option value="Assunto">Assunto (Abilita Onboarding)</option>
                            <option value="In attesa">In attesa di decisione</option>
                            <option value="Da risentire">Da risentire più avanti</option>
                            <option value="Secondo colloquio">Fissare secondo colloquio</option>
                            <option value="Prova pratica">Fissare prova pratica</option>
                            <option value="Non ci interessa">Non idoneo / Scartare</option>
                          </Select>
                        </label>

                        <div className="flex items-end pb-1.5">
                          {activeCandidate.final_judgment === "Assunto" ? (
                            <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl px-3 py-2 flex items-center gap-1.5 font-bold">
                              <Sparkles className="size-4 shrink-0 text-emerald-500" />
                              Pronto per la creazione del profilo aziendale
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-400">
                              Imposta il giudizio finale su <strong>Assunto</strong> per sbloccare la scheda di inserimento del personale.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Hiring Form (Only visible if judgment is Assunto and user is ADMIN/SUPER_ADMIN) */}
                      {activeCandidate.final_judgment === "Assunto" && (
                        <div className="space-y-5 animate-in slide-in-from-top-4 duration-300">
                          <div className="bg-gradient-to-br from-paradise-softPink/10 to-[#F7E9EF]/30 border border-paradise-pink/20 rounded-3xl p-5 space-y-4">
                            <h4 className="font-bold text-sm text-[#B85B68] flex items-center gap-1.5 uppercase tracking-wide">
                              <UserCheck className="size-4" /> Creazione Profilo Dipendente
                            </h4>

                            {!isAuthorizedToHire ? (
                              <div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">
                                Solo un Amministratore o Super Admin può completare l'assunzione e creare credenziali.
                              </div>
                            ) : (
                              <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Nome e Cognome</span>
                                    <Field 
                                      required
                                      defaultValue={`${activeCandidate.first_name} ${activeCandidate.last_name}`}
                                      disabled
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Email Aziendale (Accesso)</span>
                                    <Field 
                                      required
                                      defaultValue={activeCandidate.email}
                                      disabled
                                    />
                                  </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-[#B85B68]">PIN Personalizzato (4-6 cifre) *</span>
                                    <Field 
                                      required
                                      value={onboardingForm.pin}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "") }))}
                                      placeholder="E.g. 1234"
                                      maxLength={6}
                                      minLength={4}
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Ruolo / Mansione *</span>
                                    <Select 
                                      value={onboardingForm.role}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, role: e.target.value }))}
                                    >
                                      <option value="DIPENDENTE">Dipendente</option>
                                      <option value="RESPONSABILE">Responsabile</option>
                                      <option value="ADMIN">Admin</option>
                                    </Select>
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Salone / Sede Assegnata *</span>
                                    <Select 
                                      value={onboardingForm.sede_id}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, sede_id: e.target.value }))}
                                    >
                                      {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                      ))}
                                    </Select>
                                  </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data Inizio Contratto</span>
                                    <Field 
                                      type="date"
                                      value={onboardingForm.contract_start}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, contract_start: e.target.value }))}
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Stato Dipendente</span>
                                    <Select 
                                      value={onboardingForm.employee_status}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, employee_status: e.target.value }))}
                                    >
                                      <option value="In prova">In prova</option>
                                      <option value="Attivo">Attivo</option>
                                      <option value="Sospeso">Sospeso</option>
                                    </Select>
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Responsabile Diretto (Manager)</span>
                                    <Select 
                                      value={onboardingForm.manager_id}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, manager_id: e.target.value }))}
                                    >
                                      <option value="">Nessuno</option>
                                      {managers.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                                      ))}
                                    </Select>
                                  </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Numero WhatsApp Dipendente</span>
                                    <Field 
                                      value={onboardingForm.whatsapp_phone}
                                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, whatsapp_phone: e.target.value }))}
                                      placeholder="E.g. +39 345..."
                                    />
                                  </label>
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500 block mb-1">Accessi Abilitati</span>
                                    <div className="flex flex-wrap gap-2">
                                      {["Shopify", "WhatsApp", "Google Calendar", "Phorest", "Treatwell", "Drive Condiviso"].map((access) => {
                                        const active = onboardingForm.access_list.includes(access);
                                        return (
                                          <button
                                            key={access}
                                            type="button"
                                            onClick={() => toggleAccess(access)}
                                            className={cn(
                                              "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95",
                                              active 
                                                ? "bg-paradise-pink/20 border-paradise-pink text-paradise-noir dark:text-white" 
                                                : "bg-white dark:bg-neutral-800 border-black/10 dark:border-white/10 text-neutral-500"
                                            )}
                                          >
                                            {access}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <label className="block space-y-1">
                                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Amministrazione HR (Interne)</span>
                                  <textarea 
                                    value={onboardingForm.hr_notes}
                                    onChange={(e) => setOnboardingForm(prev => ({ ...prev, hr_notes: e.target.value }))}
                                    placeholder="Dettagli contratto, note private dell'amministrazione..."
                                    rows={2}
                                    className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                                  />
                                </label>

                                <div className="pt-3 flex justify-end border-t border-black/5 dark:border-white/5">
                                  <Button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold"
                                  >
                                    {submitting ? "Generazione Profilo..." : "Completa Assunzione e Crea Utente"}
                                  </Button>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </Card>
        </div>
      )}
    </div>
  );
}
