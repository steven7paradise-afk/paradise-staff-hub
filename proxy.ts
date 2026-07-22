import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|favicon.png|logo.png|icon-192.png|icon-512.png|login-banner.jpg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
