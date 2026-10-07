import { applyQualityAttribution, QUALITY_CAUSES } from "@/lib/shift-quality";
import { previousApplicationStaffWhere } from "@/lib/assistance-table-staff";
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
    if (typeof body.sheetId !== "string" || typeof body.rowId !== "string" || (typeof body.checked !== "boolean" && body.action !== "previousStaff" && body.action !== "cell") || typeof body.updatedAt !== "string") {
      return NextResponse.json({ error: "Richiesta di verifica non valida." }, { status: 400 });
    }
    const setting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY } });
    const sheets = normalizeAssistanceSheets(setting?.value);
    const sheet = sheets.find((item) => item.id === body.sheetId);
    const row = sheet?.rows.find((item) => item.id === body.rowId);
    if (!setting || !sheet || !row) return NextResponse.json({ error: "Riga non trovata." }, { status: 404 });
    if (row.updatedAt !== body.updatedAt) return NextResponse.json({ error: "La riga è stata aggiornata. Controlla il valore e seleziona nuovamente il personale.", row }, { status: 409 });
    const timestamp = new Date().toISOString();
    let updatedRow = { ...row, updatedAt: timestamp };
    if (body.action === "previousStaff") {
      const column = sheet.columns.find(item => item.id === body.columnId);
      if (!/sistemazione fasc/i.test(sheet.name) || !column || !/^(?:(?:app|add|appuntamento)\.?\s+precedente|sistemazione)$/i.test(column.label.trim()) || typeof body.value !== "string") {
        return NextResponse.json({ error: "Colonna non valida." }, { status: 400 });
      }
      if (body.value && !(body.value === "Da verificare" && /precedente$/i.test(column.label.trim()))) {
        const staff = await prisma.user.findFirst({ where: {
          ...previousApplicationStaffWhere, name: body.value,
        }, select: { id: true } });
        if (!staff) return NextResponse.json({ error: "Seleziona personale di Corso Buenos Aires." }, { status: 400 });
      }
      updatedRow = { ...updatedRow, values: { ...row.values, [column.id]: body.value, [/^sistemazione$/i.test(column.label.trim()) ? "__currentStaffManual" : "__previousStaffManual"]: "true" } };
    } else if (body.action === "cell") {
      const column = sheet.columns.find(item => item.id === body.columnId);
      if (!column || /^(?:(?:app|add|appuntamento)\.?\s+precedente|sistemazione)$/i.test(column.label.trim())) return NextResponse.json({ error: "Colonna non valida." }, { status: 400 });
      const value = body.value;
      if (/^causa$/i.test(column.label.trim()) && row.values.__qualityManaged === "true" && !QUALITY_CAUSES.includes(value)) return NextResponse.json({ error: "Seleziona una delle quattro cause nella scheda Qualità tecnica." }, { status: 400 });
      const validText = column.type === "text" && typeof value === "string" && value.length <= 20000;
      const validFile = column.type !== "text" && (value === "" || (value && typeof value === "object" && typeof value.name === "string" && typeof value.type === "string" && typeof value.url === "string" && value.url.startsWith("data:") && value.url.length <= 4500000));
      if (!validText && !validFile) return NextResponse.json({ error: "Valore non valido." }, { status: 400 });
      updatedRow = { ...updatedRow, values: { ...row.values, [column.id]: value, ...(/^causa$/i.test(column.label.trim()) && row.values.__qualityManaged === "true" ? { __qualityCause: value } : {}) }, reviewedAt: null, reviewedBy: null };
    } else {
      updatedRow = { ...updatedRow, reviewedAt: body.checked ? timestamp : null, reviewedBy: body.checked ? access.actorName : null };
    }
    if (body.action === "cell" && sheet.columns.some(c => c.id === body.columnId && /^causa$/i.test(c.label.trim())) && row.values.__qualityManaged === "true") {
      const previous = sheet.columns.find(c => /^(?:app|add|appuntamento)\.?\s+precedente$/i.test(c.label.trim()));
      if (previous) applyQualityAttribution(updatedRow.values, previous.id, body.value);
    }
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
