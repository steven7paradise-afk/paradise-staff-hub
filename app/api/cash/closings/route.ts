import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cashDateFromInput } from "@/lib/cash-records";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const amountEditRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !amountEditRoles.has(session.user.role ?? "")) {
    return NextResponse.json({ error: "Solo l’amministrazione può modificare l’importo." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const closingId = String(body?.closingId ?? "").trim();
  const withdrawn = Number(String(body?.withdrawn ?? "").replace(",", "."));
  const justification = String(body?.justification ?? "").trim();
  if (!closingId || !Number.isFinite(withdrawn) || withdrawn < 0) {
    return NextResponse.json({ error: "Chiusura e nuovo importo valido sono obbligatori." }, { status: 400 });
  }
  if (!justification) {
    return NextResponse.json({ error: "La motivazione della modifica è obbligatoria." }, { status: 400 });
  }

  const [closing, actor] = await Promise.all([
    prisma.cashClosing.findUnique({ where: { id: closingId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
  ]);
  if (!closing) return NextResponse.json({ error: "Chiusura cassa non trovata." }, { status: 404 });
  if (Math.abs(closing.withdrawn - withdrawn) < 0.005) {
    return NextResponse.json({ error: "Il nuovo importo è uguale a quello registrato." }, { status: 400 });
  }

  const timestamp = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const euro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  const auditNote = `[Rettifica amministrativa ${timestamp}] ${actor?.name || session.user.name || "Amministrazione"}: importo prelevato modificato da ${euro(closing.withdrawn)} a ${euro(withdrawn)}. Motivo: ${justification}`;
  const notes = [closing.notes?.trim(), auditNote].filter(Boolean).join("\n");
  const updated = await prisma.cashClosing.update({
    where: { id: closingId },
    data: { withdrawn, notes },
  });

  return NextResponse.json({ closing: updated });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role ?? "")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const locationId = String(body?.locationId ?? "").trim();
  const userId = String(body?.userId ?? "").trim();
  const date = String(body?.date ?? "").trim();
  const withdrawn = Number(String(body?.withdrawn ?? "").replace(",", "."));
  const fund = Number(String(body?.fund ?? "").replace(",", "."));
  const notes = String(body?.notes ?? "").trim();

  if (!locationId || !userId || !date || !Number.isFinite(withdrawn) || withdrawn < 0 || !Number.isFinite(fund)) {
    return NextResponse.json({ error: "Salone, lavoratore, data, prelevato e fondo cassa sono obbligatori." }, { status: 400 });
  }

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  const hasFullCashAccess = accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : false;

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && locationId !== session.user.sedeId && !hasFullCashAccess) {
    return NextResponse.json({ error: "Puoi aggiungere chiusure solo per il tuo salone." }, { status: 403 });
  }

  const accountingDate = cashDateFromInput(date);
  if (!accountingDate) {
    return NextResponse.json({ error: "Data chiusura non valida." }, { status: 400 });
  }

  const [location, user] = await Promise.all([
    prisma.location.findFirst({ where: { id: locationId, active: true } }),
    prisma.user.findFirst({
      where: {
        id: userId,
        active: true,
        ...(session.user.role === "RESPONSABILE" && session.user.sedeId && !hasFullCashAccess ? { sede_id: session.user.sedeId } : {}),
      },
      select: { id: true, name: true, role: true, sede_id: true },
    }),
  ]);

  if (!location) {
    return NextResponse.json({ error: "Salone non valido." }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "Lavoratore non valido." }, { status: 400 });
  }

  const closing = await prisma.cashClosing.create({
    data: {
      user_id: user.id,
      location_id: location.id,
      date: accountingDate,
      withdrawn,
      fund,
      notes: notes || null,
      signature_name: user.name,
      signature_role: user.role,
      signed_at: new Date(),
    },
    include: { user: true, location: true },
  });

  return NextResponse.json({ closing });
}
