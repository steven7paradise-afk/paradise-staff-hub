import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "DIPENDENTE") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${localDay}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: session.user.id, date: { gte: today, lt: tomorrow } },
    select: { id: true, type: true, timestamp: true, time: true },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json(logs.map((log) => ({
    ...log,
    timestamp: log.timestamp.toISOString(),
  })));
}
