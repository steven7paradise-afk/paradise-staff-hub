import { Prisma, type InventoryLabelStatus, type InventoryMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertInventoryTransition,
  formatInventoryLabelCode,
  nextStatusForOperation,
  normalizeInventoryCode,
  normalizeSku,
  type InventoryOperation,
  type InventoryUnitStatus,
} from "@/lib/inventory-rules";

const availableStatuses: InventoryLabelStatus[] = ["AVAILABLE", "RESERVED"];

function locationCode(name: string, id: string) {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return `SALONE-${clean || "SEDE"}-${id.slice(-5).toUpperCase()}`;
}

export async function ensureInventoryLocations() {
  await prisma.inventoryLocation.upsert({
    where: { code: "CENTRALE" },
    update: { active: true },
    create: { name: "Magazzino Centrale", code: "CENTRALE", kind: "WAREHOUSE" },
  });

  const salons = await prisma.location.findMany({ where: { active: true }, select: { id: true, name: true, address: true } });
  await Promise.all(salons.map(async (salon) => {
    const existing = await prisma.inventoryLocation.findUnique({ where: { linked_location_id: salon.id } });
    if (existing) {
      await prisma.inventoryLocation.update({ where: { id: existing.id }, data: { name: salon.name, address: salon.address, active: true } });
      return;
    }
    await prisma.inventoryLocation.create({
      data: { name: salon.name, code: locationCode(salon.name, salon.id), kind: "SALON", address: salon.address, linked_location_id: salon.id },
    });
  }));
}

