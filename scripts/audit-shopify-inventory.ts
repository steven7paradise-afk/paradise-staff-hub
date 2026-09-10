import "dotenv/config";
import { prisma } from "../lib/prisma";

type ShopifyLevel = {
  location: { id: string; name: string };
  quantities: Array<{ name: string; quantity: number }>;
};

type ShopifyVariant = {
  id: string;
  sku: string;
  title: string;
  product: { id: string; title: string };
  inventoryItem: { id: string; tracked: boolean; inventoryLevels: { nodes: ShopifyLevel[] } };
};

async function shopify<T>(query: string, variables: Record<string, unknown> = {}) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) throw new Error("Collegamento Shopify non configurato.");
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || json.errors?.length || !json.data) throw new Error(json.errors?.map((error) => error.message).join(" · ") || `Shopify HTTP ${response.status}`);
  return json.data;
}

async function main() {
  const localProducts = await prisma.inventoryProduct.findMany({
    where: { active: true },
    select: {
      sku: true,
      name: true,
      labels: { where: { status: "AVAILABLE" }, select: { location: { select: { name: true } } } },
    },
    orderBy: { sku: "asc" },
  });
  const localSkuSet = new Set(localProducts.map((product) => product.sku));

  const locationData = await shopify<{
    locations: { nodes: Array<{ id: string; name: string; isActive: boolean }> };
  }>(`query AuditLocations { locations(first: 100) { nodes { id name isActive } } }`);

  const variants: ShopifyVariant[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data: {
      productVariants: {
        nodes: ShopifyVariant[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopify(`query AuditVariants($cursor: String) {
      productVariants(first: 100, after: $cursor) {
        nodes {
          id sku title
          product { id title }
          inventoryItem {
            id tracked
            inventoryLevels(first: 50) {
              nodes { location { id name } quantities(names: ["available"]) { name quantity } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`, { cursor });
    variants.push(...data.productVariants.nodes.filter((variant) => localSkuSet.has(variant.sku)));
    hasNextPage = data.productVariants.pageInfo.hasNextPage;
    cursor = data.productVariants.pageInfo.endCursor;
  }

  const shopifyBySku = new Map(variants.map((variant) => [variant.sku, variant]));
  const products = localProducts.map((product) => {
    const variant = shopifyBySku.get(product.sku);
    const localByLocation = Object.fromEntries([...new Set(product.labels.map((label) => label.location.name))].map((name) => [name, product.labels.filter((label) => label.location.name === name).length]));
    const shopifyByLocation = variant ? Object.fromEntries(variant.inventoryItem.inventoryLevels.nodes.map((level) => [level.location.name, level.quantities.find((quantity) => quantity.name === "available")?.quantity ?? 0])) : {};
    return {
      sku: product.sku,
      name: product.name,
      foundOnShopify: Boolean(variant),
      shopifyVariantId: variant?.id ?? null,
      inventoryItemId: variant?.inventoryItem.id ?? null,
      tracked: variant?.inventoryItem.tracked ?? null,
      local: localByLocation,
      shopify: shopifyByLocation,
    };
  });

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    shopifyLocations: locationData.locations.nodes,
    localProducts: localProducts.length,
    matchedProducts: products.filter((product) => product.foundOnShopify).length,
    unmatchedProducts: products.filter((product) => !product.foundOnShopify).map((product) => ({ sku: product.sku, name: product.name })),
    products: products.filter((product) => product.foundOnShopify),
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
