export type Role = "SUPER_ADMIN" | "ADMIN" | "RESPONSABILE" | "MAGAZZINO" | "DIPENDENTE";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RESPONSABILE: "Responsabile",
  MAGAZZINO: "Magazzino",
  DIPENDENTE: "Dipendente",
};

export const routePermissions: Record<string, Role[]> = {
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/my-shifts": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tasks": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/employees": ["SUPER_ADMIN", "ADMIN"],
  "/attendance": ["SUPER_ADMIN", "ADMIN"],
  "/work-hours": ["SUPER_ADMIN", "ADMIN"],
  "/schedules": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/social-calendar": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/locations": ["SUPER_ADMIN", "ADMIN"],
  "/tablet-clock": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/requests": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/documents": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/cedolini": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/malattie": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/service-notes": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/service-forms": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tables": ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/orders": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/magazzino": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/foto": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/points": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/appointments": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/consulenza-online": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/cash": ["SUPER_ADMIN", "ADMIN"],
  "/invoices": ["SUPER_ADMIN", "ADMIN"],
  "/refunds": ["SUPER_ADMIN", "ADMIN"],
  "/rimborsi": ["SUPER_ADMIN", "ADMIN"],
  "/client-control": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/recruitment": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/staff": ["SUPER_ADMIN", "ADMIN"],
  "/team": ["SUPER_ADMIN", "ADMIN"],
  "/notifications": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/profile": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"],
  "/settings": ["SUPER_ADMIN", "ADMIN"],
  "/settings/app": ["SUPER_ADMIN", "ADMIN"],
  "/settings/dashboard": ["SUPER_ADMIN", "ADMIN"],
  "/settings/branding": ["SUPER_ADMIN"],
  "/settings/devices": ["SUPER_ADMIN"],
  "/settings/google-sheet": ["SUPER_ADMIN"],
  "/settings/email": ["SUPER_ADMIN"],
  "/settings/roles": ["SUPER_ADMIN"],
  "/settings/tasks": ["SUPER_ADMIN"],
  "/settings/tables": ["SUPER_ADMIN", "ADMIN"],
  "/settings/planning": ["SUPER_ADMIN", "ADMIN"],
  "/settings/services": ["SUPER_ADMIN"],
  "/settings/forms": ["SUPER_ADMIN", "ADMIN"],
  "/settings/sidebar": ["SUPER_ADMIN", "ADMIN"],
};

const legacyAccessRouteMap: Record<string, string> = {
  dashboard: "/dashboard",
  "i miei turni": "/my-shifts",
  turni: "/my-shifts",
  task: "/tasks",
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

function isApiRoute(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function canAccess(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

  if (pathname === "/") return true;
  if (isApiRoute(pathname)) return true;

  // Custom access list check
  if (
    accessList &&
    role !== "SUPER_ADMIN" &&
    (
      (Array.isArray(accessList) && accessList.length > 0) ||
      (!Array.isArray(accessList) && typeof accessList === "object")
    )
  ) {
    let viewRoutes: string[] = [];
    if (Array.isArray(accessList)) {
      viewRoutes = normalizeAccessRoutes(accessList);
    } else if (accessList && typeof accessList === "object" && Array.isArray(accessList.view)) {
      viewRoutes = normalizeAccessRoutes(accessList.view);
    }

    const matchedRoute = Object.keys(routePermissions)
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname === route || pathname.startsWith(`${route}/`));
    
    if (matchedRoute) {
      return viewRoutes.includes(matchedRoute);
    }

    return false;
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

  const match = Object.entries(routePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

  return match ? match[1].includes(role) : false;
}

export function canEdit(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

  if (role === "SUPER_ADMIN") return true;

  // Custom edit list check
  if (accessList && role !== "SUPER_ADMIN") {
    if (accessList && typeof accessList === "object" && Array.isArray(accessList.edit)) {
      const editRoutes = normalizeAccessRoutes(accessList.edit);
      const matchedRoute = Object.keys(routePermissions)
        .sort((a, b) => b.length - a.length)
        .find((route) => pathname === route || pathname.startsWith(`${route}/`));
      
      if (matchedRoute) {
        return editRoutes.includes(matchedRoute);
      }
    }
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

  if (pathname === "/recruitment" || pathname.startsWith("/recruitment/")) {
    return ["ADMIN", "RESPONSABILE"].includes(role);
  }

  return ["ADMIN"].includes(role);
}

export async function getEffectiveAccessList(prisma: any, user: { id: string; access_list?: any; mansione?: string | null }) {
  if (
    user.access_list &&
    (
      (Array.isArray(user.access_list) && user.access_list.length > 0) ||
      (!Array.isArray(user.access_list) && typeof user.access_list === "object")
    )
  ) {
    return user.access_list;
  }

  if (!user.mansione) return undefined;

  const mansioneSettings = await prisma.setting.findUnique({
    where: { key: "mansioni_permissions" }
  });
  const mapping = (mansioneSettings?.value as Record<string, any>) || {};
  const cleanMansione = user.mansione.trim().toLowerCase();
  return mapping[cleanMansione];
}

export async function canAccessForUser(prisma: any, pathname: string, user: { id: string; role?: Role | string; mansione?: string | null; access_list?: any }) {
  const accessList = await getEffectiveAccessList(prisma, user);
  return canAccess(pathname, user.role as Role | undefined, user.mansione || undefined, accessList);
}

export async function canEditForUser(prisma: any, pathname: string, user: { id: string; role?: Role | string; mansione?: string | null; access_list?: any }) {
  const accessList = await getEffectiveAccessList(prisma, user);
  return canEdit(pathname, user.role as Role | undefined, user.mansione || undefined, accessList);
}

export function visibleForRole<T extends { roles: Role[] }>(items: T[], role: Role) {
  return items.filter((item) => item.roles.includes(role));
}
