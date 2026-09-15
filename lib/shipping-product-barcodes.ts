import type { PrismaClient } from "@prisma/client";

export async function shippingBarcodeMap(prisma: PrismaClient, orders: any[]) {
  const variantIds = [...new Set(orders.flatMap((order) =>
    (Array.isArray(order.line_items) ? order.line_items : [])
      .map((item: any) => item.variant_id ? String(item.variant_id) : "")
      .filter(Boolean),
  ))];
  if (!variantIds.length) return new Map<string, { barcode: string | null; imageUrl: string | null }>();

  const products = await prisma.inventoryProduct.findMany({
    where: {
      active: true,
      OR: [
        { shopify_variant_id: { in: variantIds } },
        { sku: { in: variantIds.map((id) => `SHOP-${id}`) } },
      ],
    },
    select: { shopify_variant_id: true, sku: true, barcode: true, image_url: true },
  }).catch(() => []);

  const map = new Map<string, { barcode: string | null; imageUrl: string | null }>();
  for (const product of products) {
    const id = product.shopify_variant_id || product.sku.replace(/^SHOP-/, "");
    if (variantIds.includes(id)) map.set(id, { barcode: product.barcode, imageUrl: product.image_url });
  }
  return map;
}
