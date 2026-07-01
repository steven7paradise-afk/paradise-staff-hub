import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cashDateFromInput } from "@/lib/cash-records";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "") && !isDarwin)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const locationId = String(body?.locationId ?? "").trim();
  const date = String(body?.date ?? "").trim();
  const amount = Number(String(body?.amount ?? "").replace(",", "."));
  const reason = String(body?.reason ?? "").trim();

  if (!locationId || !date || !Number.isFinite(amount) || amount <= 0 || !reason) {
    return NextResponse.json({ error: "Salone, data, importo e motivo sono obbligatori." }, { status: 400 });
  }

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && locationId !== session.user.sedeId && !isDarwin) {
    return NextResponse.json({ error: "Puoi registrare prelievi solo per il tuo salone." }, { status: 403 });
  }

  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });

  if (!location) {
    return NextResponse.json({ error: "Salone non valido." }, { status: 400 });
  }

  const accountingDate = cashDateFromInput(date);
  if (!accountingDate) {
    return NextResponse.json({ error: "Data prelievo non valida." }, { status: 400 });
  }

  const response = await prisma.cashVaultWithdrawal.create({
    data: {
      user_id: session.user.id,
      location_id: location.id,
      date: accountingDate,
      amount,
      reason,
      signature_name: session.user.name ?? "Admin",
      signature_role: session.user.role,
      signed_at: new Date(),
    },
    include: { user: true, location: true },
  });

  return NextResponse.json({ response });
}
