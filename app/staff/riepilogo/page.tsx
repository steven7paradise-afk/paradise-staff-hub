import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffAttendanceSummary } from "@/components/staff-attendance-summary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { buildStaffSummary } from "@/lib/staff-attendance-summary";

export const dynamic = "force-dynamic";

export default async function StaffSummaryPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active || !["ZERO", "SUPER_ADMIN", "ADMIN"].includes(user.role) || !(await canAccessForUser(prisma, "/staff", user))) redirect("/dashboard");
  const params = await searchParams;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === "year")!.value);
  const currentMonth = Number(parts.find((part) => part.type === "month")!.value);
  const monthValue = Number(params.month); const yearValue = Number(params.year);
  const month = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : currentMonth;
  const year = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= currentYear + 1 ? yearValue : currentYear;
  const start = new Date(Date.UTC(year, month - 1, 1)); const end = new Date(Date.UTC(year, month, 1));
  const employees = await prisma.user.findMany({ where: { role: { notIn: ["ZERO", "SUPER_ADMIN"] } }, select: { id: true, name: true, active: true, photo_url: true, location: { select: { name: true } } }, orderBy: { name: "asc" } });
  const ids = employees.map((employee) => employee.id);
  const [schedules, clocks, leaves] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, select: { user_id: true, date: true, start_time: true, end_time: true, category: { select: { name: true, code: true, start_time: true, end_time: true } }, location: { select: { name: true } } } }),
    prisma.attendanceLog.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, select: { user_id: true, date: true, timestamp: true, type: true, note: true } }),
    prisma.leaveRequest.findMany({ where: { user_id: { in: ids }, start_date: { lt: end }, end_date: { gte: start } }, select: { user_id: true, type: true, start_date: true, end_date: true, start_time: true, end_time: true, status: true, reason: true, sickness_unjustified: true } }),
  ]);
  const rows = buildStaffSummary({ employees, schedules, clocks, leaves, start, end, now });
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  return <AppShell title="Riepilogo presenze" subtitle="Ritardi, assenze e richieste per dipendente"><StaffAttendanceSummary rows={rows} month={month} year={year} currentYear={currentYear} label={label} generatedAt={now.toISOString()} /></AppShell>;
}
