import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clockRuleKey } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ZERO") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const { id } = await context.params;
  const payload = await request.json();
  const entranceRoundingMinutes = Number(payload.entranceRoundingMinutes);
  const breakDurationMinutes = Number(payload.breakDurationMinutes);
  if (![0, 15, 30, 60].includes(entranceRoundingMinutes)) {
    return NextResponse.json({ error: "Regola oraria non valida." }, { status: 400 });
  }
  if (![15, 30, 45, 60, 90, 120].includes(breakDurationMinutes)) {
    return NextResponse.json({ error: "Durata pausa non valida." }, { status: 400 });
  }
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) return NextResponse.json({ error: "Salone non trovato." }, { status: 404 });

  await prisma.setting.upsert({
    where: { key: clockRuleKey(id) },
    update: { value: { entranceRoundingMinutes, breakDurationMinutes } },
    create: { key: clockRuleKey(id), value: { entranceRoundingMinutes, breakDurationMinutes } },
  });
  return NextResponse.json({ locationId: id, entranceRoundingMinutes, breakDurationMinutes });
}
