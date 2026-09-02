"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Save, UserCog, X, MapPin, Mail, Phone, Calendar, User, Award, 
  Fingerprint, Lock, Shield, ChevronLeft, Copy, Check, Briefcase, ListCheck, SlidersHorizontal, ClipboardList
  , Download
} from "lucide-react";
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
  employeeStatus?: string;
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
  iban?: string;
  hrNotes?: string;
  managerId?: string | null;
  accessList?: string[];
  workforceData?: WorkforceData;
  lastEditedByName?: string | null;
  lastEditedAt?: string | null;
};

type Location = { id: string; name: string };
type WorkforceData = {
  firstName?: string;
  lastName?: string;
  birthCity?: string;
  birthProvince?: string;
  residenceAddress?: string;
  residenceCap?: string;
  residenceCity?: string;
  residenceProvince?: string;
  bic?: string;
  personalEmail?: string;
  employmentType?: string;
  contractLevel?: string;
  jobTitle?: string;
  workforceNotes?: string;
  workLocation?: string;
};

const WORKFORCE_COLUMNS: Array<{ key: keyof WorkforceData | "fiscalCode" | "birthDate" | "iban" | "contractStart" | "contractEnd" | "fallbackJobTitle" | "fallbackWorkLocation"; label: string }> = [
  { key: "firstName", label: "Nome" },
  { key: "lastName", label: "Cognome" },
  { key: "fiscalCode", label: "Codice fiscale" },
  { key: "birthCity", label: "Comune nascita" },
  { key: "birthProvince", label: "Provincia nascita" },
  { key: "birthDate", label: "Data di nascita" },
  { key: "residenceAddress", label: "Indirizzo residenza" },
  { key: "residenceCap", label: "CAP residenza" },
  { key: "residenceCity", label: "Comune residenza" },
  { key: "residenceProvince", label: "Provincia residenza" },
  { key: "iban", label: "IBAN" },
  { key: "bic", label: "BIC" },
  { key: "personalEmail", label: "Email personale" },
  { key: "contractStart", label: "Data inizio rapporto di lavoro" },
  { key: "contractEnd", label: "Scadenza contratto" },
  { key: "employmentType", label: "Tipo rapporto di lavoro" },
  { key: "contractLevel", label: "Livello contrattuale" },
  { key: "fallbackJobTitle", label: "Job title / Mansione" },
  { key: "workforceNotes", label: "Note" },
  { key: "fallbackWorkLocation", label: "Sede di lavoro" },
];

const WORKFORCE_HELP = [
  'Completo anche di "secondo nome" se presente',
  'Completo anche di "secondo cognome" se presente',
  "",
  "Se ESTERO, indicare lo Stato Estero",
  "Sigla (es. MI). Se ESTERO, indica EE",
  "Formato (es. 20/05/1980)",
  "Via e numero civico",
  "",
  "",
  "Sigla (es. MI)",
  "IBAN su cui il dipendente riceverà lo stipendio.",
  "Obbligatorio per banca estera",
  "Mail personale per Jet HR. Non mettere email aziendale",
  "Data assunzione",
  "Se tempo determinato, apprendistato o tirocinio",
  "Es. indeterminato, determinato, tirocinio, apprendistato, collaborazione",
  "Es. primo livello commercio: 1",
  "Es. Product Manager",
  "Accordi su netti, premi fissi, detrazioni o aggiornamenti cedolino",
  "Nome sede come indicato in onboarding",
];

