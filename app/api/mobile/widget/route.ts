import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { widgetUser } from "@/lib/mobile-widget-auth";
import { prisma } from "@/lib/prisma";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const auth = await widgetUser(request);
  if (!auth) return NextResponse.json({ error: "Non autorizzato" }, { status: 401, headers });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const start = new Date(today + "T00:00:00Z");
  const end = new Date(start.getTime() + 86400000);
  const [shifts, logs, rule] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: auth.user.id, date: { gte: start, lt: new Date(start.getTime() + 7 * 86400000) } }, include: { category: true, location: true }, orderBy: { date: "asc" } }),
    prisma.attendanceLog.findMany({ where: { user_id: auth.user.id, date: { gte: start, lt: end }, timestamp: { lte: new Date() } }, select: { id: true, type: true, timestamp: true }, orderBy: [{ timestamp: "asc" }, { id: "asc" }] }),
    auth.user.sede_id ? prisma.setting.findUnique({ where: { key: clockRuleKey(auth.user.sede_id) } }) : Promise.resolve(null),
  ]);
  return NextResponse.json({ name: auth.user.name, breakMinutes: parseClockRule(rule?.value).breakDurationMinutes,
    shifts: shifts.map(s => ({ date: s.date.toISOString().slice(0, 10), start: s.start_time ?? s.category.start_time, end: s.end_time ?? s.category.end_time,
      location: s.location?.name ?? auth.user.location?.name ?? "", office: [auth.user.mansione, s.category.name, s.location?.name].some(v => v?.toLowerCase().includes("ufficio")) })),
    attendance: logs.map(l => ({ id: l.id, type: l.type, timestamp: l.timestamp.toISOString() })) }, { headers });
}
export async function POST(request: Request) {
  const auth = await widgetUser(request);
  if (!auth) return NextResponse.json({ error: "Non autorizzato" }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string" || !/^[a-f0-9]{32,512}$/.test(body.token) || !["sandbox", "production"].includes(body.environment))
    return NextResponse.json({ error: "Token non valido" }, { status: 400, headers });
  const key = `mobile-widget-device:${auth.user.id}:${createHash("sha256").update(body.token).digest("hex")}`;
  const value = { token: body.token, environment: body.environment, sessionId: auth.session.id };
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return NextResponse.json({ success: true }, { headers });
}
