export type Role = "ZERO" | "SUPER_ADMIN" | "ADMIN" | "RESPONSABILE" | "MAGAZZINO" | "DIPENDENTE";
export type PermissionSet = { view: string[]; edit: string[] };
export type RolePermissionMap = Record<Role, PermissionSet>;
export type MansionePermissionMap = Record<string, PermissionSet>;

export const ROLE_PERMISSIONS_SETTING_KEY = "role_permissions";
export const MANSIONI_PERMISSIONS_SETTING_KEY = "mansioni_permissions";

export const roleLabels: Record<Role, string> = {
  ZERO: "Zero",
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RESPONSABILE: "Responsabile",
  MAGAZZINO: "Magazzino",
  DIPENDENTE: "Dipendente",
};

export const routePermissions: Record<string, Role[]> = {
  "/dashboard": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/hub": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/my-shifts": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tasks": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/shift-reports": ["RESPONSABILE"],
  "/shift-reports/admin": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/employees": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/attendance": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/work-hours": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/schedules": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/social-calendar": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/locations": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/tablet-clock": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/requests": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/documents": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/cedolini": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/malattie": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/service-notes": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/service-forms": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tables": ["ZERO", "SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/orders": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/shipping": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO"],
  "/ordine": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/magazzino": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/foto": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/points": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/appointments": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/consulenza-online": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/cash": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/invoices": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/refunds": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/rimborsi": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/client-control": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/recruitment": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/staff": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/team": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/notifications": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/email": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/profile": ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/settings": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/app": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/dashboard": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/branding": ["ZERO"],
  "/settings/devices": ["ZERO"],
  "/settings/google-sheet": ["ZERO"],
  "/settings/email": ["ZERO"],
  "/settings/roles": ["ZERO"],
  "/settings/tasks": ["ZERO"],
  "/settings/tables": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/planning": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/services": ["ZERO"],
  "/settings/forms": ["ZERO", "SUPER_ADMIN", "ADMIN"],
  "/settings/sidebar": ["ZERO", "SUPER_ADMIN", "ADMIN"],
};

export function defaultEditRolesForPath(pathname: string): Role[] {
  if (pathname === "/shift-reports") return ["ZERO", "RESPONSABILE"];
  if (pathname === "/shift-reports/admin") return ["ZERO", "SUPER_ADMIN", "ADMIN"];
  if (pathname === "/social-calendar") return ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
  if (pathname === "/shipping") return ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO"];
  if (pathname === "/orders" || pathname === "/recruitment") return ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"];
  if (pathname === "/settings/tables" || pathname === "/settings/planning" || pathname === "/settings/forms") return ["ZERO", "SUPER_ADMIN", "ADMIN"];
  if (pathname.startsWith("/settings")) return ["ZERO"];
  return ["ZERO", "SUPER_ADMIN", "ADMIN"];
}

const legacyAccessRouteMap: Record<string, string> = {
  dashboard: "/dashboard",
  hub: "/hub",
  "paradise hub": "/hub",
  "i miei turni": "/my-shifts",
  turni: "/my-shifts",
  task: "/tasks",
  "report di turno": "/shift-reports",
  "registro giornate": "/shift-reports",
  "registro giornate admin": "/shift-reports/admin",
  documenti: "/documents",
  planning: "/schedules",
  schedules: "/schedules",
  "programmazione social": "/social-calendar",
  social: "/social-calendar",
  ordini: "/orders",
  orders: "/orders",
  magazzino: "/magazzino",
  foto: "/foto",
  appuntamenti: "/appointments",
  appointments: "/appointments",
  "consulenza online": "/consulenza-online",
  cassa: "/cash",
  cash: "/cash",
  transazioni: "/cash",
  "chiusure cassa": "/cash",
  fatture: "/invoices",
  invoices: "/invoices",
  rimborsi: "/refunds",
  refunds: "/refunds",
  "controllo cliente": "/client-control",
  "client control": "/client-control",
  tabelle: "/tables",
  "tablet clock": "/tablet-clock",
  moduli: "/service-forms",
  "moduli operativi": "/service-forms",
  "staff paradise": "/staff",
  staff: "/staff",
  recruitment: "/recruitment",
  "talent system": "/recruitment",
  timbrature: "/attendance",
  presenze: "/attendance",
  "ore staff": "/work-hours",
  "ferie e permessi": "/requests",
  richieste: "/requests",
  cedolini: "/cedolini",
  malattie: "/malattie",
  team: "/team",
  comunicazioni: "/notifications",
  notifiche: "/notifications",
  email: "/email",
  profilo: "/profile",
  profile: "/profile",
  impostazioni: "/settings",
};

