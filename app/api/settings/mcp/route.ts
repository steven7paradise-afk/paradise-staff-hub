import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessFor } from "@/lib/mcp/permissions";
import { OfficeConfig, CONFIG_KEY } from "@/lib/mcp/schemas";
import { boundedBody, issuer, audit } from "@/lib/mcp/security";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (await accessFor(session.user.id))?.role !== "super_admin") return Response.json({ error: "Accesso riservato alla direzione" }, { status: 403 });
  if (request.headers.get("origin") !== issuer()) return Response.json({ error: "Origin non valida" }, { status: 403 });
  try {
    const body = JSON.parse(await boundedBody(request, 1_000_000));
    if (body.revoke_grant_id && typeof body.revoke_grant_id === "string") {
      await prisma.mcpGrant.updateMany({ where: { id: body.revoke_grant_id }, data: { revoked_at: new Date() } });
      audit("grant.revoked_by_admin", { user_id: session.user.id });
    } else {
      const config = OfficeConfig.parse(body);
      const ids = config.employees.map(e => e.employee_id);
      const count = await prisma.user.count({ where: { id: { in: ids }, active: true } });
      if (count !== ids.length) return Response.json({ error: "Seleziona solo collaboratori attivi" }, { status: 400 });
      await prisma.setting.upsert({ where: { key: CONFIG_KEY }, create: { key: CONFIG_KEY, value: config }, update: { value: config } });
      audit("config.updated", { user_id: session.user.id });
    }
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Configurazione non valida: controlla reparti, capi reparto e campi duplicati." }, { status: 400 }); }
}
