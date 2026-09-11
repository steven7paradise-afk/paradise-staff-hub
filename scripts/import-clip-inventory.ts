import "dotenv/config";
import { prisma } from "../lib/prisma";
import { ensureInventoryLocations, generateInventoryLabels } from "../lib/inventory";

type ClipRow = {
  article: number;
  sku: string;
  name: string;
  length?: "55 cm" | "65 cm";
  quantity: number;
  image?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
};

const catalogName = "Clip";
const importLot = "IMPORT-CLIP-2026-09-10";
const genericImage = "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/1_d3836b89-4a37-497e-8294-808ba3601039.png?v=1775910984";
const images = {
  "1": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/1_d3836b89-4a37-497e-8294-808ba3601039.png?v=1775910984",
  "2": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/2_936ebf7f-8cb6-41c5-937d-c4d19716cefd.png?v=1775897891",
  "3": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/6_f09322bc-d97a-41c0-85c2-7b287e1e3bc1.png?v=1775910274",
  "4": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/3_ea8f5e50-dc88-4ca5-9346-6ae0aebf9dd0.png?v=1775904804",
  "5": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/10_fc69b507-41df-4b48-b616-e450214c36da.png?v=1775904954",
  "6A": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/7_0685c2d1-3628-4d8d-a3b3-83904d3d3cd2.png?v=1775904961",
  "7": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/9_6d308b91-da80-4ac0-819e-23b1fb119082.png?v=1775905083",
  "8": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/4_c047d6e6-7f2f-469b-8733-4754a4a26c7e.png?v=1775905094",
  "8A": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/5_3.png?v=1775905103",
  "9": "https://cdn.shopify.com/s/files/1/0952/8157/8330/files/8_fc6d53e4-319b-492d-91b7-a5e0bc7b5932.png?v=1775911150",
};

const rows: ClipRow[] = [
  { article: 2036, sku: "PRD003772036", name: "1 - NERO - CLIP PARADISE", length: "55 cm", quantity: 9, image: images["1"], shopifyProductId: "10813930602842", shopifyVariantId: "53947363918170" },
  { article: 2037, sku: "PRD003782037", name: "2 - CASTANO SCURO - CLIP PARADISE", length: "55 cm", quantity: 10, image: images["2"], shopifyProductId: "10814041948506", shopifyVariantId: "53948220670298" },
  { article: 2038, sku: "PRD003792038", name: "3 - CASTANO FREDDO - CLIP PARADISE", length: "55 cm", quantity: 11, image: images["3"], shopifyProductId: "10814042014042", shopifyVariantId: "53948222013786" },
  { article: 2039, sku: "PRD003802039", name: "4 - CASTANO CHIARO - CLIP PARADISE", length: "55 cm", quantity: 11, image: images["4"], shopifyProductId: "10814044635482", shopifyVariantId: "54640971874650" },
  { article: 2137, sku: "PRD003802137", name: "4 - CASTANO CHIARO - CLIP PARADISE", length: "65 cm", quantity: 8, image: images["4"], shopifyProductId: "10814044635482", shopifyVariantId: "54640971907418" },
  { article: 2040, sku: "PRD003812040", name: "5 - NOCCIOLA MESCIATO - CLIP PARADISE", length: "55 cm", quantity: 7, image: images["5"], shopifyProductId: "10814043980122", shopifyVariantId: "53948246098266" },
  { article: 2041, sku: "PRD003822041", name: "6.A - CARAMELLO MESCIATO - CLIP PARADISE", length: "55 cm", quantity: 13, image: images["6A"], shopifyProductId: "10814045127002", shopifyVariantId: "54640842146138" },
  { article: 2136, sku: "PRD003822136", name: "6.A - CARAMELLO MESCIATO - CLIP PARADISE", length: "65 cm", quantity: 10, image: images["6A"], shopifyProductId: "10814045127002", shopifyVariantId: "54640842178906" },
  { article: 2042, sku: "PRD003832042", name: "7 - BIONDO NOCCIOLA - CLIP PARADISE", length: "55 cm", quantity: 5, image: images["7"], shopifyProductId: "10815929909594", shopifyVariantId: "53961779315034" },
  { article: 2043, sku: "PRD003842043", name: "8 - BIONDO MESCIATO - CLIP PARADISE", length: "55 cm", quantity: 7, image: images["8"], shopifyProductId: "10814042734938", shopifyVariantId: "54641571397978" },
  { article: 2138, sku: "PRD003842138", name: "8 - BIONDO MESCIATO - CLIP PARADISE", length: "65 cm", quantity: 6, image: images["8"], shopifyProductId: "10814042734938", shopifyVariantId: "54641571430746" },
  { article: 2044, sku: "PRD003852044", name: "8.A - BIONDO MESCIATO - CLIP PARADISE", length: "55 cm", quantity: 7, image: images["8A"], shopifyProductId: "10815366889818", shopifyVariantId: "54641601249626" },
  { article: 2139, sku: "PRD003852139", name: "8.A - BIONDO MESCIATO - CLIP PARADISE", length: "65 cm", quantity: 6, image: images["8A"], shopifyProductId: "10815366889818", shopifyVariantId: "54641601282394" },
  { article: 2045, sku: "PRD003862045", name: "9 - BIONDO - CLIP PARADISE", length: "55 cm", quantity: 6, image: images["9"], shopifyProductId: "10815367414106", shopifyVariantId: "53957288657242" },
  { article: 1605, sku: "PRD000031605", name: "9.A - CASTANO & MIELE CLIP - PARADISE", length: "55 cm", quantity: 0 },
  { article: 1608, sku: "PRD000071608", name: "16 - MIELE CLIP - PARADISE", length: "55 cm", quantity: 0 },
  { article: 1610, sku: "PRD000131610", name: "11 - BIONDO CENERE CLIP - PARADISE", length: "55 cm", quantity: 0 },
  { article: 1611, sku: "PRD000131611", name: "11 - BIONDO CENERE CLIP - PARADISE", length: "55 cm", quantity: 0 },
  { article: 1616, sku: "PRD000321616", name: "1 - NERO CLIP - PARADISE", length: "55 cm", quantity: 0, image: images["1"] },
  { article: 2062, sku: "PRD003962062", name: "CLIP PARADISE", quantity: 0 },
];

