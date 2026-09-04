"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Folder,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  Edit3,
  Search,
  ChevronDown,
  GripVertical,
  PanelLeft,
  RotateCcw,
  Layers3,
} from "lucide-react";
import { Card } from "@/components/ui";
import { routePermissions } from "@/lib/roles";

type SidebarFolder = {
  id: string;
  title: string;
  routes: string[];
  labels?: Record<string, string>;
};

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/my-shifts": "I miei turni",
  "/tasks": "Task",
  "/employees": "Dipendenti",
  "/attendance": "Timbrature",
  "/work-hours": "Ore staff",
  "/schedules": "Planning",
  "/social-calendar": "Programmazione Social",
  "/locations": "Saloni",
  "/tablet-clock": "Tablet Clock",
  "/requests": "Ferie e permessi",
  "/documents": "Documenti",
  "/cedolini": "Cedolini",
  "/malattie": "Malattie",
  "/service-notes": "Note operative",
  "/service-forms": "Moduli operativi",
  "/responsabile-di-turno": "Responsabile di turno",
  "/programmazione-responsabile-di-turno": "Programmazione responsabili",
  "/hub": "Magazzino Paradise",
  "/magazzino": "Magazzino",
  "/foto": "Foto",
  "/shipping": "Spedizioni",
  "/remote": "Controllo remoto",
  "/tables": "Tabelle",
  "/orders": "Ordini",
  "/ordine": "Scheda ordine diretta",
  "/points": "Punti",
  "/appointments": "Appuntamenti",
  "/consulenza-online": "Consulenza Online",
  "/cash": "Cassa",
  "/invoices": "Fatture",
  "/refunds": "Rimborsi",
  "/rimborsi": "Rimborsi vecchio link",
  "/client-control": "Controllo Cliente",
  "/recruitment": "Talent System",
  "/staff": "Staff Paradise",
  "/team": "Team",
  "/notifications": "Comunicazioni",
  "/email": "Email",
  "/profile": "Profilo",
  "/settings": "Impostazioni",
  "/settings/app": "App",
  "/settings/dashboard": "Dashboard",
  "/settings/branding": "Brand",
  "/settings/devices": "Dispositivi",
  "/settings/google-sheet": "Google Sheet",
  "/settings/email": "Email",
  "/settings/roles": "Ruoli e permessi",
  "/settings/tasks": "Categorie task",
  "/settings/tables": "Tabelle",
  "/settings/planning": "Planning",
  "/settings/services": "Servizi",
  "/settings/forms": "Moduli",
  "/settings/sidebar": "Sidebar",
};

const ALL_PAGES = Object.keys(routePermissions).map((path) => ({
  path,
  name:
    PAGE_LABELS[path] || path.split("/").filter(Boolean).join(" / ") || "Home",
}));

const DEFAULT_LAYOUT: SidebarFolder[] = [
  {
    id: "generale",
    title: "Generale",
    routes: ["/dashboard", "/my-shifts", "/tasks", "/notifications", "/email"],
  },
  {
    id: "planning",
    title: "Planning & Saloni",
    routes: ["/schedules", "/orders"],
  },
  {
    id: "staff",
    title: "Gestione Staff",
    routes: ["/requests", "/documents", "/malattie"],
  },
  { id: "settings", title: "Impostazioni", routes: ["/profile", "/settings"] },
];

function getInitialLayout(initialLayout: SidebarFolder[] | null) {
  return initialLayout &&
    Array.isArray(initialLayout) &&
    initialLayout.length > 0
    ? initialLayout
    : DEFAULT_LAYOUT;
}

