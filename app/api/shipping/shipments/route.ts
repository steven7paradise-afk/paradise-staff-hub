import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
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
      notes,
      trackingNumber,
      courier,
    } = body;

    if (!shopifyOrderId || !orderName) {
      return NextResponse.json({ error: "Dati ordine mancanti." }, { status: 400 });
    }

    const record = await prisma.shopifyShipment.upsert({
      where: { shopify_order_id: String(shopifyOrderId) },
      update: {
        order_name: orderName,
        customer_name: customerName,
        shipping_address: shippingAddress ?? undefined,
        status: status ?? undefined,
        verified_barcodes: verifiedBarcodes ?? undefined,
        photo_url: photoUrl ?? undefined,
        notes: notes ?? undefined,
        tracking_number: trackingNumber ?? undefined,
        courier: courier ?? undefined,
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
        notes: notes || null,
        tracking_number: trackingNumber || null,
        courier: courier || null,
        packed_by_user_id: session.user.id,
      },
      include: {
        packed_by: {
          select: { id: true, name: true, photo_url: true },
        },
      },
    });

    // If status is set to SHIPPED and trackingNumber is provided, attempt to fulfill on Shopify
    if (status === "SHIPPED") {
      const shop = process.env.SHOPIFY_SHOP_DOMAIN;
      const token = process.env.SHOPIFY_ACCESS_TOKEN;

      if (shop && token) {
        try {
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
