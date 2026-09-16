import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { cacheShippingOrders, fetchRecentlyLabeledOrders, latestLabelFulfillment } from "@/lib/shipping-label-orders";
import { shippingBarcodeMap } from "@/lib/shipping-product-barcodes";
import { confirmedShippingFulfillment, reconcileLocalShippingOrders, shippingPendingItems } from "@/lib/shipping-pending-items";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, mansione: true, active: true },
    });
    if (!user?.active || !(await canAccessForUser(prisma, "/shipping", user))) {
      return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
    }

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    let shopifyOrders: any[] = [];

    if (shop && token) {
      try {
        // Fetch unfulfilled & physical shipping orders from Shopify API
        let response = await fetch(`https://${shop}/admin/api/2024-04/orders.json?status=open&fulfillment_status=unfulfilled&delivery_method=shipping&limit=250`, {
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
          next: { revalidate: 0 },
        });

        if (!response.ok) {
          // Fallback if delivery_method parameter is not accepted
          response = await fetch(`https://${shop}/admin/api/2024-04/orders.json?status=open&fulfillment_status=unfulfilled&limit=250`, {
            headers: {
              "X-Shopify-Access-Token": token,
              "Content-Type": "application/json",
            },
            next: { revalidate: 0 },
          });
        }

        if (response.ok) {
          const data = await response.json();
          const rawOrders = data.orders || [];
          const SERVICE_KEYWORDS_REGEX = /commission|pos|a rate|rate|acconto|caparra|pagamento|salone|trattamento|prenotazione/i;
          
          // Filter ONLY orders that require physical e-commerce shipping (exclude POS salon sales & service payments)
          shopifyOrders = rawOrders.filter((order: any) => {
            if (order.source_name?.toLowerCase() === "pos") return false;
            if (String(order.tags || "").toLowerCase().includes("pos")) return false;

            const hasShippingLines = Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0;
            const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

            const shippableItems = lineItems.filter((item: any) => {
              const title = String(item.title || "");
              const sku = String(item.sku || "");
              if (SERVICE_KEYWORDS_REGEX.test(title) || SERVICE_KEYWORDS_REGEX.test(sku)) return false;
              if (item.requires_shipping === false) return false;
              return true;
            });

            if (shippableItems.length === 0) return false;
            if (!hasShippingLines && !order.shipping_address?.address1) return false;

            return true;
          });
        } else {
          console.error("Shopify orders API error:", response.status, response.statusText);
        }
      } catch (err) {
        console.error("Failed to query Shopify API for unfulfilled orders:", err);
      }
    }

    if (shop && token) {
      try {
        const labeledOrders = await fetchRecentlyLabeledOrders(shop, token);
        const existing = new Set(shopifyOrders.map((order) => String(order.id)));
        const serviceKeywords = /commission|pos|a rate|rate|acconto|caparra|pagamento|salone|trattamento|prenotazione/i;
        for (const order of labeledOrders) {
          if (existing.has(String(order.id))) continue;
          if (order.source_name?.toLowerCase() === "pos" || String(order.tags || "").toLowerCase().includes("pos")) continue;
          if (!order.shipping_address?.address1 && !order.shipping_lines?.length) continue;
          if (!order.line_items?.some((item: any) => item.requires_shipping !== false && !serviceKeywords.test(`${item.title || ""} ${item.sku || ""}`))) continue;
          shopifyOrders.push(order);
          existing.add(String(order.id));
        }
      } catch (error) {
        console.error("Failed to query recently labeled Shopify orders:", error);
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
    const inactiveIds = await reconcileLocalShippingOrders(shopifyOrders, dbShipments, shop, token);
    for (const order of shopifyOrders) {
      if (!shippingPendingItems(order).length && !confirmedShippingFulfillment(order) && dbMap.get(String(order.id))?.status !== "SHIPPED") inactiveIds.add(String(order.id));
    }
    cacheShippingOrders(shopifyOrders);
    const productBarcodes = await shippingBarcodeMap(prisma, shopifyOrders);

    // Format orders for the Shipping Hub UI
    const formattedOrders = shopifyOrders.filter(order => !inactiveIds.has(String(order.id))).map((order: any) => {
      const orderIdStr = String(order.id);
      const dbRecord = dbMap.get(orderIdStr);
      const confirmedShipment = confirmedShippingFulfillment(order);

      const customerName = [
        String(order.customer?.first_name || "").trim(),
        String(order.customer?.last_name || "").trim(),
      ].filter(Boolean).join(" ") || "Cliente Shopify";

      const lineItems = shippingPendingItems(order, dbRecord?.status === "SHIPPED" || Boolean(confirmedShipment))
        .map((item: any) => ({
          id: String(item.id),
          title: item.title || "Articolo",
          variantTitle: item.variant_title || "",
          quantity: item.quantity ? parseInt(item.quantity) : 1,
          price: item.price ? parseFloat(item.price) : 0,
          sku: item.sku || "",
          variantId: item.variant_id ? String(item.variant_id) : "",
          barcode: item.variant_id ? (productBarcodes.get(String(item.variant_id))?.barcode || item.sku || "") : (item.sku || ""),
          imageUrl: item.variant_id ? (productBarcodes.get(String(item.variant_id))?.imageUrl || null) : null,
        }));

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
      const label = confirmedShipment || latestLabelFulfillment(order);

      return {
        shopifyOrderId: orderIdStr,
        orderName: order.name || `#${order.order_number}`,
        customerName,
        email: order.customer?.email || order.email || "",
        phone: order.customer?.phone || addressObj.phone || "",
        createdAt: order.created_at,
        shippedAt: dbRecord?.shipped_at?.toISOString() || confirmedShipment?.created_at || null,
        totalPrice: order.total_price ? parseFloat(order.total_price) : 0,
        financialStatus: order.financial_status || "paid",
        fulfillmentStatus: order.fulfillment_status || "unfulfilled",
        shippingMethod,
        shippingAddress,
        lineItems,
        // Status from DB if present, else default UNFULFILLED
        status: confirmedShipment ? "SHIPPED" : dbRecord?.status || (label ? "PACKING" : "UNFULFILLED"),
        verifiedBarcodes: (dbRecord?.verified_barcodes as string[]) || [],
        photoUrl: dbRecord?.photo_url || null,
        proofPhotoUrl: dbRecord?.proof_photo_url || null,
        notes: dbRecord?.notes || null,
        trackingNumber: dbRecord?.tracking_number || label?.tracking_number || null,
        courier: dbRecord?.courier || label?.tracking_company || null,
        packedBy: dbRecord?.packed_by || null,
      };
    });

    // Also include any DB records that might no longer be in the open unfulfilled list (e.g. recently SHIPPED)
    const existingIds = new Set(formattedOrders.map((o) => o.shopifyOrderId));
    for (const dbRec of dbShipments) {
      if (inactiveIds.has(dbRec.shopify_order_id)) continue;
      if (!existingIds.has(dbRec.shopify_order_id)) {
        formattedOrders.push({
          shopifyOrderId: dbRec.shopify_order_id,
          orderName: dbRec.order_name,
          customerName: dbRec.customer_name || "Cliente",
          email: "",
          phone: "",
          createdAt: dbRec.created_at.toISOString(),
          shippedAt: dbRec.shipped_at?.toISOString() || null,
          totalPrice: 0,
          financialStatus: "paid",
          fulfillmentStatus: dbRec.status === "SHIPPED" ? "fulfilled" : "unfulfilled",
          shippingMethod: "Spedizione Express",
          shippingAddress: (dbRec.shipping_address as any) || {},
          lineItems: [],
          status: dbRec.status,
          verifiedBarcodes: (dbRec.verified_barcodes as string[]) || [],
          photoUrl: dbRec.photo_url || null,
          proofPhotoUrl: dbRec.proof_photo_url || null,
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
