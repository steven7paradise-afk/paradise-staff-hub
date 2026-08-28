"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Palette, Folder, ArrowUp, ArrowDown, Trash2, Plus, 
  Settings, Save, Sparkles, AlertCircle, CheckCircle2, ChevronRight,
  FolderPlus, Edit3
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import { routePermissions } from "@/lib/roles";

type SidebarFolder = {
  id: string;
  title: string;
  routes: string[];
  labels?: Record<string, string>;
};

type BrandingTheme = {
  sidebar_color: string;
  dark_sidebar_color: string;
};

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/my-shifts": "I miei turni",
  "/tasks": "Task",
  "/shift-reports": "Report di turno",
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
  "/tables": "Tabelle",
  "/orders": "Ordini",
  "/ordine": "Scheda ordine diretta",
  "/magazzino": "Magazzino",
  "/foto": "Foto",
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
  name: PAGE_LABELS[path] || path.split("/").filter(Boolean).join(" / ") || "Home",
}));

const PRESETS = [
  { name: "Brand Classico", sidebar: "#FFFFFF", dark: "#1B1A1F" },
  { name: "Midnight Luxury", sidebar: "#0F172A", dark: "#0B121F" },
  { name: "Rose Gold", sidebar: "#FAF1F2", dark: "#201F24" },
  { name: "Smeraldo Soft", sidebar: "#EBF2EF", dark: "#1C2E24" },
  { name: "Sunny Lime", sidebar: "#E2F952", dark: "#1A2208" },
  { name: "Luxury Dark", sidebar: "#1F1F1F", dark: "#121114" },
];

