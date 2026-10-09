import { NextRequest, NextResponse } from "next/server";
import { planningAuthorized } from "@/lib/planning-integration-contract";
import { deliverPlanningUpdate } from "@/lib/planning-integration";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!planningAuthorized(request.headers.get("authorization"), process.env.PLANNING_DELIVERY_TOKEN)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  try {
    const result = await deliverPlanningUpdate();
    return NextResponse.json(result, { status: result.status === "pending" ? 503 : 200 });
  } catch { return NextResponse.json({ error: "Invio in attesa: riprovare" }, { status: 503 }); }
}
