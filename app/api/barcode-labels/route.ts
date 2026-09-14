import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

type CollectionField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "buttons";
  options?: string[];
};

const collectionFieldOptions: Record<string, CollectionField> = {
  color: { key: "color", label: "Colore", placeholder: "Biondo", required: true, type: "text" },
  weight: { key: "weight", label: "Peso", placeholder: "50 g", required: true, type: "text" },
  length: { key: "length", label: "Lunghezza", placeholder: "55 cm", required: true, type: "text" },
  productCode: { key: "productCode", label: "Codice", placeholder: "L", required: true, type: "text" },
  typology: { key: "typology", label: "Tipologia", placeholder: "Tessitura", required: true, type: "text" },
  bands: { key: "bands", label: "Fasce", placeholder: "9", required: true, type: "text" },
  price: { key: "price", label: "Prezzo", placeholder: "550 €", required: true, type: "text" },
};

const barcodeLabelSelect = {
  id: true,
  code: true,
  title: true,
  color: true,
  weight: true,
  length: true,
  product_code: true,
  typology: true,
  preview_url: true,
  collection_id: true,
  details: true,
  format: true,
  print_count: true,
  last_printed_at: true,
  created_at: true,
  created_by: { select: { name: true } },
  collection: { select: { id: true, name: true, fields: true } },
} satisfies Prisma.BarcodeLabelSelect;

function collectionFields(value: Prisma.JsonValue): CollectionField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const key = String(item.key ?? "");
    if (key in collectionFieldOptions) return [collectionFieldOptions[key]];
    if (!/^custom_[a-z0-9_]+$/i.test(key)) return [];
    const label = String(item.label ?? "").trim().slice(0, 60);
    if (!label) return [];
    const type = item.type === "buttons" ? "buttons" : "text";
    const options = type === "buttons" && Array.isArray(item.options)
      ? item.options.map(String).map((option) => option.trim()).filter(Boolean).slice(0, 8)
      : undefined;
    if (type === "buttons" && !options?.length) return [];
    return [{ key, label, placeholder: String(item.placeholder ?? "").slice(0, 80), required: true, type, options }];
  });
}

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  if (!user || !(await canAccessForUser(prisma, "/barcode-labels", user))) return null;
  return user;
}

function validCode(value: unknown) {
  const code = String(value ?? "").trim();
  if (!code) throw new Error("Inserisci il codice da trasformare in barcode.");
  if (code.length > 80) throw new Error("Il codice può contenere al massimo 80 caratteri.");
  if (!/^[\x20-\x7E]+$/.test(code)) {
    throw new Error("Usa lettere, numeri e simboli semplici supportati dal barcode.");
  }
  return code;
}

function requiredDetail(value: unknown, label: string, maxLength = 80) {
  const detail = String(value ?? "").trim();
  if (!detail) throw new Error(`Inserisci ${label}.`);
  return detail.slice(0, maxLength);
}

function optionalPreviewUrl(value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;
  if (rawValue.length > 1000) throw new Error("Il link dell’immagine è troppo lungo.");
  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new Error("Inserisci un URL immagine valido che inizi con http:// o https://.");
  }
}

function apiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Questa etichetta è già stata salvata." }, { status: 409 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Operazione non riuscita." },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const [labels, collections] = await Promise.all([
    prisma.barcodeLabel.findMany({
      where: query
        ? {
          OR: [
            { code: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } },
            { color: { contains: query, mode: "insensitive" } },
            { product_code: { contains: query, mode: "insensitive" } },
            { typology: { contains: query, mode: "insensitive" } },
          ],
        }
        : undefined,
      select: barcodeLabelSelect,
      orderBy: { created_at: "desc" },
      take: 2000,
    }),
    prisma.barcodeLabelCollection.findMany({
      select: { id: true, name: true, fields: true, is_default: true },
      orderBy: [{ is_default: "desc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({ labels, collections });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(body?.action ?? "create");

    if (action === "createCollection") {
      const name = requiredDetail(body?.name, "il nome della collezione", 60);
      const requestedKeys = Array.from(new Set(Array.isArray(body?.fieldKeys) ? body.fieldKeys.map(String) : []));
      const defaultFields = requestedKeys.flatMap((key) => key in collectionFieldOptions ? [collectionFieldOptions[key]] : []);
      const requestedCustomFields = Array.isArray(body?.customFields) ? body.customFields : [];
      const customFields = requestedCustomFields.slice(0, 8).flatMap((item, index): CollectionField[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const custom = item as Record<string, unknown>;
        const label = String(custom.label ?? "").trim().slice(0, 60);
        if (!label) return [];
        const type = custom.type === "buttons" ? "buttons" : "text";
        const options = type === "buttons"
          ? String(custom.options ?? "").split(",").map((option) => option.trim()).filter(Boolean).slice(0, 8)
          : undefined;
        if (type === "buttons" && !options?.length) throw new Error(`Inserisci le risposte per ${label}.`);
        return [{
          key: `custom_${Date.now()}_${index}`,
          label,
          placeholder: type === "text" ? "Scrivi la risposta" : "",
          required: true,
          type,
          options,
        }];
      });
      const fields = [...defaultFields, ...customFields];
      if (!fields.length) throw new Error("Scegli almeno una domanda per la collezione.");
      const duplicate = await prisma.barcodeLabelCollection.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) throw new Error("Esiste già una collezione con questo nome.");
      const collection = await prisma.barcodeLabelCollection.create({
        data: { name, fields, created_by_id: user.id },
        select: { id: true, name: true, fields: true, is_default: true },
      });
      return NextResponse.json({ collection }, { status: 201 });
    }

    if (action === "create") {
      const code = validCode(body?.code);
      const title = String(body?.title ?? "").trim().slice(0, 120) || null;
      const previewUrl = optionalPreviewUrl(body?.previewUrl);
      const collectionId = requiredDetail(body?.collectionId, "la collezione");
      const collection = await prisma.barcodeLabelCollection.findUnique({
        where: { id: collectionId },
        select: { fields: true },
      });
      if (!collection) throw new Error("La collezione selezionata non è più disponibile.");
      const fields = collectionFields(collection.fields);
      if (!fields.length) throw new Error("La collezione non contiene domande valide.");
      const suppliedDetails = body?.details && typeof body.details === "object" && !Array.isArray(body.details)
        ? body.details as Record<string, unknown>
        : {};
      const details = Object.fromEntries(fields.map((field) => [
        field.key,
        requiredDetail(suppliedDetails[field.key], `il campo ${field.label.toLocaleLowerCase("it")}`),
      ]));
      const label = await prisma.barcodeLabel.create({
        data: {
          code,
          title,
          color: details.color || null,
          weight: details.weight || null,
          length: details.length || null,
          product_code: details.productCode || null,
          typology: details.typology || null,
          preview_url: previewUrl,
          collection_id: collectionId,
          details,
          created_by_id: user.id,
        },
        select: barcodeLabelSelect,
      });
      return NextResponse.json({ label }, { status: 201 });
    }

    if (action === "delete") {
      const ids = Array.from(new Set(Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : []));
      if (!ids.length || ids.length > 500) throw new Error("Seleziona da 1 a 500 etichette da eliminare.");

      const result = await prisma.barcodeLabel.deleteMany({ where: { id: { in: ids } } });
      if (!result.count) throw new Error("Le etichette selezionate non sono più disponibili.");
      return NextResponse.json({ deleted: result.count, ids });
    }

    if (action === "recordPrint") {
      const ids = Array.from(new Set(Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : []));
      const copies = Math.min(50, Math.max(1, Math.trunc(Number(body?.copies) || 1)));
      if (!ids.length || ids.length > 500) throw new Error("Seleziona da 1 a 500 etichette.");

      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.barcodeLabel.count({ where: { id: { in: ids } } });
        if (existing !== ids.length) throw new Error("Una o più etichette non sono più disponibili.");
        await tx.barcodeLabel.updateMany({
          where: { id: { in: ids } },
          data: { print_count: { increment: copies }, last_printed_at: now },
        });
        return tx.barcodeLabel.findMany({
          where: { id: { in: ids } },
          select: barcodeLabelSelect,
        });
      });

      return NextResponse.json({ labels: result, copies });
    }

    return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
