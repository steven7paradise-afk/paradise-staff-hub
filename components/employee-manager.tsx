"use client";

import { useState } from "react";
import { Plus, Save, UserCog, X, MapPin, Mail, Phone, Calendar, User, Award, Fingerprint, Lock, Shield } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: Role;
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
  mansione?: string | null;
  googleCalendarId: string;
  googleCalendarSync: boolean;
};

type Location = { id: string; name: string };

const roles: { value: Role; label: string }[] = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "MAGAZZINO", label: "Magazzino" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function EmployeeManager({ initialEmployees, locations }: { initialEmployees: Employee[]; locations: Location[] }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [availableLocations] = useState(locations);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const draft = editing ?? {
    id: "",
    name: "",
    email: "",
    role: "DIPENDENTE" as Role,
    sedeId: availableLocations[0]?.id ?? null,
    location: availableLocations[0]?.name ?? "",
    active: true,
    hasPin: false,
    birthDate: "",
    fiscalCode: "",
    contractStart: "",
    contractEnd: "",
    photoUrl: "",
    whatsappPhone: "",
    mansione: "",
    googleCalendarId: "",
    googleCalendarSync: false,
  };
  const activeEmployees = employees.filter((employee) => employee.active);
  const inactiveEmployees = employees.filter((employee) => !employee.active);

  function openEdit(employee: Employee) {
    setCreating(false);
    setEditing(employee);
    setPin("");
    setPassword("");
    setMessage("");
  }

  function openCreate() {
    setCreating(true);
    setEditing({ ...draft, id: "" });
    setPin("");
    setPassword("");
    setMessage("");
  }

  function updateDraft<K extends keyof Employee>(key: K, value: Employee[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function saveEmployee() {
    if (!editing) return;
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setMessage("Il PIN deve avere da 4 a 6 numeri.");
      return;
    }
    setSaving(true);
    setMessage("");
    const endpoint = creating ? "/api/employees" : `/api/employees/${editing.id}`;
    const response = await fetch(endpoint, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, pin: pin || undefined, password: password || undefined }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? "Modifica non salvata.");
      return;
    }

    const location = availableLocations.find((item) => item.id === data.sede_id)?.name ?? "Nessun salone";
    const updated: Employee = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      sedeId: data.sede_id,
      location,
      active: data.active,
      hasPin: Boolean(data.pinConfigured),
      birthDate: data.birth_date ? String(data.birth_date).slice(0, 10) : "",
      fiscalCode: data.fiscal_code ?? "",
      contractStart: data.contract_start ? String(data.contract_start).slice(0, 10) : "",
      contractEnd: data.contract_end ? String(data.contract_end).slice(0, 10) : "",
      photoUrl: data.photo_url ?? "",
      whatsappPhone: data.whatsapp_phone ?? "",
      mansione: data.mansione ?? "",
      googleCalendarId: data.google_calendar_id ?? "",
      googleCalendarSync: data.google_calendar_sync ?? false,
    };
    setEmployees((current) =>
      creating ? [...current, updated].sort((a, b) => a.name.localeCompare(b.name)) : current.map((item) => (item.id === updated.id ? updated : item)),
    );
    const emailText = data.emailStatus?.skipped
      ? " Email non inviata: configura provider email o invia credenziali manualmente."
      : " Email con password provvisoria e PIN inviata al lavoratore.";
    setMessage(creating ? `Utente creato. PIN/password provvisori generati.${emailText}` : "Utente salvato. PIN personale attivo per il tablet.");
    setEditing(updated);
    setCreating(false);
    setPin("");
    setPassword("");
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Button 
          onClick={openCreate}
          className="rounded-[20px] bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury transition-all duration-300"
        >
          <Plus className="size-4" /> Nuovo Dipendente
        </Button>
      </div>

      <div className="space-y-6">
        <EmployeeSection title="Personale Attivo" employees={activeEmployees} openEdit={openEdit} />
        <EmployeeSection title="Personale Disattivato" employees={inactiveEmployees} openEdit={openEdit} empty="Nessun lavoratore disattivato." muted />
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in">
          <Card className="w-full max-w-2xl p-0 border border-white/50 bg-white/95 shadow-luxury overflow-hidden rounded-[30px]">
            <div className="flex items-start justify-between border-b border-black/5 bg-gradient-to-b from-white to-neutral-50/50 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B85B68]">{creating ? "Nuova Registrazione" : "Gestione Anagrafica"}</p>
                <h2 className="mt-1 text-xl font-bold text-paradise-noir">{editing.name || "Nuovo Dipendente"}</h2>
              </div>
              <button 
                className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:bg-paradise-nude active:scale-95" 
                onClick={() => setEditing(null)}
              >
                <X className="size-5 text-black/70" />
              </button>
            </div>

            <div className="grid max-h-[65vh] gap-5 overflow-y-auto p-6 sm:grid-cols-2">
              {/* Photo preview and URL input */}
              <div className="sm:col-span-2 rounded-2xl bg-gradient-to-br from-paradise-softPink/10 to-paradise-nude/30 border border-paradise-pink/20 p-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-white shadow-md">
                    {editing.photoUrl ? (
                      <img src={resolveDrivePhotoUrl(editing.photoUrl)} alt={editing.name} className="size-full object-cover" />
                    ) : (
                      <User className="size-8 text-black/30" />
                    )}
                  </div>
                  <label className="w-full space-y-1.5">
                    <span className="text-xs font-bold tracking-wide uppercase text-black/55">URL Foto Profilo</span>
                    <Field value={editing.photoUrl} onChange={(event) => updateDraft("photoUrl", event.target.value)} placeholder="https://esempio.com/foto.jpg" />
                  </label>
                </div>
              </div>

              {/* Personal data */}
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Nome e Cognome</span>
                <Field value={editing.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Nome completo" />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Email Aziendale</span>
                <Field type="email" value={editing.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="esempio@paradise.it" />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Cellulare WhatsApp</span>
                <Field inputMode="tel" value={editing.whatsappPhone} onChange={(event) => updateDraft("whatsappPhone", event.target.value)} placeholder="+39 333 123 4567" />
              </label>

              {/* Organization & Role */}
              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Salone Assegnato</span>
                <Select value={editing.sedeId ?? ""} onChange={(event) => updateDraft("sedeId", event.target.value || null)}>
                  <option value="">Nessun salone</option>
                  {availableLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Ruolo e Autorizzazioni</span>
                <Select value={editing.role} onChange={(event) => updateDraft("role", event.target.value as Role)}>
                  {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Mansione (es. Hairstyle, Videomaker)</span>
                <Field 
                  value={editing.mansione ?? ""} 
                  onChange={(event) => updateDraft("mansione", event.target.value)} 
                  placeholder="Seleziona o scrivi una mansione"
                  list="mansioni-list"
                />
                <datalist id="mansioni-list">
                  <option value="Hairstyle" />
                  <option value="Videomaker" />
                  <option value="Sito Web" />
                  <option value="Magazzino" />
                  <option value="Grafico" />
                </datalist>
              </label>

              {/* Private IDs */}
              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Data di Nascita</span>
                <Field type="date" value={editing.birthDate} onChange={(event) => updateDraft("birthDate", event.target.value)} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Codice</span>
                <Field value={editing.fiscalCode} onChange={(event) => updateDraft("fiscalCode", event.target.value.toUpperCase())} placeholder="Codice..." />
              </label>

              {/* Contract dates */}
              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Inizio Contratto</span>
                <Field type="date" value={editing.contractStart} onChange={(event) => updateDraft("contractStart", event.target.value)} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">Scadenza Contratto</span>
                <Field type="date" value={editing.contractEnd} onChange={(event) => updateDraft("contractEnd", event.target.value)} />
              </label>

              {/* Access security keys */}
              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">PIN Timbratura Tablet</span>
                <Field inputMode="numeric" maxLength={6} placeholder={creating ? "Automatico se vuoto (6 cifre)" : editing.hasPin ? "Modifica PIN (4-6 cifre)" : "Imposta PIN"} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold tracking-wide uppercase text-black/55">{creating ? "Password Provvisoria" : "Nuova Password (opzionale)"}</span>
                <Field type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={creating ? "Automatica se vuota" : "Minimo 8 caratteri"} />
              </label>

              {/* Google Calendar Sync settings */}
              <div className="sm:col-span-2 rounded-2xl bg-gradient-to-br from-indigo-50/20 to-blue-50/20 border border-blue-100 p-4 space-y-4">
                <label className="flex items-center gap-3 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-indigo-600"
                    checked={editing.googleCalendarSync}
                    onChange={(event) => updateDraft("googleCalendarSync", event.target.checked)}
                  />
                  <span className="text-sm font-bold text-paradise-noir">Sincronizzazione Google Calendar Attiva</span>
                </label>

                {editing.googleCalendarSync && (
                  <label className="block space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="text-xs font-bold tracking-wide uppercase text-black/55">ID Calendario Google</span>
                    <Field
                      value={editing.googleCalendarId}
                      onChange={(event) => updateDraft("googleCalendarId", event.target.value)}
                      placeholder="es: xxxxxxxxxxxxx@group.calendar.google.com"
                    />
                  </label>
                )}
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-black/5 bg-neutral-50/50 p-4 sm:col-span-2 select-none cursor-pointer hover:bg-neutral-50 transition-colors">
                <input type="checkbox" className="size-4 accent-[#B85B68]" checked={editing.active} onChange={(event) => updateDraft("active", event.target.checked)} />
                <span className="text-sm font-semibold text-paradise-noir">Account Utente Attivo e Abilitato</span>
              </label>
            </div>

            {message ? (
              <div className="mx-6 mb-3 rounded-2xl bg-paradise-nude/80 border border-paradise-pink/20 px-4 py-3 text-sm font-semibold text-[#B85B68] animate-in fade-in">
                {message}
              </div>
            ) : null}

            <div className="flex gap-3 border-t border-black/5 bg-neutral-50/50 p-6">
              <Button className="flex-1" onClick={saveEmployee} disabled={saving}>
                <Save className="size-4" /> {saving ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
              <Button variant="soft" onClick={() => setEditing(null)}>Chiudi</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function EmployeeSection({ title, employees, openEdit, empty, muted = false }: { title: string; employees: Employee[]; openEdit: (employee: Employee) => void; empty?: string; muted?: boolean }) {
  function getRoleBadgeTone(role: Role) {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return "dark";
    if (role === "RESPONSABILE") return "gold";
    return "pink";
  }

  return (
    <Card className="overflow-hidden border border-white/50 bg-white/90 p-0 shadow-soft">
      <div className="flex items-center justify-between border-b border-black/5 bg-gradient-to-b from-white to-neutral-50/50 px-6 py-4">
        <h2 className="text-base font-bold text-paradise-noir">{title}</h2>
        <Badge tone={muted ? "dark" : "green"}>{employees.length}</Badge>
      </div>

      <div className="grid grid-cols-1 divide-y divide-black/5">
        {employees.length === 0 ? (
          <p className="p-6 text-sm text-black/45 text-center italic">{empty ?? "Nessun collaboratore in elenco."}</p>
        ) : null}
        
        {employees.map((employee) => (
          <div 
            key={employee.id} 
            className={cn(
              "grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] md:items-center hover:bg-paradise-nude/25 transition-all duration-150",
              muted && "opacity-60 grayscale-[30%]"
            )}
          >
            {/* Employee Ident card */}
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-paradise-nude text-sm font-bold shadow-sm">
                {employee.photoUrl ? (
                  <img src={resolveDrivePhotoUrl(employee.photoUrl)} alt={employee.name} className="size-full object-cover" />
                ) : (
                  employee.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-sm text-paradise-noir truncate">{employee.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-black/45">
                  <Mail className="size-3 shrink-0" />
                  <span className="truncate">{employee.email}</span>
                </div>
              </div>
            </div>

            {/* Salon Sede info */}
            <div className="flex flex-col gap-1 text-xs font-semibold text-black/60">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-[#B85B68] shrink-0" />
                <span>{employee.location}</span>
              </div>
              {employee.mansione && (
                <p className="text-[11px] text-[#B85B68] font-bold mt-0.5 pl-5">{employee.mansione}</p>
              )}
            </div>

            {/* Role designation badge */}
            <div>
              <Badge tone={getRoleBadgeTone(employee.role)}>{employee.role}</Badge>
            </div>

            {/* Active dots status */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "size-2 rounded-full",
                employee.active ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"
              )} />
              <span className="text-xs font-medium text-black/55">
                {employee.active ? "Attivo" : "Disattivato"}
              </span>
            </div>

            {/* Configuration trigger */}
            <div>
              <button 
                onClick={() => openEdit(employee)}
                className="w-full md:w-auto flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 py-1.5 text-xs font-bold text-paradise-noir shadow-sm transition hover:bg-paradise-nude hover:border-black/10 active:scale-95"
              >
                <UserCog className="size-3.5 text-[#B85B68]" /> Gestisci
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