export function SidebarSettingsClient({
  initialLayout,
}: {
  initialLayout: SidebarFolder[] | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Layout state
  const [folders, setFolders] = useState<SidebarFolder[]>(() =>
    getInitialLayout(initialLayout),
  );
  const [savedLayout, setSavedLayout] = useState(() =>
    JSON.stringify(getInitialLayout(initialLayout)),
  );

  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolderForAdd, setActiveFolderForAdd] = useState<string>("");
  const [pageQuery, setPageQuery] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  const assignedRouteHrefs = new Set(folders.flatMap((f) => f.routes));
  const unassignedPages = ALL_PAGES.filter(
    (p) => !assignedRouteHrefs.has(p.path),
  );
  const normalizedPageQuery = pageQuery.trim().toLowerCase();
  const filteredUnassignedPages = normalizedPageQuery
    ? unassignedPages.filter((page) =>
        `${page.name} ${page.path}`.toLowerCase().includes(normalizedPageQuery),
      )
    : unassignedPages;
  const assignedPagesCount = folders.reduce(
    (total, folder) => total + folder.routes.length,
    0,
  );
  const serializedLayout = JSON.stringify(folders);
  const hasUnsavedChanges = savedLayout !== serializedLayout;

  useEffect(() => {
    if (folders.length > 0 && !activeFolderForAdd) {
      setActiveFolderForAdd(folders[0].id);
    }
  }, [folders, activeFolderForAdd]);

  // Move a folder position up or down
  const handleMoveFolder = (index: number, direction: "up" | "down") => {
    const nextFolders = [...folders];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    // Swap
    const temp = nextFolders[index];
    nextFolders[index] = nextFolders[targetIndex];
    nextFolders[targetIndex] = temp;
    setFolders(nextFolders);
  };

  // Create a new empty folder
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const newFolder: SidebarFolder = {
      id: `folder-${Date.now()}`,
      title: trimmed,
      routes: [],
    };
    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName("");
    setActiveFolderForAdd(newFolder.id);
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      next.delete(newFolder.id);
      return next;
    });
  };

  // Delete a folder (its routes become unassigned)
  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    const message = folder.routes.length
      ? `Eliminare la sezione “${folder.title}”? I suoi ${folder.routes.length} tasti torneranno tra le pagine disponibili.`
      : `Eliminare la sezione “${folder.title}”?`;
    if (!window.confirm(message)) return;
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderForAdd === folderId) {
      setActiveFolderForAdd(
        folders.find((item) => item.id !== folderId)?.id || "",
      );
    }
  };

  const handleToggleFolder = (folderId: string) => {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleRestoreSavedLayout = () => {
    if (
      !hasUnsavedChanges ||
      !window.confirm("Annullare tutte le modifiche non salvate?")
    )
      return;
    try {
      setFolders(JSON.parse(savedLayout) as SidebarFolder[]);
      setSuccessMsg("");
      setErrorMsg("");
    } catch {
      setErrorMsg(
        "Non è stato possibile ripristinare la configurazione salvata.",
      );
    }
  };

  // Move a route position up or down inside its folder
  const handleMoveRoute = (
    folderId: string,
    routeIndex: number,
    direction: "up" | "down",
  ) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const nextRoutes = [...f.routes];
        const targetIndex =
          direction === "up" ? routeIndex - 1 : routeIndex + 1;
        if (targetIndex < 0 || targetIndex >= nextRoutes.length) return f;

        const temp = nextRoutes[routeIndex];
        nextRoutes[routeIndex] = nextRoutes[targetIndex];
        nextRoutes[targetIndex] = temp;
        return { ...f, routes: nextRoutes };
      }),
    );
  };

  // Remove a route from its folder (making it unassigned)
  const handleRemoveRoute = (folderId: string, routePath: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        return { ...f, routes: f.routes.filter((r) => r !== routePath) };
      }),
    );
  };

  // Add an unassigned route to the selected folder
  const handleAddRoute = (folderId: string, routePath: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        if (f.routes.includes(routePath)) return f;
        return { ...f, routes: [...f.routes, routePath] };
      }),
    );
  };

  // Rename a folder
  const handleRenameFolder = (folderId: string, currentTitle: string) => {
    const nextTitle = prompt("Modifica il titolo del gruppo:", currentTitle);
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, title: trimmed } : f)),
    );
  };

  // Save sidebar layout configuration
  const handleSaveLayout = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const layoutRes = await fetch("/api/settings/roles/menu-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: folders,
        }),
      });

      if (!layoutRes.ok) {
        const err = await layoutRes.json();
        throw new Error(
          err.error || "Errore nel salvataggio dell'ordine dei tasti.",
        );
      }

      setSavedLayout(JSON.stringify(folders));
      setSuccessMsg(
        "Ordine della barra laterale salvato. Ricarica la pagina per vedere il nuovo ordinamento.",
      );
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24">
      <div className="sticky top-3 z-20 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg shadow-zinc-900/5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
            <PanelLeft size={19} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-zinc-950">
              Struttura del menu
            </p>
            <p className="text-xs font-medium text-zinc-500">
              {folders.length} sezioni · {assignedPagesCount} tasti
            </p>
          </div>
          <span
            className={`hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide md:inline-flex ${hasUnsavedChanges ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
          >
            {hasUnsavedChanges ? "Modifiche non salvate" : "Tutto salvato"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleRestoreSavedLayout}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 sm:flex-none"
              title="Annulla modifiche"
            >
              <RotateCcw size={15} /> Annulla
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={loading || !hasUnsavedChanges}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-xs font-black text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
          >
            <Save size={15} /> {loading ? "Salvataggio..." : "Salva modifiche"}
          </button>
        </div>
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700"
        >
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700"
        >
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="space-y-5 border border-zinc-200 bg-white p-4 shadow-sm hover:translate-y-0 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Folder className="text-[#2563eb]" size={18} />
                <h2 className="text-sm font-black text-zinc-950">
                  Sezioni e tasti
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Ordina ciò che il personale vede nella barra laterale.
              </p>
            </div>
            <div className="flex w-full gap-2 lg:max-w-md">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Nome nuova sezione"
                className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-xs font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-40"
              >
                <FolderPlus size={15} />
                Aggiungi
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {folders.map((folder, folderIndex) => {
              const isCollapsed = collapsedFolderIds.has(folder.id);
              return (
                <section
                  key={folder.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/40"
                >
                  <div
                    className={`flex items-center justify-between gap-3 bg-zinc-50 p-3 sm:p-4 ${isCollapsed ? "" : "border-b border-zinc-200"}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleFolder(folder.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDown
                        size={17}
                        className={`shrink-0 text-zinc-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                      <Folder size={16} className="shrink-0 text-[#2563eb]" />
                      <span className="truncate text-xs font-black uppercase tracking-wide text-zinc-950">
                        {folder.title}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-200">
                        {folder.routes.length}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <ActionButton
                        label="Rinomina sezione"
                        onClick={() =>
                          handleRenameFolder(folder.id, folder.title)
                        }
                      >
                        <Edit3 size={15} />
                      </ActionButton>
                      <ActionButton
                        label="Sposta sezione su"
                        disabled={folderIndex === 0}
                        onClick={() => handleMoveFolder(folderIndex, "up")}
                      >
                        <ArrowUp size={15} />
                      </ActionButton>
                      <ActionButton
                        label="Sposta sezione giù"
                        disabled={folderIndex === folders.length - 1}
                        onClick={() => handleMoveFolder(folderIndex, "down")}
                      >
                        <ArrowDown size={15} />
                      </ActionButton>
                      <ActionButton
                        label="Elimina sezione"
                        danger
                        onClick={() => handleDeleteFolder(folder.id)}
                      >
                        <Trash2 size={15} />
                      </ActionButton>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-2 p-3">
                      {folder.routes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-center text-xs font-semibold text-zinc-400">
                          Questa sezione è vuota. Aggiungi un tasto dalle pagine
                          disponibili.
                        </div>
                      ) : (
                        folder.routes.map((routeHref, routeIndex) => {
                          const page = ALL_PAGES.find(
                            (p) => p.path === routeHref,
                          ) || { name: routeHref, path: routeHref };
                          return (
                            <div
                              key={routeHref}
                              title={routeHref}
                              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <GripVertical
                                  size={16}
                                  className="shrink-0 text-zinc-300"
                                />
                                <span className="truncate text-sm font-bold text-zinc-700">
                                  {page.name}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <ActionButton
                                  label={`Sposta ${page.name} su`}
                                  disabled={routeIndex === 0}
                                  onClick={() =>
                                    handleMoveRoute(folder.id, routeIndex, "up")
                                  }
                                >
                                  <ArrowUp size={14} />
                                </ActionButton>
                                <ActionButton
                                  label={`Sposta ${page.name} giù`}
                                  disabled={
                                    routeIndex === folder.routes.length - 1
                                  }
                                  onClick={() =>
                                    handleMoveRoute(
                                      folder.id,
                                      routeIndex,
                                      "down",
                                    )
                                  }
                                >
                                  <ArrowDown size={14} />
                                </ActionButton>
                                <ActionButton
                                  label={`Rimuovi ${page.name}`}
                                  danger
                                  onClick={() =>
                                    handleRemoveRoute(folder.id, routeHref)
                                  }
                                >
                                  <Trash2 size={14} />
                                </ActionButton>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section className="space-y-4 border-t border-zinc-100 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers3 size={17} className="text-pink-500" />
                  <h3 className="text-sm font-black text-zinc-950">
                    Pagine disponibili
                  </h3>
                  <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-black text-pink-700">
                    {unassignedPages.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Scegli la sezione e aggiungi i tasti mancanti.
                </p>
              </div>
              <label className="text-xs font-bold text-zinc-600">
                Aggiungi in{" "}
                <select
                  value={activeFolderForAdd}
                  onChange={(e) => setActiveFolderForAdd(e.target.value)}
                  disabled={!folders.length}
                  className="ml-2 h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-[#2563eb]"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {unassignedPages.length > 0 && (
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={pageQuery}
                  onChange={(e) => setPageQuery(e.target.value)}
                  placeholder="Cerca una pagina da aggiungere..."
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}
            {unassignedPages.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 p-5 text-center text-xs font-bold text-emerald-700">
                Tutte le pagine sono già nella barra laterale.
              </div>
            ) : filteredUnassignedPages.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-5 text-center text-xs font-semibold text-zinc-500">
                Nessuna pagina corrisponde alla ricerca.
              </div>
            ) : (
              <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredUnassignedPages.map((page) => (
                  <div
                    key={page.path}
                    title={page.path}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                  >
                    <span className="truncate text-sm font-bold text-zinc-700">
                      {page.name}
                    </span>
                    <button
                      type="button"
                      disabled={!activeFolderForAdd}
                      onClick={() =>
                        handleAddRoute(activeFolderForAdd, page.path)
                      }
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563eb] transition hover:bg-[#2563eb] hover:text-white disabled:opacity-40"
                      aria-label={`Aggiungi ${page.name}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card className="overflow-hidden border border-zinc-200 bg-white p-0 shadow-sm hover:translate-y-0">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div>
                <p className="text-sm font-black text-zinc-950">
                  Anteprima menu
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Come apparirà al personale
                </p>
              </div>
              <Sparkles size={17} className="text-pink-500" />
            </div>
            <div
              className="m-3 min-h-[440px] overflow-hidden rounded-2xl border border-black/5 p-3"
              style={{
                background: "var(--user-sidebar-color, var(--sidebar))",
                color: "var(--sidebar-text)",
              }}
            >
              <div className="mb-5 flex items-center gap-2 border-b border-current/10 pb-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/30">
                  <PanelLeft size={16} />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider">
                    Paradise
                  </p>
                  <p className="text-[9px] opacity-60">Staff Hub</p>
                </div>
              </div>
              <div className="space-y-4">
                {folders.map((folder) => (
                  <div key={folder.id}>
                    <p className="mb-1.5 px-2 text-[9px] font-black uppercase tracking-[0.18em] opacity-55">
                      {folder.title}
                    </p>
                    <div className="space-y-1">
                      {folder.routes
                        .slice(0, 5)
                        .map((routeHref, routeIndex) => {
                          const page = ALL_PAGES.find(
                            (item) => item.path === routeHref,
                          );
                          return (
                            <div
                              key={routeHref}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold ${folderIndexIsFirst(folders, folder.id) && routeIndex === 0 ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]" : ""}`}
                            >
                              <span className="size-1.5 rounded-full bg-current opacity-45" />
                              <span className="truncate">
                                {page?.name || routeHref}
                              </span>
                            </div>
                          );
                        })}
                      {folder.routes.length > 5 && (
                        <p className="px-2.5 pt-1 text-[9px] font-bold opacity-50">
                          + {folder.routes.length - 5} altri
                        </p>
                      )}
                      {folder.routes.length === 0 && (
                        <p className="px-2.5 py-1 text-[10px] italic opacity-45">
                          Sezione vuota
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 px-4 pb-4">
              <p className="text-xs leading-relaxed text-zinc-500">
                L'anteprima usa i colori già impostati. Qui modifichi soltanto
                ordine e sezioni.
              </p>
              <Link
                href="/settings/branding"
                className="inline-flex h-9 items-center text-xs font-black text-[#2563eb] hover:underline"
              >
                Gestisci i colori in Branding →
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function folderIndexIsFirst(folders: SidebarFolder[], folderId: string) {
  return folders[0]?.id === folderId;
}

function ActionButton({
  label,
  children,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-25 ${danger ? "text-zinc-400 hover:bg-rose-50 hover:text-rose-600" : "text-zinc-500 hover:bg-white hover:text-zinc-950 hover:shadow-sm"}`}
    >
      {children}
    </button>
  );
}
