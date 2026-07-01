import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ASSISTANCE_TABLES_ACCESS_KEY,
  ASSISTANCE_TABLES_KEY,
  canUseAssistanceTables,
  normalizeAssistanceTablesAccess,
  normalizeAssistanceSheets,
} from "@/lib/assistance-tables";

async function currentAccess() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, status: 401, message: "Non autenticato" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, mansione: true },
  });
  const accessSetting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_ACCESS_KEY } });
  const access = normalizeAssistanceTablesAccess(accessSetting?.value);
  if (!canUseAssistanceTables(user?.role ?? session.user.role, user?.mansione, session.user.id, access)) {
    return { ok: false as const, status: 403, message: "Accesso riservato ad assistenza e amministrazione" };
  }
  return { ok: true as const };
}

export async function GET() {
  const access = await currentAccess();
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

  const setting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY } });
  return NextResponse.json({ sheets: normalizeAssistanceSheets(setting?.value) });
}

export async function PUT(request: NextRequest) {
  const access = await currentAccess();
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

  try {
    const payload = await request.json();
    const sheets = normalizeAssistanceSheets(payload?.sheets);
    await prisma.setting.upsert({
      where: { key: ASSISTANCE_TABLES_KEY },
      create: { key: ASSISTANCE_TABLES_KEY, value: sheets },
      update: { value: sheets },
    });
    return NextResponse.json({ sheets });
  } catch (error) {
    return NextResponse.json({ error: "Errore nel salvataggio delle tabelle" }, { status: 500 });
  }
}
