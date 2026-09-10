import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { getShopifyOrderNotesBulk } from "@/lib/shopify";

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  if (!operationalUser?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderIds = Array.isArray(body?.orderIds) ? body.orderIds : [];
  const cleanOrderIds = orderIds
    .map((value: unknown) => String(value || "").trim())
    .filter((value: string) => /^\d{10,}$/.test(value))
    .slice(0, 200);

  const notes = await getShopifyOrderNotesBulk(cleanOrderIds);
  return NextResponse.json({ notes: Object.fromEntries(notes) });
}
