export type ShopifyDashboardOrder = {
  id: string;
  legacyId: string;
  name: string;
  createdAt: string;
  customerName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  sourceName: string;
  itemCount: number;
  items: Array<{ title: string; quantity: number }>;
  note: string;
  destination: string;
};

export type ShopifyOrdersPage = {
  orders: ShopifyDashboardOrder[];
  hasNextPage: boolean;
  endCursor: string | null;
};

const SHOPIFY_API_VERSION = "2026-07";

function shopifyConfig() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shop || !token) {
    throw new Error("Shopify non è configurato correttamente.");
  }

  return { shop, token };
}

export async function fetchShopifyOrdersPage({
  after,
  first = 50,
}: {
  after?: string | null;
  first?: number;
} = {}): Promise<ShopifyOrdersPage> {
  const { shop, token } = shopifyConfig();
  const limit = Math.min(Math.max(first, 1), 100);
  const fields = [
    "id", "name", "created_at", "customer", "email", "phone", "note",
    "current_total_price", "total_price", "currency", "financial_status",
    "fulfillment_status", "source_name", "line_items", "shipping_address", "billing_address",
  ].join(",");
  const url = after
    ? `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=${limit}&page_info=${encodeURIComponent(after)}&fields=${fields}`
    : `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=${limit}&status=any&fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Shopify non disponibile (${response.status}).`);
  }

  const payload = await response.json();
  if (payload?.errors) {
    throw new Error(typeof payload.errors === "string" ? payload.errors : "Shopify ha restituito un errore.");
  }

  const nodes = Array.isArray(payload?.orders) ? payload.orders : [];
  const orders = nodes.map((order: any): ShopifyDashboardOrder => {
    const address = order.shipping_address || order.billing_address;
    const destination = [address?.city, address?.province_code || address?.province || address?.country].filter(Boolean).join(", ");
    const customerName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ");
    const items = Array.isArray(order.line_items) ? order.line_items : [];

    return {
      id: String(order.id || ""),
      legacyId: String(order.id || ""),
      name: String(order.name || "Ordine"),
      createdAt: String(order.created_at || ""),
      customerName: String(customerName || "Nessun cliente"),
      email: String(order.customer?.email || order.email || ""),
      phone: String(order.customer?.phone || order.phone || address?.phone || ""),
      total: Number(order.current_total_price || order.total_price || 0),
      currency: String(order.currency || "EUR"),
      financialStatus: String(order.financial_status || "pending").toUpperCase(),
      fulfillmentStatus: String(order.fulfillment_status || "unfulfilled").toUpperCase(),
      sourceName: String(order.source_name || "web"),
      itemCount: items.reduce((total: number, item: any) => total + Number(item.quantity || 1), 0),
      items: items.slice(0, 12).map((item: any) => ({ title: String(item.title || "Articolo"), quantity: Number(item.quantity || 1) })),
      note: String(order.note || ""),
      destination,
    };
  });

  const nextLink = response.headers.get("link")
    ?.split(",")
    .find((part) => /rel="next"/.test(part));
  const nextUrl = nextLink?.match(/<([^>]+)>/)?.[1];
  const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get("page_info") : null;

  return {
    orders,
    hasNextPage: Boolean(nextCursor),
    endCursor: nextCursor,
  };
}
