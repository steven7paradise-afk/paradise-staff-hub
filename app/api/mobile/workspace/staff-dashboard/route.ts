import { NextResponse } from "next/server";
import { mobileWorkspace } from "@/lib/mobile-workspace-auth";
import { isWorkspaceAdmin } from "@/lib/mobile-workspace-policy";
import { staffDashboardItem } from "@/lib/mobile-staff-dashboard";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { assignmentSnapshot } from "@/lib/client-assignment";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = await mobileWorkspace(request);
  if (!context) return NextResponse.json({ error: "Accesso scaduto." }, { status: 401 });
  if (!context.auth || !isWorkspaceAdmin(context.auth.user.role) || !context.modules.some(m => m.id === "employees")) {
    return NextResponse.json({ error: "Dashboard riservata all’amministrazione." }, { status: 403 });
  }
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const today = new Date(`${day}T00:00:00Z`);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const workers = await prisma.user.findMany({
    where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] }, employee_status: { not: "Ex dipendente" } },
    select: { id: true, name: true, location: { select: { name: true } },
      attendance_logs: { where: { date: { gte: today, lt: tomorrow }, timestamp: { lte: now } }, select: { type: true, timestamp: true, note: true } },
      schedule_entries: { where: { date: { gte: today, lt: tomorrow } }, select: { start_time: true, end_time: true, location: { select: { name: true } }, category: { select: { name: true, code: true, start_time: true, end_time: true } } } },
      leave_requests: { where: { status: "APPROVED", start_date: { lt: tomorrow }, end_date: { gte: today }, type: { in: ["FERIE", "MALATTIA", "RIPOSO", "PERMESSO"] } }, select: { type: true, start_time: true, end_time: true } },
    }, orderBy: { name: "asc" },
  });
  const cashAllowed = await canAccessForUser(prisma, "/cash", context.auth.user);
  const [closings, bookings] = await Promise.all([
    cashAllowed ? prisma.cashClosing.findMany({ where: { date: { gte: today, lt: tomorrow } }, select: { location_id: true, withdrawn: true }, orderBy: { created_at: "desc" } }) : Promise.resolve(null),
    context.modules.some(m => m.id === "appointments") ? assignmentSnapshot().catch(() => null) : Promise.resolve(null),
  ]);
  // Same recorded revenue basis as the web financial dashboard: latest closing per location/day.
  const latest = new Map<string, number>();
  for (const closing of closings ?? []) if (!latest.has(closing.location_id)) latest.set(closing.location_id, closing.withdrawn);
  const revenue = latest.size ? Math.round([...latest.values()].reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const clients = bookings && bookings.items.length < 400
    ? bookings.items.filter(b => ["IN_ATTESA", "ARRIVATO", "ARRIVATO_IN_RITARDO", "ARRIVED", "INIZIATO", "IN_PROGRESS"].includes(b.status.toUpperCase())).length : null;
  return NextResponse.json({ day, updatedAt: now.toISOString(), revenue, recordedLocations: latest.size, clients,
    items: workers.map(w => staffDashboardItem(w, now)) }, { headers: { "Cache-Control": "private, no-store" } });
}
