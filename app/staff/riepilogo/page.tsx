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
  const [schedules, clocks, leaves, clientResponses] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, select: { user_id: true, date: true, start_time: true, end_time: true, category: { select: { name: true, code: true, start_time: true, end_time: true } }, location: { select: { name: true } } } }),
    prisma.attendanceLog.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, select: { user_id: true, date: true, timestamp: true, type: true, note: true } }),
    prisma.leaveRequest.findMany({ where: { user_id: { in: ids }, start_date: { lt: end }, end_date: { gte: start } }, select: { user_id: true, type: true, start_date: true, end_date: true, start_time: true, end_time: true, status: true, reason: true, sickness_unjustified: true } }),
    prisma.serviceFormResponse.findMany({ where: { created_at: { gte: start, lt: end } }, include: { form: { select: { name: true, category: true } } } }),
  ]);
  const rows = buildStaffSummary({ employees, schedules, clocks, leaves, start, end, now });
  const enrichedRows = rows.map((row) => {
    const details = clientResponses.flatMap((response) => {
      if (!/CONTROLLO CLIENTE|QUALITA/i.test(`${response.form.name} ${response.form.category}`)) return [];
      const answers = (response.answers || {}) as Record<string, unknown>;
      const staff = [answers.client_control_service_staff, answers.client_control_service_owner].flatMap((value) => Array.isArray(value) ? value : String(value || "").split(/[,;]+/)).map(String).map((value) => value.trim()).filter(Boolean);
      if (!staff.some((name) => name.toLowerCase() === row.name.toLowerCase())) return [];
      const rawProducts = String(answers.client_control_products_list || "");
      const products = rawProducts.split(/[,;\n]+/).map((value) => value.trim()).filter((value) => value && !["undefined", "null", "[object Object]"].includes(value));
      const note = [answers.client_control_notes_text, answers.custom_note_text, answers.custom_extra_note, answers.client_control_shopify_order_note].map((value) => String(value || "").trim()).filter(Boolean).join("\n");
      const serviceText = [answers.custom_services, answers.custom_fasce, note, rawProducts].flat().join(" ");
      return [{ clientName: String(answers.client_control_client_name || "Cliente senza nome"), date: response.created_at.toISOString(), products, postoLampo: /post[oi]\s*[- ]?\s*lamp[oi]/i.test(serviceText), note }];
    });
    return { ...row, clientDetails: details, clientCount: details.length, productCount: details.reduce((sum, item) => sum + item.products.length, 0), postoLampoCount: details.filter((item) => item.postoLampo).length };
  });
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  return <AppShell title="Riepilogo presenze" subtitle="Ritardi, assenze e richieste per dipendente"><StaffAttendanceSummary rows={enrichedRows} month={month} year={year} currentYear={currentYear} label={label} generatedAt={now.toISOString()} /></AppShell>;
}
