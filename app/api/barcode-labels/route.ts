import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

const barcodeLabelSelect = {
  id: true,
  code: true,
  title: true,
  color: true,
  weight: true,
  length: true,
  product_code: true,
  typology: true,
  format: true,
  print_count: true,
  last_printed_at: true,
  created_at: true,
  created_by: { select: { name: true } },
} satisfies Prisma.BarcodeLabelSelect;

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
  const labels = await prisma.barcodeLabel.findMany({
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
    take: 500,
  });

  return NextResponse.json({ labels });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(body?.action ?? "create");

    if (action === "create") {
      const code = validCode(body?.code);
      const title = String(body?.title ?? "").trim().slice(0, 120) || null;
      const color = requiredDetail(body?.color, "il colore");
      const weight = requiredDetail(body?.weight, "il peso");
      const length = requiredDetail(body?.length, "la lunghezza");
      const productCode = requiredDetail(body?.productCode, "il codice prodotto");
      const typology = requiredDetail(body?.typology, "la tipologia");
      const label = await prisma.barcodeLabel.create({
        data: {
          code,
          title,
          color,
          weight,
          length,
          product_code: productCode,
          typology,
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
