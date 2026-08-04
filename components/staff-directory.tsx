"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, X, User, Phone, Mail, Calendar, Briefcase, 
  MapPin, ClipboardList, CheckCircle, Award, SlidersHorizontal, 
  Sparkles, Key, Shield, ToggleLeft, ToggleRight, ListCheck,
  Archive, Plus, Trash2, UserPlus, Printer, RefreshCw,
  ChevronLeft, Copy, Check, HeartPulse
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
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
  iban?: string;
  contractHistory?: ContractHistoryItem[] | null;
  sicknessStats?: {
    totalDays: number;
    justifiedDays: number;
    unjustifiedDays: number;
  };
  lastEditedByName?: string | null;
  lastEditedAt?: string | null;
};

type ContractHistoryItem = {
  tipo?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  renewedAt?: string;
  note?: string;
};

type ContractRow = {
  tipo: string;
  inizio: string;
  fine: string;
  stato: string;
  rinnovatoIl: string;
  scadenza: string;
  note: string;
  historyIndex?: number;
};

type Location = { id: string; name: string };
type Manager = { id: string; name: string; role: string };

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

class SafetyErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 rounded-3xl border border-rose-200 dark:border-rose-900 space-y-4">
          <h3 className="text-lg font-bold">Si è verificato un errore nel modulo di modifica:</h3>
          <p className="text-sm font-semibold font-mono">{this.state.error?.toString()}</p>
          <pre className="text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto p-4 bg-black/5 dark:bg-black/40 rounded-xl">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs"
          >
            Riprova
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const STATUS_OPTIONS = ["Attivo", "In prova", "Sospeso", "Ex dipendente"];
const ROLE_OPTIONS = [
  { value: "DIPENDENTE", label: "Dipendente" },
  { value: "MAGAZZINO", label: "Magazzino" },
  { value: "RESPONSABILE", label: "Responsabile" },
  { value: "ADMIN", label: "Admin" }
];
const ACCESS_PRESETS = [
  "/dashboard",
  "/profile",
  "/my-shifts",
  "/tasks",
  "/schedules",
  "/orders",
  "/appointments",
  "/cash",
  "/service-forms",
  "/documents",
  "/requests",
  "/malattie",
  "/notifications",
  "/social-calendar",
  "/client-control",
  "/attendance",
  "/work-hours",
  "/cedolini",
  "/invoices",
  "/refunds",
  "/tables",
  "/foto",
];

const ACCESS_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Profilo",
  "/my-shifts": "I miei turni",
  "/tasks": "Task",
  "/schedules": "Planning",
  "/orders": "Ordini",
  "/appointments": "Appuntamenti",
  "/cash": "Cassa & transazioni",
  "/service-forms": "Moduli operativi",
  "/documents": "Documenti",
  "/requests": "Ferie e permessi",
  "/malattie": "Malattie",
  "/notifications": "Comunicazioni",
  "/social-calendar": "Programmazione Social",
  "/client-control": "Controllo Cliente",
  "/attendance": "Timbrature",
  "/work-hours": "Ore staff",
  "/cedolini": "Cedolini",
  "/invoices": "Fatture",
  "/refunds": "Rimborsi",
  "/tables": "Tabelle",
  "/foto": "Foto",
};

