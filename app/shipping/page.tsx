import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShippingManager } from "@/components/shipping-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, photo_url: true, sede_id: true, active: true },
  }).catch(() => null);

  if (dbUser && !dbUser.active) redirect("/login");

  const role = dbUser?.role || session.user.role || "DIPENDENTE";
  const currentUser = {
    id: session.user.id,
    name: dbUser?.name || session.user.name || "Paradise Staff",
    email: dbUser?.email || session.user.email || "",
    role,
    photo_url: dbUser?.photo_url || null,
    locationName: dbUser?.sede_id ? "Salone" : null,
  };

  // Fetch initial unfulfilled orders from Shopify API & local DB
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  let shopifyOrders: any[] = [];

  if (shop && token) {
    try {
      const response = await fetch(`https://${shop}/admin/api/2024-04/orders.json?status=open&fulfillment_status=unfulfilled&limit=100`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        const rawOrders = data.orders || [];
        
        shopifyOrders = rawOrders.filter((order: any) => {
          const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
          const hasPhysicalItems = lineItems.some((item: any) => item.requires_shipping === true || (item.title && !item.title.toLowerCase().includes("commission")));
          const hasShippingLines = Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0;
          const isPureCommission = lineItems.length > 0 && lineItems.every((item: any) => item.requires_shipping === false || item.title?.toLowerCase().includes("commission"));

          if (isPureCommission && !hasShippingLines) return false;
          return hasPhysicalItems || hasShippingLines;
        });
      }
    } catch (err) {
      console.error("Failed to query Shopify API for unfulfilled orders:", err);
    }
  }

  // Get local shipments records
  const dbShipments = await prisma.shopifyShipment.findMany({
    include: {
      packed_by: {
        select: { id: true, name: true, photo_url: true },
      },
    },
  }).catch(() => []);

  const dbMap = new Map(dbShipments.map((s) => [s.shopify_order_id, s]));

  const initialOrders = shopifyOrders.map((order: any) => {
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
      status: (dbRecord?.status as any) || "UNFULFILLED",
      verifiedBarcodes: (dbRecord?.verified_barcodes as string[]) || [],
      photoUrl: dbRecord?.photo_url || null,
      notes: dbRecord?.notes || null,
      trackingNumber: dbRecord?.tracking_number || null,
      courier: dbRecord?.courier || null,
      packedBy: dbRecord?.packed_by || null,
    };
  });

  return (
    <AppShell user={currentUser} role={role}>
      <ShippingManager initialOrders={initialOrders} currentUserName={currentUser.name} />
    </AppShell>
  );
}
