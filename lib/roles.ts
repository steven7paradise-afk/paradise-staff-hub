export type Role = "SUPER_ADMIN" | "ADMIN" | "RESPONSABILE" | "DIPENDENTE";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RESPONSABILE: "Responsabile",
  DIPENDENTE: "Dipendente",
};

export const routePermissions: Record<string, Role[]> = {
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/my-shifts": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tasks": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/employees": ["SUPER_ADMIN", "ADMIN"],
  "/attendance": ["SUPER_ADMIN", "ADMIN"],
  "/work-hours": ["SUPER_ADMIN", "ADMIN"],
  "/schedules": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/social-calendar": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/locations": ["SUPER_ADMIN", "ADMIN"],
  "/tablet-clock": ["SUPER_ADMIN", "ADMIN"],
  "/requests": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/documents": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/cedolini": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/malattie": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/service-notes": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/service-forms": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tables": ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/orders": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/appointments": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/consulenza-online": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/cash": ["SUPER_ADMIN", "ADMIN"],
  "/invoices": ["SUPER_ADMIN", "ADMIN"],
  "/refunds": ["SUPER_ADMIN", "ADMIN"],
  "/client-control": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/recruitment": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/staff": ["SUPER_ADMIN", "ADMIN"],
  "/team": ["SUPER_ADMIN", "ADMIN"],
  "/notifications": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/profile": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/settings": ["SUPER_ADMIN", "ADMIN"],
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
};

export function canAccess(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

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
      viewRoutes = accessList;
    } else if (accessList && typeof accessList === "object" && Array.isArray(accessList.view)) {
      viewRoutes = accessList.view;
    }

    const matchedRoute = Object.keys(routePermissions)
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname === route || pathname.startsWith(`${route}/`));
    
    if (matchedRoute) {
      return viewRoutes.includes(matchedRoute);
    }
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

  return match ? match[1].includes(role) : true;
}

export function canEdit(pathname: string, role?: Role, mansione?: string, accessList?: any) {
  if (!role) return false;

  if (role === "SUPER_ADMIN") return true;

  // Custom edit list check
  if (accessList && role !== "SUPER_ADMIN") {
    if (accessList && typeof accessList === "object" && Array.isArray(accessList.edit)) {
      const matchedRoute = Object.keys(routePermissions)
        .sort((a, b) => b.length - a.length)
        .find((route) => pathname === route || pathname.startsWith(`${route}/`));
      
      if (matchedRoute) {
        return accessList.edit.includes(matchedRoute);
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

export function visibleForRole<T extends { roles: Role[] }>(items: T[], role: Role) {
  return items.filter((item) => item.roles.includes(role));
}
