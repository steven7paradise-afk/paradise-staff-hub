import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShiftReportManager } from "@/components/shift-report-manager";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ShiftReportsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/shift-reports");
  return <AppShell title="Registro giornate" subtitle="Consulta per giorno e sede cosa è successo, poi verifica i report" hideHeader><ShiftReportManager /></AppShell>;
}
