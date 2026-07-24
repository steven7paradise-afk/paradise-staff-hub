import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const authorizedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !authorizedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id: employeeId } = await context.params;

  try {
    const now = new Date();
    
    // Current month range
    const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const endOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

    // Previous month range
    const startOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
    const endOfPreviousMonth = new Date(startOfCurrentMonth);

    // 1. Jobs Completed (ServiceFormResponse count)
    const currentJobs = await prisma.serviceFormResponse.count({
      where: {
        user_id: employeeId,
        created_at: { gte: startOfCurrentMonth, lt: endOfCurrentMonth },
      },
    });
    const previousJobs = await prisma.serviceFormResponse.count({
      where: {
        user_id: employeeId,
        created_at: { gte: startOfPreviousMonth, lt: endOfPreviousMonth },
      },
    });

    // 2. Hours Worked (Sum of WorkHourRecord hours)
    const currentHoursResult = await prisma.workHourRecord.aggregate({
      where: {
        user_id: employeeId,
        date: { gte: startOfCurrentMonth, lt: endOfCurrentMonth },
      },
      _sum: { hours: true },
    });
    const previousHoursResult = await prisma.workHourRecord.aggregate({
      where: {
        user_id: employeeId,
        date: { gte: startOfPreviousMonth, lt: endOfPreviousMonth },
      },
      _sum: { hours: true },
    });
    const currentHours = currentHoursResult._sum.hours ?? 0;
    const previousHours = previousHoursResult._sum.hours ?? 0;

    // 3. Shifts Worked (AttendanceLog count of type ENTRATA)
    const currentShifts = await prisma.attendanceLog.count({
      where: {
        user_id: employeeId,
        type: "ENTRATA",
        timestamp: { gte: startOfCurrentMonth, lt: endOfCurrentMonth },
      },
    });
    const previousShifts = await prisma.attendanceLog.count({
      where: {
        user_id: employeeId,
        type: "ENTRATA",
        timestamp: { gte: startOfPreviousMonth, lt: endOfPreviousMonth },
      },
    });

    // Helper to calculate MoM percentage change
    const getGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
      jobs: {
        count: currentJobs,
        growth: getGrowth(currentJobs, previousJobs),
      },
      hours: {
        count: Math.round(currentHours),
        growth: getGrowth(currentHours, previousHours),
      },
      shifts: {
        count: currentShifts,
        growth: getGrowth(currentShifts, previousShifts),
      },
    });
  } catch (error) {
    console.error("Failed to fetch employee stats:", error);
    return NextResponse.json(
      { error: "Impossibile caricare le statistiche dipendente." },
      { status: 500 }
    );
  }
}