export async function getInventoryOverview(query = "") {
  await ensureInventoryLocations();
  const search = query.trim();
  const productWhere: Prisma.InventoryProductWhereInput = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] }
    : {};

  const [products, locations, statusCounts, locationCounts, recentLabels, movements] = await Promise.all([
    prisma.inventoryProduct.findMany({ where: productWhere, orderBy: { name: "asc" }, take: 200 }),
    prisma.inventoryLocation.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.inventoryLabel.groupBy({ by: ["product_id", "status"], _count: { _all: true } }),
    prisma.inventoryLabel.groupBy({ by: ["location_id", "status"], _count: { _all: true } }),
    prisma.inventoryLabel.findMany({
      where: search ? { OR: [{ label_code: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }, { lot_number: { contains: search, mode: "insensitive" } }] } : {},
      include: { product: true, location: true }, orderBy: { created_at: "desc" }, take: 120,
    }),
    prisma.inventoryMovement.findMany({
      include: { product: { select: { name: true, sku: true } }, label: { select: { label_code: true, barcode: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { created_at: "desc" }, take: 100,
    }),
  ]);

  const countsByProduct = new Map<string, Record<string, number>>();
  for (const row of statusCounts) {
    const counts = countsByProduct.get(row.product_id) ?? {};
    counts[row.status] = row._count._all;
    countsByProduct.set(row.product_id, counts);
  }
  const countsByLocation = new Map<string, Record<string, number>>();
  for (const row of locationCounts) {
    const counts = countsByLocation.get(row.location_id) ?? {};
    counts[row.status] = row._count._all;
    countsByLocation.set(row.location_id, counts);
  }

  return {
    products: products.map((product) => ({ ...product, counts: countsByProduct.get(product.id) ?? {} })),
    locations: locations.map((location) => ({ ...location, counts: countsByLocation.get(location.id) ?? {} })),
    labels: recentLabels,
    movements,
    totals: {
      available: statusCounts.filter((row) => row.status === "AVAILABLE").reduce((sum, row) => sum + row._count._all, 0),
      reserved: statusCounts.filter((row) => row.status === "RESERVED").reduce((sum, row) => sum + row._count._all, 0),
      sold: statusCounts.filter((row) => row.status === "SOLD").reduce((sum, row) => sum + row._count._all, 0),
      damaged: statusCounts.filter((row) => row.status === "DAMAGED").reduce((sum, row) => sum + row._count._all, 0),
    },
  };
}

export async function findInventoryScan(rawCode: unknown) {
  const code = normalizeInventoryCode(rawCode);
  if (!code) return null;
  const label = await prisma.inventoryLabel.findFirst({
    where: { OR: [{ barcode: code }, { label_code: code }] },
    include: { product: true, location: true, movements: { include: { user: { select: { name: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } } }, orderBy: { created_at: "desc" }, take: 20 } },
  });
  if (label) return { kind: "label" as const, label };
  const product = await prisma.inventoryProduct.findFirst({ where: { OR: [{ sku: code }, { barcode: code }] } });
  return product ? { kind: "product" as const, product } : null;
}

export async function createInventoryProduct(input: Record<string, unknown>) {
  const name = String(input.name ?? "").trim();
  const sku = normalizeSku(input.sku);
  if (!name || !sku) throw new Error("Nome e SKU sono obbligatori.");
  const minimumStock = Number(input.minimumStock ?? 0);
  if (!Number.isInteger(minimumStock) || minimumStock < 0) throw new Error("La scorta minima deve essere un numero intero positivo.");
  return prisma.inventoryProduct.create({
    data: {
      name,
      sku,
      barcode: normalizeInventoryCode(input.barcode) || null,
      description: String(input.description ?? "").trim() || null,
      category: String(input.category ?? "").trim() || null,
      image_url: String(input.imageUrl ?? "").trim() || null,
      minimum_stock: minimumStock,
      shopify_product_id: String(input.shopifyProductId ?? "").trim() || null,
      shopify_variant_id: String(input.shopifyVariantId ?? "").trim() || null,
      shopify_inventory_item_id: String(input.shopifyInventoryItemId ?? "").trim() || null,
    },
  });
}

async function enqueueSync(tx: Prisma.TransactionClient, productId: string, locationId: string) {
  const quantity = await tx.inventoryLabel.count({ where: { product_id: productId, location_id: locationId, status: "AVAILABLE" } });
  await tx.inventoryStockSyncJob.create({ data: { product_id: productId, location_id: locationId, desired_quantity: quantity, status: "PENDING" } });
}

function shopifyGid(type: "InventoryItem" | "Location", value: string) {
  return value.startsWith("gid://") ? value : `gid://shopify/${type}/${value}`;
}

async function syncLatestInventoryStock(productId: string, locationId: string) {
  const job = await prisma.inventoryStockSyncJob.findFirst({
    where: { product_id: productId, location_id: locationId, status: "PENDING" },
    include: { product: true, location: true },
    orderBy: { created_at: "desc" },
  });
  if (!job) return;
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token || !job.product.shopify_inventory_item_id || !job.location.shopify_location_id) {
    await prisma.inventoryStockSyncJob.updateMany({
      where: { product_id: productId, location_id: locationId, status: "PENDING", created_at: { lte: job.created_at } },
      data: { status: "NOT_CONFIGURED", attempts: { increment: 1 }, last_error: "Collegamento Shopify non configurato per prodotto o sede." },
    });
    return;
  }

  const mutation = `mutation InventorySet($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
    inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
      inventoryAdjustmentGroup { createdAt }
      userErrors { field message }
    }
  }`;
  try {
    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({
        query: mutation,
        variables: {
          idempotencyKey: job.id,
          input: {
            name: "available",
            reason: "correction",
            referenceDocumentUri: `paradise://inventory-sync/${job.id}`,
            ignoreCompareQuantity: true,
            quantities: [{
              inventoryItemId: shopifyGid("InventoryItem", job.product.shopify_inventory_item_id),
              locationId: shopifyGid("Location", job.location.shopify_location_id),
              quantity: job.desired_quantity,
            }],
          },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const json = await response.json() as { data?: { inventorySetQuantities?: { userErrors?: Array<{ message: string }> } }; errors?: Array<{ message: string }> };
    const apiErrors = [...(json.errors ?? []).map((item) => item.message), ...(json.data?.inventorySetQuantities?.userErrors ?? []).map((item) => item.message)];
    if (!response.ok || apiErrors.length) throw new Error(apiErrors.join(" · ") || `Shopify HTTP ${response.status}`);
    await prisma.inventoryStockSyncJob.updateMany({
      where: { product_id: productId, location_id: locationId, status: "PENDING", created_at: { lte: job.created_at } },
      data: { status: "SYNCED", synced_at: new Date(), attempts: { increment: 1 }, last_error: null },
    });
  } catch (error) {
    await prisma.inventoryStockSyncJob.updateMany({
      where: { product_id: productId, location_id: locationId, status: "PENDING", created_at: { lte: job.created_at } },
      data: { status: "FAILED", attempts: { increment: 1 }, last_error: error instanceof Error ? error.message.slice(0, 1000) : "Errore Shopify" },
    });
  }
}

export async function generateInventoryLabels(input: Record<string, unknown>, userId: string) {
  const productId = String(input.productId ?? "");
  const locationId = String(input.locationId ?? "");
  const lotNumber = String(input.lotNumber ?? "").trim() || null;
  const quantity = Number(input.quantity);
  if (!productId || !locationId) throw new Error("Prodotto e sede sono obbligatori.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new Error("La quantità deve essere compresa tra 1 e 500.");

  const labels = await prisma.$transaction(async (tx) => {
    const [product, location] = await Promise.all([
      tx.inventoryProduct.findUnique({ where: { id: productId } }),
      tx.inventoryLocation.findUnique({ where: { id: locationId } }),
    ]);
    if (!product || !location) throw new Error("Prodotto o sede non trovati.");
    const sequences = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('inventory_label_code_seq') AS value FROM generate_series(1, ${quantity})`;
    const now = new Date();
    const created = [];
    for (const row of sequences) {
      const code = formatInventoryLabelCode(row.value);
      const label = await tx.inventoryLabel.create({ data: { label_code: code, barcode: code, product_id: productId, location_id: locationId, lot_number: lotNumber, received_at: now, created_by_id: userId } });
      await tx.inventoryMovement.create({ data: { product_id: productId, inventory_label_id: label.id, movement_type: "IN", to_location_id: locationId, user_id: userId, notes: lotNumber ? `Carico lotto ${lotNumber}` : "Carico iniziale" } });
      created.push(label);
    }
    await enqueueSync(tx, productId, locationId);
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await syncLatestInventoryStock(productId, locationId);
  return labels;
}

export async function applyInventoryOperation(input: Record<string, unknown>, userId: string) {
  const code = normalizeInventoryCode(input.code);
  const operation = String(input.operation ?? "") as InventoryOperation;
  const toLocationId = String(input.toLocationId ?? "") || null;
  const notes = String(input.notes ?? "").trim() || null;
  const requestedStatus = input.status ? String(input.status) as InventoryUnitStatus : undefined;
  if (!code || !["OUT", "TRANSFER", "RETURN", "DAMAGED", "ADJUSTMENT"].includes(operation)) throw new Error("Codice o operazione non validi.");
  if (operation === "TRANSFER" && !toLocationId) throw new Error("Seleziona la sede di destinazione.");
  if (operation === "ADJUSTMENT" && !notes) throw new Error("La rettifica richiede una motivazione.");

  const result = await prisma.$transaction(async (tx) => {
    const label = await tx.inventoryLabel.findFirst({ where: { OR: [{ barcode: code }, { label_code: code }] } });
    if (!label) throw new Error("Etichetta non trovata.");
    assertInventoryTransition(operation, label.status as InventoryUnitStatus, requestedStatus);
    if (operation === "TRANSFER" && toLocationId === label.location_id) throw new Error("L’unità si trova già in questa sede.");

    const nextLocationId = operation === "TRANSFER" ? toLocationId! : (operation === "RETURN" && toLocationId ? toLocationId : label.location_id);
    const nextStatus = operation === "TRANSFER" ? label.status : nextStatusForOperation(operation, requestedStatus);
    const updated = await tx.inventoryLabel.updateMany({
      where: { id: label.id, status: label.status, location_id: label.location_id },
      data: { location_id: nextLocationId, status: nextStatus as InventoryLabelStatus, sold_at: operation === "OUT" ? new Date() : operation === "RETURN" ? null : label.sold_at },
    });
    if (updated.count !== 1) throw new Error("L’unità è stata modificata da un altro operatore. Scansionala di nuovo.");
    await tx.inventoryMovement.create({
      data: {
        product_id: label.product_id,
        inventory_label_id: label.id,
        movement_type: operation as InventoryMovementType,
        from_location_id: label.location_id,
        to_location_id: operation === "OUT" || operation === "DAMAGED" ? null : nextLocationId,
        user_id: userId,
        notes,
      },
    });
    await enqueueSync(tx, label.product_id, label.location_id);
    if (nextLocationId !== label.location_id) await enqueueSync(tx, label.product_id, nextLocationId);
    const savedLabel = await tx.inventoryLabel.findUnique({ where: { id: label.id }, include: { product: true, location: true } });
    return { label: savedLabel, productId: label.product_id, locationIds: Array.from(new Set([label.location_id, nextLocationId])) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await Promise.all(result.locationIds.map((locationId) => syncLatestInventoryStock(result.productId, locationId)));
  return result.label;
}

export async function createInventoryPrintJob(labelIds: string[], userId: string, printerName?: string) {
  const uniqueIds = Array.from(new Set(labelIds.filter(Boolean)));
  if (!uniqueIds.length || uniqueIds.length > 500) throw new Error("Seleziona da 1 a 500 etichette.");
  return prisma.$transaction(async (tx) => {
    const labels = await tx.inventoryLabel.findMany({ where: { id: { in: uniqueIds } }, include: { product: true, location: true } });
    if (labels.length !== uniqueIds.length) throw new Error("Una o più etichette non esistono.");
    const job = await tx.inventoryPrintJob.create({
      data: { user_id: userId, printer_name: printerName?.trim() || null, labels_count: labels.length, labels: { create: labels.map((label) => ({ label_id: label.id })) } },
    });
    await tx.inventoryLabel.updateMany({ where: { id: { in: uniqueIds } }, data: { print_count: { increment: 1 }, last_printed_at: new Date() } });
    return { job, labels };
  });
}

export { availableStatuses };
