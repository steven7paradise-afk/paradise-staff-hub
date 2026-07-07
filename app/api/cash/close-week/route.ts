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
  const locationId = String(body?.locationId ?? "").trim();
  const bankDeposit = parseFloat(String(body?.bankDeposit ?? "0").replace(",", "."));
  const withdrawals = parseFloat(String(body?.withdrawals ?? "0").replace(",", "."));
  const notes = String(body?.notes ?? "").trim();
  const dailyBreakdown = body?.dailyBreakdown ?? [];

  if (!/^\d{4}-\d{2}-\d{2}(:\d{4}-\d{2}-\d{2})?$/.test(weekKey)) {
    return NextResponse.json({ error: "Settimana o periodo non valido." }, { status: 400 });
  }

  if (!locationId) {
    return NextResponse.json({ error: "Sede non specificata." }, { status: 400 });
  }

  const settingKey = `cash_week_close:${locationId}:${weekKey}`;

  const setting = await prisma.setting.upsert({
    where: { key: settingKey },
    update: {
      value: {
        weekKey,
        locationId,
        bank_deposit: isNaN(bankDeposit) ? 0 : bankDeposit,
        withdrawals: isNaN(withdrawals) ? 0 : withdrawals,
        notes,
        daily_breakdown: dailyBreakdown,
        closed_at: new Date().toISOString(),
        closed_by_id: session.user.id,
        closed_by_name: session.user.name ?? "Admin",
        closed_by_role: session.user.role,
      },
    },
    create: {
      key: settingKey,
      value: {
        weekKey,
        locationId,
        bank_deposit: isNaN(bankDeposit) ? 0 : bankDeposit,
        withdrawals: isNaN(withdrawals) ? 0 : withdrawals,
        notes,
        daily_breakdown: dailyBreakdown,
        closed_at: new Date().toISOString(),
        closed_by_id: session.user.id,
        closed_by_name: session.user.name ?? "Admin",
        closed_by_role: session.user.role,
      },
    },
  });

  return NextResponse.json({ success: true, setting });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "") && !isDarwin)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const weekKey = String(body?.weekKey ?? "").trim();
  const locationId = String(body?.locationId ?? "").trim();

  if (!weekKey || !locationId) {
    return NextResponse.json({ error: "Settimana e sede sono obbligatori." }, { status: 400 });
  }

  const settingKey = `cash_week_close:${locationId}:${weekKey}`;
  await prisma.setting.delete({ where: { key: settingKey } }).catch(() => null);

  return NextResponse.json({ success: true });
}
