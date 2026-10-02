import { NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || auth.user.employee_status === "Ex dipendente"
      || auth.session.device_name?.startsWith("ios-salon:")) {
    return reply({ error: "Accedi con il tuo account personale." }, 401);
  }
  const day = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return reply({ error: "Data non valida." }, 400);
  const start = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day) {
    return reply({ error: "Data non valida." }, 400);
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: auth.user.id, date: { gte: start, lt: end }, timestamp: { lte: new Date() } },
    select: { id: true, type: true, timestamp: true, time: true },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
  });
  return reply({ userId: auth.user.id, date: day, items: logs.map(log => ({
    id: log.id, type: log.type, timestamp: log.timestamp.toISOString(), time: log.time,
  })) });
}
