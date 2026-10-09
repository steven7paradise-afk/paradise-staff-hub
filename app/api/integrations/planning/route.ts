import { NextRequest, NextResponse } from "next/server";
import { planningAuthorized } from "@/lib/planning-integration-contract";
import { planningSnapshot } from "@/lib/planning-integration";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!planningAuthorized(request.headers.get("authorization"), process.env.PLANNING_API_TOKEN)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  try {
    return NextResponse.json(await planningSnapshot(), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Planning temporaneamente non disponibile" }, { status: 503 }); }
}
