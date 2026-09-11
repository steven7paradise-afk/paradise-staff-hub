import "dotenv/config";
import { prisma } from "../lib/prisma";
import { applyInventoryOperation, ensureInventoryLocations } from "../lib/inventory";

const allocation = [
  { sku: "PRD003772036", quantity: 1 },
  { sku: "PRD003782037", quantity: 2 },
  { sku: "PRD003792038", quantity: 2 },
  { sku: "PRD003802039", quantity: 2 },
  { sku: "PRD003802137", quantity: 4 },
  { sku: "PRD003812040", quantity: 2 },
  { sku: "PRD003822041", quantity: 2 },
  { sku: "PRD003822136", quantity: 5 },
  { sku: "PRD003832042", quantity: 2 },
  { sku: "PRD003842043", quantity: 0 },
  { sku: "PRD003842138", quantity: 3 },
  { sku: "PRD003852044", quantity: 1 },
  { sku: "PRD003852139", quantity: 3 },
  { sku: "PRD003862045", quantity: 1 },
] as const;

async function main() {
  const expected = allocation.reduce((sum, row) => sum + row.quantity, 0);
  if (expected !== 30) throw new Error(`Totale Buenos Aires non valido: ${expected}, atteso 30.`);

  await ensureInventoryLocations();
  const [central, buenosAires, actor] = await Promise.all([
    prisma.inventoryLocation.findUnique({ where: { code: "CENTRALE" } }),
    prisma.inventoryLocation.findFirst({ where: { name: "Salone Buenos Aires", active: true } }),
    prisma.user.findFirst({
      where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
      orderBy: { created_at: "asc" },
    }),
  ]);
  if (!central || !buenosAires) throw new Error("Magazzino Centrale o Salone Buenos Aires non trovato.");
  if (!actor) throw new Error("Nessun amministratore attivo disponibile per registrare il trasferimento.");

  let transferred = 0;
  for (const row of allocation) {
    const product = await prisma.inventoryProduct.findUnique({ where: { sku: row.sku } });
    if (!product) throw new Error(`Prodotto ${row.sku} non trovato.`);

    const alreadyAtSalon = await prisma.inventoryLabel.count({
      where: { product_id: product.id, location_id: buenosAires.id, status: "AVAILABLE" },
    });
    const missing = Math.max(0, row.quantity - alreadyAtSalon);
    if (!missing) continue;

    const labels = await prisma.inventoryLabel.findMany({
      where: { product_id: product.id, location_id: central.id, status: "AVAILABLE" },
      orderBy: { created_at: "asc" },
      take: missing,
      select: { barcode: true },
    });
    if (labels.length !== missing) {
      throw new Error(`${row.sku}: richieste ${missing} unità, disponibili nel centrale ${labels.length}.`);
    }

    for (const label of labels) {
      await applyInventoryOperation(
        {
          code: label.barcode,
          operation: "TRANSFER",
          toLocationId: buenosAires.id,
          notes: "Assegnazione scorte Clip iniziali a Salone Buenos Aires",
        },
        actor.id,
      );
      transferred += 1;
    }
  }

  const rows = await prisma.inventoryProduct.findMany({
    where: { sku: { in: allocation.map((row) => row.sku) } },
    select: {
      sku: true,
      name: true,
      description: true,
      labels: {
        where: { location_id: buenosAires.id, status: "AVAILABLE" },
        select: { id: true },
      },
    },
    orderBy: { sku: "asc" },
  });
  const availableAtSalon = rows.reduce((sum, row) => sum + row.labels.length, 0);
  const availableAtCentral = await prisma.inventoryLabel.count({
    where: { product: { category: "Clip" }, location_id: central.id, status: "AVAILABLE" },
  });

  console.log(JSON.stringify({
    transferred,
    availableAtSalon,
    availableAtCentral,
    totalClipAvailable: availableAtSalon + availableAtCentral,
    products: rows.map((row) => ({ sku: row.sku, name: row.name, description: row.description, quantity: row.labels.length })),
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
