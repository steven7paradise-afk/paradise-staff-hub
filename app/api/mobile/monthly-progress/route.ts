import { NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { clockRuleKey, parseClockRule, localDateKey } from "@/lib/clock-rules";
import { monthlyProgress } from "@/lib/mobile-monthly-progress";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || auth.session.device_name?.startsWith("ios-salon:")) {
    return NextResponse.json({ error: "Accedi con il tuo account personale." }, { status: 401 });
  }
  const now = new Date(), today = localDateKey(now), month = today.slice(0, 7);
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  // Identity always comes from the session; no client-supplied user ID is accepted.
  const user_id = auth.user.id;
  const [logs, shifts, leaves, rule] = await Promise.all([
    prisma.attendanceLog.findMany({ where: { user_id, date: { gte: start, lt: end }, timestamp: { lte: now } },
      select: { date: true, type: true, timestamp: true, note: true }, orderBy: { timestamp: "asc" } }),
    prisma.scheduleEntry.findMany({ where: { user_id, date: { gte: start, lt: end } }, include: { category: true, location: true } }),
    prisma.leaveRequest.findMany({ where: { user_id, status: "APPROVED", start_date: { lt: end }, end_date: { gte: start } },
      select: { start_date: true, end_date: true, type: true, start_time: true, end_time: true } }),
    auth.user.sede_id ? prisma.setting.findUnique({ where: { key: clockRuleKey(auth.user.sede_id) } }) : null,
  ]);
  return NextResponse.json({ userId: user_id, month, updatedAt: now.toISOString(),
    ...monthlyProgress(logs, shifts, leaves, parseClockRule(rule?.value).breakDurationMinutes, now, today) },
    { headers: { "Cache-Control": "private, no-store" } });
}