function normalizeAccessRoute(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (routePermissions[clean]) return clean;
  const lower = clean.toLowerCase();
  if (routePermissions[`/${lower}`]) return `/${lower}`;
  return legacyAccessRouteMap[lower] ?? clean;
}

export function normalizeAccessRoutes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map(normalizeAccessRoute)
        .filter(Boolean)
    )
  );
}

export function normalizePermissionSet(value: unknown): PermissionSet {
  if (Array.isArray(value)) {
    return { view: normalizeAccessRoutes(value), edit: [] };
  }

  if (value && typeof value === "object") {
    const raw = value as { view?: unknown; edit?: unknown };
    const view = normalizeAccessRoutes(raw.view);
    const edit = normalizeAccessRoutes(raw.edit).filter((route) => view.includes(route));
    return { view, edit };
  }

  return { view: [], edit: [] };
}

export function defaultRolePermissions(): RolePermissionMap {
  const allRoutes = Object.keys(routePermissions);
  return {
    ZERO: { view: allRoutes, edit: allRoutes },
    SUPER_ADMIN: {
      view: allRoutes.filter((route) => routePermissions[route]?.includes("SUPER_ADMIN")),
      edit: allRoutes.filter((route) => defaultEditRolesForPath(route).includes("SUPER_ADMIN")),
    },
    ADMIN: {
      view: allRoutes.filter((route) => routePermissions[route]?.includes("ADMIN")),
      edit: allRoutes.filter((route) => defaultEditRolesForPath(route).includes("ADMIN")),
    },
    RESPONSABILE: {
      view: allRoutes.filter((route) => routePermissions[route]?.includes("RESPONSABILE")),
      edit: allRoutes.filter((route) => defaultEditRolesForPath(route).includes("RESPONSABILE")),
    },
    MAGAZZINO: {
      view: allRoutes.filter((route) => routePermissions[route]?.includes("MAGAZZINO")),
      edit: allRoutes.filter((route) => defaultEditRolesForPath(route).includes("MAGAZZINO")),
    },
    DIPENDENTE: {
      view: allRoutes.filter((route) => routePermissions[route]?.includes("DIPENDENTE")),
      edit: allRoutes.filter((route) => defaultEditRolesForPath(route).includes("DIPENDENTE")),
    },
  };
}

export function normalizeRolePermissions(value: unknown): RolePermissionMap {
  const defaults = defaultRolePermissions();
  const rawMap = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<Record<Role, unknown>>
    : {};

  const next = { ...defaults };
  (Object.keys(defaults) as Role[]).forEach((role) => {
    if (role === "ZERO") return;
    if (rawMap[role] !== undefined) next[role] = normalizePermissionSet(rawMap[role]);
  });
  next.ZERO = defaults.ZERO;
  return next;
}

export function normalizeMansionePermissions(value: unknown): MansionePermissionMap {
  const rawMap = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([name, permissions]) => [name.trim().toLowerCase(), normalizePermissionSet(permissions)] as const)
      .filter(([name]) => Boolean(name))
  );
}

// La mansione estende il ruolo: non deve nascondere pagine abilitate per il ruolo.
export function mergePermissionSets(base: PermissionSet, extension?: PermissionSet | null): PermissionSet {
  if (!extension) return base;
  const view = Array.from(new Set([...base.view, ...extension.view]));
  const edit = Array.from(new Set([...base.edit, ...extension.edit])).filter((route) => view.includes(route));
  return { view, edit };
}

