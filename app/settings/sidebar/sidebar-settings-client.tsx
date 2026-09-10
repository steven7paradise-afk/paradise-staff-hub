"use client";

import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Folder,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
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
  UsersRound,
  X,
} from "lucide-react";
import { Card } from "@/components/ui";
import { DynamicIcon } from "@/components/dynamic-icon";
import { routePermissions } from "@/lib/roles";
import { SIDEBAR_ICON_OPTIONS } from "@/lib/sidebar-icons";

type SidebarFolder = {
  id: string;
  title: string;
  routes: string[];
  labels?: Record<string, string>;
  icons?: Record<string, string>;
  area?: "LAVORO" | "PERSONALE";
};

type SidebarLayoutConfig = {
  default: SidebarFolder[];
  targets: Record<string, SidebarFolder[]>;
};

const PAGE_ICONS: Record<string, string> = {
  "/dashboard": "LayoutDashboard",
  "/hub": "PanelsTopLeft",
  "/my-shifts": "CalendarDays",
  "/responsabile-di-turno": "UserRound",
  "/programmazione-responsabile-di-turno": "CalendarDays",
  "/tasks": "CheckSquare",
  "/notifications": "Bell",
  "/email": "Mail",
  "/schedules": "CalendarDays",
  "/social-calendar": "Share2",
  "/locations": "Building2",
  "/orders": "ShoppingCart",
  "/shopify-orders": "Store",
  "/shipping": "Truck",
  "/appointments": "CalendarCheck",
  "/consulenza-online": "Video",
  "/cash": "DollarSign",
  "/cassa-live": "CashRegister",
  "/invoices": "ReceiptText",
  "/refunds": "RotateCcw",
  "/rimborsi": "RotateCcw",
  "/client-control": "BarChart3",
  "/fine-giornata": "ClipboardCheck",
  "/tables": "Table2",
  "/points": "Award",
  "/tablet-clock": "Smartphone",
  "/staff": "Users",
  "/employees": "Users",
  "/recruitment": "UserPlus",
  "/attendance": "CalendarCheck",
  "/work-hours": "Calculator",
  "/requests": "ShieldCheck",
  "/documents": "FileText",
  "/cedolini": "FileCheck2",
  "/malattie": "Heart",
  "/team": "Users",
  "/profile": "UserRound",
  "/settings": "Settings",
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
  "/cassa-live": "Terminale POS",
  "/invoices": "Fatture",
  "/refunds": "Rimborsi",
  "/rimborsi": "Rimborsi vecchio link",
  "/client-control": "Controllo Cliente",
  "/fine-giornata": "Fine giornata",
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
  iconName: PAGE_ICONS[path] || "Settings",
}));

const DEFAULT_LAYOUT: SidebarFolder[] = [
  {
    id: "generale",
    title: "Generale",
    routes: ["/dashboard", "/my-shifts", "/tasks", "/notifications", "/email"],
    area: "LAVORO",
  },
  {
    id: "planning",
    title: "Planning & Saloni",
    routes: ["/schedules", "/orders"],
    area: "LAVORO",
  },
  {
    id: "staff",
    title: "Gestione Staff",
    routes: ["/requests", "/documents", "/malattie"],
    area: "PERSONALE",
  },
  { id: "settings", title: "Impostazioni", routes: ["/profile", "/settings"], area: "PERSONALE" },
];

function normalizeMansioneKey(value: string) {
  return value.trim().toLowerCase();
}

function inferArea(folder: Pick<SidebarFolder, "title" | "area">) {
  if (folder.area) return folder.area;
  const title = folder.title.toLowerCase();
  return title.includes("il mio lavoro") || title.includes("personale") || title.includes("profilo")
    ? "PERSONALE" as const
    : "LAVORO" as const;
}

function normalizeFolders(value: unknown): SidebarFolder[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const folder: SidebarFolder = {
        id: typeof item.id === "string" ? item.id : `folder-${index}`,
        title: typeof item.title === "string" ? item.title : "Sezione",
        routes: Array.isArray(item.routes) ? item.routes.filter((route): route is string => typeof route === "string") : [],
        labels: item.labels && typeof item.labels === "object" && !Array.isArray(item.labels) ? item.labels as Record<string, string> : {},
        icons: item.icons && typeof item.icons === "object" && !Array.isArray(item.icons) ? item.icons as Record<string, string> : {},
        area: item.area === "PERSONALE" || item.area === "LAVORO" ? item.area : undefined,
      };
      return { ...folder, area: inferArea(folder) };
    });
}

function cloneFolders(folders: SidebarFolder[]) {
  return folders.map((folder) => ({
    ...folder,
    routes: [...folder.routes],
    labels: { ...folder.labels },
    icons: { ...folder.icons },
  }));
}

