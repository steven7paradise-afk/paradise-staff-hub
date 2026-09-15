// Shopify può segnare un ordine come evaso quando viene creata l'etichetta,
// prima che la preparazione fisica sia terminata.
let cachedLabeledOrders: { orders: any[]; expiresAt: number } | null = null;
const cachedShippingOrders = new Map<string, { order: any; expiresAt: number }>();

export function cacheShippingOrders(orders: any[]) {
  for (const [id, entry] of cachedShippingOrders) {
    if (entry.expiresAt <= Date.now()) cachedShippingOrders.delete(id);
  }
  const expiresAt = Date.now() + 10 * 60 * 1000;
  for (const order of orders) cachedShippingOrders.set(String(order.id), { order, expiresAt });
}

export function getCachedShippingOrder(orderId: string): any | null {
  const entry = cachedShippingOrders.get(orderId);
  return entry && entry.expiresAt > Date.now() ? entry.order : null;
}

export function getCachedLabeledOrder(orderId: string): any | null {
  return getCachedShippingOrder(orderId) || cachedLabeledOrders?.orders.find((order) => String(order.id) === orderId) || null;
}

export async function fetchRecentlyLabeledOrders(shop: string, token: string): Promise<any[]> {
  if (cachedLabeledOrders && Date.now() < cachedLabeledOrders.expiresAt) return cachedLabeledOrders.orders;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`https://${shop}/admin/api/2024-04/orders.json`);
  url.searchParams.set("status", "any");
  url.searchParams.set("fulfillment_status", "fulfilled");
  url.searchParams.set("updated_at_min", since);
  url.searchParams.set("limit", "250");

  const orders: any[] = [];
  let nextUrl: string | null = url.toString();
  for (let page = 0; nextUrl && page < 5; page++) {
    const response: Response = await fetch(nextUrl, {
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 429 && cachedLabeledOrders) return cachedLabeledOrders.orders;
      throw new Error(`Shopify orders API: ${response.status}`);
    }
    const data = await response.json();
    orders.push(...(Array.isArray(data.orders) ? data.orders : []));
    const link: string = response.headers.get("link") || "";
    nextUrl = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
  }

  const labeledOrders = orders.filter((order) => {
    const fulfillment = latestLabelFulfillment(order);
    if (!fulfillment) return false;
    return new Date(fulfillment.created_at).getTime() >= new Date(since).getTime();
  });
  cachedLabeledOrders = { orders: labeledOrders, expiresAt: Date.now() + 2 * 60 * 1000 };
  return labeledOrders;
}

export function latestLabelFulfillment(order: any): any | null {
  const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : [];
  return fulfillments
    .filter((fulfillment: any) =>
      fulfillment.status === "success" &&
      fulfillment.shipment_status == null &&
      Boolean(fulfillment.tracking_number),
    )
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
}
