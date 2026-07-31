"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronDown, LockKeyhole, Loader2, Search, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { roleLabels, routePermissions, type Role } from "@/lib/roles";

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
};

type RouteMeta = {
  name: string;
  description: string;
  group: string;
};

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"];

const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": { name: "Dashboard", description: "Bacheca principale, avvisi e riepilogo operativo.", group: "Base" },
  "/my-shifts": { name: "I miei turni", description: "Turni personali e orari assegnati.", group: "Base" },
  "/tasks": { name: "Task", description: "Compiti assegnati, commenti, foto e file.", group: "Base" },
  "/notifications": { name: "Comunicazioni", description: "Notifiche e messaggi interni.", group: "Base" },
  "/profile": { name: "Profilo", description: "Dati personali, foto, password e impostazioni account.", group: "Base" },
  "/schedules": { name: "Planning", description: "Turnistica mensile dei saloni.", group: "Planning & Saloni" },
  "/orders": { name: "Ordini", description: "Kanban ordini, stati, foto e stampa etichette.", group: "Planning & Saloni" },
  "/ordine": { name: "Scheda ordine diretta", description: "Pagina aperta da barcode o link diretto ordine.", group: "Planning & Saloni" },
  "/magazzino": { name: "Magazzino", description: "Prodotti, scansioni e movimenti magazzino.", group: "Planning & Saloni" },
  "/foto": { name: "Foto", description: "Caricamento rapido foto su Drive.", group: "Planning & Saloni" },
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

function getEditRoles(path: string): Role[] {
  if (path === "/social-calendar") return ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
  if (path === "/orders" || path === "/recruitment") return ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
  if (path === "/settings/tables" || path === "/settings/planning" || path === "/settings/forms") return ["SUPER_ADMIN", "ADMIN"];
  if (path.startsWith("/settings")) return ["SUPER_ADMIN"];
  return ["SUPER_ADMIN", "ADMIN"];
}

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
  if (role === "SUPER_ADMIN") return "dark";
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

export function RolesSettingsClient({ users: initialUsers, currentUser }: RolesSettingsClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [activeTab, setActiveTab] = useState<"matrix" | "staff">("matrix");
  const [selectedRole, setSelectedRole] = useState<Role | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const pages = useMemo(() => {
    return Object.entries(routePermissions)
      .map(([path, viewRoles]) => ({
        path,
        name: routeTitle(path),
        description: routeDescription(path),
        group: routeGroup(path),
        viewRoles,
        editRoles: getEditRoles(path),
      }))
      .sort((a, b) => `${a.group}-${a.name}`.localeCompare(`${b.group}-${b.name}`));
  }, []);

  const filteredPages = selectedRole === "ALL"
    ? pages
    : pages.filter((page) => page.viewRoles.includes(selectedRole) || page.editRoles.includes(selectedRole));

  const roleStats = ROLES.map((role) => ({
    role,
    users: users.filter((user) => user.role === role).length,
    visible: pages.filter((page) => page.viewRoles.includes(role)).length,
    editable: pages.filter((page) => page.editRoles.includes(role)).length,
  }));

  const filteredUsers = users.filter((user) => {
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

  const groupedPages = filteredPages.reduce<Record<string, typeof filteredPages>>((acc, page) => {
    if (!acc[page.group]) acc[page.group] = [];
    acc[page.group].push(page);
    return acc;
  }, {});

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    if (!isAdmin) {
      showMessage("error", "Solo Admin e Super Admin possono modificare i ruoli.");
      return;
    }

    if (role === "SUPER_ADMIN" && !isSuperAdmin) {
      showMessage("error", "Solo un Super Admin puo assegnare il ruolo Super Admin.");
      return;
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

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, role, access_list: null } as any : user
        )
      );
      showMessage("success", `Ruolo aggiornato: ${data.user.name} ora e ${roleLabels[role]}.`);
    } catch (err: any) {
      showMessage("error", err.message || "Errore durante il salvataggio.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div className={`fixed bottom-5 right-5 z-50 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-2xl ${
          message.type === "success" ? "bg-emerald-600" : "bg-rose-600"
        }`}>
          {message.text}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        {roleStats.map((stat) => (
          <button
            key={stat.role}
            type="button"
            onClick={() => {
              setSelectedRole(stat.role);
              setActiveTab("matrix");
            }}
            className={`rounded-[28px] border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "matrix" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="size-4" />
            Matrice ruoli
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "staff" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="size-4" />
            Staff e ruoli
          </button>
        </div>

        {activeTab === "matrix" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole("ALL")}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                selectedRole === "ALL" ? "bg-black text-white" : "bg-white text-slate-600 ring-1 ring-black/5"
              }`}
            >
              Tutti
            </button>
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  selectedRole === role ? "bg-[#C66170] text-white" : "bg-white text-slate-600 ring-1 ring-black/5"
                }`}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-w-[280px] items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cerca collaboratore, ruolo o sede..."
              className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {activeTab === "matrix" ? (
        <div className="space-y-5">
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
                  <div key={page.path} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(260px,1.2fr)_1fr_1fr] lg:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{page.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{page.path}</span>
                      </div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{page.description}</p>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <Check className="size-3.5" />
                        Vede
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.viewRoles.map((role) => (
                          <Badge key={role} tone={roleTone(role)}>{roleLabels[role]}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <LockKeyhole className="size-3.5" />
                        Modifica
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.editRoles.length > 0 ? page.editRoles.map((role) => (
                          <Badge key={role} tone={roleTone(role)}>{roleLabels[role]}</Badge>
                        )) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                            <ShieldOff className="size-3" />
                            Nessuno
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden border-white/80 bg-white p-0">
          <div className="border-b border-black/5 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Ruoli staff</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Cambia il ruolo, non i permessi singoli</h3>
            <p className="mt-1 text-sm text-slate-500">
              I permessi vengono applicati automaticamente dalla matrice ruoli. Quando cambi ruolo, il menu e le pagine si aggiornano da soli.
            </p>
          </div>

          <div className="divide-y divide-black/5">
            {filteredUsers.map((user) => (
              <div key={user.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(260px,1fr)_1fr_auto] md:items-center">
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
                  {user.mansione ? <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">{user.mansione}</span> : null}
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
                        value={user.role}
                        disabled={!isAdmin}
                        onChange={(event) => handleRoleChange(user.id, event.target.value as Role)}
                        className="h-11 min-w-[210px] appearance-none rounded-2xl border border-black/10 bg-white px-4 pr-10 text-sm font-black text-slate-900 outline-none transition focus:border-[#C66170] focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role} disabled={role === "SUPER_ADMIN" && !isSuperAdmin}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
