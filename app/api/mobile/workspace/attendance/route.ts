import { NextResponse } from "next/server";
import { mobileWorkspace } from "@/lib/mobile-workspace-auth";
import { isWorkspaceAdmin } from "@/lib/mobile-workspace-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const context = await mobileWorkspace(request);
  if (!context?.auth) return reply({ error: "Accesso scaduto." }, 401);
  if (!isWorkspaceAdmin(context.auth.user.role) || !context.modules.some(m => m.id === "attendance")) {
    return reply({ error: "Non hai accesso al registro delle presenze." }, 403);
  }
  const params = new URL(request.url).searchParams;
  const day = params.get("date") ?? "";
  const month = params.get("period") === "month";
  const userId = params.get("userId");
  if (month && !userId) return reply({ error: "Seleziona un lavoratore." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return reply({ error: "Data non valida." }, 400);
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day) return reply({ error: "Data non valida." }, 400);
  if (month) start.setUTCDate(1);
  const end = new Date(start);
  if (month) end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 1);
  const excluded = ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"];
  const logs = await prisma.attendanceLog.findMany({
    where: { ...(userId ? { user_id: userId } : {}), date: { gte: start, lt: end }, timestamp: { lte: new Date() },
      user: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] }, NOT: [
        { mansione: { in: excluded, mode: "insensitive" } },
        { employee_status: { in: excluded, mode: "insensitive" } },
      ] } },
    select: { id: true, date: true, user_id: true, type: true, timestamp: true, time: true, note: true,
      user: { select: { name: true, photo_url: true } }, location: { select: { name: true } }, device: { select: { device_name: true } } },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }], take: 2001,
  });
  return reply({ date: day, updatedAt: new Date().toISOString(), truncated: logs.length > 2000,
    items: logs.slice(0, 2000).map(log => ({ id: log.id, userId: log.user_id, employee: log.user.name, photoUrl: log.user.photo_url, day: log.date.toISOString().slice(0, 10),
      location: log.location.name, device: log.device.device_name, type: log.type,
      timestamp: log.timestamp.toISOString(), time: log.time, note: log.note ?? "" })) });
}
