import { NextRequest, NextResponse } from "next/server";
import { resolveOrderWorkspaceAccess } from "@/lib/order-workspace-access";
import { findOrderWorkspaceReference } from "@/lib/order-workspace-store";
import { getOrderTaskType, orderWorkspacePath } from "@/lib/order-workspace";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function GET(request: NextRequest) {
  try {
    const access = await resolveOrderWorkspaceAccess({
      cookieStore: request.cookies,
      remoteTarget: request.nextUrl.searchParams.get("remoteTarget") ?? undefined,
    });
    if (!access.ok) return reply({ error: "Non autorizzato a consultare gli ordini." }, access.status);
    // API paths do not receive the page's view-permission check.
    if (!access.isPC) {
      const accessUser = await prisma.user.findUnique({
        where: { id: access.session!.user.id },
        select: { id: true, role: true, mansione: true, access_list: true, active: true },
      });
      if (!accessUser?.active || !(await canAccessForUser(prisma, "/orders", accessUser))) {
        return reply({ error: "Non autorizzato a consultare gli ordini." }, 403);
      }
    }

    const reference = request.nextUrl.searchParams.get("reference")?.trim() ?? "";
    if (!reference || reference.length > 2048) return reply({ error: "Codice ordine non valido." }, 400);

    const order = await findOrderWorkspaceReference(reference, access.operationalLocationId);
    if (!order) return reply({ error: "Ordine non trovato." }, 404);

    const workspace = getOrderTaskType(order) === "conversione" ? "conversions" : "orders";
    const query = new URLSearchParams({ ordine: order.id });
    if (access.remoteTarget) query.set("remoteTarget", access.remoteTarget);
    return reply({ href: `${orderWorkspacePath(workspace)}?${query}` });
  } catch {
    return reply({ error: "Impossibile cercare l’ordine. Riprova." }, 500);
  }
}
