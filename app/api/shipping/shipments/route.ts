import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditForUser } from "@/lib/roles";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, mansione: true, active: true },
    });
    if (!user?.active || !(await canEditForUser(prisma, "/shipping", user))) {
      return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
    }

    const body = await request.json();
    const {
      shopifyOrderId,
      orderName,
      customerName,
      shippingAddress,
      status,
      verifiedBarcodes,
      photoUrl,
      proofPhotoUrl,
      notes,
      trackingNumber,
      courier,
    } = body;

    if (!shopifyOrderId || !orderName) {
      return NextResponse.json({ error: "Dati ordine mancanti." }, { status: 400 });
    }
    const existingRecord = await prisma.shopifyShipment.findUnique({
      where: { shopify_order_id: String(shopifyOrderId) },
      select: { shipped_at: true, status: true },
    });
    if (status === "SHIPPED" && existingRecord?.status !== "SHIPPED" && (!String(courier ?? "").trim() || !String(trackingNumber ?? "").trim())) {
      return NextResponse.json({ error: "Per segnare l’ordine come spedito servono il corriere e il tracking dell’etichetta. Il numero ordine Shopify non è un tracking." }, { status: 400 });
    }
    const shippedAt = status === "SHIPPED" ? (existingRecord?.shipped_at ?? new Date()) : status ? null : undefined;

    const record = await prisma.shopifyShipment.upsert({
      where: { shopify_order_id: String(shopifyOrderId) },
      update: {
        order_name: orderName,
        customer_name: customerName,
        shipping_address: shippingAddress ?? undefined,
        status: status ?? undefined,
        verified_barcodes: verifiedBarcodes ?? undefined,
        photo_url: photoUrl ?? undefined,
        proof_photo_url: proofPhotoUrl ?? undefined,
        notes: notes ?? undefined,
        tracking_number: trackingNumber ?? undefined,
        courier: courier ?? undefined,
        shipped_at: shippedAt,
        packed_by_user_id: session.user.id,
      },
      create: {
        shopify_order_id: String(shopifyOrderId),
        order_name: orderName,
        customer_name: customerName,
        shipping_address: shippingAddress ?? undefined,
        status: status || "UNFULFILLED",
        verified_barcodes: verifiedBarcodes || [],
        photo_url: photoUrl || null,
        proof_photo_url: proofPhotoUrl || null,
        notes: notes || null,
        tracking_number: trackingNumber || null,
        courier: courier || null,
        shipped_at: status === "SHIPPED" ? new Date() : null,
        packed_by_user_id: session.user.id,
      },
      include: {
        packed_by: {
          select: { id: true, name: true, photo_url: true },
        },
      },
    });

    // Register the Shopify fulfillment after a courier tracking number has been provided.
    if (status === "SHIPPED" && existingRecord?.status !== "SHIPPED") {
      const shop = process.env.SHOPIFY_SHOP_DOMAIN;
      const token = process.env.SHOPIFY_ACCESS_TOKEN;

      if (shop && token) {
        try {
          const orderRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${shopifyOrderId}.json?fields=id,fulfillment_status`, {
            headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            cache: "no-store",
          });
          // Una etichetta può aver già evaso l'ordine su Shopify. In tal caso
          // non creare una seconda evasione né inviare un'altra notifica.
          if (!orderRes.ok) throw new Error(`Shopify order lookup: ${orderRes.status}`);
          const orderData = await orderRes.json();
          if (orderData.order?.fulfillment_status === "fulfilled") {
            return NextResponse.json({ shipment: record });
          }
          // 1. Get fulfillment orders for this order
          const foRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${shopifyOrderId}/fulfillment_orders.json`, {
            headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
          });

          if (foRes.ok) {
            const foData = await foRes.json();
            const fulfillmentOrder = foData.fulfillment_orders?.[0];

            if (fulfillmentOrder) {
              // 2. Create fulfillment
              await fetch(`https://${shop}/admin/api/2024-04/fulfillments.json`, {
                method: "POST",
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                body: JSON.stringify({
                  fulfillment: {
                    line_items_by_fulfillment_order: [
                      {
                        fulfillment_order_id: fulfillmentOrder.id,
                      },
                    ],
                    tracking_info: {
                      number: trackingNumber || "",
                      company: courier || "DHL",
                    },
                    notify_customer: true,
                  },
                }),
              });
            }
          }
        } catch (shopifyErr) {
          console.warn("Failed to trigger Shopify fulfillment:", shopifyErr);
        }
      }
    }

    return NextResponse.json({ shipment: record });
  } catch (error) {
    console.error("Failed to update shipment:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della spedizione." }, { status: 500 });
  }
}
