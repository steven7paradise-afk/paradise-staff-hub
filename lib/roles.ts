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
  "/locations": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/tablet-clock": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
  "/requests": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/documents": ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"],
  "/notifications": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/profile": ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
  "/settings": ["SUPER_ADMIN"],
  "/settings/branding": ["SUPER_ADMIN"],
  "/settings/devices": ["SUPER_ADMIN"],
  "/settings/google-sheet": ["SUPER_ADMIN"],
  "/settings/email": ["SUPER_ADMIN"],
  "/settings/roles": ["SUPER_ADMIN"],
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
