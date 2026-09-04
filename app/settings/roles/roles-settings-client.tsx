"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Eye, LockKeyhole, Loader2, Plus, Search, ShieldCheck, ShieldOff, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { roleLabels, routePermissions, type MansionePermissionMap, type PermissionSet, type Role, type RolePermissionMap } from "@/lib/roles";

type UserType = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mansione: string | null;
  photo_url: string | null;
  location: { name: string } | null;
};

type RolesSettingsClientProps = {
  users: UserType[];
  currentUser: {
    id: string;
    role: Role | string;
    name?: string | null;
  };
  initialRolePermissions: RolePermissionMap;
  initialMansionePermissions: MansionePermissionMap;
};

type RouteMeta = {
  name: string;
  description: string;
  group: string;
};

const ROLES: Role[] = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"];

const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": { name: "Dashboard", description: "Bacheca principale, avvisi e riepilogo operativo.", group: "Base" },
  "/hub": { name: "Magazzino Paradise", description: "Accesso al portale Magazzino Paradise integrato.", group: "Planning & Saloni" },
  "/my-shifts": { name: "I miei turni", description: "Turni personali e orari assegnati.", group: "Base" },
  "/tasks": { name: "Task", description: "Compiti assegnati, commenti, foto e file.", group: "Base" },
  "/notifications": { name: "Comunicazioni", description: "Notifiche e messaggi interni.", group: "Base" },
  "/email": { name: "Email", description: "Invio di email interne al personale.", group: "Base" },
  "/profile": { name: "Profilo", description: "Dati personali, foto, password e impostazioni account.", group: "Base" },
  "/schedules": { name: "Planning", description: "Turnistica mensile dei saloni.", group: "Planning & Saloni" },
  "/orders": { name: "Ordini", description: "Kanban ordini, stati, foto e stampa etichette.", group: "Planning & Saloni" },
  "/ordine": { name: "Scheda ordine diretta", description: "Pagina aperta da barcode o link diretto ordine.", group: "Planning & Saloni" },
  "/appointments": { name: "Appuntamenti", description: "Prenotazioni clienti e stato appuntamento.", group: "Planning & Saloni" },
  "/consulenza-online": { name: "Consulenza online", description: "Richieste e appuntamenti consulenze online.", group: "Planning & Saloni" },
  "/social-calendar": { name: "Programmazione social", description: "Calendario contenuti e pubblicazioni.", group: "Planning & Saloni" },
  "/locations": { name: "Saloni", description: "Anagrafica sedi e saloni Paradise.", group: "Planning & Saloni" },
  "/tablet-clock": { name: "Tablet Clock", description: "Interfaccia tablet per timbrature e controllo cliente.", group: "Planning & Saloni" },
  "/service-forms": { name: "Moduli operativi", description: "Moduli tecnici, chiusura cassa e risposte operative.", group: "Planning & Saloni" },
  "/tables": { name: "Tabelle", description: "Listini e tabelle operative.", group: "Planning & Saloni" },
  "/points": { name: "Punti", description: "Punti, obiettivi e performance personali.", group: "Planning & Saloni" },
  "/staff": { name: "Staff Paradise", description: "Schede dipendenti e dati HR.", group: "Gestione Staff" },
  "/employees": { name: "Dipendenti", description: "Archivio dipendenti e gestione anagrafica.", group: "Gestione Staff" },
  "/recruitment": { name: "Talent System", description: "Candidati, colloqui e assunzioni.", group: "Gestione Staff" },
  "/attendance": { name: "Timbrature", description: "Registro entrate, pause e uscite.", group: "Gestione Staff" },
  "/work-hours": { name: "Ore staff", description: "Ore lavorate e riepiloghi mensili.", group: "Gestione Staff" },
  "/requests": { name: "Ferie e permessi", description: "Richieste, approvazioni e motivazioni.", group: "Gestione Staff" },
  "/documents": { name: "Documenti", description: "Documenti personali e archivio HR.", group: "Gestione Staff" },
  "/cedolini": { name: "Cedolini", description: "Gestione cedolini collaboratori.", group: "Gestione Staff" },
  "/malattie": { name: "Malattie", description: "Malattie, giustificativi e certificati.", group: "Gestione Staff" },
  "/team": { name: "Team", description: "Elenco membri del team.", group: "Gestione Staff" },
  "/client-control": { name: "Controllo Cliente", description: "Schede cliente, note servizio, foto e trattamenti.", group: "Amministrazione" },
  "/cash": { name: "Cassa & Transazioni", description: "Cassa, chiusure, prelievi, cassaforte e movimenti.", group: "Amministrazione" },
  "/cassa-live": { name: "Cassa Live", description: "Accesso alla cassa Cashmatic in tempo reale.", group: "Amministrazione" },
  "/invoices": { name: "Fatture", description: "Richieste fattura e dati commercialista.", group: "Amministrazione" },
  "/refunds": { name: "Rimborsi", description: "Rimborsi e note credito.", group: "Amministrazione" },
  "/rimborsi": { name: "Rimborsi vecchio link", description: "Compatibilita con il vecchio percorso rimborsi.", group: "Amministrazione" },
  "/settings": { name: "Impostazioni", description: "Pannello impostazioni generale.", group: "Impostazioni" },
  "/settings/app": { name: "Impostazioni app", description: "Configurazione generale applicazione.", group: "Impostazioni" },
  "/settings/dashboard": { name: "Dashboard", description: "Obiettivi, punti e pannelli dashboard.", group: "Impostazioni" },
  "/settings/branding": { name: "Brand", description: "Logo, colori e identita visiva.", group: "Impostazioni" },
  "/settings/devices": { name: "Dispositivi", description: "Tablet e dispositivi salone.", group: "Impostazioni" },
  "/settings/google-sheet": { name: "Google Sheet", description: "Collegamenti con fogli Google.", group: "Impostazioni" },
  "/settings/email": { name: "Email", description: "Configurazione invio email.", group: "Impostazioni" },
  "/settings/roles": { name: "Ruoli & permessi", description: "Questa pagina di sicurezza.", group: "Impostazioni" },
  "/settings/tasks": { name: "Categorie task", description: "Configurazione categorie task.", group: "Impostazioni" },
  "/settings/tables": { name: "Tabelle", description: "Configurazione tabelle listini.", group: "Impostazioni" },
  "/settings/planning": { name: "Planning", description: "Visibilita planning e mese successivo.", group: "Impostazioni" },
  "/settings/services": { name: "Servizi", description: "Trattamenti, durate e servizi.", group: "Impostazioni" },
  "/settings/forms": { name: "Moduli", description: "Creazione e modifica moduli operativi.", group: "Impostazioni" },
  "/settings/sidebar": { name: "Sidebar", description: "Organizzazione menu laterale.", group: "Impostazioni" },
};

