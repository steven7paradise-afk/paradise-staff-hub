import { DeviceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const data = await request.json();
  const status = String(data.status ?? "") as DeviceStatus;
  if (!Object.values(DeviceStatus).includes(status)) {
    return NextResponse.json({ error: "Stato tablet non valido." }, { status: 400 });
  }
  const { id } = await context.params;
  if (status === "ACTIVE") {
    const stored = await prisma.device.findUnique({ where: { id }, select: { access_token_hash: true, registered_ip: true, archived_at: true } });
    if (stored?.archived_at) {
      return NextResponse.json({ error: "Tablet eliminato. Crea un nuovo dispositivo." }, { status: 409 });
    }
    if (!stored?.access_token_hash || !stored.registered_ip) {
      return NextResponse.json({ error: "Apri prima il link di attivazione sul tablet." }, { status: 409 });
    }
  }
  const device = await prisma.device.update({ where: { id }, data: { status } });
  return NextResponse.json({ id: device.id, status: device.status });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const { id } = await context.params;
  const device = await prisma.device.findUnique({ where: { id }, select: { device_id: true } });
  if (!device || device.device_id.startsWith("ADMIN-MANUAL-")) {
    return NextResponse.json({ error: "Tablet non trovato." }, { status: 404 });
  }
  await prisma.device.update({
    where: { id },
    data: {
      status: "BLOCKED",
      archived_at: new Date(),
      access_token_hash: null,
      enrollment_token_hash: null,
      enrollment_expires_at: null,
    },
  });
  return NextResponse.json({ ok: true });
}
