import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const proxy = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isPcCassa = Boolean(request.cookies.get("appointments_pc_token")?.value);
  const isAdminRemoteAccess =
    (pathname === "/remote" || pathname.startsWith("/remote/")) &&
    Boolean(request.auth?.user?.id) &&
    ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(request.auth?.user?.role ?? "");

  if (isPcCassa && !isAdminRemoteAccess) {
    const isAllowedPage =
      pathname === "/appointments/buenos-aires" ||
      pathname === "/orders" ||
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
      pathname.startsWith("/api/vat-lookup") ||
      pathname.startsWith("/api/drive-image") ||
      pathname.startsWith("/api/remote-control") ||
      pathname.startsWith("/api/auth");

    if (!isAllowedPage && !isAllowedApi && pathname !== "/pc-non-autorizzato") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Funzione non disponibile sul PC Cassa." }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/pc-non-autorizzato";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  // The external assistant performs a browser CORS preflight without a session.
  // Let its route validate the Bearer token directly, without the Auth.js proxy.
  matcher: ["/((?!api/admin-assistant(?:/|$)|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|favicon.png|logo.png|icon-192.png|icon-512.png|login-banner.jpg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