export function SidebarSettingsClient({
  initialBranding,
  initialLayout
}: {
  initialBranding: BrandingTheme;
  initialLayout: SidebarFolder[] | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Color state
  const [sidebarColor, setSidebarColor] = useState(initialBranding.sidebar_color || "#FFFFFF");
  const [darkSidebarColor, setDarkSidebarColor] = useState(initialBranding.dark_sidebar_color || "#1B1A1F");

  // Layout state
  const [folders, setFolders] = useState<SidebarFolder[]>(
    initialLayout && Array.isArray(initialLayout) && initialLayout.length > 0
      ? initialLayout
      : [
          { id: "generale", title: "Generale", routes: ["/dashboard", "/my-shifts", "/tasks", "/notifications"] },
          { id: "planning", title: "Planning & Saloni", routes: ["/schedules", "/orders", "/magazzino", "/foto"] },
          { id: "staff", title: "Gestione Staff", routes: ["/requests", "/documents", "/malattie"] },
          { id: "settings", title: "Impostazioni", routes: ["/profile", "/settings"] }
        ]
  );

  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolderForAdd, setActiveFolderForAdd] = useState<string>("");

  const assignedRouteHrefs = new Set(folders.flatMap((f) => f.routes));
  const unassignedPages = ALL_PAGES.filter((p) => !assignedRouteHrefs.has(p.path));

  useEffect(() => {
    if (folders.length > 0 && !activeFolderForAdd) {
      setActiveFolderForAdd(folders[0].id);
    }
  }, [folders, activeFolderForAdd]);

  // Apply visual preset colors
  const handleApplyPreset = (sidebar: string, dark: string) => {
    setSidebarColor(sidebar);
    setDarkSidebarColor(dark);
  };

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
  };

  // Delete a folder (its routes become unassigned)
  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderForAdd === folderId) {
      setActiveFolderForAdd(folders[0]?.id || "");
    }
  };

  // Move a route position up or down inside its folder
  const handleMoveRoute = (folderId: string, routeIndex: number, direction: "up" | "down") => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const nextRoutes = [...f.routes];
        const targetIndex = direction === "up" ? routeIndex - 1 : routeIndex + 1;
        if (targetIndex < 0 || targetIndex >= nextRoutes.length) return f;

        const temp = nextRoutes[routeIndex];
        nextRoutes[routeIndex] = nextRoutes[targetIndex];
        nextRoutes[targetIndex] = temp;
        return { ...f, routes: nextRoutes };
      })
    );
  };

  // Remove a route from its folder (making it unassigned)
  const handleRemoveRoute = (folderId: string, routePath: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        return { ...f, routes: f.routes.filter((r) => r !== routePath) };
      })
    );
  };

  // Add an unassigned route to the selected folder
  const handleAddRoute = (folderId: string, routePath: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        if (f.routes.includes(routePath)) return f;
        return { ...f, routes: [...f.routes, routePath] };
      })
    );
  };

  // Rename a folder
  const handleRenameFolder = (folderId: string, currentTitle: string) => {
    const nextTitle = prompt("Modifica il titolo del gruppo:", currentTitle);
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, title: trimmed } : f))
    );
  };

  // Save changes to colors and layout configuration
  const handleSaveAll = async () => {
    setLoading(true);
    setStatus("saving");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Save branding colors
      const brandingRes = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...initialBranding,
          sidebar_color: sidebarColor,
          dark_sidebar_color: darkSidebarColor,
        }),
      });

      if (!brandingRes.ok) {
        const err = await brandingRes.json();
        throw new Error(err.error || "Errore nel salvataggio dei colori.");
      }

      // 2. Save sidebar layouts configuration
      const layoutRes = await fetch("/api/settings/roles/menu-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: folders,
        }),
      });

      if (!layoutRes.ok) {
        const err = await layoutRes.json();
        throw new Error(err.error || "Errore nel salvataggio dell'ordine dei tasti.");
      }

      setSuccessMsg("Configurazione salvata con successo! Ricarica o aggiorna per vedere il nuovo ordinamento.");
      setStatus("success");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore imprevisto.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      
      {/* 🚀 TOP ACTION FLOATING BAR */}
      <div className="flex items-center justify-between gap-4 bg-zinc-50 border border-zinc-200 p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-600">
          <Sparkles size={16} className="text-pink-500" />
          <span>Configura Look & Ordine Barra Laterale</span>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={loading}
          className="bg-zinc-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 flex items-center gap-2 transition disabled:opacity-50 shrink-0 shadow-sm"
        >
          {loading ? (
            <span>Salvataggio...</span>
          ) : (
            <>
              <Save size={15} />
              <span>Salva Modifiche</span>
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: COLORS CUSTOMIZER */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-6 bg-white border border-zinc-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <Palette className="text-pink-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-wider text-black">
                1. Colore Barra Laterale
              </h2>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                Combinazioni Rapide
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset.sidebar, preset.dark)}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-left hover:bg-zinc-100 transition duration-150"
                  >
                    <span className="flex size-5 shrink-0 overflow-hidden rounded-full border border-zinc-300">
                      <span className="h-full w-1/2" style={{ backgroundColor: preset.sidebar }} />
                      <span className="h-full w-1/2" style={{ backgroundColor: preset.dark }} />
                    </span>
                    <span className="text-[10px] font-bold text-zinc-700 truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Color Pickers */}
            <div className="space-y-4 pt-3 border-t border-zinc-100">
              {/* Light Mode Sidebar */}
              <div className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                <div>
                  <span className="text-[11px] font-black text-zinc-700 block">Sfondo Light Mode</span>
                  <span className="text-[9px] text-zinc-400 block">Desktop & Mobile Header</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">{sidebarColor}</span>
                  <input
                    type="color"
                    value={sidebarColor}
                    onChange={(e) => setSidebarColor(e.target.value)}
                    className="size-8 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              {/* Dark Mode Sidebar */}
              <div className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                <div>
                  <span className="text-[11px] font-black text-zinc-700 block">Sfondo Dark Mode</span>
                  <span className="text-[9px] text-zinc-400 block">Desktop & Mobile Header</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">{darkSidebarColor}</span>
                  <input
                    type="color"
                    value={darkSidebarColor}
                    onChange={(e) => setDarkSidebarColor(e.target.value)}
                    className="size-8 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: BUTTONS LAYOUT REORDER (SPAN 2) */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6 bg-white border border-zinc-200 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Folder className="text-[#2563eb]" size={18} />
                <h2 className="text-xs font-black uppercase tracking-wider text-black">
                  2. Ordine dei Tasti & Sezioni
                </h2>
              </div>

              {/* Create new folder trigger */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nuova sezione (es. Strumenti)..."
                  className="h-8 rounded-xl border border-zinc-200 px-3 text-xs font-semibold outline-none focus:border-zinc-400 bg-zinc-50 transition"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="h-8 rounded-xl bg-[#2563eb] text-white px-3 text-xs font-black uppercase tracking-wider transition flex items-center gap-1"
                >
                  <FolderPlus size={14} />
                  <span>Aggiungi</span>
                </button>
              </div>
            </div>

            {/* Folders list */}
            <div className="space-y-4">
              {folders.map((folder, folderIndex) => (
                <div key={folder.id} className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50/20">
                  
                  {/* Folder header row */}
                  <div className="flex items-center justify-between gap-3 p-3.5 bg-zinc-50 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                      <Folder size={15} className="text-[#2563eb]" />
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-950">{folder.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRenameFolder(folder.id, folder.title)}
                        className="p-1 text-zinc-500 hover:text-black transition"
                        title="Rinomina"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={folderIndex === 0}
                        onClick={() => handleMoveFolder(folderIndex, "up")}
                        className="p-1 text-zinc-500 hover:text-black disabled:opacity-20 transition"
                        title="Sposta Su"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={folderIndex === folders.length - 1}
                        onClick={() => handleMoveFolder(folderIndex, "down")}
                        className="p-1 text-zinc-500 hover:text-black disabled:opacity-20 transition"
                        title="Sposta Giù"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1 text-zinc-400 hover:text-red-600 transition"
                        title="Elimina Sezione"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Folder routes list */}
                  <div className="p-3 space-y-1.5">
                    {folder.routes.length === 0 ? (
                      <div className="p-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider border border-dashed border-zinc-200 rounded-xl">
                        Nessun tasto in questa sezione. Aggiungine uno sotto.
                      </div>
                    ) : (
                      folder.routes.map((routeHref, routeIndex) => {
                        const page = ALL_PAGES.find((p) => p.path === routeHref) || { name: routeHref, path: routeHref };
                        return (
                          <div
                            key={routeHref}
                            className="flex items-center justify-between p-2.5 bg-white border border-zinc-200 rounded-xl shadow-2xs"
                          >
                            <span className="text-xs font-semibold text-zinc-700">{page.name} <code className="text-[10px] text-zinc-400 pl-1 font-mono font-medium">{routeHref}</code></span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={routeIndex === 0}
                                onClick={() => handleMoveRoute(folder.id, routeIndex, "up")}
                                className="p-1 text-zinc-400 hover:text-black disabled:opacity-20 transition"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={routeIndex === folder.routes.length - 1}
                                onClick={() => handleMoveRoute(folder.id, routeIndex, "down")}
                                className="p-1 text-zinc-400 hover:text-black disabled:opacity-20 transition"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRoute(folder.id, routeHref)}
                                className="p-1 text-zinc-400 hover:text-red-600 transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Unassigned routes block */}
            <div className="pt-5 border-t border-zinc-100 space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-black block">
                  3. Aggiungi Tasti Disponibili
                </span>
                <p className="text-[10px] text-zinc-500">
                  Queste pagine non sono visibili nella barra. Scegli una sezione e clicca "+" per aggiungerle.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
                <span className="text-[10px] font-black uppercase text-zinc-500">Aggiungi alla sezione:</span>
                <select
                  value={activeFolderForAdd}
                  onChange={(e) => setActiveFolderForAdd(e.target.value)}
                  className="h-8 rounded-xl border border-zinc-200 px-3 text-xs font-bold bg-white outline-none"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>

              {unassignedPages.length === 0 ? (
                <div className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest py-4">
                  Tutte le pagine sono assegnate alla barra laterale!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {unassignedPages.map((page) => (
                    <div
                      key={page.path}
                      className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-zinc-600 block truncate">{page.name}</span>
                        <span className="text-[9px] font-mono text-zinc-400 truncate block">{page.path}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddRoute(activeFolderForAdd, page.path)}
                        className="p-1.5 rounded-lg bg-[#2563eb]/10 hover:bg-[#2563eb] text-[#2563eb] hover:text-white transition"
                        title="Aggiungi"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </Card>
        </div>

      </div>

    </div>
  );
}
