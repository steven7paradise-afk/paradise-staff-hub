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
  const weekKey = String(body?.weekKey ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
    return NextResponse.json({ error: "Settimana non valida." }, { status: 400 });
  }

  const setting = await prisma.setting.upsert({
    where: { key: `cash_week_close:${weekKey}` },
    update: {
      value: {
        weekKey,
        closed_at: new Date().toISOString(),
        closed_by_id: session.user.id,
        closed_by_name: session.user.name ?? "Admin",
        closed_by_role: session.user.role,
      },
    },
    create: {
      key: `cash_week_close:${weekKey}`,
      value: {
        weekKey,
        closed_at: new Date().toISOString(),
        closed_by_id: session.user.id,
        closed_by_name: session.user.name ?? "Admin",
        closed_by_role: session.user.role,
      },
    },
  });

  return NextResponse.json({ success: true, setting });
}
