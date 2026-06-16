"use client";

import { useState } from "react";
import { 
  Search, X, User, Phone, Mail, Calendar, Briefcase, 
  MapPin, ClipboardList, CheckCircle, Award, SlidersHorizontal, 
  Sparkles, Key, Shield, UserCog, ToggleLeft, ToggleRight, ListCheck,
  Plus
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  sedeId: string | null;
  location: string;
  active: boolean;
  hasPin: boolean;
  birthDate: string;
  fiscalCode: string;
  contractStart: string;
  contractEnd: string;
  photoUrl: string;
  whatsappPhone: string;
  mansione: string;
  employeeStatus: string;
  managerId: string | null;
  managerName: string;
  hrNotes: string;
  accessList: string[];
};

type Location = { id: string; name: string };
type Manager = { id: string; name: string; role: string };

const STATUS_OPTIONS = ["Attivo", "In prova", "Sospeso", "Ex dipendente"];
const ROLE_OPTIONS = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" }
];
const ACCESS_PRESETS = ["Shopify", "WhatsApp", "Google Calendar", "Phorest", "Treatwell", "Drive Condiviso"];

export function StaffDirectory({
  initialStaff,
  locations,
  managers,
  userRole
}: {
  initialStaff: Employee[];
  locations: Location[];
  managers: Manager[];
  userRole: string;
}) {
  const [staff, setStaff] = useState<Employee[]>(initialStaff);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterManager, setFilterManager] = useState("");
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Modals editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Employee | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  
  // Modals creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState<Partial<Employee> | null>(null);
  const [creationMessage, setCreationMessage] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAuthorizedToEdit = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Filters
  const filteredStaff = staff.filter((emp) => {
    const fullName = emp.name.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = fullName.includes(query) || 
      emp.email.toLowerCase().includes(query) || 
      emp.mansione.toLowerCase().includes(query);

    const matchesLocation = !filterLocation || emp.sedeId === filterLocation;
    const matchesStatus = !filterStatus || emp.employeeStatus === filterStatus;
    const matchesRole = !filterRole || emp.role === filterRole;
    const matchesManager = !filterManager || emp.managerId === filterManager;

    return matchesSearch && matchesLocation && matchesStatus && matchesRole && matchesManager;
  });

  // Handle Save Update
  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);

    if (pinInput && !/^\d{4,6}$/.test(pinInput)) {
      setErrorMsg("Il PIN deve essere composto da 4 a 6 numeri.");
      setSubmitting(false);
      return;
    }

    if (passwordInput && passwordInput.length < 8) {
      setErrorMsg("La password deve contenere almeno 8 caratteri.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/employees/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          sedeId: editForm.sedeId,
          birthDate: editForm.birthDate || undefined,
          fiscalCode: editForm.fiscalCode || undefined,
          contractStart: editForm.contractStart || undefined,
          contractEnd: editForm.contractEnd || undefined,
          photoUrl: editForm.photoUrl || undefined,
          whatsappPhone: editForm.whatsappPhone || undefined,
          mansione: editForm.mansione || undefined,
          active: editForm.active,
          employeeStatus: editForm.employeeStatus,
          managerId: editForm.managerId || null,
          accessList: editForm.accessList,
          hrNotes: editForm.hrNotes || undefined,
          pin: pinInput || undefined,
          password: passwordInput || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore durante il salvataggio.");
      }

      // Find location name
      const locName = locations.find((l) => l.id === data.sede_id)?.name ?? "Nessuna sede";
      const mgrName = managers.find((m) => m.id === data.manager_id)?.name ?? "";

      const updated: Employee = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        sedeId: data.sede_id,
        location: locName,
        active: data.active,
        hasPin: Boolean(data.pinConfigured),
        birthDate: data.birth_date ? String(data.birth_date).slice(0, 10) : "",
        fiscalCode: data.fiscal_code ?? "",
        contractStart: data.contract_start ? String(data.contract_start).slice(0, 10) : "",
        contractEnd: data.contract_end ? String(data.contract_end).slice(0, 10) : "",
        photoUrl: data.photo_url ?? "",
        whatsappPhone: data.whatsapp_phone ?? "",
        mansione: data.mansione ?? "",
        employeeStatus: data.employee_status,
        managerId: data.manager_id,
        managerName: mgrName,
        hrNotes: data.hr_notes ?? "",
        accessList: (data.access_list as string[]) ?? [],
      };

      setStaff((prev) => prev.map((emp) => emp.id === updated.id ? updated : emp));
      setSelectedEmployee(updated);
      setIsEditing(false);
      setPinInput("");
      setPasswordInput("");
      setSuccessMsg("Profilo dipendente aggiornato con successo!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const toggleAccessInEdit = (access: string) => {
    if (!editForm) return;
    setEditForm(prev => {
      if (!prev) return prev;
      const current = prev.accessList;
      const updated = current.includes(access)
        ? current.filter(a => a !== access)
        : [...current, access];
      return { ...prev, accessList: updated };
    });
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case "Attivo": return "green";
      case "In prova": return "gold";
      case "Sospeso": return "pink";
      default: return "dark";
    }
  };

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmployeeForm) return;
    setErrorMsg("");
    setCreationMessage("");
    setSubmitting(true);

    if (pinInput && !/^\d{4,6}$/.test(pinInput)) {
      setErrorMsg("Il PIN deve essere composto da 4 a 6 numeri.");
      setSubmitting(false);
      return;
    }

    if (passwordInput && passwordInput.length < 8) {
      setErrorMsg("La password deve contenere almeno 8 caratteri.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmployeeForm.name,
          email: newEmployeeForm.email,
          role: newEmployeeForm.role,
          sedeId: newEmployeeForm.sedeId || null,
          birthDate: newEmployeeForm.birthDate || undefined,
          fiscalCode: newEmployeeForm.fiscalCode || undefined,
          contractStart: newEmployeeForm.contractStart || undefined,
          contractEnd: newEmployeeForm.contractEnd || undefined,
          photoUrl: newEmployeeForm.photoUrl || undefined,
          whatsappPhone: newEmployeeForm.whatsappPhone || undefined,
          mansione: newEmployeeForm.mansione || undefined,
          active: newEmployeeForm.active !== false,
          employeeStatus: newEmployeeForm.employeeStatus || "Attivo",
          managerId: newEmployeeForm.managerId || null,
          accessList: newEmployeeForm.accessList || [],
          hrNotes: newEmployeeForm.hrNotes || undefined,
          pin: pinInput || undefined,
          password: passwordInput || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore durante la creazione del dipendente.");
      }

      const locName = locations.find((l) => l.id === data.sede_id)?.name ?? "Nessuna sede";
      const mgrName = managers.find((m) => m.id === data.manager_id)?.name ?? "";

      const created: Employee = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        sedeId: data.sede_id,
        location: locName,
        active: data.active,
        hasPin: Boolean(data.pinConfigured),
        birthDate: data.birth_date ? String(data.birth_date).slice(0, 10) : "",
        fiscalCode: data.fiscal_code ?? "",
        contractStart: data.contract_start ? String(data.contract_start).slice(0, 10) : "",
        contractEnd: data.contract_end ? String(data.contract_end).slice(0, 10) : "",
        photoUrl: data.photo_url ?? "",
        whatsappPhone: data.whatsapp_phone ?? "",
        mansione: data.mansione ?? "",
        employeeStatus: data.employee_status || "Attivo",
        managerId: data.manager_id,
        managerName: mgrName,
        hrNotes: data.hr_notes ?? "",
        accessList: (data.access_list as string[]) ?? [],
      };

      setStaff((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      
      const emailText = data.emailStatus?.skipped
        ? " Email NON inviata: configura provider email o invia credenziali manualmente."
        : " Email con credenziali inviata al dipendente.";
        
      setCreationMessage(`Dipendente creato con successo! PIN: ${pinInput || "generato automaticamente"} e password provvisoria generata. ${emailText}`);
      setNewEmployeeForm(null);
      setPinInput("");
      setPasswordInput("");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const toggleAccessInCreate = (access: string) => {
    if (!newEmployeeForm) return;
    setNewEmployeeForm(prev => {
      if (!prev) return prev;
      const current = prev.accessList || [];
      const updated = current.includes(access)
        ? current.filter(a => a !== access)
        : [...current, access];
      return { ...prev, accessList: updated };
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white/70 p-5 rounded-3xl border border-black/5 dark:bg-neutral-900/40 dark:border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-3.5 size-4 text-black/40 dark:text-white/40" />
            <Field 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca dipendente per nome, email, mansione..." 
              className="pl-11 min-h-11"
            />
          </div>
          {isAuthorizedToEdit && (
            <Button 
              onClick={() => {
                setShowCreateModal(true);
                setNewEmployeeForm({
                  name: "",
                  email: "",
                  role: "DIPENDENTE",
                  sedeId: locations[0]?.id ?? "",
                  birthDate: "",
                  fiscalCode: "",
                  contractStart: new Date().toISOString().slice(0, 10),
                  contractEnd: "",
                  photoUrl: "",
                  whatsappPhone: "",
                  mansione: "",
                  employeeStatus: "Attivo",
                  managerId: "",
                  hrNotes: "",
                  accessList: []
                });
                setCreationMessage("");
                setErrorMsg("");
                setPinInput("");
                setPasswordInput("");
              }}
              className="bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury transition-all duration-300 rounded-2xl min-h-11 shrink-0"
            >
              <Plus className="size-4" /> Nuovo Dipendente
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)}
            className="min-h-10 text-xs"
          >
            <option value="">Tutti i saloni</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </Select>

          <Select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="min-h-10 text-xs"
          >
            <option value="">Tutti i livelli di ruolo</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </Select>

          <Select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="min-h-10 text-xs"
          >
            <option value="">Tutti gli stati</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>

          <Select 
            value={filterManager} 
            onChange={(e) => setFilterManager(e.target.value)}
            className="min-h-10 text-xs"
          >
            <option value="">Tutti i responsabili</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900">
          {successMsg}
        </div>
      )}

      {/* Grid of employee cards */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-16 bg-white/40 border border-black/5 dark:bg-neutral-900/10 dark:border-white/5 rounded-3xl">
          <p className="text-neutral-500 font-medium">Nessun dipendente trovato con i filtri selezionati.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((emp) => (
            <Card 
              key={emp.id}
              onClick={() => {
                setSelectedEmployee(emp);
                setIsEditing(false);
                setEditForm(null);
                setPinInput("");
                setPasswordInput("");
                setErrorMsg("");
              }}
              className="group p-5 cursor-pointer flex flex-col justify-between border-black/5 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-luxury hover:-translate-y-1 transition-all duration-300"
            >
              <div className="space-y-4">
                {/* Photo & Basic header */}
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-2xl overflow-hidden border border-black/5 bg-paradise-softPink/20 shrink-0 shadow-sm flex items-center justify-center font-bold text-lg text-paradise-noir">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt={emp.name} className="size-full object-cover" />
                    ) : (
                      emp.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-paradise-noir dark:text-white group-hover:text-paradise-pink transition-colors">
                      {emp.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-neutral-500">{emp.mansione || "Collaboratore"}</span>
                      <span className="text-[10px] text-neutral-300">•</span>
                      <Badge tone={getStatusTone(emp.employeeStatus)}>{emp.employeeStatus}</Badge>
                    </div>
                  </div>
                </div>

                {/* Info List */}
                <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-neutral-400" />
                    <span>Salone: <strong className="text-neutral-700 dark:text-neutral-200">{emp.location}</strong></span>
                  </div>
                  {emp.whatsappPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-neutral-400" />
                      <span>{emp.whatsappPhone}</span>
                    </div>
                  )}
                  {emp.managerName && (
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-neutral-400" />
                      <span>Responsabile: <strong className="text-neutral-700 dark:text-neutral-200">{emp.managerName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Access list badges */}
                {emp.accessList.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Accessi attivi</span>
                    <div className="flex flex-wrap gap-1">
                      {emp.accessList.map((access) => (
                        <span 
                          key={access} 
                          className="text-[9px] font-bold bg-[#F7E9EF] text-[#B85B68] dark:bg-neutral-800 dark:text-[#FFA8DD] px-1.5 py-0.5 rounded"
                        >
                          {access}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-auto flex items-center justify-between text-xs font-bold text-paradise-pink group-hover:text-[#E96BA8] transition-colors">
                <span>Vedi scheda completa</span>
                <span className="size-6 rounded-full bg-paradise-softPink/20 flex items-center justify-center font-bold text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* DETAIL & EDIT MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl p-0 border border-white/50 bg-white/95 dark:bg-neutral-900/95 shadow-luxury overflow-hidden rounded-[30px] flex flex-col max-h-[90vh]">
            
            {/* Cover Banner (Luxury Gradient) */}
            <div className="h-28 bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] relative shrink-0">
              <button 
                className="absolute top-4 right-4 grid size-10 place-items-center rounded-xl bg-white/80 dark:bg-neutral-900/80 shadow-md transition hover:bg-white active:scale-95 z-10" 
                onClick={() => setSelectedEmployee(null)}
              >
                <X className="size-5 text-black/70 dark:text-white/70" />
              </button>
            </div>

            {/* Profile Avatar overlaying cover */}
            <div className="px-6 relative shrink-0">
              <div className="absolute -top-12 left-6 size-24 rounded-3xl overflow-hidden border-4 border-white bg-paradise-softPink/30 shadow-md flex items-center justify-center font-bold text-3xl text-paradise-noir">
                {selectedEmployee.photoUrl ? (
                  <img src={selectedEmployee.photoUrl} alt={selectedEmployee.name} className="size-full object-cover" />
                ) : (
                  selectedEmployee.name.slice(0, 2).toUpperCase()
                )}
              </div>
              
              <div className="pl-28 pt-3 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-paradise-noir dark:text-white">{selectedEmployee.name}</h3>
                  <p className="text-xs text-neutral-400 font-semibold">{selectedEmployee.mansione || "Collaboratore"}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone={getStatusTone(selectedEmployee.employeeStatus)}>{selectedEmployee.employeeStatus}</Badge>
                  {isAuthorizedToEdit && !isEditing && (
                    <Button 
                      variant="soft" 
                      onClick={() => {
                        setIsEditing(true);
                        setEditForm({ ...selectedEmployee });
                        setPinInput("");
                        setPasswordInput("");
                        setErrorMsg("");
                      }}
                      className="min-h-8 rounded-xl text-xs py-1 px-3 border border-black/10 hover:bg-paradise-nude"
                    >
                      <UserCog className="size-3.5" /> Modifica
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 border-t border-black/5 dark:border-white/5 space-y-6 luxury-scroll">
              {errorMsg && (
                <div className="p-3.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900">
                  {errorMsg}
                </div>
              )}

              {isEditing && editForm ? (
                /* EDIT FORM FOR ADMIN */
                <form onSubmit={handleSaveEmployee} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Nome e Cognome</span>
                      <Field 
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Email di Accesso</span>
                      <Field 
                        required
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, email: e.target.value } : null)}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">URL Foto Profilo</span>
                      <Field 
                        value={editForm.photoUrl}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, photoUrl: e.target.value } : null)}
                        placeholder="https://..."
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Numero WhatsApp</span>
                      <Field 
                        value={editForm.whatsappPhone}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, whatsappPhone: e.target.value } : null)}
                        placeholder="+39..."
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Mansione / Ruolo</span>
                      <Field 
                        value={editForm.mansione}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, mansione: e.target.value } : null)}
                        placeholder="E.g. Onicotecnica"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Stato Dipendente</span>
                      <Select 
                        value={editForm.employeeStatus}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, employeeStatus: e.target.value } : null)}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Livello Sistema</span>
                      <Select 
                        value={editForm.role}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, role: e.target.value } : null)}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Salone Sede</span>
                      <Select 
                        value={editForm.sedeId || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, sedeId: e.target.value || null } : null)}
                      >
                        <option value="">Nessuna sede</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Responsabile Diretto</span>
                      <Select 
                        value={editForm.managerId || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, managerId: e.target.value || null } : null)}
                      >
                        <option value="">Nessuno</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Stato Account</span>
                      <Select 
                        value={editForm.active ? "true" : "false"}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, active: e.target.value === "true" } : null)}
                      >
                        <option value="true">Attivo / Abilitato</option>
                        <option value="false">Disattivato / Bloccato</option>
                      </Select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Codice</span>
                      <Field 
                        value={editForm.fiscalCode || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, fiscalCode: e.target.value } : null)}
                        placeholder="Codice..."
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data di Nascita</span>
                      <Field 
                        type="date"
                        value={editForm.birthDate}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, birthDate: e.target.value } : null)}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data Inizio Contratto</span>
                      <Field 
                        type="date"
                        value={editForm.contractStart}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, contractStart: e.target.value } : null)}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data Fine Contratto</span>
                      <Field 
                        type="date"
                        value={editForm.contractEnd}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, contractEnd: e.target.value } : null)}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-black/5 pt-3">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-rose-500">Cambia PIN (4-6 cifre)</span>
                      <Field 
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="Lascia vuoto per non modificare"
                        maxLength={6}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase text-rose-500">Cambia Password</span>
                      <Field 
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Lascia vuoto per non modificare"
                      />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500 block mb-1">Accessi Abilitati</span>
                    <div className="flex flex-wrap gap-2">
                      {ACCESS_PRESETS.map((access) => {
                        const active = editForm.accessList.includes(access);
                        return (
                          <button
                            key={access}
                            type="button"
                            onClick={() => toggleAccessInEdit(access)}
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

                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Amministrazione HR (Interne)</span>
                    <textarea 
                      value={editForm.hrNotes}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, hrNotes: e.target.value } : null)}
                      placeholder="Note interne dell'amministrazione..."
                      rows={3}
                      className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                    />
                  </label>

                  <div className="pt-3 flex justify-end gap-3 border-t border-black/5 dark:border-white/5">
                    <Button type="button" variant="soft" onClick={() => setIsEditing(false)}>
                      Annulla
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className="bg-gradient-to-r from-paradise-pink to-[#ffa8dd] text-paradise-noir font-bold"
                    >
                      {submitting ? "Salvataggio..." : "Salva Modifiche"}
                    </Button>
                  </div>
                </form>
              ) : (
                /* READ-ONLY INFO VIEW (ADMIN/RESPONSABILE) */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Email Aziendale</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 break-all">
                        <Mail className="size-3.5 text-neutral-400" />
                        {selectedEmployee.email}
                      </span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Numero WhatsApp</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <Phone className="size-3.5 text-neutral-400" />
                        {selectedEmployee.whatsappPhone || "Non fornito"}
                      </span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Sede Assegnata</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-neutral-400" />
                        {selectedEmployee.location}
                      </span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Responsabile Diretto</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <User className="size-3.5 text-neutral-400" />
                        {selectedEmployee.managerName || "Nessun manager"}
                      </span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Inizio Rapporto</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-neutral-400" />
                        {selectedEmployee.contractStart ? new Date(selectedEmployee.contractStart).toLocaleDateString("it-IT") : "Non impostata"}
                      </span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Fine Contratto</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-neutral-400" />
                        {selectedEmployee.contractEnd ? new Date(selectedEmployee.contractEnd).toLocaleDateString("it-IT") : "Indeterminato"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Codice</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{selectedEmployee.fiscalCode || "Non inserito"}</span>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Data di Nascita</span>
                      <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">
                        {selectedEmployee.birthDate ? new Date(selectedEmployee.birthDate).toLocaleDateString("it-IT") : "Non inserita"}
                      </span>
                    </div>
                  </div>

                  {/* Access details */}
                  <div className="bg-neutral-50 dark:bg-neutral-950/40 p-5 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Configurazioni & Accessi Applicazioni</span>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={selectedEmployee.hasPin ? "green" : "pink"}>
                        {selectedEmployee.hasPin ? "PIN Tablet Attivo" : "PIN Tablet Non configurato"}
                      </Badge>
                      <Badge tone={selectedEmployee.active ? "green" : "pink"}>
                        {selectedEmployee.active ? "Account Attivo" : "Account Disattivato"}
                      </Badge>
                    </div>

                    {selectedEmployee.accessList.length > 0 ? (
                      <div className="space-y-1 pt-2">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Servizi/Piattaforme autorizzate</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEmployee.accessList.map((access) => (
                            <span 
                              key={access} 
                              className="text-xs font-semibold bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-300 px-2.5 py-1 rounded-xl"
                            >
                              {access}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">Nessuna piattaforma esterna abilitata.</p>
                    )}
                  </div>

                  {/* HR Private Notes */}
                  <div className="bg-neutral-50 dark:bg-neutral-950/40 p-5 rounded-2xl border border-black/5 dark:border-white/5 space-y-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Note Interne HR & Note Amministrative</span>
                    {selectedEmployee.hrNotes ? (
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{selectedEmployee.hrNotes}</p>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">Nessuna nota presente.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          </Card>
        </div>
      )}

      {/* SUCCESS CREATION BANNER */}
      {creationMessage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-neutral-900 shadow-luxury text-center space-y-4 rounded-[30px]">
            <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-800 dark:text-white">Dipendente Creato!</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{creationMessage}</p>
            <Button onClick={() => setCreationMessage("")} className="bg-neutral-800 text-white w-full">
              Chiudi
            </Button>
          </Card>
        </div>
      )}

      {/* MODAL: CREATE MANUALLY NEW EMPLOYEE */}
      {showCreateModal && newEmployeeForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl p-0 border border-white/50 bg-white/95 dark:bg-neutral-900/95 shadow-luxury overflow-hidden rounded-[30px] flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between border-b border-black/5 dark:border-white/5 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900 px-6 py-5 shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-paradise-pink">HR ADMINISTRATION</p>
                <h2 className="mt-1 text-xl font-bold text-paradise-noir dark:text-white">Nuovo Dipendente Manuale</h2>
              </div>
              <button 
                className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white dark:bg-neutral-800 dark:border-white/10 shadow-sm transition hover:bg-paradise-nude active:scale-95" 
                onClick={() => setShowCreateModal(false)}
              >
                <X className="size-5 text-black/70 dark:text-white/70" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="flex-1 overflow-y-auto p-6 space-y-4 luxury-scroll">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Nome e Cognome *</span>
                  <Field 
                    required
                    value={newEmployeeForm.name || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="E.g. Angela Bianchi"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Email Aziendale *</span>
                  <Field 
                    required
                    type="email"
                    value={newEmployeeForm.email || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="E.g. angela@paradisebeauty.it"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">URL Foto Profilo</span>
                  <Field 
                    value={newEmployeeForm.photoUrl || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, photoUrl: e.target.value } : null)}
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Numero WhatsApp</span>
                  <Field 
                    value={newEmployeeForm.whatsappPhone || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, whatsappPhone: e.target.value } : null)}
                    placeholder="E.g. +39..."
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Mansione *</span>
                  <Field 
                    required
                    value={newEmployeeForm.mansione || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, mansione: e.target.value } : null)}
                    placeholder="E.g. Estetista"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Stato Dipendente *</span>
                  <Select 
                    value={newEmployeeForm.employeeStatus || "Attivo"}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, employeeStatus: e.target.value } : null)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Ruolo Sistema *</span>
                  <Select 
                    value={newEmployeeForm.role || "DIPENDENTE"}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, role: e.target.value } : null)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Salone Sede *</span>
                  <Select 
                    value={newEmployeeForm.sedeId || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, sedeId: e.target.value } : null)}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Responsabile Diretto</span>
                  <Select 
                    value={newEmployeeForm.managerId || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, managerId: e.target.value } : null)}
                  >
                    <option value="">Nessuno</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Data di Nascita</span>
                  <Field 
                    type="date"
                    value={newEmployeeForm.birthDate || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, birthDate: e.target.value } : null)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Codice</span>
                  <Field 
                    value={newEmployeeForm.fiscalCode || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, fiscalCode: e.target.value } : null)}
                    placeholder="Codice..."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Inizio Rapporto *</span>
                  <Field 
                    required
                    type="date"
                    value={newEmployeeForm.contractStart || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, contractStart: e.target.value } : null)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Fine Contratto</span>
                  <Field 
                    type="date"
                    value={newEmployeeForm.contractEnd || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, contractEnd: e.target.value } : null)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-black/5 dark:border-white/5 pt-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-[#B85B68]">PIN Personalizzato (4-6 cifre)</span>
                  <Field 
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="Lascia vuoto per generare casuale"
                    maxLength={6}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-[#B85B68]">Password Provvisoria</span>
                  <Field 
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Lascia vuoto per generare casuale"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500 block mb-1">Accessi Abilitati</span>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_PRESETS.map((access) => {
                    const active = newEmployeeForm.accessList?.includes(access) || false;
                    return (
                      <button
                        key={access}
                        type="button"
                        onClick={() => toggleAccessInCreate(access)}
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

              <label className="block space-y-1">
                <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Note Amministrazione HR (Interne)</span>
                <textarea 
                  value={newEmployeeForm.hrNotes || ""}
                  onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, hrNotes: e.target.value } : null)}
                  placeholder="Dettagli del contratto..."
                  rows={2}
                  className="w-full rounded-2xl border border-black/10 bg-white/80 dark:bg-white/10 dark:text-white p-3 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20"
                />
              </label>

              <div className="pt-3 flex justify-end gap-3 border-t border-black/5 dark:border-white/5">
                <Button type="button" variant="soft" onClick={() => setShowCreateModal(false)}>
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-gradient-to-r from-paradise-pink to-[#ffa8dd] text-paradise-noir font-bold"
                >
                  {submitting ? "Creazione..." : "Crea Dipendente"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
