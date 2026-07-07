"use client";

import React, { useState, useEffect, useTransition } from "react";
import { ShieldAlert, ShieldCheck, UserCheck, Users, Settings, Edit, Loader2, Search, FolderPlus, ArrowUp, ArrowDown, Plus, Trash2, Folder, X, Menu, ChevronRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";

type UserType = {
  id: string;
  name: string;
  email: string;
  role: string;
  mansione: string | null;
  photo_url: string | null;
  location: { name: string } | null;
  access_list: any;
};

type RolesSettingsClientProps = {
  users: UserType[];
  currentUser: {
    id: string;
    role: string;
    name?: string | null;
  };
};

import { routePermissions } from "@/lib/roles";

const ROUTE_LABELS: Record<string, { name: string; description: string }> = {
  "/dashboard": { name: "Dashboard Principale", description: "Bacheca iniziale con timbrature e avvisi." },
  "/my-shifts": { name: "I Miei Turni", description: "Visualizzazione dei propri turni personali." },
  "/tasks": { name: "Task & Compiti", description: "Lista dei compiti assegnati e commenti." },
  "/employees": { name: "Gestione Dipendenti", description: "Anagrafica completa e dati dello staff." },
  "/attendance": { name: "Registro Presenze", description: "Log di entrata/uscita dei dipendenti." },
  "/work-hours": { name: "Ore Lavorate", description: "Riepilogo ore ordinarie e straordinarie." },
  "/schedules": { name: "Turni Saloni", description: "Pianificazione oraria settimanale dello staff." },
  "/social-calendar": { name: "Calendario Social", description: "Pianificazione post e upload foto social." },
  "/locations": { name: "Gestione Saloni", description: "Anagrafica dei saloni Paradise." },
  "/tablet-clock": { name: "Timbratrice Tablet", description: "Accesso all'interfaccia timbrature per tablet salone." },
  "/requests": { name: "Ferie & Permessi", description: "Richieste di congedo e approvazioni." },
  "/documents": { name: "Buste Paga & Cedolini", description: "Archivio cedolini e documenti personali." },
  "/service-notes": { name: "Note di Servizio", description: "Diario interno delle annotazioni operative." },
  "/service-forms": { name: "Moduli Operativi", description: "Compilazione dei moduli tecnici dei servizi." },
  "/tables": { name: "Tabelle Listini", description: "Visualizzazione tabelle listini e prezzi." },
  "/orders": { name: "Ordini (Kanban)", description: "Pipeline ordini per acquisto extension, conversioni e accessori." },
  "/appointments": { name: "Gestione Appuntamenti", description: "Planning e prenotazioni dei clienti." },
  "/cash": { name: "Cassa & Chiusure", description: "Chiusure di cassa e monitoraggio cassaforte." },
  "/invoices": { name: "Richieste Fatture", description: "Registro richieste ed export per commercialista." },
  "/refunds": { name: "Rimborsi", description: "Gestione note di credito e rimborsi." },
  "/client-control": { name: "Controllo Clienti", description: "Tablet clienti in salone per recensioni e dati." },
  "/recruitment": { name: "HR Recruitment", description: "Candidature e colloqui di assunzione." },
  "/staff": { name: "Organigramma Staff", description: "Mappa visuale delle posizioni e ruoli." },
  "/team": { name: "Elenco Team", description: "Lista dei membri del team Paradise." },
  "/notifications": { name: "Centro Notifiche", description: "Storico degli avvisi e delle comunicazioni." },
  "/profile": { name: "Profilo Personale", description: "Dati personali, password e preferenze grafiche." },
  "/settings": { name: "Impostazioni Generali", description: "Pannello principale di configurazione hub." },
  "/settings/branding": { name: "Brand & Loghi", description: "Personalizzazione loghi, colori e testi dell'app." },
  "/settings/devices": { name: "Configura Timbratrici", description: "Associazione e attivazione tablet salone." },
  "/settings/google-sheet": { name: "Integrazione Fogli Google", description: "Collegamento fogli drive per i dati." },
  "/settings/email": { name: "Configura Email", description: "Impostazioni server SMTP per notifiche." },
  "/settings/roles": { name: "Sicurezza Ruoli & Permessi", description: "Gestione dei ruoli dipendenti e accessi pagine." },
  "/settings/tasks": { name: "Configura Categorie Task", description: "Impostazione categorie compiti di staff." },
  "/settings/tables": { name: "Configura Tabelle Listini", description: "Permessi di scrittura tabelle listini." },
  "/settings/planning": { name: "Configura Planning", description: "Accesso e orari agende appuntamenti." },
  "/settings/services": { name: "Gestione Servizi", description: "Configurazione dei trattamenti e durata." },
  "/settings/forms": { name: "Gestione Moduli Operativi", description: "Creazione e modifica dei campi dei moduli." }
};

const APP_PAGES_MATRIX = Object.entries(routePermissions).map(([path, viewRoles]) => {
  const meta = ROUTE_LABELS[path] || { 
    name: path.split("/").filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" > "), 
    description: "Configurazione e modulo di sistema." 
  };
  
  let editRoles = ["SUPER_ADMIN", "ADMIN"];
  let exceptionsEdit = "";
  if (path === "/social-calendar") {
    editRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
  } else if (path === "/orders") {
    editRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
    exceptionsEdit = "Jessinca Inturri, Biy Darwin Ramirez Castillo";
  } else if (path === "/requests") {
    exceptionsEdit = "I dipendenti possono creare o annullare le proprie richieste.";
  } else if (path === "/recruitment") {
    editRoles = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
  } else if (path.startsWith("/settings")) {
    editRoles = ["SUPER_ADMIN"];
    if (path === "/settings/tables" || path === "/settings/planning" || path === "/settings/forms") {
      editRoles = ["SUPER_ADMIN", "ADMIN"];
    }
  }

  let exceptions = "Nessuna eccezione";
  if (path === "/orders") {
    exceptions = "Tutti i dipendenti (incluse le sarte) vedono tutti gli ordini.";
  } else if (path === "/schedules") {
    exceptions = "Tutti i dipendenti possono vedere i turni propri e dei colleghi.";
  } else if (path === "/requests") {
    exceptions = "I dipendenti vedono solo le proprie richieste.";
  } else if (path === "/documents") {
    exceptions = "I dipendenti vedono solo i propri cedolini.";
  } else if (path === "/appointments") {
    exceptions = "I dipendenti con mansione 'assistenza' possono visualizzare.";
  }

  return {
    path,
    name: meta.name,
    description: meta.description,
    viewRoles,
    exceptions,
    editRoles,
    exceptionsEdit
  };
});

