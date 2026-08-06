import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    let shopifyOrders: any[] = [];

    if (shop && token) {
      try {
        // Fetch unfulfilled & open orders from Shopify API
        const response = await fetch(`https://${shop}/admin/api/2024-04/orders.json?status=open&fulfillment_status=unfulfilled&limit=100`, {
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
          next: { revalidate: 0 },
        });

        if (response.ok) {
          const data = await response.json();
          shopifyOrders = data.orders || [];
        } else {
          console.error("Shopify orders API error:", response.status, response.statusText);
        }
      } catch (err) {
        console.error("Failed to query Shopify API for unfulfilled orders:", err);
      }
    }

    // Get all records from local DB
    const dbShipments = await prisma.shopifyShipment.findMany({
      include: {
        packed_by: {
          select: { id: true, name: true, photo_url: true },
        },
      },
    });

    const dbMap = new Map(dbShipments.map((s) => [s.shopify_order_id, s]));

    // Format orders for the Shipping Hub UI
    const formattedOrders = shopifyOrders.map((order: any) => {
      const orderIdStr = String(order.id);
      const dbRecord = dbMap.get(orderIdStr);

      const customerName = [
        String(order.customer?.first_name || "").trim(),
        String(order.customer?.last_name || "").trim(),
      ].filter(Boolean).join(" ") || "Cliente Shopify";

      const lineItems = Array.isArray(order.line_items)
        ? order.line_items.map((item: any) => ({
            id: String(item.id),
            title: item.title || "Articolo",
            variantTitle: item.variant_title || "",
            quantity: item.quantity ? parseInt(item.quantity) : 1,
            price: item.price ? parseFloat(item.price) : 0,
            sku: item.sku || "",
            barcode: item.variant_id ? String(item.variant_id) : (item.sku || String(item.id)),
          }))
        : [];

      const addressObj = order.shipping_address || order.billing_address || {};
      const shippingAddress = {
        name: [addressObj.first_name, addressObj.last_name].filter(Boolean).join(" "),
        address1: addressObj.address1 || "",
        address2: addressObj.address2 || "",
        city: addressObj.city || "",
        zip: addressObj.zip || "",
        province: addressObj.province || "",
        country: addressObj.country || "Italia",
        phone: addressObj.phone || order.customer?.phone || "",
      };

      const shippingMethod = order.shipping_lines?.[0]?.title || "Spedizione Standard";

      return {
        shopifyOrderId: orderIdStr,
        orderName: order.name || `#${order.order_number}`,
        customerName,
        email: order.customer?.email || order.email || "",
        phone: order.customer?.phone || addressObj.phone || "",
        createdAt: order.created_at,
        totalPrice: order.total_price ? parseFloat(order.total_price) : 0,
        financialStatus: order.financial_status || "paid",
        fulfillmentStatus: order.fulfillment_status || "unfulfilled",
        shippingMethod,
        shippingAddress,
        lineItems,
        // Status from DB if present, else default UNFULFILLED
        status: dbRecord?.status || "UNFULFILLED",
        verifiedBarcodes: (dbRecord?.verified_barcodes as string[]) || [],
        photoUrl: dbRecord?.photo_url || null,
        notes: dbRecord?.notes || null,
        trackingNumber: dbRecord?.tracking_number || null,
        courier: dbRecord?.courier || null,
        packedBy: dbRecord?.packed_by || null,
      };
    });

    // Also include any DB records that might no longer be in the open unfulfilled list (e.g. recently SHIPPED)
    const existingIds = new Set(formattedOrders.map((o) => o.shopifyOrderId));
    for (const dbRec of dbShipments) {
      if (!existingIds.has(dbRec.shopify_order_id)) {
        formattedOrders.push({
          shopifyOrderId: dbRec.shopify_order_id,
          orderName: dbRec.order_name,
          customerName: dbRec.customer_name || "Cliente",
          email: "",
          phone: "",
          createdAt: dbRec.created_at.toISOString(),
          totalPrice: 0,
          financialStatus: "paid",
          fulfillmentStatus: dbRec.status === "SHIPPED" ? "fulfilled" : "unfulfilled",
          shippingMethod: "Spedizione Express",
          shippingAddress: (dbRec.shipping_address as any) || {},
          lineItems: [],
          status: dbRec.status,
          verifiedBarcodes: (dbRec.verified_barcodes as string[]) || [],
          photoUrl: dbRec.photo_url || null,
          notes: dbRec.notes || null,
          trackingNumber: dbRec.tracking_number || null,
          courier: dbRec.courier || null,
          packedBy: dbRec.packed_by || null,
        });
      }
    }

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Failed to fetch shipping orders:", error);
    return NextResponse.json({ error: "Errore durante il caricamento degli ordini." }, { status: 500 });
  }
}
