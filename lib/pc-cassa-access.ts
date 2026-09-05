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

export function isPcCassaProxyAllowedPath(pathname: string) {
  const isAllowedPage =
    pathname === "/appointments/buenos-aires" ||
    pathname === "/orders" ||
    pathname === "/shopify-orders" ||
    pathname.startsWith("/shopify-orders/") ||
    pathname === "/service-forms" ||
    pathname.startsWith("/service-forms/");

  const isOperationalServiceFormsApi =
    pathname === "/api/service-forms/submit" ||
    pathname.startsWith("/api/service-forms/responses/");
  const isCashClosingReferenceApi =
    pathname === "/api/cash/shopify-daily-summary" ||
    pathname === "/api/cash/daily-close";
  const isOperationalOrdersApi =
    pathname.startsWith("/api/orders/") &&
    !pathname.startsWith("/api/orders/import");
  const isAllowedApi =
    pathname.startsWith("/api/appointments") ||
    pathname === "/api/client-control/analytics" ||
    pathname === "/api/client-control/polish-note" ||
    pathname === "/api/client-control/tablet-submit" ||
    isOperationalOrdersApi ||
    isOperationalServiceFormsApi ||
    isCashClosingReferenceApi ||
    pathname.startsWith("/api/shopify-order-lookup") ||
    pathname.startsWith("/api/shopify-orders-dashboard") ||
    pathname.startsWith("/api/vat-lookup") ||
    pathname.startsWith("/api/drive-image") ||
    pathname.startsWith("/api/remote-control") ||
    pathname.startsWith("/api/auth");

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