const ROUTE_GROUPS = [
  {
    title: "Area Operativa & Personale",
    routes: [
      "/dashboard",
      "/my-shifts",
      "/tasks",
      "/schedules",
      "/social-calendar",
      "/requests",
      "/documents",
      "/service-notes",
      "/service-forms",
      "/tables",
      "/orders",
      "/appointments",
      "/profile",
      "/notifications"
    ]
  },
  {
    title: "Area Amministrazione & Cassa",
    routes: [
      "/employees",
      "/attendance",
      "/work-hours",
      "/locations",
      "/tablet-clock",
      "/cash",
      "/invoices",
      "/refunds",
      "/client-control",
      "/recruitment",
      "/staff",
      "/team"
    ]
  },
  {
    title: "Area Impostazioni & Configurazione",
    routes: [
      "/settings",
      "/settings/branding",
      "/settings/devices",
      "/settings/google-sheet",
      "/settings/email",
      "/settings/roles",
      "/settings/tasks",
      "/settings/tables",
      "/settings/planning",
      "/settings/services",
      "/settings/forms"
    ]
  }
];

export function RolesSettingsClient({ users: initialUsers, currentUser }: RolesSettingsClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [activeTab, setActiveTab] = useState<"matrix" | "users" | "mansioni" | "sidebar">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track updates
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingMansioneId, setEditingMansioneId] = useState<string | null>(null);
  const [mansioneInput, setMansioneInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Mansioni state
  const [mansioni, setMansioni] = useState<Record<string, string[]>>({});
  const [newMansioneName, setNewMansioneName] = useState("");
  const [expandedMansione, setExpandedMansione] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<string>("DIPENDENTE");

  const getPreviewAccessList = (target: string): string[] => {
    if (["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"].includes(target)) {
      return APP_PAGES_MATRIX.filter(p => p.viewRoles.includes(target as any)).map(p => p.path);
    }
    const mName = target.toLowerCase();
    return mansioni[mName] || [];
  };

  const getPreviewEditAccessList = (target: string): string[] => {
    if (["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"].includes(target)) {
      return APP_PAGES_MATRIX.filter(p => p.editRoles.includes(target as any)).map(p => p.path);
    }
    return APP_PAGES_MATRIX.filter(p => p.editRoles.includes("DIPENDENTE")).map(p => p.path);
  };

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Sidebar custom layout state
  const [sidebarLayout, setSidebarLayout] = useState<Array<{ id: string; title: string; routes: string[] }>>([]);
  const [newFolderName, setNewFolderName] = useState("");

  React.useEffect(() => {
    // Fetch mansioni
    fetch("/api/settings/roles/mansioni")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMansioni(data.mansioni || {});
        }
      });

    // Fetch sidebar layout
    fetch("/api/settings/roles/menu-layout")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.layout) {
          setSidebarLayout(data.layout);
        } else {
          setSidebarLayout([
            { id: "sec-generale", title: "Generale", routes: ["/dashboard", "/my-shifts", "/tasks", "/notifications"] },
            { id: "sec-planning", title: "Planning & Saloni", routes: ["/schedules", "/social-calendar", "/locations", "/orders", "/appointments", "/cash", "/invoices", "/refunds", "/client-control", "/tables", "/tablet-clock", "/settings/forms", "/service-forms"] },
            { id: "sec-staff", title: "Gestione Staff", routes: ["/staff", "/recruitment", "/attendance", "/work-hours", "/requests", "/documents", "/team"] },
            { id: "sec-impostazioni", title: "Impostazioni", routes: ["/profile", "/settings"] }
          ]);
        }
      });
  }, []);

  const handleCreateMansione = async () => {
    const cleanName = newMansioneName.trim().toLowerCase();
    if (!cleanName) return;
    if (mansioni[cleanName]) {
      showMessage("Questa mansione esiste già.", "error");
      return;
    }

    try {
      const res = await fetch("/api/settings/roles/mansioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", mansioneName: cleanName, accessList: [] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile creare la mansione.");
      setMansioni(data.mansioni);
      setNewMansioneName("");
      showMessage(`Mansione "${cleanName}" creata con successo!`, "success");
    } catch (err: any) {
      showMessage(err.message || "Errore durante la creazione.", "error");
    }
  };

  const handleToggleMansioneAccess = async (mansioneName: string, path: string, isChecked: boolean) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono modificare i permessi delle mansioni.", "error");
      return;
    }

    let newList = [...(mansioni[mansioneName] || [])];
    if (isChecked) {
      if (!newList.includes(path)) newList.push(path);
    } else {
      newList = newList.filter(p => p !== path);
    }

    try {
      const res = await fetch("/api/settings/roles/mansioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", mansioneName, accessList: newList })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile salvare i permessi.");
      setMansioni(data.mansioni);
      showMessage(`Permessi per la mansione "${mansioneName}" aggiornati!`, "success");
    } catch (err: any) {
      showMessage(err.message || "Errore durante l'aggiornamento.", "error");
    }
  };

  const handleDeleteMansione = async (mansioneName: string) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono eliminare le mansioni.", "error");
      return;
    }

    if (!confirm(`Sei sicuro di voler eliminare la mansione "${mansioneName}"?`)) return;
    try {
      const res = await fetch("/api/settings/roles/mansioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", mansioneName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile eliminare la mansione.");
      setMansioni(data.mansioni);
      showMessage(`Mansione "${mansioneName}" eliminata con successo!`, "success");
    } catch (err: any) {
      showMessage(err.message || "Errore durante l'eliminazione.", "error");
    }
  };

  const handleCreateFolder = () => {
    const title = newFolderName.trim();
    if (!title) return;
    const id = `folder-${Date.now()}`;
    const newLayout = [...sidebarLayout, { id, title, routes: [] }];
    setSidebarLayout(newLayout);
    setNewFolderName("");
    saveSidebarLayout(newLayout);
  };

  const handleDeleteFolder = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa cartella? I tasti al suo interno verranno spostati tra le pagine non assegnate.")) return;
    const newLayout = sidebarLayout.filter(f => f.id !== id);
    setSidebarLayout(newLayout);
    saveSidebarLayout(newLayout);
  };

  const handleMoveRouteToFolder = (route: string, folderId: string) => {
    const newLayout = sidebarLayout.map(f => {
      let routes = f.routes.filter(r => r !== route);
      if (f.id === folderId) {
        routes.push(route);
      }
      return { ...f, routes };
    });
    setSidebarLayout(newLayout);
    saveSidebarLayout(newLayout);
  };

  const handleRemoveRouteFromFolder = (route: string, folderId: string) => {
    const newLayout = sidebarLayout.map(f => {
      if (f.id === folderId) {
        return { ...f, routes: f.routes.filter(r => r !== route) };
      }
      return f;
    });
    setSidebarLayout(newLayout);
    saveSidebarLayout(newLayout);
  };

  const handleMoveFolder = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sidebarLayout.length) return;
    const newLayout = [...sidebarLayout];
    const temp = newLayout[index];
    newLayout[index] = newLayout[targetIndex];
    newLayout[targetIndex] = temp;
    setSidebarLayout(newLayout);
    saveSidebarLayout(newLayout);
  };

  const handleMoveRouteInFolder = (folderId: string, routeIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? routeIndex - 1 : routeIndex + 1;
    const folder = sidebarLayout.find(f => f.id === folderId);
    if (!folder || targetIndex < 0 || targetIndex >= folder.routes.length) return;
    
    const newLayout = sidebarLayout.map(f => {
      if (f.id === folderId) {
        const newRoutes = [...f.routes];
        const temp = newRoutes[routeIndex];
        newRoutes[routeIndex] = newRoutes[targetIndex];
        newRoutes[targetIndex] = temp;
        return { ...f, routes: newRoutes };
      }
      return f;
    });
    setSidebarLayout(newLayout);
    saveSidebarLayout(newLayout);
  };

  const saveSidebarLayout = async (layout: any) => {
    try {
      const res = await fetch("/api/settings/roles/menu-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Impossibile salvare il layout.");
      }
      showMessage("Layout del menu salvato con successo!", "success");
    } catch (err: any) {
      showMessage(err.message || "Errore durante il salvataggio del layout.", "error");
    }
  };

  const handleTogglePageAccess = async (userId: string, path: string, isChecked: boolean, currentList: string[] | null) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono modificare i permessi delle pagine.", "error");
      return;
    }

    let newList: string[] = [];
    if (Array.isArray(currentList)) {
      newList = [...currentList];
    } else {
      const userObj = users.find(u => u.id === userId);
      const defaultPages = APP_PAGES_MATRIX.filter(p => p.viewRoles.includes(userObj?.role || "DIPENDENTE")).map(p => p.path);
      newList = defaultPages;
    }

    if (isChecked) {
      if (!newList.includes(path)) newList.push(path);
    } else {
      newList = newList.filter(p => p !== path);
    }

    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accessList: newList }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile aggiornare la lista accessi.");

      setUsers(current =>
        current.map(u => (u.id === userId ? { ...u, access_list: newList } : u))
      );
      showMessage(`Permessi di ${data.user.name} aggiornati con successo!`, "success");
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || "Errore durante l'aggiornamento.", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleResetToDefault = async (userId: string) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono modificare i permessi delle pagine.", "error");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accessList: null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile ripristinare i permessi.");

      setUsers(current =>
        current.map(u => (u.id === userId ? { ...u, access_list: null } : u))
      );
      showMessage(`Permessi di ${data.user.name} ripristinati al default del ruolo!`, "success");
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || "Errore durante il ripristino.", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono modificare i ruoli degli utenti.", "error");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile aggiornare il ruolo.");

      setUsers(current =>
        current.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showMessage(`Ruolo di ${data.user.name} aggiornato a ${newRole}!`, "success");
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || "Errore durante l'aggiornamento.", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleMansioneSave = async (userId: string) => {
    if (!isSuperAdmin) {
      showMessage("Solo i Super Admin possono modificare le mansioni.", "error");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mansione: mansioneInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile aggiornare la mansione.");

      setUsers(current =>
        current.map(u => (u.id === userId ? { ...u, mansione: mansioneInput } : u))
      );
      setEditingMansioneId(null);
      showMessage(`Mansione di ${data.user.name} aggiornata a "${mansioneInput}"!`, "success");
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || "Errore durante l'aggiornamento.", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.mansione || "").toLowerCase().includes(query) ||
      (u.location?.name || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert Box */}
      {message && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            message.type === "success" ? "bg-emerald-600 shadow-emerald-600/10" : "bg-rose-600 shadow-rose-600/10"
          }`}
        >
          <ShieldCheck className="size-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Premium Tab Selector */}
      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "matrix" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Settings className="size-3.5" />
          Matrice Pagine e Permessi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "users" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="size-3.5" />
          Gestione Ruoli Staff ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mansioni")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "mansioni" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <UserCheck className="size-3.5" />
          Gestione Mansioni ({Object.keys(mansioni).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sidebar")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
            activeTab === "sidebar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Menu className="size-3.5" />
          Organizzazione Menu
        </button>
      </div>

      {activeTab === "matrix" ? (
        <Card className="overflow-hidden border-slate-100 p-0 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Pagina / Sezione</th>
                  <th className="px-6 py-4">Descrizione</th>
                  <th className="px-6 py-4">Visualizzazione Generale</th>
                  <th className="px-6 py-4">Eccezioni Persone (Lettura)</th>
                  <th className="px-6 py-4">Modifiche & Scrittura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {APP_PAGES_MATRIX.map((page) => (
                  <tr key={page.path} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{page.name}</p>
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{page.path}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-slate-500 max-w-xs leading-normal">
                      {page.description}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {page.viewRoles.map((role) => (
                          <Badge key={role} tone="gold" className="text-[9px] py-0 px-2 font-extrabold uppercase">
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-slate-500 max-w-[200px] leading-normal italic">
                      {page.exceptions}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1 items-center">
                        {page.editRoles.map((role) => (
                          <Badge key={role} tone="pink" className="text-[9px] py-0 px-2 font-extrabold uppercase">
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                      {page.exceptionsEdit && (
                        <p className="text-[10px] text-slate-400 mt-1.5 italic leading-tight">
                          Eccez.: {page.exceptionsEdit}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex max-w-md items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca dipendente per nome, mansione, sede..."
              className="w-full bg-transparent text-xs font-semibold outline-none text-slate-800"
            />
          </div>

          <Card className="overflow-hidden border-slate-100 p-0 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Foto & Nome</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Sede Salone</th>
                    <th className="px-6 py-4">Mansione</th>
                    <th className="px-6 py-4">Permessi Pagine</th>
                    <th className="px-6 py-4">Ruolo System</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-bold">
                        Nessun dipendente trovato.
                      </td>
                    </tr>
                  ) : null}
                  {filteredUsers.map((user) => {
                    const isEditingMansione = editingMansioneId === user.id;
                    const isUpdating = updatingUserId === user.id;
                    const isExpanded = expandedUserId === user.id;
                    const hasCustomAccess = Array.isArray(user.access_list);
                    const customPagesCount = hasCustomAccess ? user.access_list.length : 0;

                    return (
                      <React.Fragment key={user.id}>
                        <tr className="hover:bg-slate-50/30 transition">
                          {/* Profile Photo & Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {user.photo_url ? (
                                <img src={user.photo_url} alt={user.name} className="size-9 rounded-full object-cover border border-slate-100" />
                              ) : (
                                <div className="grid size-9 place-items-center rounded-full bg-[#FAF7F9] font-black text-[#C66170] border border-pink-100">
                                  {(user.name || "S").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {user.id.substring(0, 8)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4 text-slate-600 font-mono">
                            {user.email}
                          </td>

                          {/* Sede / Salon */}
                          <td className="px-6 py-4 text-slate-600 font-bold">
                            {user.location?.name || <span className="text-slate-400 font-medium italic">Sede centrale</span>}
                          </td>

                          {/* Mansione (Editable) */}
                          <td className="px-6 py-4">
                            {isEditingMansione ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={mansioneInput.toLowerCase()}
                                  onChange={(e) => setMansioneInput(e.target.value)}
                                  className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold outline-none focus:border-[#A74758] focus:bg-white bg-slate-50 transition"
                                >
                                  <option value="">Nessuna</option>
                                  {Object.keys(mansioni).map((mKey) => (
                                    <option key={mKey} value={mKey}>
                                      {mKey.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleMansioneSave(user.id)}
                                  disabled={isUpdating}
                                  className="h-8 rounded-lg bg-emerald-600 text-white px-2.5 font-bold hover:bg-emerald-700 transition"
                                >
                                  Salva
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMansioneId(null)}
                                  className="h-8 rounded-lg bg-slate-200 text-slate-600 px-2.5 font-bold hover:bg-slate-300 transition"
                                >
                                  Annulla
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 capitalize">
                                  {user.mansione || <span className="text-slate-400 font-medium italic">Nessuna</span>}
                                </span>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMansioneId(user.id);
                                      setMansioneInput(user.mansione || "");
                                    }}
                                    className="text-slate-400 hover:text-slate-600 transition"
                                  >
                                    <Edit className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Custom Page Permissions Selector Toggle */}
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                                hasCustomAccess
                                  ? "bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100"
                                  : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {hasCustomAccess ? `${customPagesCount} Pagine Abilitate` : "Default (Ruolo)"}
                            </button>
                          </td>

                          {/* Role Selector */}
                          <td className="px-6 py-4">
                            {isUpdating ? (
                              <div className="flex items-center gap-1 text-slate-500 font-bold">
                                <Loader2 className="size-3.5 animate-spin" />
                                Aggiornamento...
                              </div>
                            ) : (
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                disabled={!isSuperAdmin}
                                className="appearance-none bg-black/5 border border-black/10 text-slate-800 text-xs font-black rounded-xl pl-3 pr-8 py-1.5 outline-none cursor-pointer hover:bg-black/10 transition disabled:opacity-75 disabled:cursor-not-allowed"
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23475569' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                                  backgroundPosition: "right 0.5rem center",
                                  backgroundSize: "0.8rem 0.8rem",
                                  backgroundRepeat: "no-repeat"
                                }}
                              >
                                <option value="SUPER_ADMIN">Super Admin</option>
                                <option value="ADMIN">Admin</option>
                                <option value="RESPONSABILE">Responsabile</option>
                                <option value="DIPENDENTE">Dipendente</option>
                              </select>
                            )}
                          </td>
                        </tr>

                        {/* Accordion content for dynamic page selection */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-8 py-6 border-t border-b border-slate-100">
                              <div className="space-y-4 max-w-4xl">
                                <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 pb-3">
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                      Personalizza Accesso Pagine per {user.name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      {hasCustomAccess
                                        ? "Questo dipendente ha permessi personalizzati. Seleziona esattamente quali pagine può visualizzare."
                                        : "Attualmente eredita i permessi di default basati sul ruolo di sistema. Attiva la personalizzazione per selezionare le pagine singolarmente."}
                                    </p>
                                  </div>
                                  
                                  {isSuperAdmin && (
                                    hasCustomAccess ? (
                                      <button
                                        type="button"
                                        onClick={() => handleResetToDefault(user.id)}
                                        className="rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 text-[10px] uppercase tracking-wider transition"
                                      >
                                        Ripristina a Default (Ruolo)
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const defaultPages = APP_PAGES_MATRIX.filter(p => p.viewRoles.includes(user.role)).map(p => p.path);
                                          // Initialize custom access list with their role defaults
                                          fetch("/api/settings/roles/update-user", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ userId: user.id, accessList: defaultPages }),
                                          }).then(async (res) => {
                                            const data = await res.json();
                                            if (res.ok) {
                                              setUsers(curr => curr.map(u => u.id === user.id ? { ...u, access_list: defaultPages } : u));
                                              showMessage(`Personalizzazione abilitata per ${data.user.name}!`, "success");
                                            }
                                          });
                                        }}
                                        className="rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 text-[10px] uppercase tracking-wider transition"
                                      >
                                        Attiva Permessi Personalizzati
                                      </button>
                                    )
                                  )}
                                </div>

                                {hasCustomAccess && (
                                  <div className="space-y-6 pt-2">
                                    {ROUTE_GROUPS.map((group) => {
                                      const groupPages = APP_PAGES_MATRIX.filter(p => group.routes.includes(p.path));
                                      if (groupPages.length === 0) return null;

                                      return (
                                        <div key={group.title} className="space-y-2.5">
                                          <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest border-l-2 border-[#C66170] pl-2">
                                            {group.title}
                                          </h5>
                                          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                                            {groupPages.map((page) => {
                                              const isChecked = user.access_list.includes(page.path);
                                              return (
                                                <label
                                                  key={page.path}
                                                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                                                    isChecked
                                                      ? "bg-white border-[#C66170]/30 shadow-sm"
                                                      : "bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100"
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={!isSuperAdmin}
                                                    onChange={(e) => handleTogglePageAccess(user.id, page.path, e.target.checked, user.access_list)}
                                                    className="mt-0.5 rounded border-slate-300 text-[#C66170] focus:ring-[#C66170] size-3.5 cursor-pointer disabled:cursor-not-allowed"
                                                  />
                                                  <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 text-xs leading-normal">{page.name}</p>
                                                    <p className="font-mono text-[9px] text-slate-400 mt-0.5">{page.path}</p>
                                                  </div>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "mansioni" && (
        <div className="space-y-6">
          {/* Create new mansione container */}
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Crea Nuova Mansione</h4>
                <p className="text-[10px] text-slate-500">Aggiungi una mansione per configurarne i permessi e assegnarla allo staff.</p>
              </div>
              <div className="flex gap-2 min-w-0 max-w-sm ml-auto">
                <input
                  type="text"
                  value={newMansioneName}
                  onChange={(e) => setNewMansioneName(e.target.value)}
                  placeholder="Nome mansione (es. sarta)"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#A74758] bg-slate-50 transition"
                />
                <button
                  type="button"
                  onClick={handleCreateMansione}
                  className="h-9 rounded-lg bg-[#A74758] hover:bg-[#8e3848] text-white px-4 text-xs font-black uppercase tracking-wider transition shrink-0"
                >
                  Crea
                </button>
              </div>
            </div>
          )}

          {/* List of mansioni */}
          <div className="grid gap-4">
            {Object.keys(mansioni).length === 0 ? (
              <Card className="p-8 text-center text-slate-400 font-bold text-xs bg-white border-slate-100">
                Nessuna mansione registrata. Crea una mansione in alto per iniziare.
              </Card>
            ) : null}

            {Object.entries(mansioni).map(([mName, mList]) => {
              const isMansioneExpanded = expandedMansione === mName;
              return (
                <Card key={mName} className="p-0 overflow-hidden border-slate-100 bg-white shadow-sm">
                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/20">
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-4 text-slate-400" />
                      <div>
                        <h3 className="font-black text-slate-950 text-sm uppercase tracking-wider">{mName}</h3>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {mList.length} Pagine Abilitate
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedMansione(isMansioneExpanded ? null : mName)}
                        className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 text-[10px] uppercase tracking-wider transition"
                      >
                        {isMansioneExpanded ? "Chiudi Permessi" : "Gestisci Permessi"}
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMansione(mName)}
                          className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 text-[10px] uppercase tracking-wider transition"
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accordion checkboxes */}
                  {isMansioneExpanded && (
                    <div className="p-5 bg-white space-y-6">
                      {ROUTE_GROUPS.map((group) => {
                        const groupPages = APP_PAGES_MATRIX.filter(p => group.routes.includes(p.path));
                        if (groupPages.length === 0) return null;

                        return (
                          <div key={group.title} className="space-y-2.5">
                            <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest border-l-2 border-[#C66170] pl-2">
                              {group.title}
                            </h5>
                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                              {groupPages.map((page) => {
                                const isChecked = mList.includes(page.path);
                                return (
                                  <label
                                    key={page.path}
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                                      isChecked
                                        ? "bg-white border-[#C66170]/30 shadow-sm"
                                        : "bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!isSuperAdmin}
                                      onChange={(e) => handleToggleMansioneAccess(mName, page.path, e.target.checked)}
                                      className="mt-0.5 rounded border-slate-300 text-[#C66170] focus:ring-[#C66170] size-3.5 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-800 text-xs leading-normal">{page.name}</p>
                                      <p className="font-mono text-[9px] text-slate-400 mt-0.5">{page.path}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "sidebar" && (
        <div className="space-y-6">
          {/* Create new folder container */}
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Crea Nuova Cartella Menu</h4>
                <p className="text-[10px] text-slate-500">Raggruppa i pulsanti all'interno di una cartella personalizzata nella barra laterale.</p>
              </div>
              <div className="flex gap-2 min-w-0 max-w-sm ml-auto">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome cartella (es. Area Tecnica)"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#A74758] bg-slate-50 transition"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="h-9 rounded-lg bg-[#A74758] hover:bg-[#8e3848] text-white px-4 text-xs font-black uppercase tracking-wider transition shrink-0"
                >
                  Crea Cartella
                </button>
              </div>
            </div>
          )}

          {/* Grid showing folders on the left, unassigned routes in the middle, live preview on the right */}
          <div className="grid gap-6 xl:grid-cols-3">
            {/* Folders & Unassigned column (span 2) */}
            <div className="xl:col-span-2 space-y-6">
              {/* Folders column */}
              <div className="space-y-4">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider pl-1">Cartelle e Pulsanti Attivi</h3>
                {sidebarLayout.length === 0 ? (
                  <Card className="p-8 text-center text-slate-400 font-bold text-xs bg-white border-slate-100">
                    Nessuna cartella configurata.
                  </Card>
                ) : null}

                {sidebarLayout.map((folder, folderIndex) => {
                  const unassignedRoutesForFolder = APP_PAGES_MATRIX.filter(p => !new Set(sidebarLayout.flatMap(f => f.routes)).has(p.path));
                  return (
                    <Card key={folder.id} className="p-0 overflow-hidden border-slate-100 bg-white shadow-sm">
                      {/* Folder Header Row */}
                      <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/40">
                        <div className="flex items-center gap-2">
                          <Folder className="size-4 text-[#A74758] shrink-0" />
                          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">{folder.title}</h4>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={folderIndex === 0}
                            onClick={() => handleMoveFolder(folderIndex, "up")}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={folderIndex === sidebarLayout.length - 1}
                            onClick={() => handleMoveFolder(folderIndex, "down")}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Folder Content / Link List */}
                      <div className="p-4 space-y-2 bg-white">
                        {folder.routes.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic py-2">
                            Questa cartella è vuota. Aggiungi pulsanti dal selettore sottostante.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {folder.routes.map((routeHref, routeIndex) => {
                              const pageObj = APP_PAGES_MATRIX.find(p => p.path === routeHref) || { name: routeHref, path: routeHref };
                              return (
                                <div key={routeHref} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-xs">{pageObj.name}</p>
                                    <p className="font-mono text-[9px] text-slate-400 mt-0.5">{pageObj.path}</p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={routeIndex === 0}
                                      onClick={() => handleMoveRouteInFolder(folder.id, routeIndex, "up")}
                                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      <ArrowUp className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={routeIndex === folder.routes.length - 1}
                                      onClick={() => handleMoveRouteInFolder(folder.id, routeIndex, "down")}
                                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      <ArrowDown className="size-3" />
                                    </button>
                                    {isSuperAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveRouteFromFolder(routeHref, folder.id)}
                                        className="p-1 rounded-md hover:bg-rose-50 text-rose-600 ml-1"
                                      >
                                        <X className="size-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Dropdown to add route */}
                        {isSuperAdmin && unassignedRoutesForFolder.length > 0 && (
                          <div className="pt-2 border-t border-slate-50 mt-2">
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleMoveRouteToFolder(e.target.value, folder.id);
                                }
                              }}
                              className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold outline-none bg-slate-50 focus:bg-white text-slate-700 transition w-full"
                            >
                              <option value="">+ Aggiungi tasto/pagina...</option>
                              {unassignedRoutesForFolder.map(page => (
                                <option key={page.path} value={page.path}>
                                  {page.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Unassigned section */}
              <div className="space-y-4">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider pl-1">Pagine Non Assegnate</h3>
                <Card className="p-4 bg-white border-slate-100 shadow-sm space-y-3">
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Queste pagine non sono inserite in nessuna cartella. Verranno visualizzate in automatico all'interno di una cartella predefinita "Altre Pagine" in fondo al menu.
                  </p>

                  {(() => {
                    const assignedRouteHrefs = new Set(sidebarLayout.flatMap(f => f.routes));
                    const unassignedList = APP_PAGES_MATRIX.filter(p => !assignedRouteHrefs.has(p.path));

                    if (unassignedList.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 font-bold italic py-4 text-center">
                          Tutte le pagine sono assegnate!
                        </p>
                      );
                    }

                    return (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {unassignedList.map(page => (
                          <div key={page.path} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-800 text-xs leading-normal">{page.name}</p>
                              <p className="font-mono text-[9px] text-slate-400 mt-0.5">{page.path}</p>
                            </div>
                            
                            {/* Folder target assign dropdown */}
                            {isSuperAdmin && sidebarLayout.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleMoveRouteToFolder(page.path, e.target.value);
                                  }
                                }}
                                className="h-7 rounded-lg border border-slate-200 px-2 text-[10px] font-bold outline-none bg-white text-slate-600 transition w-full"
                              >
                                <option value="">Sposta in cartella...</option>
                                {sidebarLayout.map(f => (
                                  <option key={f.id} value={f.id}>
                                    {f.title}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </div>

            {/* Live Sidebar Preview Mockup column */}
            <div className="space-y-4">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider pl-1">Live Sidebar Preview</h3>
              
              <Card className="p-4 bg-white border-slate-100 shadow-sm space-y-4">
                {/* Selector Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Anteprima per Mansione / Ruolo:
                  </label>
                  <select
                    value={previewTarget}
                    onChange={(e) => setPreviewTarget(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-[#A74758] bg-slate-50 focus:bg-white text-slate-700 transition w-full"
                  >
                    <optgroup label="Ruoli di Sistema">
                      <option value="DIPENDENTE">Collaboratore (DIPENDENTE)</option>
                      <option value="RESPONSABILE">Responsabile (RESPONSABILE)</option>
                      <option value="ADMIN">Amministratore (ADMIN)</option>
                      <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                    </optgroup>
                    <optgroup label="Mansioni Registrate">
                      {Object.keys(mansioni).map(mKey => (
                        <option key={mKey} value={mKey}>
                          Mansione: {mKey.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Visual Representation of Sidebar */}
                <div className="rounded-2xl border border-slate-200 bg-[#0E131F] text-slate-300 p-4 space-y-5 overflow-hidden shadow-inner font-sans max-h-[600px] overflow-y-auto luxury-scroll relative select-none">
                  {/* Glass indicator of mockup */}
                  <div className="absolute top-2 right-2 rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[8px] font-black uppercase text-white/50 tracking-wider">
                    Mockup Preview
                  </div>

                  {/* Logo block */}
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3 pt-1">
                    <div className="size-7 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-rose-300">
                      P
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.15em] text-white uppercase">PARADISE</p>
                      <p className="text-[8px] text-white/40">Staff Hub</p>
                    </div>
                  </div>

                  {/* Sidebar list items */}
                  <div className="space-y-4">
                    {(() => {
                      const allowedPages = getPreviewAccessList(previewTarget);
                      const editablePages = getPreviewEditAccessList(previewTarget);

                      // Helper: filter allowed ones inside each folder
                      const renderedHrefs = new Set<string>();
                      const structured = sidebarLayout.map(folder => {
                        const matched = folder.routes.filter(r => {
                          const hasView = allowedPages.includes(r);
                          if (hasView) renderedHrefs.add(r);
                          return hasView;
                        });
                        return { ...folder, matched };
                      }).filter(f => f.matched.length > 0);

                      // Fallback unassigned list
                      const unassignedMatched = APP_PAGES_MATRIX.filter(p => allowedPages.includes(p.path) && !renderedHrefs.has(p.path));

                      const displaySections = [
                        ...structured,
                        ...(unassignedMatched.length > 0 ? [{ id: "fallback-unassigned", title: "Altre Pagine", matched: unassignedMatched.map(p => p.path) }] : [])
                      ];

                      if (displaySections.length === 0) {
                        return (
                          <div className="py-8 text-center text-[10px] text-slate-500 font-bold italic">
                            Nessuna pagina visibile per questa configurazione.
                          </div>
                        );
                      }

                      return displaySections.map(sec => (
                        <div key={sec.id} className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 pb-1">
                            {sec.title}
                          </p>
                          <div className="space-y-0.5">
                            {sec.matched.map(rHref => {
                              const pageInfo = APP_PAGES_MATRIX.find(p => p.path === rHref) || { name: rHref, path: rHref };
                              const isEditable = editablePages.includes(rHref);
                              return (
                                <div
                                  key={rHref}
                                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-slate-200 transition"
                                >
                                  <span>{pageInfo.name}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span title="Visibile (Lettura)" className="text-[10px]">👁️</span>
                                    {isEditable && (
                                      <span title="Modificabile (Scrittura)" className="text-[10px] text-amber-400">✍️</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