function routeTitle(path: string) {
  return ROUTE_META[path]?.name || path.split("/").filter(Boolean).join(" / ") || "Home";
}

function routeDescription(path: string) {
  return ROUTE_META[path]?.description || "Pagina di sistema.";
}

function routeGroup(path: string) {
  return ROUTE_META[path]?.group || "Altro";
}

function roleTone(role: Role): "pink" | "gold" | "green" | "dark" {
  if (role === "ZERO" || role === "SUPER_ADMIN") return "dark";
  if (role === "ADMIN") return "pink";
  if (role === "RESPONSABILE") return "gold";
  return "green";
}

function employeeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function emptyPermissionSet(): PermissionSet {
  return { view: [], edit: [] };
}

function rolesForRoute(rolePermissions: RolePermissionMap, path: string, kind: keyof PermissionSet) {
  return ROLES.filter((role) => rolePermissions[role]?.[kind]?.includes(path));
}

function groupedByArea<T extends { group: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});
}

function permissionHas(permission: PermissionSet, path: string, kind: keyof PermissionSet) {
  return permission[kind].includes(path);
}

function nextPermissionSet(current: PermissionSet, path: string, kind: keyof PermissionSet, checked: boolean): PermissionSet {
  let view = [...current.view];
  let edit = [...current.edit];

  if (kind === "view") {
    view = checked ? Array.from(new Set([...view, path])) : view.filter((route) => route !== path);
    if (!checked) edit = edit.filter((route) => route !== path);
  } else {
    edit = checked ? Array.from(new Set([...edit, path])) : edit.filter((route) => route !== path);
    if (checked) view = Array.from(new Set([...view, path]));
  }

  return { view, edit };
}

