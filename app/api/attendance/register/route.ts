import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { attendanceRegisterAccess, readAttendanceDay, readAttendanceLogs } from "@/lib/attendance-register";

const privateResponse = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });

  const access = await attendanceRegisterAccess(session.user.id);
  if (!access?.hasFullAttendanceAccess) {
    return NextResponse.json({ error: "Accesso negato." }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const workerId = searchParams.get("worker");
  const month = searchParams.get("month");
  if (!workerId && !month) return NextResponse.json(await readAttendanceDay(access.where), privateResponse);

  if (!workerId || !month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Dipendente o mese non valido." }, { status: 400 });
  }

  const start = new Date(month + "-01");
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  cutoff.setUTCHours(0, 0, 0, 0);
  if (end <= cutoff) return NextResponse.json({ logs: [] }, privateResponse);

  const logs = await readAttendanceLogs({
    ...access.where,
    user_id: workerId,
    date: { gte: start < cutoff ? cutoff : start, lt: end },
  });
  return NextResponse.json({ logs }, privateResponse);
}
