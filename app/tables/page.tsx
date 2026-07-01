import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AssistanceTablesManager } from "@/components/assistance-tables-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ASSISTANCE_TABLES_ACCESS_KEY,
  ASSISTANCE_TABLES_KEY,
  canUseAssistanceTables,
  defaultAssistanceSheet,
  normalizeAssistanceTablesAccess,
  normalizeAssistanceSheets,
} from "@/lib/assistance-tables";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, mansione: true },
  });
  const role = (user?.role ?? session.user.role) as Role;

  const accessSetting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_ACCESS_KEY } });
  const access = normalizeAssistanceTablesAccess(accessSetting?.value);

  if (!canUseAssistanceTables(role, user?.mansione, session.user.id, access)) {
    redirect("/dashboard");
  }

  const setting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY } });
  const sheets = normalizeAssistanceSheets(setting?.value);

  return (
    <AppShell
      title="Tabelle"
      subtitle="Fogli operativi per assistenza: crea sheet, registra nominativi, note, immagini e file."
      role={role}
    >
      <AssistanceTablesManager initialSheets={sheets.length ? sheets : [defaultAssistanceSheet()]} />
    </AppShell>
  );
}
