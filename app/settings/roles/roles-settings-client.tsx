"use client";

import React, { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck, UserCheck, Users, Settings, Edit, Loader2, Search } from "lucide-react";
import { Badge, Card } from "@/components/ui";

type UserType = {
  id: string;
  name: string;
  email: string;
  role: string;
  mansione: string | null;
  photo_url: string | null;
  location: { name: string } | null;
};

type RolesSettingsClientProps = {
  users: UserType[];
  currentUser: {
    id: string;
    role: string;
    name?: string | null;
  };
};

const APP_PAGES_MATRIX = [
  {
    path: "/dashboard",
    name: "Dashboard Principale",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Pagina iniziale con pannello timbrature, calendario compleanni, eventi recenti e notifiche."
  },
  {
    path: "/orders",
    name: "Ordini (Kanban)",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "Tutti i dipendenti (incluse le sarte) vedono tutti gli ordini.",
    editRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
    exceptionsEdit: "Jessinca Inturri, Biy Darwin Ramirez Castillo",
    description: "Gestione e avanzamento degli ordini inseriti dallo staff. Include il filtro per tipologia di compito."
  },
  {
    path: "/invoices",
    name: "Registro Richieste Fatture",
    viewRoles: ["SUPER_ADMIN", "ADMIN"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Visualizzazione delle richieste di fattura elettronica, generazione PDF cumulativo e invio automatico al commercialista."
  },
  {
    path: "/cash",
    name: "Cassa & Chiusure",
    viewRoles: ["SUPER_ADMIN", "ADMIN"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Monitoraggio delle chiusure di cassa settimanali/mensili e dei prelievi di cassaforte."
  },
  {
    path: "/attendance",
    name: "Registro Presenze & Timbrature",
    viewRoles: ["SUPER_ADMIN", "ADMIN"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Gestione dei log di entrata/uscita, orari effettivi e inserimenti manuali delle ore lavorate."
  },
  {
    path: "/schedules",
    name: "Pianificazione Turni",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "Tutti i dipendenti possono vedere i turni propri e dei colleghi.",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Matrice di pianificazione oraria settimanale per i vari saloni Paradise."
  },
  {
    path: "/social-calendar",
    name: "Calendario Social",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    description: "Pianificazione dei post social e caricamento foto da parte del personale."
  },
  {
    path: "/requests",
    name: "Richieste Ferie & Permessi",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "I dipendenti vedono solo le proprie richieste. Responsabili/Admin vedono tutto.",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    exceptionsEdit: "I dipendenti possono creare o annullare le proprie richieste in sospeso.",
    description: "Approvazione e gestione dei congedi, ferie e permessi richiesti dal personale."
  },
  {
    path: "/recruitment",
    name: "HR Recruitment & Candidati",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
    description: "Gestione delle candidature lavorative e dei processi di assunzione per i saloni."
  },
  {
    path: "/documents",
    name: "Buste Paga & Documenti",
    viewRoles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
    exceptions: "I dipendenti vedono solo i propri cedolini. Admin caricano per tutti.",
    editRoles: ["SUPER_ADMIN", "ADMIN"],
    description: "Archivio documentale personale e invio sicuro delle buste paga mensili."
  },
  {
    path: "/settings",
    name: "Impostazioni Generali",
    viewRoles: ["SUPER_ADMIN", "ADMIN"],
    exceptions: "Nessuna exception",
    editRoles: ["SUPER_ADMIN"],
    exceptionsEdit: "Gli Admin hanno accesso limitato solo ad alcune schede di configurazione.",
    description: "Configurazione di sistema, fogli Google di appoggio, credenziali mail e matrice permessi."
  }
];

export function RolesSettingsClient({ users: initialUsers, currentUser }: RolesSettingsClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [activeTab, setActiveTab] = useState<"matrix" | "users">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track updates
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingMansioneId, setEditingMansioneId] = useState<string | null>(null);
  const [mansioneInput, setMansioneInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
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
                    <th className="px-6 py-4">Ruolo System</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold">
                        Nessun dipendente trovato.
                      </td>
                    </tr>
                  ) : null}
                  {filteredUsers.map((user) => {
                    const isEditingMansione = editingMansioneId === user.id;
                    const isUpdating = updatingUserId === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition">
                        {/* Profile Photo & Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.photo_url ? (
                              <img src={user.photo_url} alt={user.name} className="size-9 rounded-full object-cover border border-slate-100" />
                            ) : (
                              <div className="grid size-9 place-items-center rounded-full bg-[#FAF7F9] font-black text-[#C66170] border border-pink-100">
                                {user.name.charAt(0).toUpperCase()}
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
                              <input
                                type="text"
                                value={mansioneInput}
                                onChange={(e) => setMansioneInput(e.target.value)}
                                className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold outline-none focus:border-[#A74758] focus:bg-white bg-slate-50 transition"
                                placeholder="E.g. sarta, assistenza"
                              />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
