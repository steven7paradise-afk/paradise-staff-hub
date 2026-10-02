import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function createWidgetAccess(sessionId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.setting.upsert({ where: { key: `mobile-widget-auth:${sessionId}` },
    create: { key: `mobile-widget-auth:${sessionId}`, value: { hash: digest(token) } },
    update: { value: { hash: digest(token) } } });
  return `${sessionId}.${token}`;
}
export async function widgetUser(request: Request) {
  const match = /^Bearer ([a-zA-Z0-9_-]+)\.([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return null;
  const record = await prisma.setting.findUnique({ where: { key: `mobile-widget-auth:${match[1]}` } });
  const value = record?.value as { hash?: string } | undefined;
  if (value?.hash !== digest(match[2])) return null;
  const session = await prisma.mobileSession.findUnique({ where: { id: match[1] }, include: { user: { include: { location: true } } } });
  if (!session || session.revoked_at || session.expires_at <= new Date() || !session.user.active || session.user.must_change_password
      || session.user.employee_status === "Ex dipendente" || session.device_name?.startsWith("ios-salon:")) return null;
  return { session, user: session.user };
}
