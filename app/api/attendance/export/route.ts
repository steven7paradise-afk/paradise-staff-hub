import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  const where: Prisma.AttendanceLogWhereInput | undefined =
    session.user.role === "RESPONSABILE" ? { location_id: session.user.sedeId } : undefined;
  const logs = await prisma.attendanceLog.findMany({
    where,
    include: { user: true, location: true, device: true },
    orderBy: { timestamp: "desc" },
  });
  const rows = [
    ["Data", "Ora", "Dipendente", "Email", "Salone", "Tipo", "Dispositivo", "Note"],
    ...logs.map((log) => [
      new Intl.DateTimeFormat("it-IT").format(log.date),
      log.time,
      log.user.name,
      log.user.email,
      log.location.name,
      log.type,
      log.device.device_name,
      log.note ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => csvCell(cell)).join(";")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="timbrature-paradise.csv"',
    },
  });
}
