import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShiftReportManager } from "@/components/shift-report-manager";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ShiftReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role)) redirect("/dashboard");
  if (["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/shift-reports/admin");
  return <AppShell title="Report di turno" subtitle="Compilazione del Responsabile e approvazione dello Store Manager" hideHeader><ShiftReportManager /></AppShell>;
}
