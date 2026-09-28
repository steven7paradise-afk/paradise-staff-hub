import { NextResponse } from "next/server";
import { version as release } from "@/package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_BUILD_VERSION || "unknown", release },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
  );
}
