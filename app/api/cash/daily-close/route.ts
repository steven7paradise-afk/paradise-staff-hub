import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { automaticDailyCashSummary, isBeforeDailyClosingTime, romeDateKey } from "@/lib/daily-cash-closing";
import { auth } from "@/lib/auth";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

async function dailyClosingContext(request: NextRequest, requestedDate?: string | null) {
  const operationalUser = await getOperationalUser(request);
  if (!operationalUser?.id || !operationalUser.sedeId) return null;

  const today = romeDateKey();
  let date = today;
  if (requestedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return null;
    const parsedDate = new Date(`${requestedDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== requestedDate) return null;
    date = requestedDate;
  }
  if (date > today) return null;
  if (date !== today) {
    const session = await auth();
    if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) return null;
  }
  const accountingDate = new Date(`${date}T00:00:00.000Z`);
  const nextDate = new Date(accountingDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const [location, existing] = await Promise.all([
    prisma.location.findFirst({ where: { id: operationalUser.sedeId, active: true }, select: { id: true, name: true } }),
    prisma.cashClosing.findFirst({
      where: { location_id: operationalUser.sedeId, date: { gte: accountingDate, lt: nextDate } },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    }),
  ]);
  if (!location) return null;
  return { operationalUser, location, existing, date, accountingDate };
}

export async function GET(request: NextRequest) {
  const context = await dailyClosingContext(request, request.nextUrl.searchParams.get("date"));
  if (!context) return NextResponse.json({ error: "Sede non autorizzata." }, { status: 403 });
  const summary = await automaticDailyCashSummary(context.date, context.location.id);
  return NextResponse.json({
    ...summary,
    locationName: context.location.name,
    alreadyClosed: Boolean(context.existing),
    existing: context.existing ? {
      id: context.existing.id,
      signedAt: context.existing.signed_at.toISOString(),
      signedBy: context.existing.signature_name || context.existing.user.name,
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const context = await dailyClosingContext(request, typeof body?.date === "string" ? body.date : null);
  if (!context) return NextResponse.json({ error: "Sede non autorizzata." }, { status: 403 });
  if (context.existing) {
    return NextResponse.json({
      error: `La chiusura del ${context.date} è già stata effettuata da ${context.existing.signature_name || context.existing.user.name}.`,
      alreadyClosed: true,
    }, { status: 409 });
  }

  const before19 = context.date === romeDateKey() && isBeforeDailyClosingTime();
  if (before19 && body?.confirmEarly !== true) {
    return NextResponse.json({
      error: "Prima delle 19:00 è necessaria la conferma della chiusura anticipata.",
      requiresConfirmation: true,
    }, { status: 409 });
  }

  const summary = await automaticDailyCashSummary(context.date, context.location.id);
  if (!summary.available) {
    return NextResponse.json({ error: "Shopify non è disponibile: la chiusura non è stata registrata." }, { status: 503 });
  }

  let signer = context.operationalUser.id === "PC_CASSA"
    ? null
    : await prisma.user.findFirst({
        where: { id: context.operationalUser.id, active: true, sede_id: context.location.id },
        select: { id: true, name: true, role: true },
      });
  if (!signer) {
    signer = await prisma.user.findFirst({
      where: { active: true, sede_id: context.location.id },
      select: { id: true, name: true, role: true },
      orderBy: { created_at: "asc" },
    });
  }
  if (!signer) return NextResponse.json({ error: "Nessun lavoratore attivo associato alla sede." }, { status: 400 });

  const formatEuro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  const closingTime = context.date !== romeDateKey()
    ? "Chiusura registrata successivamente da un amministratore."
    : before19
      ? "Chiusura anticipata confermata prima delle 19:00."
      : "Chiusura effettuata dopo le 19:00.";
  const notes = [
    "Chiusura giornaliera automatica Contanti.",
    `Controlli Cliente collegati: ${summary.completedControlCount}.`,
    `Contanti associati ai Controlli Cliente, rilevati da Shopify: ${formatEuro(summary.controlShopifyCash)}.`,
    `Importo dichiarato negli stessi Controlli Cliente: ${formatEuro(summary.controlDeclaredCash)}.`,
    `Contanti Shopify: ${formatEuro(summary.shopifyCash)}.`,
    `Ordini senza Controllo Cliente: ${summary.missingControlCount}, per ${formatEuro(summary.missingControlCash)}.`,
    `Differenza sui controlli lavoratore presenti: ${formatEuro(summary.difference)}.`,
    closingTime,
  ].join(" ");
  const signatureName = context.operationalUser.name || signer.name;
  const signatureRole = context.operationalUser.id === "PC_CASSA" ? signer.role : context.operationalUser.role;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "locations" WHERE "id" = ${context.location.id} FOR UPDATE`;
    const duplicate = await tx.cashClosing.findFirst({
      where: { location_id: context.location.id, date: context.accountingDate },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    });
    if (duplicate) return { duplicate, closing: null };
    const closing = await tx.cashClosing.create({
      data: {
        user_id: signer.id,
        location_id: context.location.id,
        date: context.accountingDate,
        withdrawn: summary.shopifyCash,
        fund: 0,
        cash_orders: summary.cashOrders as unknown as Prisma.InputJsonValue,
        notes,
        signature_name: signatureName,
        signature_role: signatureRole,
        signed_at: new Date(),
      },
      include: { user: true, location: true },
    });
    return { duplicate: null, closing };
  });

  if (result.duplicate || !result.closing) {
    return NextResponse.json({
      error: `La chiusura del ${context.date} è già stata effettuata da ${result.duplicate?.signature_name || result.duplicate?.user.name || "un altro operatore"}.`,
      alreadyClosed: true,
    }, { status: 409 });
  }

  return NextResponse.json({
    closing: result.closing,
    summary,
    message: "Chiusura giornaliera registrata senza PIN.",
  });
}
