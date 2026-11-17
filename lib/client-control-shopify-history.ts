import "server-only";

type HistoryCoverage = "all" | "recent" | "unknown";

export type ClientControlShopifyHistory =
  | { status: "ready"; count: number; exact: boolean; coverage: HistoryCoverage }
  | { status: "unlinked" | "unavailable" };

type OrderIdentity = {
  order?: { id?: unknown; customer?: { id?: unknown } | null } | null;
  currentAppInstallation?: { accessScopes?: unknown } | null;
};

type PaidOrderCount = {
  ordersCount?: { count?: unknown; precision?: unknown } | null;
};

const orderIdPattern = /^(?:gid:\/\/shopify\/Order\/)?([1-9]\d{0,19})$/;
const customerIdPattern = /^gid:\/\/shopify\/Customer\/([1-9]\d{0,19})$/;

const identityQuery = `query ClientControlOrderIdentity($id: ID!) {
  order(id: $id) { id customer { id } }
  currentAppInstallation { accessScopes { handle } }
}`;

const countQuery = `query ClientControlPaidOrderCount($search: String!) {
  ordersCount(query: $search) { count precision }
}`;

function historyCoverage(scopes: unknown): HistoryCoverage {
  if (!Array.isArray(scopes)) return "unknown";
  const handles = scopes.map((scope: { handle?: unknown } | null) => scope?.handle);
  if (handles.includes("read_all_orders")) return "all";
  if (handles.includes("read_orders") || handles.includes("write_orders")) return "recent";
  return "unknown";
}

/** The Cowlendar order ID is supplied by the server for the selected control. */
export async function loadClientControlShopifyHistory(orderId: string | null): Promise<ClientControlShopifyHistory> {
  const rawId = orderId?.trim().match(orderIdPattern)?.[1];
  if (!rawId) return { status: "unlinked" };

  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) return { status: "unavailable" };

  const endpoint = `https://${shop}/admin/api/2026-07/graphql.json`;
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": token };
  const signal = AbortSignal.timeout(5000);

  async function query<T>(document: string, variables: Record<string, string>, optionalField?: string): Promise<T | null> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: document, variables }),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok) return null;
    const body: { data?: T; errors?: { path?: string[] }[] } | null = await response.json();
    if (body?.errors?.some(error => !optionalField || error.path?.[0] !== optionalField)) return null;
    return body?.data ?? null;
  }

  try {
    const gid = `gid://shopify/Order/${rawId}`;
    const identity = await query<OrderIdentity>(identityQuery, { id: gid }, "currentAppInstallation");
    if (identity?.order?.id !== gid) return { status: "unavailable" };

    const customerId = identity.order.customer?.id;
    if (identity.order.customer === null) return { status: "unlinked" };
    const customerNumber = typeof customerId === "string" ? customerId.match(customerIdPattern)?.[1] : undefined;
    if (!customerNumber) return { status: "unavailable" };

    const coverage = historyCoverage(identity.currentAppInstallation?.accessScopes);
    const paid = await query<PaidOrderCount>(countQuery, {
      search: `customer_id:${customerNumber} financial_status:paid test:false`,
    });
    const { count, precision } = paid?.ordersCount ?? {};
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || (precision !== "EXACT" && precision !== "AT_LEAST")) {
      return { status: "unavailable" };
    }
    return { status: "ready", count, exact: precision === "EXACT", coverage };
  } catch {
    return { status: "unavailable" };
  }
}
