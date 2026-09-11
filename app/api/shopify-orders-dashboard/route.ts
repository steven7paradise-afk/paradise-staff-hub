import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { fetchShopifyOrdersPage } from "@/lib/shopify-orders-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  if (!user.isPC) {
    const accessUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, mansione: true, access_list: true, active: true },
    });
    if (!accessUser?.active || !(await canAccessForUser(prisma, "/orders", accessUser))) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
  }

  const after = request.nextUrl.searchParams.get("after");

  try {
    const result = await fetchShopifyOrdersPage({ after, first: 50 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile caricare gli ordini Shopify.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
