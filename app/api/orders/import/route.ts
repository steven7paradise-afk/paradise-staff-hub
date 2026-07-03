import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrderForm } from "@/lib/order-form";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const role = session.user.role;
    const canManageOrders =
      ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role) ||
      session.user.id === "cmpo4y9900001jr09bg1dnqxs" ||
      session.user.id === "cmpms4o9h0003l809zof30mni" ||
      !!session.user.email?.toLowerCase().includes("jessica") ||
      !!session.user.email?.toLowerCase().includes("darwin");

    if (!canManageOrders) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const data = await req.json();
    const { orders } = data as { orders: { clientName: string; notes: string }[] };

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    const orderForm = await ensureOrderForm(session.user.id);
    if (!orderForm) {
      return NextResponse.json({ error: "Modulo ordine non trovato" }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { sede_id: true, location: true },
    });

    const responses = await Promise.all(
      orders.map(async (order) => {
        const titleField = (orderForm.fields as any[]).find((f) => f.id === "order_title")?.id || "order_title";
        const itemsField = (orderForm.fields as any[]).find((f) => f.id === "order_items")?.id || "order_items";
        const supplierField = (orderForm.fields as any[]).find((f) => f.id === "order_supplier")?.id || "order_supplier";
        const priorityField = (orderForm.fields as any[]).find((f) => f.id === "order_priority")?.id || "order_priority";

        const answers = {
          [titleField]: `Ordine per: ${order.clientName}`,
          [itemsField]: order.notes,
          [supplierField]: "Importato da CSV",
          [priorityField]: "Normale",
        };

        return prisma.serviceFormResponse.create({
          data: {
            form_id: orderForm.id,
            user_id: session.user.id,
            user_role: role,
            user_location_id: user?.sede_id ?? null,
            user_location_name: user?.location?.name ?? "Nessuna sede",
            answers,
            status: "NEW",
            priority: "Normale",
            assigned_to_id: null,
            internal_notes: [],
            comments: [],
            activity_log: [
              {
                date: new Date().toISOString(),
                user: session.user.name ?? "Utente sconosciuto",
                action: "Ordine importato da CSV",
              },
            ],
          },
        });
      })
    );

    return NextResponse.json({ success: true, count: responses.length });
  } catch (error) {
    console.error("Errore importazione CSV:", error);
    return NextResponse.json({ error: "Errore durante l'importazione" }, { status: 500 });
  }
}