function matchRoute(pathname: string) {
  return Object.keys(routePermissions)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isApiRoute(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function hasExplicitPermissionSet(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && ("view" in value || "edit" in value));
}

export function canAccess(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

  if (pathname === "/") return true;
  if (isApiRoute(pathname)) return true;
  if (role === "ZERO") return Boolean(matchRoute(pathname));

  const matchedRoute = matchRoute(pathname);
  const permissions = normalizePermissionSet(accessList);
  if (matchedRoute && hasExplicitPermissionSet(accessList)) {
    return permissions.view.includes(matchedRoute);
  }

  // Abilita la pagina appuntamenti per chiunque abbia "assistenza" nella mansione
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) {
    if (role === "DIPENDENTE" && mansione && mansione.toLowerCase().includes("assistenza")) {
      return true;
    }
  }

  // Abilita la pagina consulenza online per chiunque abbia "assistenza" nella mansione
  if (pathname === "/consulenza-online" || pathname.startsWith("/consulenza-online/")) {
    if (role === "DIPENDENTE" && mansione && mansione.toLowerCase().includes("assistenza")) {
      return true;
    }
  }

  return matchedRoute ? routePermissions[matchedRoute].includes(role) : false;
}

export function canEdit(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

  if (role === "ZERO") return true;
  const matchedRoute = matchRoute(pathname);
  const permissions = normalizePermissionSet(accessList);
  if (matchedRoute && hasExplicitPermissionSet(accessList)) {
    return permissions.edit.includes(matchedRoute);
  }

  // Fallback to default edit rules defined in the matrix
  const isSettings = pathname.startsWith("/settings");
  if (isSettings) {
    if (pathname === "/settings/tables" || pathname === "/settings/planning" || pathname === "/settings/forms") {
      return role === "ADMIN";
    }
    return false;
  }

  if (pathname === "/social-calendar" || pathname.startsWith("/social-calendar/")) {
    return ["ADMIN", "RESPONSABILE", "DIPENDENTE"].includes(role);
  }

  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    return ["ADMIN", "RESPONSABILE"].includes(role);
  }

  if (pathname === "/shipping" || pathname.startsWith("/shipping/")) {
    return ["ADMIN", "RESPONSABILE", "MAGAZZINO"].includes(role);
  }

  if (pathname === "/recruitment" || pathname.startsWith("/recruitment/")) {
    return ["ADMIN", "RESPONSABILE"].includes(role);
  }

  return ["ADMIN"].includes(role);
}

export async function getEffectiveAccessList(prisma: any, user: { id: string; access_list?: any; mansione?: string | null }) {
  return undefined;
}

export async function getEffectivePermissionSet(prisma: any, user: { id: string; role?: Role | string; mansione?: string | null }) {
  const role = user.role as Role | undefined;
  if (!role) return undefined;
  if (role === "ZERO") return defaultRolePermissions().ZERO;

  const [roleSetting, mansioneSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: MANSIONI_PERMISSIONS_SETTING_KEY } }).catch(() => null),
  ]);

  const rolePermissions = normalizeRolePermissions(roleSetting?.value);
  const mansionePermissions = normalizeMansionePermissions(mansioneSetting?.value);
  const cleanMansione = user.mansione?.trim().toLowerCase();

  return mergePermissionSets(rolePermissions[role], cleanMansione ? mansionePermissions[cleanMansione] : null);
}

export async function canAccessForUser(prisma: any, pathname: string, user: { id: string; role?: Role | string; mansione?: string | null; access_list?: any }) {
  const permissions = await getEffectivePermissionSet(prisma, user);
  return canAccess(pathname, user.role as Role | undefined, user.mansione || undefined, permissions);
}

export async function canEditForUser(prisma: any, pathname: string, user: { id: string; role?: Role | string; mansione?: string | null; access_list?: any }) {
  const permissions = await getEffectivePermissionSet(prisma, user);
  return canEdit(pathname, user.role as Role | undefined, user.mansione || undefined, permissions);
}

export function visibleForRole<T extends { roles: Role[] }>(items: T[], role: Role) {
  return items.filter((item) => item.roles.includes(role));
}
