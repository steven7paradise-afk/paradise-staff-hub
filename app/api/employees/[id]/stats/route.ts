import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateClockHours } from "@/lib/work-hours";

const authorizedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

// Helper to extract names from answer
const namesFromAnswer = (val: any): string[] => {
  if (!val) return [];
  if (typeof val === "string") {
    return val.split(",").map(x => x.trim()).filter(Boolean);
  }
  if (Array.isArray(val)) {
    return val.map(x => String(x).trim()).filter(Boolean);
  }
  return [];
};

// Helper to resolve canonical name
const resolveCanonicalStaffName = (name: string, allNames: string[]) => {
  const clean = name.trim().toLowerCase();
  if (!clean) return name;
  const match = allNames.find(n => n.toLowerCase() === clean);
  return match || name;
};

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
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { name: true }
    });
    if (!employee) {
      return NextResponse.json({ error: "Lavoratore non trovato." }, { status: 404 });
    }
    const employeeName = employee.name;

    const now = new Date();
    
    // Current month range
    const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const endOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

    // Previous month range
    const startOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
    const endOfPreviousMonth = new Date(startOfCurrentMonth);

    // Fetch all employees to resolve canonical names
    const allUsers = await prisma.user.findMany({ select: { name: true } });
    const employeeNames = allUsers.map(u => u.name);

    // --- 1. JOBS COMPLETED (ServiceFormResponse parsing) ---
    const [currentResponses, previousResponses] = await Promise.all([
      prisma.serviceFormResponse.findMany({
        where: {
          created_at: { gte: startOfCurrentMonth, lt: endOfCurrentMonth },
        },
        select: { answers: true, user: { select: { name: true } } }
      }),
      prisma.serviceFormResponse.findMany({
        where: {
          created_at: { gte: startOfPreviousMonth, lt: endOfPreviousMonth },
        },
        select: { answers: true, user: { select: { name: true } } }
      })
    ]);

    const countJobsForEmployee = (responses: typeof currentResponses) => {
      let count = 0;
      for (const res of responses) {
        const answers = res.answers as any;
        if (!answers) continue;
        const selectedStaff = namesFromAnswer(answers["client_control_service_staff"]);
        const fallbackOwner = namesFromAnswer(answers["client_control_service_owner"]);
        const staffNames = (selectedStaff.length ? selectedStaff : fallbackOwner.length ? fallbackOwner : [res.user?.name ?? ""])
          .map((name) => resolveCanonicalStaffName(name, employeeNames));

        if (staffNames.includes(employeeName)) {
          count++;
        }
      }
      return count;
    };

    const currentJobs = countJobsForEmployee(currentResponses);
    const previousJobs = countJobsForEmployee(previousResponses);

    // --- 2. HOURS & SHIFTS WORKED (AttendanceLog computation) ---
    const [currentLogs, previousLogs] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          user_id: employeeId,
          timestamp: { gte: startOfCurrentMonth, lt: endOfCurrentMonth }
        },
        orderBy: { timestamp: "asc" }
      }),
      prisma.attendanceLog.findMany({
        where: {
          user_id: employeeId,
          timestamp: { gte: startOfPreviousMonth, lt: endOfPreviousMonth }
        },
        orderBy: { timestamp: "asc" }
      })
    ]);

    const calculateMetricsFromLogs = (logs: typeof currentLogs) => {
      const logsByDay = new Map<string, typeof logs>();
      for (const log of logs) {
        const dayStr = log.date.toISOString().slice(0, 10);
        const dayLogs = logsByDay.get(dayStr) || [];
        dayLogs.push(log);
        logsByDay.set(dayStr, dayLogs);
      }

      let totalHours = 0;
      for (const [_, dayLogs] of logsByDay) {
        const calc = calculateClockHours(dayLogs);
        totalHours += calc.netHours;
      }

      return {
        hours: totalHours,
        shifts: logsByDay.size
      };
    };

    const currentMetrics = calculateMetricsFromLogs(currentLogs);
    const previousMetrics = calculateMetricsFromLogs(previousLogs);

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
        count: Math.round(currentMetrics.hours * 100) / 100, // round to 2 decimals
        growth: getGrowth(currentMetrics.hours, previousMetrics.hours),
      },
      shifts: {
        count: currentMetrics.shifts,
        growth: getGrowth(currentMetrics.shifts, previousMetrics.shifts),
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
