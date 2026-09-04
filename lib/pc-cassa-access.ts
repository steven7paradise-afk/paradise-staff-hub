export const PC_CASSA_ALLOWED_PAGE_PATHS = [
  "/appointments/buenos-aires",
  "/service-forms",
  "/cassa-live",
  "/orders",
] as const;

const CENTRAL_MANAGEMENT_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export function isBuenosAiresLocationName(value?: string | null) {
  const name = String(value ?? "").trim().toLowerCase();
  return name.includes("buenos") || name.includes("corso");
}

export function requiresBuenosAiresPcCassa(role?: string | null, locationName?: string | null) {
  if (!role || CENTRAL_MANAGEMENT_ROLES.has(role)) return false;
  return isBuenosAiresLocationName(locationName);
}
