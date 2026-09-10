import "dotenv/config";
import { prisma } from "../lib/prisma";
import { applyInventoryOperation, ensureInventoryLocations, generateInventoryLabels } from "../lib/inventory";

const allocation = [
  ["PRD002911932", 5], ["PRD002921933", 4], ["PRD002941935", 6], ["PRD002951936", 7],
  ["PRD002931934", 7], ["PRD002961937", 8], ["PRD002971938", 0], ["PRD003001941", 1],
  ["PRD003011942", 3], ["PRD004192140", 5], ["PRD002981939", 8], ["PRD002991940", 7],
  ["PRD003882047", 2], ["PRD004202141", 5], ["PRD003892048", 3], ["PRD004212142", 5],
  ["PRD003902049", 6], ["PRD004222143", 5], ["PRD003912050", 4], ["PRD004232144", 5],
  ["PRD004242145", 5], ["PRD003031944", 8], ["PRD003932052", 3], ["PRD004252146", 0],
  ["PRD004262147", 5], ["PRD003051946", 6], ["PRD003922051", 3], ["PRD004272148", 0],
  ["PRD003041945", 4], ["PRD002881929", 0], ["PRD002871829", 0], ["PRD003872046", 0],
  ["PRD002901931", 5], ["PAR-BIA-JENYBIA-55", 0], ["PRD002891930", 2],
] as const;

async function main() {
  const expected = allocation.reduce((sum, [, quantity]) => sum + quantity, 0);
  if (expected !== 137) throw new Error(`Totale Buenos Aires non valido: ${expected}, atteso 137.`);

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
  if (!actor) throw new Error("Nessun amministratore attivo disponibile per registrare la rettifica.");

  let created = 0;
  let cancelled = 0;
  let transferred = 0;

  for (const [sku, target] of allocation) {
    const product = await prisma.inventoryProduct.findUnique({ where: { sku } });
    if (!product) throw new Error(`Prodotto ${sku} non trovato.`);

    let allAvailable = await prisma.inventoryLabel.findMany({
      where: { product_id: product.id, status: "AVAILABLE" },
      orderBy: [{ lot_number: "asc" }, { created_at: "desc" }],
    });

    if (allAvailable.length > target) {
      const excess = allAvailable
        .sort((a, b) => Number(Boolean(a.lot_number)) - Number(Boolean(b.lot_number)) || b.created_at.getTime() - a.created_at.getTime())
        .slice(0, allAvailable.length - target);
      for (const label of excess) {
        await applyInventoryOperation({
          code: label.barcode,
          operation: "ADJUSTMENT",
          status: "CANCELLED",
          notes: "Rettifica inventario iniziale Corso Buenos Aires: etichetta eccedente",
        }, actor.id);
        cancelled += 1;
      }
    }

    allAvailable = await prisma.inventoryLabel.findMany({
      where: { product_id: product.id, status: "AVAILABLE" },
      orderBy: { created_at: "asc" },
    });
    const missing = target - allAvailable.length;
    if (missing > 0) {
      await generateInventoryLabels({
        productId: product.id,
        locationId: central.id,
        quantity: missing,
        lotNumber: "RETTIFICA-BIADESIVE-BA-2026-09-10",
      }, actor.id);
      created += missing;
    }

    const alreadyAtSalon = await prisma.inventoryLabel.count({
      where: { product_id: product.id, location_id: buenosAires.id, status: "AVAILABLE" },
    });
    const toMove = target - alreadyAtSalon;
    if (toMove <= 0) continue;
    const labels = await prisma.inventoryLabel.findMany({
      where: { product_id: product.id, location_id: central.id, status: "AVAILABLE" },
      orderBy: { created_at: "asc" },
      take: toMove,
      select: { barcode: true },
    });
    if (labels.length !== toMove) throw new Error(`${sku}: unità insufficienti per il trasferimento.`);
    for (const label of labels) {
      await applyInventoryOperation({
        code: label.barcode,
        operation: "TRANSFER",
        toLocationId: buenosAires.id,
        notes: "Assegnazione scorte Biadesive iniziali a Salone Buenos Aires",
      }, actor.id);
      transferred += 1;
    }
  }

  const [availableAtSalon, availableAtCentral, totalAvailable, movementCount] = await Promise.all([
    prisma.inventoryLabel.count({ where: { product: { category: "Biadesivo" }, location_id: buenosAires.id, status: "AVAILABLE" } }),
    prisma.inventoryLabel.count({ where: { product: { category: "Biadesivo" }, location_id: central.id, status: "AVAILABLE" } }),
    prisma.inventoryLabel.count({ where: { product: { category: "Biadesivo" }, status: "AVAILABLE" } }),
    prisma.inventoryMovement.count({ where: { notes: "Assegnazione scorte Biadesive iniziali a Salone Buenos Aires" } }),
  ]);
  console.log(JSON.stringify({ created, cancelled, transferred, availableAtSalon, availableAtCentral, totalAvailable, movementCount }, null, 2));
}

main().finally(() => prisma.$disconnect());
