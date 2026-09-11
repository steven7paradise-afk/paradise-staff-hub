import "dotenv/config";
import { prisma } from "../lib/prisma";

type PublicCollection = {
  title: string;
  handle: string;
  description: string;
  image: { src: string } | null;
};

const physicalCatalogs: Record<string, string> = {
  "accessori-paradise-extension-capelli": "Accessori Paradise",
  coda: "Coda Paradise",
  "extension-microcheratina-capelli-veri-paradise": "Microcheratina",
  "extension-tessitura-microring-capelli-veri-paradise": "Microtessitura",
  "microtessitura-ricce": "Microtessitura Ricce",
  "ghd-accessori": "GHD Accessori",
  "linea-paradise": "Prodotti professionali",
  "parrucche-paradise": "Parrucche",
  "topper-paradise": "Topper",
  "summer-paradise-2026": "Summer Paradise 2026",
};

async function main() {
  const response = await fetch("https://www.paradisebeauty.it/collections.json?limit=250", { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Shopify pubblico HTTP ${response.status}`);
  const payload = await response.json() as { collections: PublicCollection[] };
  const collections = payload.collections.filter((collection) => physicalCatalogs[collection.handle]);

  for (const collection of collections) {
    const name = physicalCatalogs[collection.handle];
    await prisma.inventoryCatalog.upsert({
      where: { name },
      update: {
        active: true,
        description: collection.description || `Catalogo Shopify: ${collection.title}`,
        cover_image_url: collection.image?.src ?? null,
      },
      create: {
        name,
        description: collection.description || `Catalogo Shopify: ${collection.title}`,
        cover_image_url: collection.image?.src ?? null,
      },
    });
  }

  console.log(JSON.stringify({ createdOrUpdated: collections.length, catalogs: collections.map((collection) => physicalCatalogs[collection.handle]) }, null, 2));
}

main().finally(() => prisma.$disconnect());
