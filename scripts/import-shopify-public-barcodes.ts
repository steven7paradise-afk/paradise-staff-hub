import "dotenv/config";
import { prisma } from "../lib/prisma";

type CollectionProduct = { handle: string };
type ProductJs = {
  title: string;
  variants: Array<{ id: number; title: string; sku: string | null; barcode: string | null }>;
};

const collectionHandles = [
  "accessori-paradise-extension-capelli",
  "coda",
  "extension-microcheratina-capelli-veri-paradise",
  "extension-tessitura-microring-capelli-veri-paradise",
  "microtessitura-ricce",
  "ghd-accessori",
  "linea-paradise",
  "parrucche-paradise",
  "topper-paradise",
  "summer-paradise-2026",
];

async function json<T>(url: string, attempt = 0): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 429 && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 750 * (attempt + 1))));
    return json<T>(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function main() {
  const handles = new Set<string>();
  for (const collection of collectionHandles) {
    const payload = await json<{ products: CollectionProduct[] }>(`https://www.paradisebeauty.it/collections/${collection}/products.json?limit=250`);
    payload.products.forEach((product) => handles.add(product.handle));
  }

  const products: ProductJs[] = [];
  const queue = [...handles];
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const handle = queue.shift();
      if (!handle) return;
      products.push(await json<ProductJs>(`https://www.paradisebeauty.it/products/${handle}.js`));
    }
  });
  await Promise.all(workers);

  const variants = new Map<string, { product: string; title: string; sku: string | null; barcode: string | null }>();
  for (const product of products) {
    for (const variant of product.variants) {
      variants.set(String(variant.id), { product: product.title, title: variant.title, sku: variant.sku?.trim() || null, barcode: variant.barcode?.trim().toUpperCase() || null });
    }
  }

  const barcodeOwners = new Map<string, string[]>();
  for (const [variantId, variant] of variants) {
    if (!variant.barcode) continue;
    barcodeOwners.set(variant.barcode, [...(barcodeOwners.get(variant.barcode) ?? []), variantId]);
  }
  const duplicateBarcodes = new Set([...barcodeOwners].filter(([, owners]) => owners.length > 1).map(([barcode]) => barcode));

  let connected = 0;
  let missingBarcode = 0;
  let missingLocalProduct = 0;
  const conflicts: Array<{ variantId: string; barcode: string; reason: string }> = [];

  for (const [variantId, variant] of variants) {
    const local = await prisma.inventoryProduct.findUnique({ where: { shopify_variant_id: variantId } });
    if (!local) { missingLocalProduct += 1; continue; }
    if (!variant.barcode) { missingBarcode += 1; continue; }
    if (duplicateBarcodes.has(variant.barcode)) {
      conflicts.push({ variantId, barcode: variant.barcode, reason: "Barcode ripetuto su più varianti Shopify" });
      continue;
    }
    const barcodeInUse = await prisma.inventoryProduct.findUnique({ where: { barcode: variant.barcode } });
    if (barcodeInUse && barcodeInUse.id !== local.id) {
      conflicts.push({ variantId, barcode: variant.barcode, reason: `Già associato a ${barcodeInUse.sku}` });
      continue;
    }
    const nextSku = local.sku.startsWith("SHOP-") && variant.sku ? variant.sku.toUpperCase().replace(/\s+/g, "-") : local.sku;
    const skuInUse = nextSku !== local.sku ? await prisma.inventoryProduct.findUnique({ where: { sku: nextSku } }) : null;
    await prisma.inventoryProduct.update({
      where: { id: local.id },
      data: { barcode: variant.barcode, sku: skuInUse ? local.sku : nextSku },
    });
    connected += 1;
  }

  console.log(JSON.stringify({
    publicProductsRead: products.length,
    variantsRead: variants.size,
    connected,
    missingBarcode,
    missingLocalProduct,
    duplicateBarcodeCount: duplicateBarcodes.size,
    conflicts,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
