import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nfcBadgeHash } from "@/lib/nfc-badge";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

async function manager() {
  const session = await auth();
  return session?.user?.id && allowedRoles.has(session.user.role) ? session.user : null;
}

export async function POST(request: NextRequest) {
  if (!(await manager())) return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const userId = String(payload.userId ?? "");
  let hash: string;
  try { hash = nfcBadgeHash(payload.badgeToken); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tessera non valida" }, { status: 400 }); }

  const worker = await prisma.user.findFirst({
    where: { id: userId, active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, role: { not: "ZERO" } },
    select: { id: true },
  });
  if (!worker) return NextResponse.json({ error: "Lavoratore non disponibile" }, { status: 404 });
  const duplicate = await prisma.user.findFirst({ where: { nfc_badge_hash: hash, id: { not: userId } }, select: { name: true } });
  if (duplicate) return NextResponse.json({ error: `Questa tessera è già associata a ${duplicate.name}.` }, { status: 409 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { nfc_badge_hash: hash, nfc_badge_enabled: true, nfc_badge_enrolled_at: new Date() },
    select: { id: true, nfc_badge_enabled: true, nfc_badge_enrolled_at: true },
  });
  return NextResponse.json({ id: updated.id, enabled: updated.nfc_badge_enabled, enrolledAt: updated.nfc_badge_enrolled_at?.toISOString() });
}

export async function PATCH(request: NextRequest) {
  if (!(await manager())) return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const userId = String(payload.userId ?? "");
  const enabled = payload.enabled === true;
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { nfc_badge_hash: true } });
  if (!existing?.nfc_badge_hash) return NextResponse.json({ error: "Nessuna tessera associata" }, { status: 404 });
  await prisma.user.update({ where: { id: userId }, data: { nfc_badge_enabled: enabled } });
  return NextResponse.json({ id: userId, enabled });
}

export async function DELETE(request: NextRequest) {
  if (!(await manager())) return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const userId = String(payload.userId ?? "");
  await prisma.user.update({
    where: { id: userId },
    data: { nfc_badge_hash: null, nfc_badge_enabled: false, nfc_badge_enrolled_at: null },
  });
  return NextResponse.json({ id: userId, removed: true });
}
