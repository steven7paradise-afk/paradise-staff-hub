import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPcCassa = Boolean(request.cookies.get("appointments_pc_token")?.value);

  if (isPcCassa) {
    const isAllowedPage =
      pathname === "/appointments" ||
      pathname.startsWith("/appointments/") ||
      pathname === "/client-control" ||
      pathname.startsWith("/client-control/") ||
      pathname === "/orders" ||
      pathname.startsWith("/orders/") ||
      pathname === "/service-forms" ||
      pathname.startsWith("/service-forms/") ||
      pathname === "/my-shifts";

    const isAllowedApi =
      pathname.startsWith("/api/appointments") ||
      pathname.startsWith("/api/client-control") ||
      pathname.startsWith("/api/orders") ||
      pathname.startsWith("/api/service-forms") ||
      pathname.startsWith("/api/shopify-order-lookup") ||
      pathname.startsWith("/api/drive-image") ||
      pathname.startsWith("/api/auth");

    if (!isAllowedPage && !isAllowedApi && pathname !== "/pc-non-autorizzato") {
      const url = request.nextUrl.clone();
      url.pathname = "/pc-non-autorizzato";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|favicon.png|logo.png|icon-192.png|icon-512.png|login-banner.jpg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
