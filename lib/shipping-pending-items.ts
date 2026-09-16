import { latestLabelFulfillment } from "./shipping-label-orders";

// A partially fulfilled order can remain open solely for a nonphysical fee.
// Work from the remaining physical quantities, never from the order status alone.
export function shippingPendingItems(order: any, includeHistory = false): any[] {
  if (!includeHistory && order.cancelled_at) return [];
  const label = includeHistory ? null : latestLabelFulfillment(order);
  const serviceKeywords = /commission|pos|a rate|rate|acconto|caparra|pagamento|salone|trattamento|prenotazione/i;
  return (Array.isArray(order.line_items) ? order.line_items : []).flatMap((item: any) => {
    if (item.requires_shipping === false || serviceKeywords.test(`${item.title || ""} ${item.sku || ""}`)) return [];
    const remaining = item.fulfillable_quantity == null ? Number(item.quantity || 0) : Number(item.fulfillable_quantity);
    const labeledItem = label?.line_items?.find((entry: any) => String(entry.id) === String(item.id));
    const quantity = includeHistory ? Number(item.quantity || 0) : Math.max(remaining, Number(labeledItem?.quantity || 0));
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}

export function confirmedShippingFulfillment(order: any): any | null {
  if (order.cancelled_at || shippingPendingItems(order).length || !shippingPendingItems(order, true).length) return null;
  return (Array.isArray(order.fulfillments) ? order.fulfillments : [])
    .filter((entry: any) => entry.status === "success" && ["in_transit", "out_for_delivery", "delivered"].includes(entry.shipment_status))
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
}

// Recheck local drafts that disappeared from the open-order query. Never let a
// stale local status reintroduce a delivered order into the preparation queue.
export async function reconcileLocalShippingOrders(
  orders: any[],
  records: Array<{ shopify_order_id: string; status: string }>,
  shop: string | undefined,
  token: string | undefined,
): Promise<Set<string>> {
  const inactive = new Set<string>();
  const knownIds = new Set(orders.map(order => String(order.id)));
  for (const record of records) {
    if (record.status === "SHIPPED" || knownIds.has(record.shopify_order_id) || !shop || !token) continue;
    if (!/^\d+$/.test(record.shopify_order_id)) continue;
    try {
      const response = await fetch(`https://${shop}/admin/api/2024-04/orders/${record.shopify_order_id}.json`, {
        headers: { "X-Shopify-Access-Token": token }, cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue; // Do not silently lose drafts during an outage.
      const { order } = await response.json();
      if (!order) continue;
      if (shippingPendingItems(order).length || confirmedShippingFulfillment(order)) {
        orders.push(order);
        knownIds.add(String(order.id));
      } else inactive.add(record.shopify_order_id);
    } catch {
      // Keep the last known local draft if Shopify is temporarily unavailable.
    }
  }
  return inactive;
}
