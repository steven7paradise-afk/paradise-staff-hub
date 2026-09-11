import "dotenv/config";
import { prisma } from "../lib/prisma";

type PublicVariant = {
  id: number;
  title: string;
  sku: string | null;
  available: boolean;
  price: string;
  grams: number;
  requires_shipping: boolean;
};

type PublicProduct = {
  id: number;
  title: string;
  handle: string;
  images: Array<{ src: string }>;
  variants: PublicVariant[];
};

const catalogs = [
  ["accessori-paradise-extension-capelli", "Accessori Paradise"],
  ["coda", "Coda Paradise"],
  ["extension-microcheratina-capelli-veri-paradise", "Microcheratina"],
  ["extension-tessitura-microring-capelli-veri-paradise", "Microtessitura"],
  ["microtessitura-ricce", "Microtessitura Ricce"],
  ["ghd-accessori", "GHD Accessori"],
  ["linea-paradise", "Prodotti professionali"],
  ["parrucche-paradise", "Parrucche"],
  ["topper-paradise", "Topper"],
  ["summer-paradise-2026", "Summer Paradise 2026"],
] as const;

function internalSku(variant: PublicVariant) {
  return variant.sku?.trim().toUpperCase().replace(/\s+/g, "-") || `SHOP-${variant.id}`;
}

async function productsFor(handle: string) {
  const response = await fetch(`https://www.paradisebeauty.it/collections/${handle}/products.json?limit=250`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${handle}: Shopify pubblico HTTP ${response.status}`);
  return (await response.json() as { products: PublicProduct[] }).products;
}

async function main() {
  let created = 0;
  let updated = 0;
  let skippedServices = 0;

  for (const [handle, category] of catalogs) {
    const products = await productsFor(handle);
    const firstImage = products.flatMap((product) => product.images.map((image) => image.src))[0] ?? null;
    if (firstImage) await prisma.inventoryCatalog.update({ where: { name: category }, data: { cover_image_url: firstImage } });

    for (const product of products) {
      const physicalVariants = product.variants.filter((variant) => variant.requires_shipping);
      skippedServices += product.variants.length - physicalVariants.length;
      for (const variant of physicalVariants) {
        const variantId = String(variant.id);
        const productId = String(product.id);
        const sku = internalSku(variant);
        const existing = await prisma.inventoryProduct.findFirst({
          where: { OR: [{ shopify_variant_id: variantId }, { sku }] },
        });
        const name = product.variants.length > 1 && variant.title !== "Default Title" ? `${product.title} · ${variant.title}` : product.title;
        const description = `Shopify · ${variant.title}${variant.grams ? ` · ${variant.grams} g` : ""} · € ${variant.price}`;
        const imageUrl = product.images[0]?.src ?? null;

        if (existing) {
          await prisma.inventoryProduct.update({
            where: { id: existing.id },
            data: {
              name,
              description,
              image_url: imageUrl ?? existing.image_url,
              shopify_product_id: productId,
              shopify_variant_id: variantId,
              active: true,
            },
          });
          updated += 1;
          continue;
        }

        await prisma.inventoryProduct.create({
          data: {
            name,
            description,
            image_url: imageUrl,
            category,
            sku,
            shopify_product_id: productId,
            shopify_variant_id: variantId,
            active: true,
          },
        });
        created += 1;
      }
    }
  }

  const counts = await prisma.inventoryProduct.groupBy({ by: ["category"], where: { category: { in: catalogs.map(([, category]) => category) } }, _count: { _all: true } });
  console.log(JSON.stringify({ created, updated, skippedServices, categories: Object.fromEntries(counts.map((row) => [row.category ?? "Senza categoria", row._count._all])) }, null, 2));
}

main().finally(() => prisma.$disconnect());
