import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_BUILD_VERSION || "unknown" },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
  );
}

