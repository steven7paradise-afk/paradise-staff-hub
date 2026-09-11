import { isSidebarIconName } from "./sidebar-icons";

export type SidebarArea = "LAVORO" | "PERSONALE";

export type SidebarFolder = {
  id: string;
  title: string;
  routes: string[];
  labels?: Record<string, string>;
  icons?: Record<string, string>;
  area?: SidebarArea;
};

export function inferSidebarArea(folder: { title?: unknown; area?: unknown }): SidebarArea {
  if (folder.area === "PERSONALE") return "PERSONALE";
  if (folder.area === "LAVORO") return "LAVORO";
  const title = typeof folder.title === "string" ? folder.title.toLowerCase() : "";
  return title.includes("il mio lavoro") || title.includes("personale") || title.includes("profilo")
    ? "PERSONALE"
    : "LAVORO";
}

export function normalizeSidebarFolders(value: unknown): SidebarFolder[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((folder): folder is Record<string, unknown> => Boolean(folder) && typeof folder === "object")
    .map((folder, index) => ({
      id: typeof folder.id === "string" ? folder.id : `folder-${index}`,
      title: typeof folder.title === "string" ? folder.title : "Menu",
      routes: Array.isArray(folder.routes) ? folder.routes.filter((route): route is string => typeof route === "string") : [],
      labels: folder.labels && typeof folder.labels === "object" && !Array.isArray(folder.labels)
        ? Object.fromEntries(Object.entries(folder.labels).filter(([, label]) => typeof label === "string")) as Record<string, string>
        : {},
      icons: folder.icons && typeof folder.icons === "object" && !Array.isArray(folder.icons)
        ? Object.fromEntries(Object.entries(folder.icons).filter(([, icon]) => isSidebarIconName(icon))) as Record<string, string>
        : {},
      area: inferSidebarArea(folder),
    }));
}

export function resolveSidebarLayout(
  value: unknown,
  role: string,
  mansione?: string | null,
): SidebarFolder[] | null {
  if (Array.isArray(value)) return normalizeSidebarFolders(value);
  if (!value || typeof value !== "object") return null;

  const raw = value as { default?: unknown; targets?: unknown };
  const targets = raw.targets && typeof raw.targets === "object" && !Array.isArray(raw.targets)
    ? raw.targets as Record<string, unknown>
    : {};
  const cleanMansione = mansione?.trim().toLowerCase();
  const hasMansioneLayout = Boolean(cleanMansione)
    && Object.prototype.hasOwnProperty.call(targets, cleanMansione as string);
  const targetLayout = hasMansioneLayout
    ? targets[cleanMansione as string]
    : targets[role];

  return normalizeSidebarFolders(targetLayout ?? raw.default);
}
