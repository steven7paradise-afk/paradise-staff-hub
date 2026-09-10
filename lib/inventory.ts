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

  const [products, catalogs, locations, statusCounts, locationCounts, recentLabels, movements] = await Promise.all([
    prisma.inventoryProduct.findMany({ where: productWhere, orderBy: { name: "asc" }, take: 1000 }),
    prisma.inventoryCatalog.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryLocation.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.inventoryLabel.groupBy({ by: ["product_id", "status"], _count: { _all: true } }),
    prisma.inventoryLabel.groupBy({ by: ["location_id", "status"], _count: { _all: true } }),
    prisma.inventoryLabel.findMany({
      where: search ? { OR: [{ label_code: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }, { lot_number: { contains: search, mode: "insensitive" } }] } : {},
      include: { product: true, location: true }, orderBy: { created_at: "desc" }, take: 500,
    }),
    prisma.inventoryMovement.findMany({
      include: { product: { select: { name: true, sku: true } }, label: { select: { label_code: true, barcode: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { created_at: "desc" }, take: 500,
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
    catalogs,
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
    include: { product: true, location: true, movements: { include: { label: { select: { label_code: true, barcode: true } }, user: { select: { name: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } } }, orderBy: { created_at: "desc" } } },
  });
  if (label) {
    const [productLabels, productMovements] = await Promise.all([
      prisma.inventoryLabel.findMany({ where: { product_id: label.product_id }, include: { location: true }, orderBy: { created_at: "desc" } }),
      prisma.inventoryMovement.findMany({
        where: { product_id: label.product_id },
        include: { label: { select: { label_code: true, barcode: true } }, user: { select: { name: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } } },
        orderBy: { created_at: "desc" },
      }),
    ]);
    return { kind: "label" as const, label, productLabels, productMovements };
  }
  const product = await prisma.inventoryProduct.findFirst({
    where: { OR: [{ sku: code }, { barcode: code }] },
    include: {
      labels: { include: { location: true }, orderBy: { created_at: "desc" } },
      movements: { include: { label: { select: { label_code: true, barcode: true } }, user: { select: { name: true } }, from_location: { select: { name: true } }, to_location: { select: { name: true } } }, orderBy: { created_at: "desc" } },
    },
  });
  return product ? { kind: "product" as const, product } : null;
}

export async function resolveInventoryCountCode(rawCode: unknown) {
  const code = normalizeInventoryCode(rawCode);
  if (!code) return null;
  const label = await prisma.inventoryLabel.findFirst({
    where: { OR: [{ barcode: code }, { label_code: code }] },
    select: { id: true, label_code: true, status: true, location: { select: { id: true, name: true } }, product: { select: { id: true, name: true, sku: true, barcode: true, image_url: true, category: true } } },
  });
  if (label) return { code, kind: "label" as const, label, product: label.product };
  const product = await prisma.inventoryProduct.findFirst({
    where: { active: true, OR: [{ sku: code }, { barcode: code }] },
    select: { id: true, name: true, sku: true, barcode: true, image_url: true, category: true },
  });
  return product ? { code, kind: "product" as const, label: null, product } : null;
}

export async function saveInventoryCount(input: Record<string, unknown>, userId: string) {
  const locationId = String(input.locationId ?? "");
  const inventoryDateValue = String(input.inventoryDate ?? "").trim();
  const codes = Array.isArray(input.codes) ? input.codes.map(normalizeInventoryCode).filter(Boolean) : [];
  if (!locationId) throw new Error("Seleziona il salone o il magazzino del conteggio.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inventoryDateValue)) throw new Error("Seleziona la data dell’inventario.");
  const [year, month, day] = inventoryDateValue.split("-").map(Number);
  const inventoryDate = new Date(Date.UTC(year, month - 1, day, 12));
  if (inventoryDate.toISOString().slice(0, 10) !== inventoryDateValue) throw new Error("La data dell’inventario non è valida.");
  const todayInRome = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (inventoryDateValue > todayInRome) throw new Error("Non puoi registrare un inventario con una data futura.");
  if (!codes.length) throw new Error("Scansiona almeno un prodotto prima di salvare.");
  if (codes.length > 2000) throw new Error("Puoi salvare al massimo 2.000 scansioni per inventario.");

  return prisma.$transaction(async (tx) => {
    const location = await tx.inventoryLocation.findFirst({ where: { id: locationId, active: true }, select: { id: true, name: true, kind: true } });
    if (!location) throw new Error("La sede selezionata non è più disponibile.");
    const uniqueCodes = Array.from(new Set(codes));
    const labels = await tx.inventoryLabel.findMany({
      where: { OR: [{ barcode: { in: uniqueCodes } }, { label_code: { in: uniqueCodes } }] },
      select: { id: true, barcode: true, label_code: true, product_id: true },
    });
    const labelProductIds = Array.from(new Set(labels.map((label) => label.product_id)));
    const products = await tx.inventoryProduct.findMany({
      where: { active: true, OR: [{ id: { in: labelProductIds } }, { barcode: { in: uniqueCodes } }, { sku: { in: uniqueCodes } }] },
      select: { id: true, barcode: true, sku: true, name: true },
    });
    const labelByCode = new Map<string, (typeof labels)[number]>();
    for (const label of labels) { labelByCode.set(label.barcode, label); labelByCode.set(label.label_code, label); }
    const productByCode = new Map<string, (typeof products)[number]>();
    for (const product of products) { if (product.barcode) productByCode.set(product.barcode, product); productByCode.set(product.sku, product); }
    const duplicateUnits = codes.filter((code, index) => labelByCode.has(code) && codes.indexOf(code) !== index);
    if (duplicateUnits.length) throw new Error(`La confezione ${duplicateUnits[0]} è stata scansionata più di una volta.`);

    const resolved = codes.map((code) => {
      const label = labelByCode.get(code);
      const product = label ? products.find((item) => item.id === label.product_id) : productByCode.get(code);
      if (!product) throw new Error(`Codice non riconosciuto: ${code}`);
      return { code, product, label };
    });
    const grouped = new Map<string, { productId: string; name: string; counted: number }>();
    for (const item of resolved) {
      const current = grouped.get(item.product.id) ?? { productId: item.product.id, name: item.product.name, counted: 0 };
      current.counted += 1;
      grouped.set(item.product.id, current);
    }
    const productIds = Array.from(grouped.keys());
    const expected = await tx.inventoryLabel.groupBy({
      by: ["product_id"],
      where: { product_id: { in: productIds }, location_id: locationId, status: { in: availableStatuses } },
      _count: { _all: true },
    });
    const expectedByProduct = new Map(expected.map((row) => [row.product_id, row._count._all]));
    const summary = Array.from(grouped.values()).map((item) => ({ ...item, expected: expectedByProduct.get(item.productId) ?? 0, difference: item.counted - (expectedByProduct.get(item.productId) ?? 0) }));
    const session = await tx.inventoryCountSession.create({
      data: {
        location_id: locationId,
        created_by_id: userId,
        inventory_date: inventoryDate,
        scans_count: resolved.length,
        products_count: grouped.size,
        summary,
        scans: { create: resolved.map((item) => ({ raw_code: item.code, product_id: item.product.id, inventory_label_id: item.label?.id ?? null })) },
      },
      include: { location: { select: { name: true, kind: true } }, created_by: { select: { name: true } } },
    });
    return { session, summary };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createInventoryProduct(input: Record<string, unknown>) {
  const name = String(input.name ?? "").trim();
  const sku = normalizeSku(input.sku);
  if (!name || !sku) throw new Error("Nome e SKU sono obbligatori.");
  const minimumStock = Number(input.minimumStock ?? 0);
  if (!Number.isInteger(minimumStock) || minimumStock < 0) throw new Error("La scorta minima deve essere un numero intero positivo.");
  const category = String(input.category ?? "").trim() || null;
  return prisma.$transaction(async (tx) => {
    if (category) await tx.inventoryCatalog.upsert({ where: { name: category }, update: { active: true }, create: { name: category } });
    return tx.inventoryProduct.create({ data: {
      name,
      sku,
      barcode: normalizeInventoryCode(input.barcode) || null,
      description: String(input.description ?? "").trim() || null,
      category,
      image_url: String(input.imageUrl ?? "").trim() || null,
      minimum_stock: minimumStock,
      shopify_product_id: String(input.shopifyProductId ?? "").trim() || null,
      shopify_variant_id: String(input.shopifyVariantId ?? "").trim() || null,
      shopify_inventory_item_id: String(input.shopifyInventoryItemId ?? "").trim() || null,
    } });
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