const DEFAULT_MANSIONI = [
  "Amministratore",
  "Assistenza",
  "Collaboratore",
  "Magazzino",
  "Parrucchiera",
  "Responsabile salone",
  "Sarta",
  "Social",
  "Vice responsabile salone"
];

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
  const [archiveMode, setArchiveMode] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Modals editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Employee | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirmInput, setPinConfirmInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showRenewalForm, setShowRenewalForm] = useState(false);
  const [renewalDraft, setRenewalDraft] = useState({ startDate: "", endDate: "", note: "" });
  const [stats, setStats] = useState<{
    jobs: { count: number; growth: number };
    hours: { count: number; growth: number };
    shifts: { count: number; growth: number };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [copiedPhotoUrl, setCopiedPhotoUrl] = useState(false);
  const [teammateErrors, setTeammateErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isEditing && selectedEmployee?.id) {
      setLoadingStats(true);
      fetch(`/api/employees/${selectedEmployee.id}/stats`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setStats(data);
        })
        .catch(err => console.error("Error loading stats:", err))
        .finally(() => setLoadingStats(false));
    }
  }, [isEditing, selectedEmployee?.id]);
  
  // Modals creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState<Partial<Employee> | null>(null);
  const [creationMessage, setCreationMessage] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [syncingDrivePhotos, setSyncingDrivePhotos] = useState(false);

  const [mansioniList, setMansioniList] = useState<string[]>(DEFAULT_MANSIONI);
  const [customMansioneEdit, setCustomMansioneEdit] = useState(false);
  const [customMansioneCreate, setCustomMansioneCreate] = useState(false);

  useEffect(() => {
    fetch("/api/settings/roles/mansioni")
      .then(res => res.json())
      .then(data => {
        if (data && data.mansioni) {
          const fetched = Object.keys(data.mansioni).map(m => {
            return m.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
          });
          const merged = Array.from(new Set([...DEFAULT_MANSIONI, ...fetched])).sort();
          setMansioniList(merged);
        }
      })
      .catch(err => console.error("Error fetching mansioni:", err));
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setCustomMansioneEdit(false);
    }
  }, [isEditing]);

  useEffect(() => {
    const editorOpen = Boolean(selectedEmployee && isEditing && editForm);
    document.documentElement.classList.toggle("staff-directory-editor-open", editorOpen);

    return () => {
      document.documentElement.classList.remove("staff-directory-editor-open");
    };
  }, [selectedEmployee, isEditing, editForm]);

  useEffect(() => {
    if (!showCreateModal) {
      setCustomMansioneCreate(false);
    }
  }, [showCreateModal]);

  const isAuthorizedToEdit = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  const isArchivedEmployee = (emp: Employee) => !emp.active || emp.employeeStatus === "Ex dipendente";
  const archivedCount = staff.filter(isArchivedEmployee).length;

  // Filters
  const filteredStaff = staff.filter((emp) => {
    const archived = isArchivedEmployee(emp);
    if (archiveMode ? !archived : archived) return false;

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

  async function printStaffListPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const rows = staff
      .filter((emp) => archiveMode ? isArchivedEmployee(emp) : !isArchivedEmployee(emp))
      .sort((a, b) => a.name.localeCompare(b.name));
    const generatedAt = new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const columns = [
      { label: "Nome", x: 12, width: 42 },
      { label: "Mansione", x: 56, width: 32 },
      { label: "Salone", x: 90, width: 38 },
      { label: "Ruolo", x: 130, width: 28 },
      { label: "Telefono", x: 160, width: 32 },
      { label: "Email", x: 194, width: 48 },
      { label: "PIN", x: 244, width: 34 },
    ];

    function drawHeader(page: number) {
      doc.setFillColor(255, 214, 234);
      doc.rect(0, 0, 297, 22, "F");
      doc.setTextColor(31, 31, 31);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Paradise Staff Hub - Lista lavoratori", 12, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${archiveMode ? "Archivio staff" : "Personale attivo"} - Generato ${generatedAt}`, 12, 18);
      doc.text(`Pagina ${page}`, 274, 18);
    }

    function cellText(value: string, width: number) {
      return doc.splitTextToSize(value || "-", width);
    }

    let page = 1;
    let y = 34;
    drawHeader(page);

    const drawTableHead = () => {
      doc.setFillColor(248, 239, 244);
      doc.rect(10, y - 6, 274, 9, "F");
      doc.setTextColor(120, 55, 80);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      columns.forEach((column) => doc.text(column.label.toUpperCase(), column.x, y));
      y += 8;
      doc.setTextColor(31, 31, 31);
      doc.setFont("helvetica", "normal");
    };

    drawTableHead();
    rows.forEach((emp, index) => {
      const pinInfo = emp.hasPin ? "Configurato" : "Da impostare";
      const values = [
        emp.name,
        emp.mansione || "Collaboratore",
        emp.location,
        emp.role.replace("_", " "),
        emp.whatsappPhone || "-",
        emp.email,
        pinInfo,
      ];
      const wrapped = values.map((value, valueIndex) => cellText(value, columns[valueIndex].width));
      const rowHeight = Math.max(8, ...wrapped.map((line) => line.length * 4.2));

      if (y + rowHeight > 194) {
        doc.addPage();
        page += 1;
        y = 34;
        drawHeader(page);
        drawTableHead();
      }

      if (index % 2 === 0) {
        doc.setFillColor(252, 249, 251);
        doc.rect(10, y - 5, 274, rowHeight, "F");
      }

      doc.setFontSize(8);
      wrapped.forEach((lines, valueIndex) => {
        doc.text(lines, columns[valueIndex].x, y, { maxWidth: columns[valueIndex].width });
      });
      y += rowHeight;
    });

    if (rows.length === 0) {
      doc.setFontSize(11);
      doc.text("Nessun lavoratore da stampare.", 12, y + 4);
    }

    doc.setProperties({ title: "Lista lavoratori Paradise" });
    doc.save(`paradise-lista-lavoratori-${archiveMode ? "archivio" : "attivi"}.pdf`);
  }

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

    if (pinInput && pinInput !== pinConfirmInput) {
      setErrorMsg("La conferma PIN non corrisponde.");
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
          iban: editForm.iban || undefined,
          contractHistory: getContractHistory(editForm),
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
        iban: data.iban ?? "",
        contractHistory: Array.isArray(data.contract_history) ? data.contract_history : [],
        sicknessStats: editForm.sicknessStats,
      };

      setStaff((prev) => prev.map((emp) => emp.id === updated.id ? updated : emp));
      setSelectedEmployee(updated);
      setIsEditing(false);
      resetRenewalForm();
      setPinInput("");
      setPinConfirmInput("");
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
      const current = Array.isArray(prev.accessList) ? prev.accessList : [];
      const updated = current.includes(access)
        ? current.filter(a => a !== access)
        : [...current, access];
      return { ...prev, accessList: updated };
    });
  };

  const resetRenewalForm = () => {
    setShowRenewalForm(false);
    setRenewalDraft({ startDate: "", endDate: "", note: "" });
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

    if (pinInput && pinInput !== pinConfirmInput) {
      setErrorMsg("La conferma PIN non corrisponde.");
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
          iban: newEmployeeForm.iban || undefined,
          pin: pinInput || undefined,
          password: passwordInput || undefined
        })
      });

      const data = await readJsonResponse(response);
      if (!response.ok || !data) {
        throw new Error(data?.error || "Errore durante la creazione del dipendente.");
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
        iban: data.iban ?? "",
        sicknessStats: { totalDays: 0, justifiedDays: 0, unjustifiedDays: 0 },
      };

      setStaff((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      
      const emailText = data.emailStatus?.skipped
        ? " Email NON inviata: configura provider email o invia credenziali manualmente."
        : " Email con credenziali inviata al dipendente.";
        
      setCreationMessage(`Dipendente creato con successo! PIN: ${pinInput || "generato automaticamente"} e password provvisoria generata. ${emailText}`);
      setNewEmployeeForm(null);
      setPinInput("");
      setPinConfirmInput("");
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
      const current = Array.isArray(prev.accessList) ? prev.accessList : [];
      const updated = current.includes(access)
        ? current.filter(a => a !== access)
        : [...current, access];
      return { ...prev, accessList: updated };
    });
  };

  async function handleStaffPhotoUpload(employeeId: string, file?: File) {
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");
    setPhotoUploadingId(employeeId);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch(`/api/staff/${employeeId}/photo`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Caricamento foto non riuscito.");
      }

      const photoUrl = data.photoUrl || "";
      setStaff((prev) => prev.map((emp) => emp.id === employeeId ? { ...emp, photoUrl } : emp));
      setSelectedEmployee((prev) => prev?.id === employeeId ? { ...prev, photoUrl } : prev);
      setEditForm((prev) => prev?.id === employeeId ? { ...prev, photoUrl } : prev);
      setSuccessMsg("Foto lavoratore caricata su Google Drive e collegata al profilo.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Caricamento foto non riuscito.");
    } finally {
      setPhotoUploadingId(null);
    }
  }

  async function handleSyncDrivePhotos() {
    setErrorMsg("");
    setSuccessMsg("");
    setSyncingDrivePhotos(true);

    try {
      const response = await fetch("/api/staff/photos/sync-drive", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import foto da Drive non riuscito.");
      }

      const updated = Array.isArray(data.updated) ? data.updated : [];
      if (updated.length) {
        const photoById = new Map(updated.map((item: { id: string; photoUrl: string }) => [item.id, item.photoUrl]));
        setStaff((prev) => prev.map((emp) => photoById.has(emp.id) ? { ...emp, photoUrl: String(photoById.get(emp.id)) } : emp));
        setSelectedEmployee((prev) => prev && photoById.has(prev.id) ? { ...prev, photoUrl: String(photoById.get(prev.id)) } : prev);
        setEditForm((prev) => prev && photoById.has(prev.id) ? { ...prev, photoUrl: String(photoById.get(prev.id)) } : prev);
      }

      setSuccessMsg(
        updated.length
          ? `Importate ${updated.length} foto già presenti nella cartella Drive.`
          : "Nessuna nuova foto trovata nella cartella Drive."
      );
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err: any) {
      setErrorMsg(err.message || "Import foto da Drive non riuscito.");
    } finally {
      setSyncingDrivePhotos(false);
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

  const formatContractDate = (date: Date | string) => {
    const parsed = date instanceof Date ? date : new Date(date);
    return isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("it-IT");
  };

  const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

  const getDaysLabel = (date: Date) => {
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "—";
    if (days === 0) return "Oggi";
    return `Tra ${days} giorni`;
  };

  const getContractHistory = (employee: Employee | null) => {
    return Array.isArray(employee?.contractHistory) ? employee.contractHistory : [];
  };

  const buildContractsList = (startStr?: string, endStr?: string, history: ContractHistoryItem[] = []): ContractRow[] => {
    if (!startStr) return [];
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;
    if (isNaN(start.getTime())) return [];

    const list: ContractRow[] = [];
    const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    list.push({
      tipo: "Assunzione iniziale",
      inizio: formatContractDate(start),
      fine: end ? formatContractDate(end) : "Indeterminato",
      stato: daysLeft === null || daysLeft >= 0 ? "Attivo" : "Completato",
      rinnovatoIl: "—",
      scadenza: daysLeft === null ? "—" : daysLeft < 0 ? "—" : daysLeft === 0 ? "Scade oggi" : `Tra ${daysLeft} giorni`,
      note: "Contratto corrente"
    });

    history.forEach((item, historyIndex) => {
      const renewalEnd = item.endDate ? new Date(item.endDate) : null;
      list.push({
        tipo: item.tipo || "Rinnovo",
        inizio: item.startDate ? formatContractDate(item.startDate) : "—",
        fine: item.endDate ? formatContractDate(item.endDate) : "—",
        stato: item.status || "Pianificato",
        rinnovatoIl: item.renewedAt ? formatContractDate(item.renewedAt) : "—",
        scadenza: renewalEnd && !isNaN(renewalEnd.getTime()) ? getDaysLabel(renewalEnd) : "—",
        note: item.note || "Da confermare",
        historyIndex
      });
    });

    return list;
  };

  const getSuggestedRenewalDates = (employee: Employee) => {
    const history = getContractHistory(employee);
    const lastEnd = history.length > 0 ? history[history.length - 1].endDate : employee.contractEnd;

    if (!lastEnd) return { startDate: "", endDate: "" };

    const nextStart = new Date(lastEnd);
    if (isNaN(nextStart.getTime())) return { startDate: "", endDate: "" };

    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setFullYear(nextStart.getFullYear() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);

    return {
      startDate: formatDateInput(nextStart),
      endDate: formatDateInput(nextEnd)
    };
  };

  const openRenewalForm = () => {
    if (!editForm) return;
    const suggested = getSuggestedRenewalDates(editForm);
    setRenewalDraft({
      startDate: suggested.startDate,
      endDate: suggested.endDate,
      note: "Da confermare"
    });
    setShowRenewalForm(true);
    setErrorMsg("");
  };

  const planContractRenewal = () => {
    if (!editForm) return;
    if (!renewalDraft.startDate || !renewalDraft.endDate) {
      setErrorMsg("Inserisci data inizio e data fine del rinnovo.");
      return;
    }

    const nextStart = new Date(renewalDraft.startDate);
    const nextEnd = new Date(renewalDraft.endDate);
    if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime())) {
      setErrorMsg("Le date del rinnovo non sono valide.");
      return;
    }

    if (nextEnd < nextStart) {
      setErrorMsg("La data fine rinnovo deve essere successiva alla data inizio.");
      return;
    }

    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contractHistory: [
          ...getContractHistory(prev),
          {
            tipo: "Rinnovo",
            startDate: renewalDraft.startDate,
            endDate: renewalDraft.endDate,
            status: "Pianificato",
            renewedAt: "",
            note: renewalDraft.note.trim() || "Da confermare"
          }
        ]
      };
    });
    setShowRenewalForm(false);
    setRenewalDraft({ startDate: "", endDate: "", note: "" });
    setErrorMsg("");
  };

  const deleteContractRenewal = (historyIndex: number) => {
    const confirmed = window.confirm("Vuoi eliminare questo rinnovo pianificato?");
    if (!confirmed) return;

    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contractHistory: getContractHistory(prev).filter((_, index) => index !== historyIndex)
      };
    });
  };

  const renderFullscreenEditor = () => {
    if (!editForm) return null;

    const contracts = buildContractsList(editForm.contractStart, editForm.contractEnd, getContractHistory(editForm));

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
      { key: "foto", label: "Foto", val: "/foto" },
    ];

    const copyPhotoUrl = () => {
      if (editForm.photoUrl) {
        navigator.clipboard.writeText(editForm.photoUrl);
        setCopiedPhotoUrl(true);
        setTimeout(() => setCopiedPhotoUrl(false), 2000);
      }
    };

    return (
      <div className="staff-profile-editor w-full bg-transparent min-h-screen text-[#171717] pb-12 animate-in fade-in duration-200">
        <style dangerouslySetInnerHTML={{__html: `
          .staff-directory-editor-open main > header {
            display: none !important;
          }
          .staff-directory-editor-open main > div:first-child {
            margin-bottom: 0.25rem !important;
          }
          .staff-directory-editor-open main {
            padding-top: 0 !important;
          }
          .staff-directory-editor-open .staff-profile-editor {
            background: transparent !important;
          }
        `}} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setSelectedEmployee(null);
              resetRenewalForm();
            }}
            className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-black transition duration-200"
          >
            <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-1" />
            Torna all'elenco
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-3 w-full min-w-0 overflow-hidden">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-[#F4E3EA] p-4 sm:p-6 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 min-w-0 w-full">
              <div className="relative size-24 sm:size-28 rounded-[24px] overflow-hidden border-2 border-[#e6dcd4] bg-neutral-100 flex items-center justify-center text-3xl font-black text-neutral-800 shadow-md group shrink-0">
                {editForm.photoUrl ? (
                  <img src={resolveDrivePhotoUrl(editForm.photoUrl)} alt={editForm.name} className="size-full object-cover" />
                ) : (
                  editForm.name.slice(0, 2).toUpperCase()
                )}
                <label className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer text-center px-1">
                  <span>{photoUploadingId === editForm.id ? "Carico..." : "Carica foto"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoUploadingId === editForm.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleStaffPhotoUpload(editForm.id, file);
                    }}
                  />
                </label>
              </div>

              <div className="min-w-0 w-full">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 break-words">{editForm.name}</h1>
                <p className="text-xs sm:text-sm font-semibold text-neutral-400 mt-1 capitalize">{editForm.mansione || "Nessun ruolo"}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 items-center mt-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow-sm",
                    editForm.active ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                  )}>
                    <span className={cn("size-2 rounded-full", editForm.active ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                    {editForm.active ? "Attivo" : "Disattivato"}
                  </span>
                  <span className="bg-neutral-50 text-neutral-600 border border-neutral-200 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider max-w-full truncate">
                    CF: {editForm.fiscalCode || "Non inserito"}
                  </span>
                  <span className="bg-neutral-50 text-neutral-600 border border-neutral-200 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1 max-w-full">
                    <MapPin className="size-3 text-red-500 shrink-0" />
                    <span className="truncate">{editForm.location}</span>
                  </span>
                </div>
                <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 w-full">
                  {[
                    { label: "WhatsApp", value: editForm.whatsappPhone || "Non inserito" },
                    { label: "Data nascita", value: editForm.birthDate ? formatContractDate(editForm.birthDate) : "Non inserita" },
                    { label: "Codice fiscale", value: editForm.fiscalCode || "Non inserito" },
                    { label: "IBAN", value: editForm.iban || "Non inserito" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-black/5 bg-white/65 px-3 py-2 shadow-sm min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-400">{item.label}</p>
                      <p className="mt-1 truncate text-xs font-extrabold text-neutral-700" title={item.value}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {editForm.lastEditedByName && (
                  <p className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold mt-2.5 italic truncate">
                    Ultima modifica: <span className="font-extrabold">{editForm.lastEditedByName}</span> ({new Date(editForm.lastEditedAt!).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })})
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full shrink-0">
              {[
                { title: "Lavori", count: stats?.jobs.count ?? 0, growth: stats?.jobs.growth ?? 0, unit: "" },
                { title: "Ore", count: stats?.hours.count ?? 0, growth: stats?.hours.growth ?? 0, unit: "h" },
                { title: "Turni", count: stats?.shifts.count ?? 0, growth: stats?.shifts.growth ?? 0, unit: "" },
              ].map((card, idx) => (
                <div key={idx} className="bg-[#FAF7F6] border border-[#F4E3EA] p-2.5 sm:p-3 rounded-[20px] shadow-2xs flex flex-col justify-between min-h-[85px] min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400 leading-tight truncate">{card.title}</p>
                  {loadingStats ? (
                    <div className="h-5 w-12 bg-neutral-200 animate-pulse rounded-md mt-2" />
                  ) : (
                    <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1.5 min-w-0">
                      <span className="text-base sm:text-xl font-black tracking-tight text-[#1F1F1F] truncate">{card.count.toLocaleString("it-IT")}{card.unit}</span>
                      <span className={cn(
                        "text-[8px] sm:text-[9px] font-extrabold rounded-full px-1.5 py-0.5 shrink-0",
                        card.growth >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      )}>
                        {card.growth >= 0 ? `+${card.growth}%` : `${card.growth}%`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-6 w-full min-w-0 overflow-hidden">
          <form onSubmit={handleSaveEmployee} className="space-y-6">
            {errorMsg && (
              <div className="p-4 text-sm font-semibold text-rose-800 bg-rose-50 rounded-2xl border border-rose-200 animate-in fade-in">
                {errorMsg}
              </div>
            )}

            {/* 1. Malattie prima del profilo personale */}
            <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                    <HeartPulse className="size-4" />
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Malattie Anno Corrente</h2>
                </div>
                <Badge tone={(editForm.sicknessStats?.unjustifiedDays ?? 0) > 0 ? "pink" : "green"}>
                  {(editForm.sicknessStats?.unjustifiedDays ?? 0) > 0 ? "Da controllare" : "Ok"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/5 bg-[#FAF7F6] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/40">Totale Giorni</p>
                  <p className="mt-1 text-2xl font-black text-[#1F1F1F]">{editForm.sicknessStats?.totalDays ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700/70">Giustificate</p>
                  <p className="mt-1 text-2xl font-black text-emerald-800">{editForm.sicknessStats?.justifiedDays ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-700/70">Mancanti / Da verificare</p>
                  <p className="mt-1 text-2xl font-black text-rose-800">{editForm.sicknessStats?.unjustifiedDays ?? 0}</p>
                </div>
              </div>
            </div>

            {/* 2. Profilo Personale, Posizione Lavorativa, Account e Sicurezza */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                  <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                    <User className="size-4" />
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Profilo Personale</h2>
                </div>

                <div className="space-y-3.5 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome e cognome</span>
                    <Field
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Email di accesso</span>
                    <Field
                      required
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, email: e.target.value } : null)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">URL foto profilo</span>
                    <div className="relative">
                      <Field
                        value={editForm.photoUrl || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, photoUrl: e.target.value } : null)}
                        placeholder="https://..."
                        className="pr-12"
                      />
                      {editForm.photoUrl && (
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
                      value={editForm.whatsappPhone || ""}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, whatsappPhone: e.target.value } : null)}
                      placeholder="+39..."
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data di nascita</span>
                    <Field
                      type="date"
                      value={editForm.birthDate || ""}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, birthDate: e.target.value } : null)}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Codice fiscale</span>
                    <Field
                      value={editForm.fiscalCode || ""}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, fiscalCode: e.target.value.toUpperCase() } : null)}
                      placeholder="Codice fiscale..."
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">IBAN</span>
                    <Field
                      value={editForm.iban || ""}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, iban: e.target.value.toUpperCase() } : null)}
                      placeholder="IT..."
                    />
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                  <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                    <Briefcase className="size-4" />
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Posizione Lavorativa</h2>
                </div>

                <div className="space-y-3.5 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Mansione / Ruolo</span>
                    <Select
                      value={customMansioneEdit ? "custom" : (editForm.mansione || "").toLowerCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setCustomMansioneEdit(true);
                          setEditForm(prev => prev ? { ...prev, mansione: "" } : null);
                        } else {
                          setCustomMansioneEdit(false);
                          setEditForm(prev => prev ? { ...prev, mansione: val } : null);
                        }
                      }}
                    >
                      <option value="">Seleziona mansione...</option>
                      {mansioniList.map((m) => (
                        <option key={m} value={m.toLowerCase()}>{m}</option>
                      ))}
                      <option value="custom">+ Aggiungi altra mansione...</option>
                    </Select>
                    {customMansioneEdit && (
                      <Field
                        required
                        value={editForm.mansione || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, mansione: e.target.value } : null)}
                        placeholder="Inserisci nuova mansione..."
                        className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200"
                      />
                    )}
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Stato Dipendente</span>
                    <Select
                      value={editForm.employeeStatus}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, employeeStatus: e.target.value } : null)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Livello sistema</span>
                    <Select
                      value={editForm.role}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, role: e.target.value } : null)}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Salone sede</span>
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

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Responsabile diretto</span>
                    <Select
                      value={editForm.managerId || ""}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, managerId: e.target.value || null } : null)}
                    >
                      <option value="">Nessun manager</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Inizio contratto</span>
                      <Field
                        type="date"
                        value={editForm.contractStart || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, contractStart: e.target.value } : null)}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Fine contratto</span>
                      <Field
                        type="date"
                        value={editForm.contractEnd || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, contractEnd: e.target.value } : null)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                  <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                    <Shield className="size-4" />
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Account e Sicurezza</h2>
                </div>

                <div className="space-y-4 mt-4">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Stato account</span>
                    <Select
                      value={editForm.active ? "true" : "false"}
                      onChange={(e) => setEditForm(prev => prev ? { ...prev, active: e.target.value === "true" } : null)}
                    >
                      <option value="true">Attivo / Abilitato</option>
                      <option value="false">Disattivato / Bloccato</option>
                    </Select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#B85B68]">Cambia PIN (4-6 cifre)</span>
                    <Field
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Nuovo PIN"
                      maxLength={6}
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#B85B68]">Conferma PIN</span>
                    <Field
                      value={pinConfirmInput}
                      onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Conferma PIN"
                      maxLength={6}
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    Il PIN viene aggiornato quando premi Salva modifiche. Il reset password via email resta nascosto finche configuriamo il servizio email.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-col gap-3 border-b border-black/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                      <ClipboardList className="size-4" />
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Storico contratti e rinnovi</h2>
                  </div>
                  <button
                    type="button"
                    onClick={openRenewalForm}
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#FCE5F3] px-4 text-xs font-bold text-[#B83D7F] transition hover:bg-[#F9D4E8] active:scale-[0.98]"
                  >
                    <Plus className="size-4" />
                    Pianifica rinnovo
                  </button>
                </div>

                {showRenewalForm && (
                  <div className="mt-4 rounded-[22px] border border-[#F3B5D4] bg-[#FFF8FC] p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data inizio rinnovo</span>
                        <Field
                          type="date"
                          value={renewalDraft.startDate}
                          onChange={(e) => setRenewalDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data fine rinnovo</span>
                        <Field
                          type="date"
                          value={renewalDraft.endDate}
                          onChange={(e) => setRenewalDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Note</span>
                        <Field
                          value={renewalDraft.note}
                          onChange={(e) => setRenewalDraft((prev) => ({ ...prev, note: e.target.value }))}
                          placeholder="Da confermare"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetRenewalForm();
                          setErrorMsg("");
                        }}
                        className="inline-flex min-h-9 items-center justify-center rounded-2xl border border-black/10 bg-white px-4 text-xs font-bold text-neutral-600 transition hover:bg-black/[0.03]"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={planContractRenewal}
                        className="inline-flex min-h-9 items-center justify-center rounded-2xl bg-[#D96B94] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#C85982] active:scale-[0.98]"
                      >
                        Aggiungi rinnovo
                      </button>
                    </div>
                  </div>
                )}

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
                        <th className="py-2.5 text-right">Azioni</th>
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
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide",
                                c.stato === "Attivo" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                                c.stato === "Completato" && "bg-neutral-100 text-neutral-600",
                                c.stato === "Pianificato" && "bg-blue-50 text-blue-700 border border-blue-100"
                              )}>
                                {c.stato}
                              </span>
                            </td>
                            <td className="py-3 text-neutral-500">{c.rinnovatoIl}</td>
                            <td className="py-3 text-[#D96B94] font-bold">{c.scadenza}</td>
                            <td className="py-3 text-neutral-400 text-[11px] font-normal italic">{c.note}</td>
                            <td className="py-3 text-right">
                              {c.historyIndex !== undefined ? (
                                <button
                                  type="button"
                                  onClick={() => deleteContractRenewal(c.historyIndex!)}
                                  className="inline-flex size-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 active:scale-95"
                                  title="Elimina rinnovo"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-neutral-400 italic">
                            Nessuna data di contratto configurata per questo dipendente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-[#F4E3EA] p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                  <div className="grid size-9 place-items-center rounded-full bg-[#FCE5F3] text-[#D96B94]">
                    <SlidersHorizontal className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F1F1F]">Note HR (interne)</h2>
                    <p className="text-[10px] text-neutral-400 font-semibold">Visibili solo ad HR ed amministratori</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between mt-4">
                  <textarea
                    value={editForm.hrNotes || ""}
                    onChange={(e) => {
                      const text = e.target.value.slice(0, 1000);
                      setEditForm(prev => prev ? { ...prev, hrNotes: text } : null);
                    }}
                    placeholder="Scrivi qui la nota interna per l'amministrazione HR..."
                    rows={6}
                    className="w-full flex-1 rounded-2xl border border-black/10 bg-[#FAF7F6] p-3.5 text-sm outline-none transition focus:border-[#D96B94] resize-none font-medium text-[#1F1F1F]"
                  />
                  <div className="text-[10px] text-neutral-400 font-bold text-right mt-2">
                    {(editForm.hrNotes || "").length}/1000 caratteri
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-black/5">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setSelectedEmployee(null);
                  resetRenewalForm();
                }}
                className="rounded-2xl bg-[#F8EEF3] px-7 py-3 text-sm font-bold text-black/70 transition hover:bg-[#F2E0EA] active:scale-95"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-[#D96B94] px-8 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#C85982] active:scale-95 disabled:opacity-60"
              >
                {submitting ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (selectedEmployee && isEditing && editForm) {
    return renderFullscreenEditor();
  }

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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Link
              href="/recruitment"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm font-bold text-paradise-noir shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-neutral-900 dark:text-white"
            >
              <UserPlus className="size-4" /> Talent System
            </Link>
            <Button
              type="button"
              variant="soft"
              onClick={printStaffListPdf}
              className="min-h-11 shrink-0 rounded-2xl bg-white text-paradise-noir"
            >
              <Printer className="size-4" /> Stampa lista
            </Button>
            {isAuthorizedToEdit && (
              <Button
                type="button"
                variant="soft"
                onClick={handleSyncDrivePhotos}
                disabled={syncingDrivePhotos}
                className="min-h-11 shrink-0 rounded-2xl bg-white text-paradise-noir"
              >
                <RefreshCw className={cn("size-4", syncingDrivePhotos && "animate-spin")} />
                {syncingDrivePhotos ? "Importo..." : "Importa foto Drive"}
              </Button>
            )}
            <Button
              type="button"
              variant={archiveMode ? "dark" : "soft"}
              onClick={() => {
                setArchiveMode((current) => !current);
                setFilterStatus("");
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-2xl",
                archiveMode ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-white text-paradise-noir"
              )}
            >
              <Archive className="size-4" /> Archivio {archivedCount > 0 ? `(${archivedCount})` : ""}
            </Button>
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
                    accessList: [],
                    iban: ""
                  });
                  setCreationMessage("");
                  setErrorMsg("");
                  setPinInput("");
                  setPinConfirmInput("");
                  setPasswordInput("");
                }}
                className="bg-gradient-to-r from-paradise-pink via-paradise-softPink to-[#ffa8dd] text-paradise-noir shadow-soft hover:shadow-luxury transition-all duration-300 rounded-2xl min-h-11 shrink-0"
              >
                <Plus className="size-4" /> Nuovo Dipendente
              </Button>
            )}
          </div>
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

      {errorMsg && !selectedEmployee && (
        <div className="p-3.5 text-xs font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900">
          {errorMsg}
        </div>
      )}

      {archiveMode ? (
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500">Archivio staff</p>
              <h2 className="mt-1 text-lg font-black">Account bloccati ed ex dipendenti</h2>
              <p className="mt-1 text-xs opacity-75">Qui trovi solo profili disattivati o segnati come ex dipendente.</p>
            </div>
            <Button type="button" variant="soft" onClick={() => setArchiveMode(false)} className="bg-white">
              Torna allo staff attivo
            </Button>
          </div>
        </div>
      ) : null}

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
                setIsEditing(true);
                setEditForm({ ...emp });
                resetRenewalForm();
                setPinInput("");
                setPinConfirmInput("");
                setPasswordInput("");
                setErrorMsg("");
                const isCustom = emp.mansione && 
                  !mansioniList.map(m => m.toLowerCase()).includes(emp.mansione.toLowerCase());
                setCustomMansioneEdit(Boolean(isCustom));
              }}
              className="group p-5 cursor-pointer flex flex-col justify-between border-black/5 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-luxury hover:-translate-y-1 transition-all duration-300"
            >
              <div className="space-y-4">
                {/* Photo & Basic header */}
                <div className="flex items-center gap-4">
                  <div className="relative size-14 rounded-2xl overflow-hidden border border-black/5 bg-paradise-softPink/20 shrink-0 shadow-sm flex items-center justify-center font-bold text-lg text-paradise-noir">
                    {emp.photoUrl ? (
                      <img src={resolveDrivePhotoUrl(emp.photoUrl)} alt={emp.name} className="size-full object-cover" />
                    ) : (
                      emp.name.slice(0, 2).toUpperCase()
                    )}
                    {isAuthorizedToEdit && (
                      <label
                        className="absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center rounded-lg bg-black/65 px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-white opacity-0 transition group-hover:opacity-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {photoUploadingId === emp.id ? "..." : "Foto"}
                        <input
                          type="file"
                          accept="image/*,.heic,.heif"
                          className="hidden"
                          disabled={photoUploadingId === emp.id}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            void handleStaffPhotoUpload(emp.id, file);
                          }}
                        />
                      </label>
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
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-3.5 text-neutral-400" />
                    <span>CF: <strong className="text-neutral-700 dark:text-neutral-200">{emp.fiscalCode || "Non inserito"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-neutral-400" />
                    <span>Nascita: <strong className="text-neutral-700 dark:text-neutral-200">{emp.birthDate ? formatContractDate(emp.birthDate) : "Non inserita"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-3.5 text-neutral-400" />
                    <span>IBAN: <strong className="text-neutral-700 dark:text-neutral-200">{emp.iban || "Non inserito"}</strong></span>
                  </div>
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
                          {ACCESS_LABELS[access] || access}
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
                  <Select 
                    value={customMansioneCreate ? "custom" : (newEmployeeForm.mansione || "").toLowerCase()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setCustomMansioneCreate(true);
                        setNewEmployeeForm(prev => prev ? { ...prev, mansione: "" } : null);
                      } else {
                        setCustomMansioneCreate(false);
                        setNewEmployeeForm(prev => prev ? { ...prev, mansione: val } : null);
                      }
                    }}
                  >
                    <option value="">Seleziona mansione...</option>
                    {mansioniList.map((m) => (
                      <option key={m} value={m.toLowerCase()}>{m}</option>
                    ))}
                    <option value="custom">+ Aggiungi altra mansione...</option>
                  </Select>
                  {customMansioneCreate && (
                    <Field 
                      required
                      value={newEmployeeForm.mansione || ""}
                      onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, mansione: e.target.value } : null)}
                      placeholder="Inserisci nuova mansione..."
                      className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200"
                    />
                  )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">Codice</span>
                  <Field 
                    value={newEmployeeForm.fiscalCode || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, fiscalCode: e.target.value } : null)}
                    placeholder="Codice..."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">IBAN</span>
                  <Field 
                    value={newEmployeeForm.iban || ""}
                    onChange={(e) => setNewEmployeeForm(prev => prev ? { ...prev, iban: e.target.value.toUpperCase() } : null)}
                    placeholder="IT..."
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-black/5 dark:border-white/5 pt-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-[#B85B68]">PIN Personalizzato (4-6 cifre)</span>
                  <Field 
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Lascia vuoto per generare casuale"
                    maxLength={6}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-[#B85B68]">Conferma PIN</span>
                  <Field 
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Ripeti PIN"
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
                    const active = Array.isArray(newEmployeeForm.accessList) ? newEmployeeForm.accessList.includes(access) : false;
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
                        {ACCESS_LABELS[access] || access}
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