function getInitialConfig(initialLayout: unknown): SidebarLayoutConfig {
  if (Array.isArray(initialLayout)) {
    const folders = normalizeFolders(initialLayout);
    return { default: folders.length ? folders : cloneFolders(DEFAULT_LAYOUT), targets: {} };
  }
  if (initialLayout && typeof initialLayout === "object") {
    const raw = initialLayout as { default?: unknown; targets?: unknown };
    const defaultFolders = normalizeFolders(raw.default);
    const rawTargets = raw.targets && typeof raw.targets === "object" && !Array.isArray(raw.targets)
      ? raw.targets as Record<string, unknown>
      : {};
    return {
      default: defaultFolders.length ? defaultFolders : cloneFolders(DEFAULT_LAYOUT),
      targets: Object.fromEntries(
        Object.entries(rawTargets).map(([key, value]) => [normalizeMansioneKey(key), normalizeFolders(value)]),
      ),
    };
  }
  return { default: cloneFolders(DEFAULT_LAYOUT), targets: {} };
}

export function SidebarSettingsClient({
  initialLayout,
  mansioni,
}: {
  initialLayout: unknown;
  mansioni: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const initialConfig = useMemo(() => getInitialConfig(initialLayout), [initialLayout]);
  const [layoutConfig, setLayoutConfig] = useState<SidebarLayoutConfig>(initialConfig);
  const [savedLayout, setSavedLayout] = useState(() =>
    JSON.stringify(initialConfig),
  );
  const [activeTarget, setActiveTarget] = useState("default");

  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolderForAdd, setActiveFolderForAdd] = useState<string>("");
  const [pageQuery, setPageQuery] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingRouteKey, setEditingRouteKey] = useState<string | null>(null);
  const [previewArea, setPreviewArea] = useState<"LAVORO" | "PERSONALE">("LAVORO");

  const mansioneOptions = useMemo(() => {
    const labels = new Map<string, string>();
    mansioni.forEach((mansione) => labels.set(normalizeMansioneKey(mansione), mansione.trim()));
    Object.keys(layoutConfig.targets).forEach((key) => {
      if (!labels.has(key)) labels.set(key, key);
    });
    return Array.from(labels, ([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));
  }, [layoutConfig.targets, mansioni]);
  const isDefaultTarget = activeTarget === "default";
  const isInheritedTarget = !isDefaultTarget && !Object.prototype.hasOwnProperty.call(layoutConfig.targets, activeTarget);
  const folders = isDefaultTarget
    ? layoutConfig.default
    : layoutConfig.targets[activeTarget] ?? layoutConfig.default;
  const activeTargetLabel = isDefaultTarget
    ? "Menu generale"
    : mansioneOptions.find((option) => option.key === activeTarget)?.label ?? activeTarget;

  const setFolders = (value: SetStateAction<SidebarFolder[]>) => {
    setLayoutConfig((current) => {
      const currentFolders = activeTarget === "default"
        ? current.default
        : current.targets[activeTarget] ?? cloneFolders(current.default);
      const nextFolders = typeof value === "function" ? value(currentFolders) : value;
      if (activeTarget === "default") return { ...current, default: nextFolders };
      return { ...current, targets: { ...current.targets, [activeTarget]: nextFolders } };
    });
  };

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
  const serializedLayout = JSON.stringify(layoutConfig);
  const hasUnsavedChanges = savedLayout !== serializedLayout;

  useEffect(() => {
    if (!folders.length) {
      setActiveFolderForAdd("");
      return;
    }
    if (!folders.some((folder) => folder.id === activeFolderForAdd)) {
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

  const handleSetFolderArea = (folderId: string, area: "LAVORO" | "PERSONALE") => {
    setFolders((current) => current.map((folder) => folder.id === folderId
      ? { ...folder, area }
      : folder));
  };

  const handleRestoreSavedLayout = () => {
    if (
      !hasUnsavedChanges ||
      !window.confirm("Annullare tutte le modifiche non salvate?")
    )
      return;
    try {
      setLayoutConfig(JSON.parse(savedLayout) as SidebarLayoutConfig);
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
        const labels = { ...f.labels };
        const icons = { ...f.icons };
        delete labels[routePath];
        delete icons[routePath];
        return { ...f, routes: f.routes.filter((r) => r !== routePath), labels, icons };
      }),
    );
    setEditingRouteKey((current) => current === `${folderId}:${routePath}` ? null : current);
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

  const handleSetRouteLabel = (folderId: string, routePath: string, value: string) => {
    setFolders((current) => current.map((folder) => {
      if (folder.id !== folderId) return folder;
      const labels = { ...folder.labels };
      const trimmed = value.slice(0, 48);
      if (trimmed) labels[routePath] = trimmed;
      else delete labels[routePath];
      return { ...folder, labels };
    }));
  };

  const handleSetRouteIcon = (folderId: string, routePath: string, iconName: string) => {
    setFolders((current) => current.map((folder) => folder.id === folderId
      ? { ...folder, icons: { ...folder.icons, [routePath]: iconName } }
      : folder));
  };

  const handleResetRouteCustomization = (folderId: string, routePath: string) => {
    setFolders((current) => current.map((folder) => {
      if (folder.id !== folderId) return folder;
      const labels = { ...folder.labels };
      const icons = { ...folder.icons };
      delete labels[routePath];
      delete icons[routePath];
      return { ...folder, labels, icons };
    }));
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
          layout: layoutConfig,
        }),
      });

      if (!layoutRes.ok) {
        const err = await layoutRes.json();
        throw new Error(
          err.error || "Errore nel salvataggio dell'ordine dei tasti.",
        );
      }

      setSavedLayout(JSON.stringify(layoutConfig));
      setSuccessMsg(
        "Menu salvato. Ogni lavoratore vedrà le pagine della propria mansione.",
      );
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMansione = () => {
    if (isDefaultTarget || isInheritedTarget) return;
    if (!window.confirm(`Ripristinare per “${activeTargetLabel}” il menu generale?`)) return;
    setLayoutConfig((current) => {
      const targets = { ...current.targets };
      delete targets[activeTarget];
      return { ...current, targets };
    });
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

      <Card className="border border-zinc-200 bg-white p-4 shadow-sm hover:translate-y-0 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <UsersRound size={19} />
            </span>
            <div>
              <p className="text-sm font-black text-zinc-950">Menu per mansione</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                La stessa pagina può essere aggiunta a tutte le mansioni che ne hanno bisogno.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Mansione da configurare
              <select
                value={activeTarget}
                onChange={(event) => {
                  setActiveTarget(event.target.value);
                  setEditingRouteKey(null);
                  setPageQuery("");
                }}
                className="mt-1 block h-11 min-w-64 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-zinc-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="default">Menu generale (amministratori)</option>
                {mansioneOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            {!isDefaultTarget && !isInheritedTarget ? (
              <button
                type="button"
                onClick={handleResetMansione}
                className="mt-auto h-11 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-600 transition hover:bg-zinc-50"
              >
                Usa menu generale
              </button>
            ) : null}
          </div>
        </div>
        {!isDefaultTarget ? (
          <div className={`mt-4 rounded-xl px-3 py-2.5 text-xs font-bold ${isInheritedTarget ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {isInheritedTarget
              ? `${activeTargetLabel} usa per ora il menu generale. La prima modifica creerà automaticamente il suo menu personale.`
              : `${activeTargetLabel} ha un menu personalizzato.`}
          </div>
        ) : null}
      </Card>

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
                Stai configurando <strong>{activeTargetLabel}</strong>. Per ogni sezione scegli Personale o Lavoro.
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
                      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                        <fieldset>
                          <legend className="px-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                            Tipo di sezione
                          </legend>
                          <div className="mt-1 flex gap-2">
                            {(["LAVORO", "PERSONALE"] as const).map((area) => {
                              const selected = (folder.area ?? "LAVORO") === area;
                              return (
                                <button
                                  key={area}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => handleSetFolderArea(folder.id, area)}
                                  className={`min-h-9 rounded-full border px-3 text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "border-pink-600 bg-pink-600 text-white" : "border-zinc-200 bg-white text-zinc-500 hover:border-pink-300 hover:text-pink-700"}`}
                                >
                                  {area === "LAVORO" ? "Lavoro" : "Personale"}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>

                      </div>
                      {folder.routes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-center text-xs font-semibold text-zinc-400">
                          Questa sezione è vuota. Aggiungi un tasto dalle pagine
                          disponibili.
                        </div>
                      ) : (
                        folder.routes.map((routeHref, routeIndex) => {
                          const page = ALL_PAGES.find(
                            (p) => p.path === routeHref,
                          ) || { name: routeHref, path: routeHref, iconName: "Settings" };
                          const customLabel = folder.labels?.[routeHref] || "";
                          const displayedName = customLabel || page.name;
                          const displayedIcon = folder.icons?.[routeHref] || page.iconName;
                          const routeKey = `${folder.id}:${routeHref}`;
                          const isEditing = editingRouteKey === routeKey;
                          return (
                            <div
                              key={routeHref}
                              title={routeHref}
                              className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${isEditing ? "border-pink-300 ring-2 ring-pink-100" : "border-zinc-200"}`}
                            >
                              <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-3">
                                  <GripVertical size={16} className="shrink-0 text-zinc-300" />
                                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pink-50 text-pink-600">
                                    <DynamicIcon name={displayedIcon} className="size-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-zinc-700">{displayedName}</p>
                                    {customLabel || folder.icons?.[routeHref] ? <p className="text-[9px] font-black uppercase tracking-wide text-pink-500">Personalizzato</p> : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <ActionButton label={`Personalizza ${displayedName}`} onClick={() => setEditingRouteKey(isEditing ? null : routeKey)}>
                                    {isEditing ? <X size={14} /> : <Edit3 size={14} />}
                                  </ActionButton>
                                  <ActionButton label={`Sposta ${displayedName} su`} disabled={routeIndex === 0} onClick={() => handleMoveRoute(folder.id, routeIndex, "up")}>
                                    <ArrowUp size={14} />
                                  </ActionButton>
                                  <ActionButton label={`Sposta ${displayedName} giù`} disabled={routeIndex === folder.routes.length - 1} onClick={() => handleMoveRoute(folder.id, routeIndex, "down")}>
                                    <ArrowDown size={14} />
                                  </ActionButton>
                                  <ActionButton label={`Rimuovi ${displayedName}`} danger onClick={() => handleRemoveRoute(folder.id, routeHref)}>
                                    <Trash2 size={14} />
                                  </ActionButton>
                                </div>
                              </div>
                              {isEditing ? (
                                <div className="border-t border-pink-100 bg-pink-50/40 p-3 sm:p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                      Nome del tasto
                                      <input
                                        value={customLabel}
                                        maxLength={48}
                                        onChange={(event) => handleSetRouteLabel(folder.id, routeHref, event.target.value)}
                                        placeholder={page.name}
                                        className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-zinc-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                                      />
                                    </label>
                                    {(customLabel || folder.icons?.[routeHref]) ? (
                                      <button type="button" onClick={() => handleResetRouteCustomization(folder.id, routeHref)} className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-600 hover:bg-zinc-50">
                                        Ripristina originale
                                      </button>
                                    ) : null}
                                  </div>
                                  <fieldset className="mt-4">
                                    <legend className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Scegli icona</legend>
                                    <div className="mt-2 grid max-h-48 grid-cols-6 gap-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 sm:grid-cols-9">
                                      {SIDEBAR_ICON_OPTIONS.map((icon) => (
                                        <button
                                          key={icon.name}
                                          type="button"
                                          title={icon.label}
                                          aria-label={`Usa icona ${icon.label}`}
                                          aria-pressed={displayedIcon === icon.name}
                                          onClick={() => handleSetRouteIcon(folder.id, routeHref, icon.name)}
                                          className={`grid aspect-square min-h-10 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${displayedIcon === icon.name ? "bg-[#C84F89] text-white shadow-sm" : "bg-zinc-50 text-zinc-500 hover:bg-pink-50 hover:text-pink-600"}`}
                                        >
                                          <DynamicIcon name={icon.name} className="size-4" />
                                        </button>
                                      ))}
                                    </div>
                                  </fieldset>
                                </div>
                              ) : null}
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
                  {activeTargetLabel}
                </p>
              </div>
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
              <div className="mb-4 grid grid-cols-2 rounded-xl border border-current/10 bg-white/5 p-1">
                {(["PERSONALE", "LAVORO"] as const).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setPreviewArea(area)}
                    className={`min-h-9 rounded-lg px-2 text-[9px] font-black uppercase tracking-wider transition ${previewArea === area ? "bg-white text-zinc-900 shadow-sm" : "opacity-55"}`}
                  >
                    {area === "PERSONALE" ? "Personale" : "Lavoro"}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {folders
                  .filter((folder) => (folder.area ?? "LAVORO") === previewArea)
                  .map((folder) => (
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
                          const previewLabel = folder.labels?.[routeHref] || page?.name || routeHref;
                          const previewIcon = folder.icons?.[routeHref] || page?.iconName || "Settings";
                          return (
                            <div
                              key={routeHref}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold ${folderIndexIsFirst(folders, folder.id) && routeIndex === 0 ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]" : ""}`}
                            >
                              <DynamicIcon name={previewIcon} className="size-3.5 shrink-0 opacity-70" />
                              <span className="truncate">
                                {previewLabel}
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
              <div className="mt-6 border-t border-current/10 pt-3">
                <p className="px-2 text-[8px] font-black uppercase tracking-[0.18em] opacity-45">Account</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/25">
                    <UsersRound className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black">Nome lavoratore</p>
                    <p className="truncate text-[8px] font-bold opacity-55">{activeTargetLabel}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2 px-4 pb-4">
              <p className="text-xs leading-relaxed text-zinc-500">
                L’anteprima mostra le sezioni della mansione e della categoria
                selezionata. L’account resta sempre disponibile in basso.
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
