export type Role = "SUPER_ADMIN" | "ADMIN" | "RESPONSABILE" | "DIPENDENTE";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RESPONSABILE: "Responsabile",
  DIPENDENTE: "Dipendente",
};

export const routePermissions: Record<string, Role[]> = {
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/my-shifts": ["DIPENDENTE"],
  "/employees": ["SUPER_ADMIN", "ADMIN"],
  "/attendance": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/work-hours": ["SUPER_ADMIN", "ADMIN"],
  "/schedules": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/social-calendar": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/locations": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/tablet-clock": ["SUPER_ADMIN", "ADMIN"],
  "/requests": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/documents": ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/service-notes": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/service-forms": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/orders": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/recruitment": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/staff": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/team": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/notifications": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/profile": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/settings": ["SUPER_ADMIN", "ADMIN"],
  "/settings/branding": ["SUPER_ADMIN"],
  "/settings/devices": ["SUPER_ADMIN"],
  "/settings/google-sheet": ["SUPER_ADMIN"],
  "/settings/email": ["SUPER_ADMIN"],
  "/settings/roles": ["SUPER_ADMIN"],
  "/settings/tasks": ["SUPER_ADMIN"],
  "/settings/services": ["SUPER_ADMIN"],
  "/settings/forms": ["SUPER_ADMIN", "ADMIN"],
};

export function canAccess(pathname: string, role?: Role) {
  if (!role) return false;
  const match = Object.entries(routePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

  return match ? match[1].includes(role) : true;
}

export function visibleForRole<T extends { roles: Role[] }>(items: T[], role: Role) {
  return items.filter((item) => item.roles.includes(role));
}
