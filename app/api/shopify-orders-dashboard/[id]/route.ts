import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { fetchShopifyOrderDetail } from "@/lib/shopify-orders-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getOperationalUser(request);
  if (!user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  if (!user.isPC) {
    const accessUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, mansione: true, access_list: true, active: true },
    });
    if (!accessUser?.active || !(await canAccessForUser(prisma, "/orders", accessUser))) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
  }

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Ordine non valido" }, { status: 400 });

  try {
    const result = await fetchShopifyOrderDetail(id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile caricare il dettaglio dell'ordine.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
