import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "DIPENDENTE") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const where: Prisma.UserWhereInput = {
    active: true,
    role: { not: "SUPER_ADMIN" },
    ...(session.user.role === "RESPONSABILE" ? { sede_id: session.user.sedeId ?? undefined } : {}),
  };

  const workers = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      sede_id: true,
      location: { select: { name: true } },
      attendance_logs: {
        where: { date: { gte: today, lt: tomorrow } },
        select: { type: true, timestamp: true, time: true },
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });
  const locationIds = Array.from(new Set(workers.map((worker) => worker.sede_id).filter((id): id is string => Boolean(id))));
  const rules = await prisma.setting.findMany({ where: { key: { in: locationIds.map(clockRuleKey) } } });

  return NextResponse.json(workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    location: worker.location?.name ?? "Nessun salone",
    lastLog: worker.attendance_logs[0]
      ? { ...worker.attendance_logs[0], timestamp: worker.attendance_logs[0].timestamp.toISOString() }
      : null,
    breakDurationMinutes: parseClockRule(rules.find((rule) => rule.key === clockRuleKey(worker.sede_id ?? ""))?.value).breakDurationMinutes,
  })));
}