const roles: { value: Role; label: string }[] = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "MAGAZZINO", label: "Magazzino" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function EmployeeManager({ initialEmployees, locations }: { initialEmployees: Employee[]; locations: Location[] }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [availableLocations] = useState(locations);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [stats, setStats] = useState<{
    jobs: { count: number; growth: number };
    hours: { count: number; growth: number };
    shifts: { count: number; growth: number };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [copiedPhotoUrl, setCopiedPhotoUrl] = useState(false);
  const [customMansioneEdit, setCustomMansioneEdit] = useState(false);

  useEffect(() => {
    if (editing?.id) {
      setLoadingStats(true);
      fetch(`/api/employees/${editing.id}/stats`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setStats(data);
        })
        .catch(err => console.error("Error loading stats:", err))
        .finally(() => setLoadingStats(false));
    }
  }, [editing?.id]);

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
    workforceData: {},
  };
  const activeEmployees = employees.filter((employee) => employee.active);
  const inactiveEmployees = employees.filter((employee) => !employee.active);

  function splitEmployeeName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) || "" };
  }

  function formatExcelDate(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("it-IT");
  }

  function workforceValue(employee: Employee, key: (typeof WORKFORCE_COLUMNS)[number]["key"]) {
    const workforce = employee.workforceData || {};
    const splitName = splitEmployeeName(employee.name);
    const valueMap: Record<string, string> = {
      firstName: workforce.firstName || splitName.firstName,
      lastName: workforce.lastName || splitName.lastName,
      fiscalCode: employee.fiscalCode || "",
      birthCity: workforce.birthCity || "",
      birthProvince: (workforce.birthProvince || "").toUpperCase(),
      birthDate: formatExcelDate(employee.birthDate),
      residenceAddress: workforce.residenceAddress || "",
      residenceCap: workforce.residenceCap || "",
      residenceCity: workforce.residenceCity || "",
      residenceProvince: (workforce.residenceProvince || "").toUpperCase(),
      iban: employee.iban || "",
      bic: (workforce.bic || "").toUpperCase(),
      personalEmail: workforce.personalEmail || "",
      contractStart: formatExcelDate(employee.contractStart),
      contractEnd: formatExcelDate(employee.contractEnd),
      employmentType: workforce.employmentType || "",
      contractLevel: workforce.contractLevel || "",
      fallbackJobTitle: workforce.jobTitle || employee.mansione || "",
      workforceNotes: workforce.workforceNotes || "",
      fallbackWorkLocation: workforce.workLocation || employee.location || "",
    };
    return valueMap[String(key)] || "";
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function exportWorkforceExcel() {
    const rows = employees.filter((employee) => employee.active);
    const header = WORKFORCE_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
    const help = WORKFORCE_HELP.map((item) => `<td>${escapeHtml(item)}</td>`).join("");
    const body = rows.map((employee) => (
      `<tr>${WORKFORCE_COLUMNS.map((column) => `<td>${escapeHtml(workforceValue(employee, column.key))}</td>`).join("")}</tr>`
    )).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${header}</tr><tr>${help}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Dati_forza_lavoro_compilato_${stamp}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handlePhotoUpload(employeeId: string, file: File) {
    if (!file) return;
    setErrorMsg("");
    setPhotoUploadingId(employeeId);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/staff/${employeeId}/photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Caricamento foto fallito.");
      
      const photoUrl = data.photoUrl || "";
      setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, photoUrl } : emp));
      setEditing(prev => prev && prev.id === employeeId ? { ...prev, photoUrl } : prev);
      setMessage("Foto caricata con successo.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Errore durante il caricamento.");
    } finally {
      setPhotoUploadingId(null);
    }
  }

  function openEdit(employee: Employee) {
    setCreating(false);
    setEditing(employee);
    setPin("");
    setPassword("");
    setMessage("");

    const mansioniPresets = ["hairstyle", "videomaker", "sito web", "magazzino", "grafico", "parrucchiera", "estetista", "receptionist"];
    const isCustom = employee.mansione && !mansioniPresets.includes(employee.mansione.toLowerCase());
    setCustomMansioneEdit(Boolean(isCustom));
  }

  function openCreate() {
    setCreating(true);
    setEditing({ ...draft, id: "" });
    setPin("");
    setPassword("");
    setMessage("");
    setCustomMansioneEdit(false);
  }

  function updateDraft<K extends keyof Employee>(key: K, value: Employee[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  function updateWorkforceDraft<K extends keyof WorkforceData>(key: K, value: WorkforceData[K]) {
    setEditing((current) => current ? {
      ...current,
      workforceData: {
        ...(current.workforceData || {}),
        [key]: value,
      },
    } : current);
  }

  async function saveEmployee() {
    if (!editing) return;
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setMessage("Il PIN deve avere da 4 a 6 numeri.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const endpoint = creating ? "/api/employees" : `/api/employees/${editing.id}`;
      const response = await fetch(endpoint, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, pin: pin || undefined, password: password || undefined }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok || !data) {
        setMessage(data?.error ?? "Modifica non salvata. Riprova tra poco.");
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
        iban: data.iban ?? "",
        hrNotes: data.hr_notes ?? "",
        managerId: data.manager_id,
        accessList: (data.access_list as string[]) ?? [],
        workforceData: data.workforce_data && typeof data.workforce_data === "object" && !Array.isArray(data.workforce_data) ? data.workforce_data : {},
        lastEditedByName: data.last_edited_by?.name ?? null,
        lastEditedAt: data.last_edited_at ?? null,
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-[#d946ef]" : "bg-zinc-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );

  const buildContractsList = (startStr?: string, endStr?: string) => {
    if (!startStr) return [];
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;
    if (isNaN(start.getTime())) return [];

    const list = [];
    const formatDate = (d: Date) => d.toLocaleDateString("it-IT");

    const startYear = start.getFullYear();
    const currentYear = new Date().getFullYear();

    if (startYear < currentYear) {
      const initialEnd = new Date(start);
      initialEnd.setFullYear(startYear + 1);
      initialEnd.setDate(initialEnd.getDate() - 1);
      list.push({
        tipo: "Assunzione iniziale",
        inizio: formatDate(start),
        fine: formatDate(initialEnd),
        stato: "Completato",
        rinnovatoIl: "—",
        scadenza: "—",
        note: "Primo contratto"
      });

      const renewalStart = new Date(start);
      renewalStart.setFullYear(startYear + 1);
      const renewalEnd = end ? end : new Date(renewalStart);
      if (!end) {
        renewalEnd.setFullYear(renewalStart.getFullYear() + 1);
        renewalEnd.setDate(renewalEnd.getDate() - 1);
      }
      const daysLeft = Math.ceil((renewalEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      list.push({
        tipo: "Rinnovo",
        inizio: formatDate(renewalStart),
        fine: formatDate(renewalEnd),
        stato: daysLeft < 0 ? "Completato" : "Attivo",
        rinnovatoIl: "10/07/2025",
        scadenza: daysLeft < 0 ? "—" : daysLeft === 0 ? "Scade oggi" : `Tra ${daysLeft} giorni`,
        note: "Rinnovo annuale"
      });

      const nextStart = new Date(renewalEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextEnd = new Date(nextStart);
      nextEnd.setFullYear(nextStart.getFullYear() + 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
      const nextDaysLeft = Math.ceil((nextStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      list.push({
        tipo: "Prossimo rinnovo previsto",
        inizio: formatDate(nextStart),
        fine: formatDate(nextEnd),
        stato: "Pianificato",
        rinnovatoIl: "—",
        scadenza: nextDaysLeft < 0 ? "—" : `Tra ${nextDaysLeft} giorni`,
        note: "Da confermare"
      });
    } else {
      const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      list.push({
        tipo: "Assunzione iniziale",
        inizio: formatDate(start),
        fine: end ? formatDate(end) : "Indeterminato",
        stato: daysLeft === null || daysLeft >= 0 ? "Attivo" : "Completato",
        rinnovatoIl: "—",
        scadenza: daysLeft === null ? "—" : daysLeft < 0 ? "—" : `Tra ${daysLeft} giorni`,
        note: "Contratto corrente"
      });
      
      if (end) {
        const nextStart = new Date(end);
        nextStart.setDate(nextStart.getDate() + 1);
        const nextEnd = new Date(nextStart);
        nextEnd.setFullYear(nextStart.getFullYear() + 1);
        nextEnd.setDate(nextEnd.getDate() - 1);
        const nextDaysLeft = Math.ceil((nextStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        list.push({
          tipo: "Prossimo rinnovo previsto",
          inizio: formatDate(nextStart),
          fine: formatDate(nextEnd),
          stato: "Pianificato",
          rinnovatoIl: "—",
          scadenza: `Tra ${nextDaysLeft} giorni`,
          note: "Da confermare"
        });
      }
    }

    return list;
  };

  const renderFullscreenEditor = () => {
    if (!editing) return null;

    const contracts = buildContractsList(editing.contractStart, editing.contractEnd);
    const managersList = employees.filter(emp => emp.role === "ZERO" || emp.role === "SUPER_ADMIN" || emp.role === "ADMIN" || emp.role === "RESPONSABILE");

    const PLATFORMS = [
      { key: "dashboard", label: "Dashboard", val: "/dashboard" },
      { key: "profile", label: "Profilo", val: "/profile" },
      { key: "my-shifts", label: "I miei turni", val: "/my-shifts" },
      { key: "tasks", label: "Task", val: "/tasks" },
      { key: "schedules", label: "Planning", val: "/schedules" },
      { key: "orders", label: "Ordini", val: "/orders" },
      { key: "appointments", label: "Appuntamenti", val: "/appointments" },
      { key: "cash", label: "Cassa & transazioni", val: "/cash" },
      { key: "service-forms", label: "Moduli operativi", val: "/service-forms" },
      { key: "documents", label: "Documenti", val: "/documents" },
      { key: "requests", label: "Ferie e permessi", val: "/requests" },
      { key: "malattie", label: "Malattie", val: "/malattie" },
      { key: "notifications", label: "Notifiche", val: "/notifications" },
      { key: "social-calendar", label: "Programmazione Social", val: "/social-calendar" },
      { key: "client-control", label: "Controllo Cliente", val: "/client-control" },
      { key: "attendance", label: "Timbrature", val: "/attendance" },
      { key: "work-hours", label: "Ore staff", val: "/work-hours" },
      { key: "cedolini", label: "Cedolini", val: "/cedolini" },
      { key: "invoices", label: "Fatture", val: "/invoices" },
      { key: "refunds", label: "Rimborsi", val: "/refunds" },
      { key: "tables", label: "Tabelle", val: "/tables" },
    ];

    const copyPhotoUrl = () => {
      if (editing.photoUrl) {
        navigator.clipboard.writeText(editing.photoUrl);
        setCopiedPhotoUrl(true);
        setTimeout(() => setCopiedPhotoUrl(false), 2000);
      }
    };

    const toggleAccessInEdit = (access: string) => {
      const current = Array.isArray(editing.accessList) ? editing.accessList : [];
      const next = current.includes(access)
        ? current.filter(a => a !== access)
        : [...current, access];
      updateDraft("accessList", next);
    };

    const mansioniPresets = ["Hairstyle", "Videomaker", "Sito Web", "Magazzino", "Grafico", "Parrucchiera", "Estetista", "Receptionist"];

    return (
      <div className="w-full bg-transparent min-h-screen text-[#171717] pb-12 animate-in fade-in duration-200">
        <style dangerouslySetInnerHTML={{__html: `
          header, main > header {
            display: none !important;
          }
          main {
            padding-top: 1rem !important;
          }
        `}} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(false);
            }}
            className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-black transition duration-200"
          >
            <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-1" />
            Torna all'elenco
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-white rounded-[32px] border border-black/5 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative size-24 md:size-28 rounded-[24px] overflow-hidden border-2 border-[#e6dcd4] bg-neutral-100 flex items-center justify-center text-3xl font-black text-neutral-800 shadow-md group shrink-0">
                {editing.photoUrl ? (
                  <img src={resolveDrivePhotoUrl(editing.photoUrl)} alt={editing.name} className="size-full object-cover" />
                ) : (
                  editing.name.slice(0, 2).toUpperCase()
                )}
                {!creating && (
                  <label className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer text-center px-1">
                    <span>{photoUploadingId === editing.id ? "Carico..." : "Carica foto"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={photoUploadingId === editing.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePhotoUpload(editing.id, file);
                      }}
                    />
                  </label>
                )}
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900">{editing.name || "Nuovo Dipendente"}</h1>
                <p className="text-sm font-semibold text-neutral-400 mt-1 capitalize">{editing.mansione || "Nessun ruolo"}</p>
                <div className="flex flex-wrap gap-2 items-center mt-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm",
                    editing.active ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                  )}>
                    <span className={cn("size-2 rounded-full", editing.active ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                    {editing.active ? "Attivo" : "Disattivato"}
                  </span>
                  <span className="bg-neutral-50 text-neutral-600 border border-neutral-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Codice: {editing.fiscalCode || "0"}
                  </span>
                  <span className="bg-neutral-50 text-neutral-600 border border-neutral-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="size-3 text-red-500" />
                    {editing.location}
                  </span>
                </div>
                {editing.lastEditedByName && (
                  <p className="text-[11px] text-neutral-400 font-semibold mt-2.5 italic">
                    Ultima modifica eseguita da: <span className="font-extrabold">{editing.lastEditedByName}</span> il {new Date(editing.lastEditedAt!).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                )}
              </div>
            </div>

            {!creating && (
              <div className="grid grid-cols-3 gap-3 w-full md:w-auto md:min-w-[420px]">
                {[
                  { title: "Lavori completati", count: stats?.jobs.count ?? 0, growth: stats?.jobs.growth ?? 0, unit: "" },
                  { title: "Ore lavorate", count: stats?.hours.count ?? 0, growth: stats?.hours.growth ?? 0, unit: "h" },
                  { title: "Turni effettuati", count: stats?.shifts.count ?? 0, growth: stats?.shifts.growth ?? 0, unit: "" },
                ].map((card, idx) => (
                  <div key={idx} className="bg-[#fcfaf7] border border-black/5 p-3 rounded-[20px] shadow-sm flex flex-col justify-between min-h-[90px]">
                    <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400 leading-normal">{card.title}</p>
                    {loadingStats ? (
                      <div className="h-6 w-16 bg-neutral-200 animate-pulse rounded-md mt-2" />
                    ) : (
                      <div className="flex items-baseline justify-between gap-1 mt-2">
                        <span className="text-xl font-black tracking-tight">{card.count.toLocaleString("it-IT")}{card.unit}</span>
                        <span className={cn(
                          "text-[9px] font-extrabold rounded-full px-1.5 py-0.5",
                          card.growth >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        )}>
                          {card.growth >= 0 ? `+${card.growth}%` : `${card.growth}%`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <form onSubmit={(e) => { e.preventDefault(); void saveEmployee(); }} className="space-y-6">
            {message && (
              <div className="p-4 text-sm font-semibold text-rose-800 bg-[#fcf5f6] rounded-2xl border border-rose-200 animate-in fade-in">
                {message}
              </div>
            )}
            {errorMsg && (
              <div className="p-4 text-sm font-semibold text-rose-800 bg-rose-50 rounded-2xl border border-rose-200 animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <User className="size-4 text-[#C66170]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Profilo Personale</h2>
                </div>

                <div className="space-y-3.5 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome e cognome</span>
                    <Field
                      required
                      value={editing.name}
                      onChange={(e) => updateDraft("name", e.target.value)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Email di accesso</span>
                    <Field
                      required
                      type="email"
                      value={editing.email}
                      onChange={(e) => updateDraft("email", e.target.value)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">URL foto profilo</span>
                    <div className="relative">
                      <Field
                        value={editing.photoUrl || ""}
                        onChange={(e) => updateDraft("photoUrl", e.target.value)}
                        placeholder="https://..."
                        className="pr-12"
                      />
                      {editing.photoUrl && (
                        <button
                          type="button"
                          onClick={copyPhotoUrl}
                          className="absolute right-2.5 top-2.5 grid size-7 place-items-center bg-black/5 hover:bg-black/10 active:scale-95 rounded-lg text-neutral-500 transition-all"
                          title="Copia link"
                        >
                          {copiedPhotoUrl ? <Check className="size-3.5 text-emerald-600 animate-in zoom-in" /> : <Copy className="size-3.5" />}
                        </button>
                      )}
                    </div>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Numero WhatsApp</span>
                    <Field
                      value={editing.whatsappPhone || ""}
                      onChange={(e) => updateDraft("whatsappPhone", e.target.value)}
                      placeholder="+39..."
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data di nascita</span>
                    <Field
                      type="date"
                      value={editing.birthDate || ""}
                      onChange={(e) => updateDraft("birthDate", e.target.value)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Codice fiscale</span>
                    <Field
                      value={editing.fiscalCode || ""}
                      onChange={(e) => updateDraft("fiscalCode", e.target.value.toUpperCase())}
                      placeholder="Codice fiscale..."
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">IBAN</span>
                    <Field
                      value={editing.iban || ""}
                      onChange={(e) => updateDraft("iban", e.target.value.toUpperCase())}
                      placeholder="IT..."
                    />
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <Briefcase className="size-4 text-[#C66170]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Posizione Lavorativa</h2>
                </div>

                <div className="space-y-3.5 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Mansione / Ruolo</span>
                    <Select
                      value={customMansioneEdit ? "custom" : (editing.mansione || "").toLowerCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setCustomMansioneEdit(true);
                          updateDraft("mansione", "");
                        } else {
                          setCustomMansioneEdit(false);
                          updateDraft("mansione", val);
                        }
                      }}
                    >
                      <option value="">Seleziona mansione...</option>
                      {mansioniPresets.map((m) => (
                        <option key={m} value={m.toLowerCase()}>{m}</option>
                      ))}
                      <option value="custom">+ Aggiungi altra mansione...</option>
                    </Select>
                    {customMansioneEdit && (
                      <Field
                        required
                        value={editing.mansione || ""}
                        onChange={(e) => updateDraft("mansione", e.target.value)}
                        placeholder="Inserisci nuova mansione..."
                        className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200"
                      />
                    )}
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Stato Dipendente</span>
                    <Select
                      value={editing.employeeStatus || "Attivo"}
                      onChange={(e) => updateDraft("employeeStatus", e.target.value)}
                    >
                      {["Attivo", "In prova", "Sospeso", "Ex dipendente"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Livello sistema</span>
                    <Select
                      value={editing.role}
                      onChange={(e) => updateDraft("role", e.target.value as Role)}
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Salone sede</span>
                    <Select
                      value={editing.sedeId || ""}
                      onChange={(e) => {
                        const sId = e.target.value || null;
                        const sLoc = availableLocations.find(l => l.id === sId)?.name ?? "Nessun salone";
                        updateDraft("sedeId", sId);
                        updateDraft("location", sLoc);
                      }}
                    >
                      <option value="">Nessuna sede</option>
                      {availableLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Responsabile diretto</span>
                    <Select
                      value={editing.managerId || ""}
                      onChange={(e) => updateDraft("managerId", e.target.value || null)}
                    >
                      <option value="">Nessun manager</option>
                      {managersList.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Inizio contratto</span>
                      <Field
                        type="date"
                        value={editing.contractStart || ""}
                        onChange={(e) => updateDraft("contractStart", e.target.value)}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Fine contratto</span>
                      <Field
                        type="date"
                        value={editing.contractEnd || ""}
                        onChange={(e) => updateDraft("contractEnd", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <Shield className="size-4 text-[#C66170]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Account e Sicurezza</h2>
                </div>

                <div className="space-y-4 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Stato account</span>
                    <Select
                      value={editing.active ? "true" : "false"}
                      onChange={(e) => updateDraft("active", e.target.value === "true")}
                    >
                      <option value="true">Attivo / Abilitato</option>
                      <option value="false">Disattivato / Bloccato</option>
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#B85B68]">Cambia PIN (4-6 cifre)</span>
                    <Field
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Nuovo PIN"
                      maxLength={6}
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#B85B68]">Conferma PIN</span>
                    <Field
                      placeholder="Conferma PIN"
                      maxLength={6}
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>

                  <div className="pt-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">Cambia password</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setErrorMsg("");
                        try {
                          const res = await fetch(`/api/profile/password`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: editing.email })
                          });
                          if (!res.ok) throw new Error("Errore invio email reset password.");
                          setMessage("Email per il reset della password inviata con successo!");
                          setTimeout(() => setMessage(""), 3500);
                        } catch (err: any) {
                          setErrorMsg(err.message);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#B85B68]/20 bg-[#B85B68]/5 px-4 py-3 text-xs font-bold text-[#B85B68] hover:bg-[#B85B68]/10 active:scale-98 transition duration-200"
                    >
                      <Mail className="size-4" /> Invia link di reimpostazione
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                <ClipboardList className="size-4 text-[#C66170]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Dati forza lavoro / Excel</h2>
              </div>
              <p className="text-[10px] text-neutral-400 font-semibold mt-1">
                Questi campi compilano il file Excel "Dati forza lavoro".
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome</span>
                  <Field
                    value={editing.workforceData?.firstName || splitEmployeeName(editing.name).firstName}
                    onChange={(e) => updateWorkforceDraft("firstName", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Cognome</span>
                  <Field
                    value={editing.workforceData?.lastName || splitEmployeeName(editing.name).lastName}
                    onChange={(e) => updateWorkforceDraft("lastName", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Comune nascita</span>
                  <Field value={editing.workforceData?.birthCity || ""} onChange={(e) => updateWorkforceDraft("birthCity", e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Provincia nascita</span>
                  <Field maxLength={2} value={editing.workforceData?.birthProvince || ""} onChange={(e) => updateWorkforceDraft("birthProvince", e.target.value.toUpperCase())} placeholder="MI" />
                </label>
                <label className="block space-y-1 lg:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Indirizzo residenza</span>
                  <Field value={editing.workforceData?.residenceAddress || ""} onChange={(e) => updateWorkforceDraft("residenceAddress", e.target.value)} placeholder="Via e numero civico" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">CAP residenza</span>
                  <Field value={editing.workforceData?.residenceCap || ""} onChange={(e) => updateWorkforceDraft("residenceCap", e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Comune residenza</span>
                  <Field value={editing.workforceData?.residenceCity || ""} onChange={(e) => updateWorkforceDraft("residenceCity", e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Provincia residenza</span>
                  <Field maxLength={2} value={editing.workforceData?.residenceProvince || ""} onChange={(e) => updateWorkforceDraft("residenceProvince", e.target.value.toUpperCase())} placeholder="TO" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">BIC</span>
                  <Field value={editing.workforceData?.bic || ""} onChange={(e) => updateWorkforceDraft("bic", e.target.value.toUpperCase())} />
                </label>
                <label className="block space-y-1 lg:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Email personale</span>
                  <Field type="email" value={editing.workforceData?.personalEmail || ""} onChange={(e) => updateWorkforceDraft("personalEmail", e.target.value)} placeholder="email personale, non aziendale" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tipo rapporto</span>
                  <Field value={editing.workforceData?.employmentType || ""} onChange={(e) => updateWorkforceDraft("employmentType", e.target.value)} placeholder="Determinato, tirocinio..." />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Livello contrattuale</span>
                  <Field value={editing.workforceData?.contractLevel || ""} onChange={(e) => updateWorkforceDraft("contractLevel", e.target.value)} />
                </label>
                <label className="block space-y-1 lg:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Job title / Mansione Excel</span>
                  <Field value={editing.workforceData?.jobTitle || editing.mansione || ""} onChange={(e) => updateWorkforceDraft("jobTitle", e.target.value)} />
                </label>
                <label className="block space-y-1 lg:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Sede di lavoro Excel</span>
                  <Field value={editing.workforceData?.workLocation || editing.location || ""} onChange={(e) => updateWorkforceDraft("workLocation", e.target.value)} />
                </label>
                <label className="block space-y-1 md:col-span-2 lg:col-span-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Note Excel</span>
                  <textarea
                    value={editing.workforceData?.workforceNotes || ""}
                    onChange={(e) => updateWorkforceDraft("workforceNotes", e.target.value)}
                    placeholder="Accordi, premi fissi, detrazioni, aggiornamenti cedolino..."
                    rows={3}
                    className="w-full rounded-2xl border border-black/10 bg-white/80 p-3.5 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20 resize-none font-medium"
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                <ListCheck className="size-4 text-[#C66170]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Accessi Abilitati</h2>
              </div>
              <p className="text-[10px] text-neutral-400 font-semibold mt-1">Seleziona a quali piattaforme e funzionalità può accedere il dipendente</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
                {PLATFORMS.map((item) => {
                  const isChecked = Array.isArray(editing.accessList) ? editing.accessList.includes(item.val) : false;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#fcfaf8] border border-black/[0.03] hover:shadow-sm transition-all duration-200">
                      <span className="text-xs font-extrabold text-neutral-700">{item.label}</span>
                      <Toggle
                        checked={isChecked}
                        onChange={() => toggleAccessInEdit(item.val)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm lg:col-span-2">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <ClipboardList className="size-4 text-[#C66170]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Storico contratti e rinnovi</h2>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full divide-y divide-black/5 text-left text-xs">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                        <th className="py-2.5">Tipo</th>
                        <th className="py-2.5">Data Inizio</th>
                        <th className="py-2.5">Data Fine</th>
                        <th className="py-2.5">Stato</th>
                        <th className="py-2.5">Rinnovato il</th>
                        <th className="py-2.5">Scadenza tra</th>
                        <th className="py-2.5">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-semibold text-neutral-700">
                      {contracts.length > 0 ? (
                        contracts.map((c, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50 transition">
                            <td className="py-3 font-extrabold text-neutral-900">{c.tipo}</td>
                            <td className="py-3">{c.inizio}</td>
                            <td className="py-3">{c.fine}</td>
                            <td className="py-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide",
                                c.stato === "Attivo" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                                c.stato === "Completato" && "bg-neutral-100 text-neutral-600",
                                c.stato === "Pianificato" && "bg-blue-50 text-blue-700 border border-blue-100"
                              )}>
                                {c.stato}
                              </span>
                            </td>
                            <td className="py-3 text-neutral-500">{c.rinnovatoIl}</td>
                            <td className="py-3 text-[#B85B68] font-bold">{c.scadenza}</td>
                            <td className="py-3 text-neutral-400 text-[11px] font-normal italic">{c.note}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-neutral-400 italic">
                            Nessuna data di contratto configurata per questo dipendente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-black/5 p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <SlidersHorizontal className="size-4 text-[#C66170]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-600">Note amministrazione HR (interne)</h2>
                </div>
                <p className="text-[10px] text-neutral-400 font-semibold mt-1">Visibile solo ad amministratori e responsabili HR</p>

                <div className="flex-1 flex flex-col justify-between mt-4">
                  <textarea
                    value={editing.hrNotes || ""}
                    onChange={(e) => {
                      const text = e.target.value.slice(0, 1000);
                      updateDraft("hrNotes", text);
                    }}
                    placeholder="Scrivi una nota interna..."
                    rows={6}
                    className="w-full flex-1 rounded-2xl border border-black/10 bg-white/80 p-3.5 text-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20 resize-none font-medium"
                  />
                  <div className="text-[10px] text-neutral-400 font-bold text-right mt-2">
                    {(editing.hrNotes || "").length}/1000 caratteri
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4 border-t border-black/5">
              <Button
                type="button"
                variant="soft"
                onClick={() => {
                  setEditing(null);
                  setCreating(false);
                }}
                className="min-w-[150px] border border-black/10 bg-white text-neutral-600"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="min-w-[180px] bg-gradient-to-r from-paradise-pink to-[#ffa8dd] text-paradise-noir font-black shadow-md hover:shadow-lg transition active:scale-[0.98]"
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (editing) {
    return renderFullscreenEditor();
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
        <Button
          type="button"
          variant="soft"
          onClick={exportWorkforceExcel}
          className="rounded-[20px] border border-black/10 bg-white text-paradise-noir shadow-sm"
        >
          <Download className="size-4" /> Scarica Excel forza lavoro
        </Button>
      </div>

      <div className="space-y-6">
        <EmployeeSection title="Personale Attivo" employees={activeEmployees} openEdit={openEdit} />
        <EmployeeSection title="Personale Disattivato" employees={inactiveEmployees} openEdit={openEdit} empty="Nessun lavoratore disattivato." muted />
      </div>
    </>
  );
}

function EmployeeSection({ title, employees, openEdit, empty, muted = false }: { title: string; employees: Employee[]; openEdit: (employee: Employee) => void; empty?: string; muted?: boolean }) {
  function getRoleBadgeTone(role: Role) {
    if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN") return "dark";
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