async function main() {
  const expected = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (expected !== 116) throw new Error(`Totale Clip non valido: ${expected}, atteso 116.`);

  await ensureInventoryLocations();
  const [location, actor] = await Promise.all([
    prisma.inventoryLocation.findUnique({ where: { code: "CENTRALE" } }),
    prisma.user.findFirst({ where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } }, orderBy: { created_at: "asc" } }),
  ]);
  if (!location) throw new Error("Magazzino Centrale non trovato.");
  if (!actor) throw new Error("Nessun amministratore attivo disponibile per registrare il carico.");

  await prisma.inventoryCatalog.upsert({
    where: { name: catalogName },
    update: { active: true, cover_image_url: images["1"], description: "Extension a clip Paradise in capelli veri" },
    create: { name: catalogName, cover_image_url: images["1"], description: "Extension a clip Paradise in capelli veri" },
  });

  let createdProducts = 0;
  let createdLabels = 0;
  for (const row of rows) {
    const existing = await prisma.inventoryProduct.findUnique({ where: { sku: row.sku } });
    const product = await prisma.inventoryProduct.upsert({
      where: { sku: row.sku },
      update: {
        name: row.name,
        barcode: row.sku,
        description: `${row.length ? `Lunghezza ${row.length} · ` : ""}Categoria Clip · Articolo n° ${row.article}`,
        image_url: row.image ?? genericImage,
        category: catalogName,
        shopify_product_id: row.shopifyProductId ?? null,
        shopify_variant_id: row.shopifyVariantId ?? null,
        active: true,
      },
      create: {
        name: row.name,
        sku: row.sku,
        barcode: row.sku,
        description: `${row.length ? `Lunghezza ${row.length} · ` : ""}Categoria Clip · Articolo n° ${row.article}`,
        image_url: row.image ?? genericImage,
        category: catalogName,
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

  const [catalogProducts, importedLabels, availableLabels] = await Promise.all([
    prisma.inventoryProduct.count({ where: { category: catalogName } }),
    prisma.inventoryLabel.count({ where: { lot_number: importLot } }),
    prisma.inventoryLabel.count({ where: { lot_number: importLot, status: "AVAILABLE" } }),
  ]);
  console.log(JSON.stringify({ catalog: catalogName, catalogProducts, importedLabels, availableLabels, createdProducts, createdLabels, location: location.name }, null, 2));
}

main().finally(() => prisma.$disconnect());
