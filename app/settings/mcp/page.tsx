import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/mcp/oauth";
import { officeConfig } from "@/lib/mcp/data";
import { McpSettings } from "@/components/mcp-settings";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/mcp");
  if (!await currentAdmin(session.user.id)) redirect("/dashboard");
  const [config, users, grants] = await Promise.all([
    officeConfig(),
    prisma.user.findMany({ where: { active: true, employee_status: { not: "Ex dipendente" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mcpGrant.findMany({ where: { revoked_at: null, expires_at: { gt: new Date() } }, select: { id: true, client_id: true, expires_at: true } }),
  ]);
  const clients = await prisma.mcpClient.findMany({ where: { id: { in: grants.map(g => g.client_id) } }, select: { id: true, name: true } });
  return <AppShell title="Connettore MCP" subtitle="Dati operativi per la dashboard esterna e Claude. Accesso in sola lettura."><McpSettings initial={config} users={users} grants={grants.map(g => ({ id: g.id, name: clients.find(c => c.id === g.client_id)?.name || "Connettore", expires: g.expires_at.toISOString() }))} /></AppShell>;
}
