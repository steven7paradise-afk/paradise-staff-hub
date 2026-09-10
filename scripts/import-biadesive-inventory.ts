import "dotenv/config";
import { prisma } from "../lib/prisma";
import { ensureInventoryLocations, generateInventoryLabels } from "../lib/inventory";

type CatalogRow = {
  article?: number;
  sku: string;
  name: string;
  quantity: number;
  image?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  length?: string;
};

const genericImage = "https://www.paradisebeauty.it/cdn/shop/files/biadesivo-extension-capelli-veri-milano-paradise-beauty.jpg?v=1783510432&width=1800";
const importLot = "IMPORT-BIADESIVE-2026-09-10";

const rows: CatalogRow[] = [
  { article: 1829, sku: "PRD002871829", name: "CAMY BIA", quantity: 0, length: "55 cm" },
  { article: 1929, sku: "PRD002881929", name: "ALY BIA", quantity: 0, length: "55 cm" },
  { article: 1930, sku: "PRD002891930", name: "ROXY BIA", quantity: 2, length: "55 cm" },
  { article: 1931, sku: "PRD002901931", name: "FRANCY BIA", quantity: 5, length: "55 cm" },
  { article: 1932, sku: "PRD002911932", name: "1 - NERO - BIADESIVE PARADISE", quantity: 5, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/7-4.png?v=1776097831", shopifyProductId: "10805851226458", shopifyVariantId: "54384635052378" },
  { article: 1933, sku: "PRD002921933", name: "2 - CASTANO SCURO - BIADESIVE PARADISE", quantity: 4, length: "55 cm" },
  { article: 1934, sku: "PRD002931934", name: "4 - CASTANO FONDENTE SFUMATO - BIADESIVE PARADISE", quantity: 7, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/1-4.png?v=1776157605", shopifyProductId: "10805814460762", shopifyVariantId: "54384763109722" },
  { article: 1935, sku: "PRD002941935", name: "3 - CASTANO CHIARO FREDDO - BIADESIVE PARADISE", quantity: 6, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/2-4.png?v=1776157358", shopifyProductId: "10805827699034", shopifyVariantId: "54384753049946" },
  { article: 1936, sku: "PRD002951936", name: "3.A - CASTANO CHIARO FREDDO - BIADESIVE PARADISE", quantity: 7, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/2-4_fb7a82a6-794b-4a2c-84b3-27c4abfdc3b3.png?v=1776157614", shopifyProductId: "10805878784346", shopifyVariantId: "54384765796698" },
  { article: 1937, sku: "PRD002961937", name: "5 - CASTANO CHIARO - BIADESIVE PARADISE", quantity: 8, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/8-4_e9d96625-4dca-4bc0-8b21-d38cf2971b15.png?v=1776157589", shopifyProductId: "10805856043354", shopifyVariantId: "54384758096218" },
  { article: 1938, sku: "PRD002971938", name: "5.A - CASTANO CHIARO - BIADESIVE PARADISE", quantity: 0, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/10-4.png?v=1776157442", shopifyProductId: "10805876490586", shopifyVariantId: "54384762224986" },
  { article: 1939, sku: "PRD002981939", name: "8 - TOFFE MESCIATO - BIADESIVE PARADISE", quantity: 8, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/6-4.png?v=1776157645", shopifyProductId: "10805844181338", shopifyVariantId: "54384773988698" },
  { article: 1940, sku: "PRD002991940", name: "8.A - TOFFE MESCIATO - BIADESIVE PARADISE", quantity: 7, length: "55 cm" },
  { article: 1941, sku: "PRD003001941", name: "6 - CARAMELLO - BIADESIVE PARADISE", quantity: 1, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/3-4.png?v=1776157624", shopifyProductId: "10805834187098", shopifyVariantId: "54384767205722" },
  { article: 1942, sku: "PRD003011942", name: "6.A - CARAMELLO - BIADESIVE PARADISE", quantity: 3, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/5-4.png?v=1776157631", shopifyProductId: "10805837005146", shopifyVariantId: "54384772153690" },
  { article: 1944, sku: "PRD003031944", name: "13.A - MIELE - BIADESIVE PARADISE", quantity: 8, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/4-4_ebc3edd9-d18c-463f-b18a-efa193f9c66f.png?v=1776157656", shopifyProductId: "10805840609626", shopifyVariantId: "54384778051930" },
  { article: 1945, sku: "PRD003041945", name: "17.A1 - BIONDO SABBIA - BIADESIVE PARADISE", quantity: 4, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/12-4.png?v=1776157660", shopifyProductId: "10805914206554", shopifyVariantId: "54384781033818" },
  { article: 1946, sku: "PRD003051946", name: "15.A - BIONDO GHIACCIO - BIADESIVE PARADISE", quantity: 6, length: "55 cm", image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/9-4.png?v=1776157689", shopifyProductId: "10805861187930", shopifyVariantId: "54384783262042" },
  { article: 2003, sku: "PRD003502003", name: "NASTRO BIADESIVO", quantity: 0, image: "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/15_NASTRO_BIADESIVO.png?v=1781610021", shopifyProductId: "10802281054554", shopifyVariantId: "53881512329562" },
  { article: 2046, sku: "PRD003872046", name: "CASTANO - BIADESIVE PARADISE", quantity: 0, length: "55 cm" },
  { article: 2047, sku: "PRD003882047", name: "9 - BIONDO SCURO MIELE - BIADESIVE PARADISE", quantity: 2, length: "55 cm" },
  { article: 2048, sku: "PRD003892048", name: "10 - BIONDO SCURO DORATO - BIADESIVE PARADISE", quantity: 3, length: "55 cm" },
  { article: 2049, sku: "PRD003902049", name: "11 - BIONDO MESCIATO - BIADESIVE PARADISE", quantity: 6, length: "55 cm" },
  { article: 2050, sku: "PRD003912050", name: "12 - BIONDO NOCCIOLA - BIADESIVE PARADISE", quantity: 4, length: "55 cm" },
  { article: 2051, sku: "PRD003922051", name: "16 - BIONDO CHAMPAGNE - BIADESIVE PARADISE", quantity: 3, length: "55 cm" },
  { article: 2052, sku: "PRD003932052", name: "14 - BIONDO - BIADESIVE PARADISE", quantity: 3, length: "55 cm" },
  { article: 2140, sku: "PRD004192140", name: "7 - NOCCIOLA MESCIATO - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2141, sku: "PRD004202141", name: "9.A - BIONDO SCURO MIELE - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2142, sku: "PRD004212142", name: "10.A - BIONDO SCURO DORATO - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2143, sku: "PRD004222143", name: "11.A - BIONDO MESCIATO - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2144, sku: "PRD004232144", name: "12.A - BIONDO NOCCIOLA - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2145, sku: "PRD004242145", name: "13 - MIELLE - BIADESIVE PARADISE", quantity: 5, length: "55 cm", shopifyProductId: "10976129450330", shopifyVariantId: "54659980624218" },
  { article: 2146, sku: "PRD004252146", name: "14.A - BIONDO - BIADESIVE PARADISE", quantity: 0, length: "55 cm" },
  { article: 2147, sku: "PRD004262147", name: "15 - BIONDO GHIACCIO - BIADESIVE PARADISE", quantity: 5, length: "55 cm" },
  { article: 2148, sku: "PRD004272148", name: "16.A - BIONDO CHAMPAGNE - BIADESIVE PARADISE", quantity: 0, length: "55 cm" },
  { sku: "PAR-BIA-JENYBIA-55", name: "JENYBIA", quantity: 0, length: "55 cm" },
];

async function main() {
  const expected = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (expected !== 137) throw new Error(`Totale inventario non valido: ${expected}, atteso 137.`);
  await ensureInventoryLocations();
  const [location, actor] = await Promise.all([
    prisma.inventoryLocation.findUnique({ where: { code: "CENTRALE" } }),
    prisma.user.findFirst({ where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } }, orderBy: { created_at: "asc" } }),
  ]);
  if (!location) throw new Error("Magazzino Centrale non trovato.");
  if (!actor) throw new Error("Nessun amministratore attivo disponibile per registrare il carico.");

  let createdProducts = 0;
  let createdLabels = 0;
  for (const row of rows) {
    const existing = await prisma.inventoryProduct.findUnique({ where: { sku: row.sku } });
    const product = await prisma.inventoryProduct.upsert({
      where: { sku: row.sku },
      update: {
        name: row.name,
        barcode: row.sku,
        description: `${row.length ? `Lunghezza ${row.length} · ` : ""}Categoria Biadesivo${row.article ? ` · Articolo n° ${row.article}` : " · Codice interno provvisorio"}`,
        image_url: row.image ?? genericImage,
        category: "Biadesivo",
        shopify_product_id: row.shopifyProductId ?? null,
        shopify_variant_id: row.shopifyVariantId ?? null,
        active: true,
      },
      create: {
        name: row.name,
        sku: row.sku,
        barcode: row.sku,
        description: `${row.length ? `Lunghezza ${row.length} · ` : ""}Categoria Biadesivo${row.article ? ` · Articolo n° ${row.article}` : " · Codice interno provvisorio"}`,
        image_url: row.image ?? genericImage,
        category: "Biadesivo",
        shopify_product_id: row.shopifyProductId ?? null,
        shopify_variant_id: row.shopifyVariantId ?? null,
      },
    });
    if (!existing) createdProducts += 1;
    const importedCount = await prisma.inventoryLabel.count({ where: { product_id: product.id, location_id: location.id, lot_number: importLot } });
    const missing = Math.max(0, row.quantity - importedCount);
    if (missing > 0) {
      await generateInventoryLabels({ productId: product.id, locationId: location.id, quantity: missing, lotNumber: importLot }, actor.id);
      createdLabels += missing;
    }
  }

  const [catalogCount, importedLabels, availableLabels] = await Promise.all([
    prisma.inventoryProduct.count({ where: { sku: { in: rows.map((row) => row.sku) } } }),
    prisma.inventoryLabel.count({ where: { lot_number: importLot } }),
    prisma.inventoryLabel.count({ where: { lot_number: importLot, status: "AVAILABLE" } }),
  ]);
  console.log(JSON.stringify({ catalogCount, importedLabels, availableLabels, createdProducts, createdLabels, location: location.name }, null, 2));
}

main().finally(() => prisma.$disconnect());
