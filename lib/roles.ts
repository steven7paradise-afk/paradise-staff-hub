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
  "/service-notes": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/service-forms": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/tables": ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/orders": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/appointments": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/cash": ["SUPER_ADMIN", "ADMIN"],
  "/invoices": ["SUPER_ADMIN", "ADMIN"],
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

export function canAccess(pathname: string, role?: Role, mansione?: string) {
  if (!role) return false;

  // Abilita la pagina appuntamenti per chiunque abbia "assistenza" nella mansione
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) {
    if (role === "DIPENDENTE" && mansione && mansione.toLowerCase().includes("assistenza")) {
      return true;
    }
  }

  const match = Object.entries(routePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

  return match ? match[1].includes(role) : true;
}

export function visibleForRole<T extends { roles: Role[] }>(items: T[], role: Role) {
  return items.filter((item) => item.roles.includes(role));
}
