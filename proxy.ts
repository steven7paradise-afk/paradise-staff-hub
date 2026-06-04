import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { canAccess, type Role } from "@/lib/roles";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname === "/login" ||
    pathname === "/tablet-clock" ||
    pathname === "/tablet-clock/activate" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.png" ||
    pathname === "/logo.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/login-banner.jpg" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/devices/activate") ||
    pathname.startsWith("/api/attendance/clock") ||
    pathname.startsWith("/api/attendance/identify") ||
    pathname.startsWith("/api/attendance/status") ||
    pathname.startsWith("/api/attendance/close-open-shifts") ||
    pathname.startsWith("/api/tablet-requests")
  ) {
    return NextResponse.next();
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccess(pathname, token.role as Role | undefined)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|favicon.png|logo.png|icon-192.png|icon-512.png|login-banner.jpg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