export function RolesSettingsClient({
  users: initialUsers,
  currentUser,
  initialRolePermissions,
  initialMansionePermissions,
}: RolesSettingsClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionMap>(initialRolePermissions);
  const [mansionePermissions, setMansionePermissions] = useState<MansionePermissionMap>(initialMansionePermissions);
  const [activeTab, setActiveTab] = useState<"roles" | "mansioni" | "staff">("staff");
  const [selectedRole, setSelectedRole] = useState<Role>("ADMIN");
  const [selectedMansione, setSelectedMansione] = useState<string>("");
  const [personToAddId, setPersonToAddId] = useState("");
  const [newMansioneName, setNewMansioneName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isZero = currentUser.role === "ZERO";
  const isAdmin = isZero || currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
  const isSuperAdmin = isZero;
  const allRoutes = useMemo(() => Object.keys(routePermissions), []);

  const mansioneNames = useMemo(() => {
    const fromUsers = users.map((user) => user.mansione?.trim().toLowerCase()).filter((name): name is string => Boolean(name));
    return Array.from(new Set([...Object.keys(mansionePermissions), ...fromUsers])).sort((a, b) => a.localeCompare(b));
  }, [mansionePermissions, users]);

  const pages = useMemo(() => {
    return allRoutes
      .map((path) => ({
        path,
        name: routeTitle(path),
        description: routeDescription(path),
        group: routeGroup(path),
        viewRoles: rolesForRoute(rolePermissions, path, "view"),
        editRoles: rolesForRoute(rolePermissions, path, "edit"),
      }))
      .sort((a, b) => `${a.group}-${a.name}`.localeCompare(`${b.group}-${b.name}`));
  }, [allRoutes, rolePermissions]);

  const filteredPages = pages.filter((page) => {
    const query = permissionQuery.trim().toLowerCase();
    return !query || page.name.toLowerCase().includes(query) || page.path.toLowerCase().includes(query) || page.group.toLowerCase().includes(query);
  });

  const roleStats = ROLES.map((role) => ({
    role,
    users: users.filter((user) => user.role === role).length,
    visible: rolePermissions[role]?.view.length ?? 0,
    editable: rolePermissions[role]?.edit.length ?? 0,
  }));

  const filteredUsers = users.filter((user) => {
    if (user.role !== selectedRole) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      roleLabels[user.role].toLowerCase().includes(query) ||
      (user.mansione || "").toLowerCase().includes(query) ||
      (user.location?.name || "").toLowerCase().includes(query)
    );
  });

  const availableUsers = users.filter((user) => user.role !== selectedRole && user.role !== "ZERO");

  const groupedPages = groupedByArea(filteredPages);
  const activeMansione = selectedMansione || mansioneNames[0] || "";
  const activeMansionePermission = activeMansione ? mansionePermissions[activeMansione] || emptyPermissionSet() : emptyPermissionSet();

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const savePermissionMaps = async (nextRoles: RolePermissionMap, nextMansioni: MansionePermissionMap) => {
    if (!isSuperAdmin) {
      showMessage("error", "Solo Zero puo modificare la matrice permessi.");
      return false;
    }

    setSavingPermissions(true);
    try {
      const res = await fetch("/api/settings/roles/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolePermissions: nextRoles, mansionePermissions: nextMansioni }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile salvare i permessi.");

      setRolePermissions(data.rolePermissions);
      setMansionePermissions(data.mansionePermissions);
      showMessage("success", "Matrice permessi salvata.");
      return true;
    } catch (err: any) {
      showMessage("error", err.message || "Errore durante il salvataggio.");
      return false;
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleToggleRolePermission = async (role: Role, path: string, kind: keyof PermissionSet, checked: boolean) => {
    if (role === "ZERO") return;
    const nextRoles = {
      ...rolePermissions,
      [role]: nextPermissionSet(rolePermissions[role] || emptyPermissionSet(), path, kind, checked),
    };
    setRolePermissions(nextRoles);
    await savePermissionMaps(nextRoles, mansionePermissions);
  };

  const handleToggleMansionePermission = async (mansione: string, path: string, kind: keyof PermissionSet, checked: boolean) => {
    const clean = mansione.trim().toLowerCase();
    if (!clean) return;
    const nextMansioni = {
      ...mansionePermissions,
      [clean]: nextPermissionSet(mansionePermissions[clean] || emptyPermissionSet(), path, kind, checked),
    };
    setMansionePermissions(nextMansioni);
    await savePermissionMaps(rolePermissions, nextMansioni);
  };

  const handleCreateMansione = async () => {
    const clean = newMansioneName.trim().toLowerCase();
    if (!clean) return;
    if (mansionePermissions[clean]) {
      setSelectedMansione(clean);
      setNewMansioneName("");
      return;
    }
    const nextMansioni = { ...mansionePermissions, [clean]: emptyPermissionSet() };
    setMansionePermissions(nextMansioni);
    setSelectedMansione(clean);
    setNewMansioneName("");
    await savePermissionMaps(rolePermissions, nextMansioni);
  };

  const handleDeleteMansione = async (mansione: string) => {
    const clean = mansione.trim().toLowerCase();
    if (!clean || !confirm(`Eliminare la matrice permessi per "${clean}"?`)) return;
    const nextMansioni = { ...mansionePermissions };
    delete nextMansioni[clean];
    setMansionePermissions(nextMansioni);
    setSelectedMansione("");
    await savePermissionMaps(rolePermissions, nextMansioni);
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    if (!isSuperAdmin) {
      showMessage("error", "Solo Zero puo modificare i ruoli di sistema.");
      return false;
    }

    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, accessList: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile aggiornare il ruolo.");

      setUsers((current) => current.map((user) => user.id === userId ? { ...user, role } : user));
      showMessage("success", `Ruolo aggiornato: ${data.user.name} ora e ${roleLabels[role]}.`);
      return true;
    } catch (err: any) {
      showMessage("error", err.message || "Errore durante il salvataggio.");
      return false;
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddPersonToRole = async () => {
    if (!personToAddId || selectedRole === "ZERO") return;
    const moved = await handleRoleChange(personToAddId, selectedRole);
    if (moved) setPersonToAddId("");
  };

  const handleMansioneChange = async (userId: string, mansione: string) => {
    if (!isAdmin) {
      showMessage("error", "Solo Admin e Super Admin possono modificare le mansioni.");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const cleanMansione = mansione.trim().toLowerCase();
      const res = await fetch("/api/settings/roles/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mansione: cleanMansione || null, accessList: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossibile aggiornare la mansione.");

      setUsers((current) => current.map((user) => user.id === userId ? { ...user, mansione: cleanMansione || null } : user));
      showMessage("success", `Mansione aggiornata per ${data.user.name}.`);
    } catch (err: any) {
      showMessage("error", err.message || "Errore durante il salvataggio.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const renderRoleToggle = (path: string, kind: keyof PermissionSet) => {
    const checked = rolePermissions[selectedRole]?.[kind]?.includes(path) ?? false;
    const locked = selectedRole === "ZERO" || !isSuperAdmin || savingPermissions;
    return (
      <label className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 transition ${
        checked ? "border-[#C66170]/35 bg-pink-50 text-[#A74758]" : "border-slate-200 bg-slate-50 text-slate-500"
      } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[#C66170]/40"}`}>
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          {kind === "view" ? <Eye className="size-4" /> : <LockKeyhole className="size-4" />}
          {kind === "view" ? "Vede" : "Modifica"}
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(event) => handleToggleRolePermission(selectedRole, path, kind, event.target.checked)}
          className="size-4 rounded border-slate-300 text-[#C66170] focus:ring-[#C66170]"
        />
      </label>
    );
  };

  const renderMansioneToggles = (path: string, permission: PermissionSet) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {(["view", "edit"] as const).map((kind) => {
        const checked = permissionHas(permission, path, kind);
        const disabled = !isSuperAdmin || savingPermissions || !activeMansione;
        return (
          <label
            key={`${activeMansione}-${path}-${kind}`}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider ${
              checked ? "border-[#C66170]/35 bg-pink-50 text-[#B85B68]" : "border-slate-200 bg-slate-50 text-slate-500"
            } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => handleToggleMansionePermission(activeMansione, path, kind, event.target.checked)}
              className="size-3.5 rounded border-slate-300 text-[#C66170] focus:ring-[#C66170]"
            />
            {kind === "view" ? "Vede" : "Modifica"}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {message ? (
        <div className={`fixed bottom-5 right-5 z-50 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-2xl ${
          message.type === "success" ? "bg-emerald-600" : "bg-rose-600"
        }`}>
          {message.text}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {roleStats.map((stat) => (
          <button
            key={stat.role}
            type="button"
            onClick={() => {
              setSelectedRole(stat.role);
              setActiveTab("staff");
              setPersonToAddId("");
            }}
            className={`rounded-[24px] border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
              selectedRole === stat.role ? "border-[#C66170] ring-4 ring-pink-100" : "border-black/5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <Badge tone={roleTone(stat.role)}>{roleLabels[stat.role]}</Badge>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{stat.users}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vede</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stat.visible}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Modifica</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stat.editable}</p>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-black/5 bg-gradient-to-r from-white to-pink-50/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={roleTone(selectedRole)}>{roleLabels[selectedRole]}</Badge>
              <span className="text-xs font-bold text-slate-400">{roleStats.find((item) => item.role === selectedRole)?.users ?? 0} persone</span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Impostazione ruolo</h2>
            <p className="mt-1 text-sm text-slate-500">Gestisci le persone assegnate e stabilisci quali pagine possono vedere o modificare.</p>
          </div>
          <div className="flex flex-wrap self-start rounded-2xl bg-slate-100 p-1 sm:self-auto">
          {[
            { id: "staff", label: "Persone", icon: Users },
            { id: "roles", label: "Permessi pagine", icon: ShieldCheck },
            { id: "mansioni", label: "Profili operativi", icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  activeTab === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
          </div>
        </div>
      </section>

      {savingPermissions ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#B85B68]">
          <Loader2 className="size-4 animate-spin" />
          Salvataggio permessi
        </div>
      ) : null}

      {activeTab === "roles" ? (
        <div className="space-y-5">
          <Card className="border-white/80 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C66170]">Permessi di {roleLabels[selectedRole]}</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Pagine e operazioni consentite</h3>
                <p className="mt-1 text-sm text-slate-500">“Modifica” attiva automaticamente anche “Vede”. Disattivando “Vede” viene rimossa anche la modifica.</p>
              </div>
              <div className="flex min-w-[280px] items-center gap-2 rounded-2xl border border-black/5 bg-slate-50 px-3 py-2.5">
                <Search className="size-4 text-slate-400" />
                <input
                  value={permissionQuery}
                  onChange={(event) => setPermissionQuery(event.target.value)}
                  placeholder="Cerca pagina o area..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </Card>
          {Object.keys(groupedPages).length === 0 ? (
            <Card className="border-white/80 bg-white py-12 text-center text-sm font-bold text-slate-400">Nessuna pagina trovata.</Card>
          ) : null}
          {Object.entries(groupedPages).map(([group, groupPages]) => (
            <Card key={group} className="overflow-hidden border-white/80 bg-white p-0">
              <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Area</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{group}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{groupPages.length} pagine</span>
              </div>

              <div className="divide-y divide-black/5">
                {groupPages.map((page) => (
                  <div key={page.path} className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(240px,1fr)_1.25fr_1.25fr] xl:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{page.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{page.path}</span>
                      </div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{page.description}</p>
                    </div>

                    {renderRoleToggle(page.path, "view")}
                    {renderRoleToggle(page.path, "edit")}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : activeTab === "mansioni" ? (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="border-white/80 bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Mansioni</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Profili operativi</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Usa questi profili per Parrucchiera, Assistenza, Sarta, Social o altre mansioni. Si applicano ai collaboratori non Admin.
            </p>

            <div className="mt-5 flex gap-2">
              <input
                value={newMansioneName}
                onChange={(event) => setNewMansioneName(event.target.value)}
                placeholder="Nuova mansione..."
                className="h-11 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-[#C66170] focus:ring-4 focus:ring-pink-100"
              />
              <button
                type="button"
                onClick={handleCreateMansione}
                disabled={!isSuperAdmin || savingPermissions}
                className="grid size-11 place-items-center rounded-2xl bg-[#C66170] text-white transition hover:bg-[#A74758] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {mansioneNames.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm font-bold text-slate-400">
                  Nessuna mansione configurata.
                </p>
              ) : null}
              {mansioneNames.map((mansione) => {
                const active = activeMansione === mansione;
                const permission = mansionePermissions[mansione] || emptyPermissionSet();
                return (
                  <button
                    key={mansione}
                    type="button"
                    onClick={() => setSelectedMansione(mansione)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active ? "border-[#C66170] bg-pink-50" : "border-black/5 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-black capitalize text-slate-950">{mansione}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{permission.view.length} vede · {permission.edit.length} modifica</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden border-white/80 bg-white p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Permessi mansione</p>
                <h3 className="mt-1 text-xl font-black capitalize text-slate-950">{activeMansione || "Seleziona mansione"}</h3>
              </div>
              {activeMansione ? (
                <button
                  type="button"
                  onClick={() => handleDeleteMansione(activeMansione)}
                  disabled={!isSuperAdmin || savingPermissions}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  Elimina
                </button>
              ) : null}
            </div>

            {activeMansione ? (
              <div className="divide-y divide-black/5">
                {pages.map((page) => (
                  <div key={page.path} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_260px] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{page.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{page.path}</span>
                      </div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{page.description}</p>
                    </div>
                    {renderMansioneToggles(page.path, activeMansionePermission)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[280px] place-items-center p-10 text-center">
                <div>
                  <ShieldOff className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-400">Crea o seleziona una mansione.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden border-white/80 bg-white p-0">
          <div className="flex flex-col gap-4 border-b border-black/5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Persone assegnate</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Team {roleLabels[selectedRole]}</h3>
              <p className="mt-1 text-sm text-slate-500">Aggiungi una persona oppure spostala in un altro ruolo già esistente.</p>
            </div>
            <div className="flex min-w-[280px] items-center gap-2 rounded-2xl border border-black/5 bg-slate-50 px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cerca nel ruolo..."
                className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {selectedRole !== "ZERO" && isSuperAdmin ? (
            <div className="border-b border-black/5 bg-gradient-to-r from-pink-50/70 to-white px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Aggiungi una persona a {roleLabels[selectedRole]}</span>
                  <div className="relative">
                    <select
                      value={personToAddId}
                      onChange={(event) => setPersonToAddId(event.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 pr-10 text-sm font-bold text-slate-900 outline-none transition focus:border-[#C66170] focus:ring-4 focus:ring-pink-100"
                    >
                      <option value="">Seleziona una persona...</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} — ora {roleLabels[user.role]}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleAddPersonToRole}
                  disabled={!personToAddId || Boolean(updatingUserId)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#C66170] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#A74758] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingUserId === personToAddId ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Aggiungi al ruolo
                </button>
              </div>
            </div>
          ) : null}

          <div className="divide-y divide-black/5">
            {filteredUsers.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Users className="mx-auto size-9 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-500">Nessuna persona trovata in questo ruolo.</p>
              </div>
            ) : null}
            {filteredUsers.map((user) => (
              <div key={user.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(260px,1fr)_1fr_auto_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  {user.photo_url ? (
                    <img src={resolveDrivePhotoUrl(user.photo_url)} alt={user.name} className="size-12 rounded-2xl object-cover ring-1 ring-black/5" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-2xl bg-pink-100 text-sm font-black text-[#C66170] ring-1 ring-pink-200">
                      {employeeInitials(user.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{user.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={roleTone(user.role)}>{roleLabels[user.role]}</Badge>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">{user.location?.name || "Sede non assegnata"}</span>
                  {user.mansione ? <span className="rounded-full bg-slate-100 px-3 py-1 font-bold capitalize text-slate-600">{user.mansione}</span> : null}
                </div>

                <div className="relative">
                  {updatingUserId === user.id ? (
                    <div className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-500">
                      <Loader2 className="size-4 animate-spin" />
                      Salvo
                    </div>
                  ) : (
                    <>
                      <select
                        aria-label={`Sposta ${user.name} in un altro ruolo`}
                        value={user.role}
                        disabled={!isSuperAdmin || user.role === "ZERO"}
                        onChange={(event) => handleRoleChange(user.id, event.target.value as Role)}
                        className="h-11 min-w-[210px] appearance-none rounded-2xl border border-black/10 bg-white px-4 pr-10 text-sm font-black text-slate-900 outline-none transition focus:border-[#C66170] focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role} disabled={role === "ZERO"}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    </>
                  )}
                </div>

                <div className="relative">
                  <select
                    aria-label={`Assegna mansione a ${user.name}`}
                    value={user.mansione || ""}
                    disabled={!isAdmin || updatingUserId === user.id}
                    onChange={(event) => handleMansioneChange(user.id, event.target.value)}
                    className="h-11 min-w-[220px] appearance-none rounded-2xl border border-black/10 bg-white px-4 pr-10 text-sm font-black capitalize text-slate-900 outline-none transition focus:border-[#C66170] focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Nessuna mansione</option>
                    {mansioneNames.map((mansione) => (
                      <option key={mansione} value={mansione}>{mansione}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
