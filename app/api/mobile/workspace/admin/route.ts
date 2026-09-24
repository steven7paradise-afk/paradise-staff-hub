import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { createMobileSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { pinLookup } from "@/lib/pin";

export async function POST(request: Request) {
  const device = await checkPCAuthorization(request.headers.get("x-paradise-device") ?? undefined);
  if (!device) return NextResponse.json({ error: "Dispositivo non autorizzato." }, { status: 401 });
  // Persistent, per-device limit: restarts or multiple server processes cannot reset attempts.
  const allowed = await prisma.$transaction(async (tx) => {
    const key = `ios_admin_attempts:${device.code}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    const record = await tx.setting.findUnique({ where: { key } });
    const previous = record?.value as { count?: number; until?: number } | null;
    const now = Date.now();
    const count = previous?.until && previous.until > now ? Number(previous.count || 0) : 0;
    if (count >= 5) return false;
    const value = { count: count + 1, until: count ? previous!.until! : now + 15 * 60 * 1000 };
    await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return true;
  });
  if (!allowed) return NextResponse.json({ error: "Troppi tentativi. Riprova fra 15 minuti." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: "Inserisci il PIN amministratore completo (4–6 cifre)." }, { status: 400 });
  const user = await prisma.user.findFirst({
    where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] }, pin_lookup: pinLookup(pin) },
    select: { id: true, pin_hash: true, must_change_password: true },
  });
  if (!user?.pin_hash || user.must_change_password || !(await bcrypt.compare(pin, user.pin_hash))) {
    return NextResponse.json({ error: "Accesso non riuscito. Verifica il PIN e l’account amministratore." }, { status: 403 });
  }
  const session = await createMobileSession(user.id, `ios-salon:${device.code}`, 15 * 60 * 1000);
  await prisma.setting.deleteMany({ where: { key: `ios_admin_attempts:${device.code}` } });
  return NextResponse.json({ token: session.token, expiresAt: session.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
