import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWarehouseState, saveWarehouseState, type WarehouseProduct } from "@/lib/internal-warehouse";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const state = await getWarehouseState();
  return NextResponse.json({ state });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const body = await request.json();
  const action = String(body.action ?? "");
  const state = await getWarehouseState();

  if (action === "createCollection") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nome collezione obbligatorio." }, { status: 400 });
    const id = `collection-${slug(name)}-${Date.now().toString(36)}`;
    state.collections = [...state.collections, { id, name, description: String(body.description ?? ""), productIds: [] }];
    return NextResponse.json({ state: await saveWarehouseState(state) });
  }

  if (action === "addProductToCollection") {
    const collectionId = String(body.collectionId ?? "");
    const productId = String(body.productId ?? "");
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection) return NextResponse.json({ error: "Collezione non trovata." }, { status: 404 });
    const productExists = state.inventories.some((inventory) => inventory.products.some((product) => product.id === productId));
    if (!productExists) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
    collection.productIds = Array.from(new Set([...collection.productIds, productId]));
    state.inventories = state.inventories.map((inventory) => ({
      ...inventory,
      products: inventory.products.map((product) =>
        product.id === productId ? { ...product, collectionIds: Array.from(new Set([...product.collectionIds, collectionId])) } : product,
      ),
    }));
    return NextResponse.json({ state: await saveWarehouseState(state) });
  }

  if (action === "createProduct") {
    const inventoryId = String(body.inventoryId ?? "");
    const name = String(body.name ?? "").trim();
    const inventory = state.inventories.find((item) => item.id === inventoryId);
    if (!inventory) return NextResponse.json({ error: "Magazzino non trovato." }, { status: 404 });
    if (!name) return NextResponse.json({ error: "Nome prodotto obbligatorio." }, { status: 400 });
    const quantities = {
      cm40: Number(body.cm40) || 0,
      cm55: Number(body.cm55) || 0,
      cm65: Number(body.cm65) || 0,
      cm75: Number(body.cm75) || 0,
    };
    const collectionIds = Array.isArray(body.collectionIds) ? body.collectionIds.map(String) : [];
    const product: WarehouseProduct = {
      id: `${inventoryId}:custom-${slug(name)}-${Date.now().toString(36)}`,
      name,
      quantities,
      total: quantities.cm40 + quantities.cm55 + quantities.cm65 + quantities.cm75,
      collectionIds,
      custom: true,
    };
    inventory.products = [...inventory.products, product];
    inventory.totals = inventory.products.reduce(
      (sum, item) => {
        sum.cm40 += item.quantities.cm40;
        sum.cm55 += item.quantities.cm55;
        sum.cm65 += item.quantities.cm65;
        sum.cm75 += item.quantities.cm75;
        sum.total += item.total;
        return sum;
      },
      { cm40: 0, cm55: 0, cm65: 0, cm75: 0, total: 0 },
    );
    state.collections = state.collections.map((collection) =>
      collectionIds.includes(collection.id)
        ? { ...collection, productIds: Array.from(new Set([...collection.productIds, product.id])) }
        : collection,
    );
    return NextResponse.json({ state: await saveWarehouseState(state) });
  }

  return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
}
