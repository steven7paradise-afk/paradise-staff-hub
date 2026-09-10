import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  applyInventoryOperation,
  createInventoryPrintJob,
  createInventoryProduct,
  ensureInventoryLocations,
  findInventoryScan,
  generateInventoryLabels,
  getInventoryOverview,
  resolveInventoryCountCode,
  saveInventoryCount,
} from "@/lib/inventory";
import { inventoryManagementRoles, inventoryOperationRoles, normalizeInventoryCode } from "@/lib/inventory-rules";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function currentInventoryUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, mansione: true, access_list: true } });
  if (!user || !(await canAccessForUser(prisma, "/magazzino", user))) return null;
  return user;
}

function apiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Questo SKU, barcode o collegamento Shopify è già registrato." }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "Operazione non riuscita.";
  const conflict = /già uscita|altro operatore|già registrato/i.test(message);
  return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
}

export async function GET(request: NextRequest) {
  const user = await currentInventoryUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  try {
    const scan = request.nextUrl.searchParams.get("scan");
    if (scan !== null) {
      const result = await findInventoryScan(scan);
      return NextResponse.json({ result, scannedCode: normalizeInventoryCode(scan) });
    }
    const countCode = request.nextUrl.searchParams.get("countCode");
    if (countCode !== null) {
      return NextResponse.json({ result: await resolveInventoryCountCode(countCode), scannedCode: normalizeInventoryCode(countCode) });
    }
    if (request.nextUrl.searchParams.get("countSetup") === "1") {
      await ensureInventoryLocations();
      const locations = await prisma.inventoryLocation.findMany({ where: { active: true }, select: { id: true, name: true, code: true, kind: true, address: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
      return NextResponse.json({ locations, permissions: { operate: inventoryOperationRoles.has(user.role) } });
    }
    const query = request.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json({ data: await getInventoryOverview(query), permissions: { manage: inventoryManagementRoles.has(user.role), operate: inventoryOperationRoles.has(user.role) } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await currentInventoryUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const canManage = inventoryManagementRoles.has(user.role);
    const canOperate = inventoryOperationRoles.has(user.role);

    if (action === "createCatalog") {
      if (!canManage) return NextResponse.json({ error: "Solo amministratori e responsabili possono creare cataloghi." }, { status: 403 });
      const name = String(body.name ?? "").trim();
      if (!name) throw new Error("Il nome del catalogo è obbligatorio.");
      const catalog = await prisma.inventoryCatalog.create({
        data: {
          name,
          description: String(body.description ?? "").trim() || null,
          cover_image_url: String(body.coverImageUrl ?? "").trim() || null,
        },
      });
      return NextResponse.json({ catalog });
    }
    if (action === "createProduct") {
      if (!canManage) return NextResponse.json({ error: "Solo amministratori e responsabili possono creare prodotti." }, { status: 403 });
      return NextResponse.json({ product: await createInventoryProduct(body) });
    }
    if (action === "updateProduct") {
      if (!canManage) return NextResponse.json({ error: "Permesso insufficiente." }, { status: 403 });
      const id = String(body.productId ?? "");
      if (!id) throw new Error("Prodotto non valido.");
      const product = await prisma.inventoryProduct.update({
        where: { id },
        data: {
          name: body.name === undefined ? undefined : String(body.name).trim(),
          minimum_stock: body.minimumStock === undefined ? undefined : Math.max(0, Number(body.minimumStock) || 0),
          image_url: body.imageUrl === undefined ? undefined : String(body.imageUrl).trim() || null,
          category: body.category === undefined ? undefined : String(body.category).trim() || null,
          active: body.active === undefined ? undefined : Boolean(body.active),
        },
      });
      return NextResponse.json({ product });
    }
    if (action === "createLocation") {
      if (!canManage) return NextResponse.json({ error: "Permesso insufficiente." }, { status: 403 });
      const name = String(body.name ?? "").trim();
      const code = normalizeInventoryCode(body.code).replace(/[^A-Z0-9-]+/g, "-");
      if (!name || !code) throw new Error("Nome e codice sede sono obbligatori.");
      return NextResponse.json({ location: await prisma.inventoryLocation.create({ data: { name, code, kind: "WAREHOUSE", address: String(body.address ?? "").trim() || null } }) });
    }
    if (action === "updateLocation") {
      if (!canManage) return NextResponse.json({ error: "Permesso insufficiente." }, { status: 403 });
      const locationId = String(body.locationId ?? "");
      if (!locationId) throw new Error("Sede non valida.");
      return NextResponse.json({ location: await prisma.inventoryLocation.update({ where: { id: locationId }, data: { shopify_location_id: String(body.shopifyLocationId ?? "").trim() || null } }) });
    }
    if (action === "generateLabels") {
      if (!canOperate) return NextResponse.json({ error: "Non puoi generare etichette." }, { status: 403 });
      return NextResponse.json({ labels: await generateInventoryLabels(body, user.id) });
    }
    if (action === "saveInventoryCount") {
      if (!canOperate) return NextResponse.json({ error: "Non puoi registrare inventari." }, { status: 403 });
      return NextResponse.json(await saveInventoryCount(body, user.id));
    }
    if (action === "moveLabel") {
      if (!canOperate) return NextResponse.json({ error: "Non puoi movimentare il magazzino." }, { status: 403 });
      return NextResponse.json({ label: await applyInventoryOperation(body, user.id) });
    }
    if (action === "printLabels") {
      if (!canOperate) return NextResponse.json({ error: "Non puoi stampare etichette." }, { status: 403 });
      const ids = Array.isArray(body.labelIds) ? body.labelIds.map(String) : [];
      return NextResponse.json(await createInventoryPrintJob(ids, user.id, String(body.printerName ?? "")));
    }
    return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
