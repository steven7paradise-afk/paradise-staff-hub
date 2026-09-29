import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadAutocompletedAssistanceSheets } from "@/lib/systemazione-fasce-autocomplete";
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
    select: { role: true, mansione: true, name: true },
  });
  const accessSetting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_ACCESS_KEY } });
  const access = normalizeAssistanceTablesAccess(accessSetting?.value);
  if (!canUseAssistanceTables(user?.role ?? session.user.role, user?.mansione, session.user.id, access)) {
    return { ok: false as const, status: 403, message: "Accesso riservato ad assistenza e amministrazione" };
  }
  return { ok: true as const, actorName: user?.name || "Staff" };
}

export async function PATCH(request: NextRequest) {
  const access = await currentAccess();
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  try {
    const body = await request.json();
    if (typeof body.sheetId !== "string" || typeof body.rowId !== "string" || typeof body.checked !== "boolean" || typeof body.updatedAt !== "string") {
      return NextResponse.json({ error: "Richiesta di verifica non valida." }, { status: 400 });
    }
    const setting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY } });
    const sheets = normalizeAssistanceSheets(setting?.value);
    const sheet = sheets.find((item) => item.id === body.sheetId);
    const row = sheet?.rows.find((item) => item.id === body.rowId);
    if (!setting || !sheet || !row) return NextResponse.json({ error: "Riga non trovata." }, { status: 404 });
    if (row.updatedAt !== body.updatedAt) return NextResponse.json({ error: "La riga è cambiata. Ricarica e controlla i dati aggiornati." }, { status: 409 });
    const timestamp = new Date().toISOString();
    const updatedRow = { ...row, reviewedAt: body.checked ? timestamp : null, reviewedBy: body.checked ? access.actorName : null, updatedAt: timestamp };
    const next = sheets.map((item) => item.id === sheet.id ? { ...item, updatedAt: timestamp, rows: item.rows.map((r) => r.id === row.id ? updatedRow : r) } : item);
    const saved = await prisma.setting.updateMany({ where: { key: ASSISTANCE_TABLES_KEY, value: { equals: setting.value! } }, data: { value: next } });
    if (!saved.count) return NextResponse.json({ error: "I dati sono cambiati. Ricarica e riprova." }, { status: 409 });
    return NextResponse.json({ row: updatedRow });
  } catch {
    return NextResponse.json({ error: "Check non salvato. Riprova." }, { status: 500 });
  }
}

export async function GET() {
  const access = await currentAccess();
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

  return NextResponse.json({ sheets: await loadAutocompletedAssistanceSheets() });
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
