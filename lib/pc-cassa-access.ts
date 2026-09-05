export const PC_CASSA_ALLOWED_PAGE_PATHS = [
  "/appointments",
  "/appointments/buenos-aires",
  "/client-control",
  "/service-forms",
  "/cassa-live",
  "/orders",
  "/shopify-orders",
] as const;

export const PC_CASSA_ALLOWED_API_PREFIXES = [
  "/api/appointments",
  "/api/client-control",
  "/api/orders",
  "/api/service-forms",
  "/api/remote-control",
  "/api/shopify-order-lookup",
  "/api/shopify-orders-dashboard",
  "/api/vat-lookup",
  "/api/drive-image",
  "/api/auth",
] as const;

export function isPcCassaAllowedPath(pathname: string) {
  const isAllowedPage = PC_CASSA_ALLOWED_PAGE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isAllowedApi = PC_CASSA_ALLOWED_API_PREFIXES.some((path) => pathname.startsWith(path));

  return isAllowedPage || isAllowedApi;
}

const CENTRAL_MANAGEMENT_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export function isBuenosAiresLocationName(value?: string | null) {
  const name = String(value ?? "").trim().toLowerCase();
  return name.includes("buenos") || name.includes("corso");
}

export function requiresBuenosAiresPcCassa(role?: string | null, locationName?: string | null) {
  if (!role || CENTRAL_MANAGEMENT_ROLES.has(role)) return false;
  return isBuenosAiresLocationName(locationName);
}
