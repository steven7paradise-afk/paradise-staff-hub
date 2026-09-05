import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPcCassaProxyAllowedPath } from "@/lib/pc-cassa-access";

export const proxy = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isPcCassa = Boolean(request.cookies.get("appointments_pc_token")?.value);
  const isAdminRemoteAccess =
    (pathname === "/remote" || pathname.startsWith("/remote/")) &&
    Boolean(request.auth?.user?.id) &&
    ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(request.auth?.user?.role ?? "");

  if (isPcCassa && !isAdminRemoteAccess) {
    if (!isPcCassaProxyAllowedPath(pathname) && pathname !== "/pc-non-autorizzato") {
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
