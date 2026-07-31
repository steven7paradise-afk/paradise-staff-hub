import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  if (session.user.role === "RESPONSABILE" && session.user.sedeId !== id) {
    return NextResponse.json({ error: "Puoi scaricare solo il tuo salone." }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const logs = await prisma.attendanceLog.findMany({
    where: { location_id: id, timestamp: { gte: monthStart } },
    include: { user: true, location: true, device: true },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  const rows = [
    ["Data", "Ora", "Dipendente", "Email", "Sede", "Tipo", "Dispositivo", "Note"],
    ...logs.map((log) => [
      log.date.toISOString().slice(0, 10),
      log.time,
      log.user.name,
      log.user.email,
      log.location.name,
      log.type,
      log.device?.device_name ?? "",
      log.note ?? "",
    ]),
  ];

  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resoconto-salone-${id}.csv"`,
    },
  });
}
