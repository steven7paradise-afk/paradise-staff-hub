import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "") && !isDarwin)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const month = String(body?.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Mese non valido." }, { status: 400 });
  }

  const setting = await prisma.cashMonthClose.upsert({
    where: { month },
    update: {
      closed_at: new Date(),
      closed_by_id: session.user.id,
      closed_by_name: session.user.name ?? "Admin",
      closed_by_role: session.user.role,
    },
    create: {
      month,
      closed_by_id: session.user.id,
      closed_by_name: session.user.name ?? "Admin",
      closed_by_role: session.user.role,
    },
  });

  return NextResponse.json({
    setting: {
      id: setting.id,
      key: `cash_month_close:${month}`,
      value: {
    month,
        closed_at: setting.closed_at.toISOString(),
        closed_by_id: setting.closed_by_id,
        closed_by_name: setting.closed_by_name,
        closed_by_role: setting.closed_by_role,
      },
    },
  });
}
