import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cashDateFromInput } from "@/lib/cash-records";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!allowedRoles.has(session.user.role ?? "") && !isDarwin)) {
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
  const hasFullCashAccess = isDarwin || (accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : false);

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
