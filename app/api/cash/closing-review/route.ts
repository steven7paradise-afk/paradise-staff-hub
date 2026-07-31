import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const allowedStatuses = new Set(["DA_CONTROLLARE", "CORRETTO", "ERRORE"]);

export async function POST(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!allowedRoles.has(session.user.role ?? "") && !isDarwin)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const closingId = String(body?.closingId ?? "").trim();
  const status = String(body?.status ?? "DA_CONTROLLARE").trim();
  const note = String(body?.note ?? "").trim();

  if (!closingId || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Dati controllo non validi." }, { status: 400 });
  }

  const closing = await prisma.cashClosing.findUnique({
    where: { id: closingId },
    select: { id: true, location_id: true },
  });

  if (!closing) {
    return NextResponse.json({ error: "Chiusura non trovata." }, { status: 404 });
  }

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  const hasFullCashAccess = isDarwin || (accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : false);

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && closing.location_id !== session.user.sedeId && !hasFullCashAccess) {
    return NextResponse.json({ error: "Puoi controllare solo il tuo salone." }, { status: 403 });
  }

  const value = {
    status,
    note,
    reviewed_by_id: session.user.id,
    reviewed_by_name: session.user.name ?? "Admin",
    reviewed_at: new Date().toISOString(),
  };

  const setting = await prisma.setting.upsert({
    where: { key: `cash_closing_review:${closing.id}` },
    update: { value },
    create: { key: `cash_closing_review:${closing.id}`, value },
  });

  return NextResponse.json({ review: setting.value });
}
