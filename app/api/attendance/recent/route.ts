import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let where: Prisma.AttendanceLogWhereInput = {};
  if (session.user.role === "DIPENDENTE") where = { user_id: session.user.id };
  if (session.user.role === "RESPONSABILE") where = { location_id: session.user.sedeId ?? undefined };

  const logs = await prisma.attendanceLog.findMany({
    where,
    include: { user: true, location: true, device: true },
    orderBy: { timestamp: "desc" },
    take: 8,
  });

  return NextResponse.json(
    logs.map((log) => ({
      id: log.id,
      employee: log.user.name,
      location: log.location.name,
      device: log.device.device_name,
      type: log.type,
      time: log.time,
      timestamp: log.timestamp.toISOString(),
    })),
  );
}
