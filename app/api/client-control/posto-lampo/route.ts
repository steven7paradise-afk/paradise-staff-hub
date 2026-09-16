import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { isClientControlFormName } from "@/lib/client-control-form";
import { getCompleteCowlendarBookingsForRange } from "@/lib/cowlendar";
import { buildPostoLampoReport, isPostoLampo, romeMonthRange } from "@/lib/posto-lampo-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Accedi per consultare il riepilogo." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, mansione: true, access_list: true, active: true } });
  if (!user?.active || !await canAccessForUser(prisma, "/client-control", user)) return NextResponse.json({ error: "Non hai accesso a questo riepilogo." }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const year = Number(params.get("year")), month = Number(params.get("month"));
  if (!/^\d{4}$/.test(params.get("year") ?? "") || !/^\d{1,2}$/.test(params.get("month") ?? "") || year < 2020 || year > 2100 || month < 1 || month > 12) return NextResponse.json({ error: "Seleziona un mese e un anno validi." }, { status: 400 });
  const hour = params.get("hour");
  if (hour && !/^([01]\d|2[0-3])$/.test(hour)) return NextResponse.json({ error: "Ora non valida." }, { status: 400 });
  try {
    const { start, end } = romeMonthRange(year, month);
    const [bookings, forms, overrides] = await Promise.all([
      getCompleteCowlendarBookingsForRange(start.toISOString(), new Date(end.getTime() - 1).toISOString()),
      prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
      prisma.setting.findUnique({ where: { key: "appointment_status_overrides" }, select: { value: true } }),
    ]);
    const ids = bookings.filter(b => isPostoLampo(b.service?.title)).map(b => b.id);
    const formIds = forms.filter(f => isClientControlFormName(f.name, f.category)).map(f => f.id);
    const controls = ids.length && formIds.length ? await prisma.serviceFormResponse.findMany({ where: { form_id: { in: formIds }, OR: ids.map(id => ({ answers: { path: ["booking_id"], equals: id } })) }, select: { id: true, answers: true, updated_at: true, user_location_name: true } }) : [];
    const report = buildPostoLampoReport({ bookings, controls, overrides: overrides?.value, year, month, salon: params.get("salon") || "Tutti", todayOnly: params.get("date") === "today", hour });
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Posto Lampo report unavailable", error instanceof Error ? error.message : "Errore");
    return NextResponse.json({ error: "Non riesco a caricare tutti gli appuntamenti. Riprova tra poco." }, { status: 502 });
  }
}
