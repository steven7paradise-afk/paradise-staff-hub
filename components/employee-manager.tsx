"use client";

import { useState } from "react";
import { Plus, Save, UserCog, X } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";

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
};

type Location = { id: string; name: string };

const roles: { value: Role; label: string }[] = [
  { value: "DIPENDENTE", label: "Dipendente" },
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
      <div className="mb-5 flex flex-wrap gap-3">
        <Button onClick={openCreate}><Plus className="size-4" /> Nuovo dipendente</Button>
      </div>
      <EmployeeSection title="Personale attivo" employees={activeEmployees} openEdit={openEdit} />
      <div className="mt-6">
        <EmployeeSection title="Personale disattivato" employees={inactiveEmployees} openEdit={openEdit} empty="Nessun lavoratore disattivato." muted />
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">{creating ? "Nuovo utente" : "Modifica utente"}</p>
                <h2 className="mt-2 text-2xl font-semibold">{editing.name || "Nuovo dipendente"}</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-xl border border-black/10" onClick={() => setEditing(null)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-center gap-4 rounded-2xl bg-paradise-nude/70 p-4">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-xl font-semibold shadow-sm">
                    {editing.photoUrl ? <img src={editing.photoUrl} alt={editing.name} className="size-full object-cover" /> : editing.name.slice(0, 1).toUpperCase() || "P"}
                  </div>
                  <label className="flex-1 space-y-2">
                    <span className="text-sm font-semibold">Foto lavoratore (URL)</span>
                    <Field value={editing.photoUrl} onChange={(event) => updateDraft("photoUrl", event.target.value)} placeholder="https://..." />
                  </label>
                </div>
              </div>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Nome e cognome</span>
                <Field value={editing.name} onChange={(event) => updateDraft("name", event.target.value)} />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Email</span>
                <Field type="email" value={editing.email} onChange={(event) => updateDraft("email", event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Salone</span>
                <Select value={editing.sedeId ?? ""} onChange={(event) => updateDraft("sedeId", event.target.value)}>
                  {availableLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Ruolo</span>
                <Select value={editing.role} onChange={(event) => updateDraft("role", event.target.value as Role)}>
                  {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Data di nascita</span>
                <Field type="date" value={editing.birthDate} onChange={(event) => updateDraft("birthDate", event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Codice fiscale</span>
                <Field value={editing.fiscalCode} onChange={(event) => updateDraft("fiscalCode", event.target.value.toUpperCase())} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Inizio contratto</span>
                <Field type="date" value={editing.contractStart} onChange={(event) => updateDraft("contractStart", event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Scadenza contratto</span>
                <Field type="date" value={editing.contractEnd} onChange={(event) => updateDraft("contractEnd", event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">PIN tablet personale</span>
                <Field inputMode="numeric" maxLength={6} placeholder={creating ? "Automatico se vuoto (6 numeri)" : editing.hasPin ? "Nuovo PIN (4-6 numeri)" : "Automatico se vuoto"} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">{creating ? "Password provvisoria" : "Nuova password (opzionale)"}</span>
                <Field type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={creating ? "Automatica se vuota" : "Minimo 8 caratteri"} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/65 p-4 sm:col-span-2">
                <input type="checkbox" checked={editing.active} onChange={(event) => updateDraft("active", event.target.checked)} />
                <span className="text-sm font-semibold">Utente attivo</span>
              </label>
            </div>
            {message ? <p className="mt-4 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium">{message}</p> : null}
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={saveEmployee} disabled={saving}><Save className="size-4" /> {saving ? "Salvataggio..." : "Salva utente"}</Button>
              <Button variant="soft" onClick={() => setEditing(null)}>Annulla</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function EmployeeSection({ title, employees, openEdit, empty, muted = false }: { title: string; employees: Employee[]; openEdit: (employee: Employee) => void; empty?: string; muted?: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge tone={muted ? "dark" : "green"}>{employees.length}</Badge>
      </div>
      <div className="grid grid-cols-1 divide-y divide-black/5">
        {employees.length === 0 ? <p className="p-5 text-sm text-black/45">{empty ?? "Nessun dipendente."}</p> : null}
        {employees.map((employee) => (
          <div key={employee.email} className={`grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] md:items-center ${muted ? "opacity-70" : ""}`}>
            <div>
              <p className="font-semibold">{employee.name}</p>
              <p className="text-sm text-black/50">{employee.email}</p>
            </div>
            <p className="text-sm">{employee.location}</p>
            <Badge tone={muted ? "dark" : "gold"}>{employee.role}</Badge>
            <p className="text-sm text-black/55">{employee.active ? "Account attivo" : "Disattivato"}</p>
            <Button variant="soft" onClick={() => openEdit(employee)}><UserCog className="size-4" /> Modifica</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
