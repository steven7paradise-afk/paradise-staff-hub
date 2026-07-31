import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { hashTabletToken, newTabletToken } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ZERO") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const data = await request.json();
  const name = String(data.name ?? "").trim();
  const locationId = String(data.locationId ?? "");
  if (!name || !locationId) {
    return NextResponse.json({ error: "Nome tablet e salone sono obbligatori." }, { status: 400 });
  }
  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });
  if (!location) {
    return NextResponse.json({ error: "Seleziona un salone attivo." }, { status: 400 });
  }

  const token = newTabletToken();
  const deviceId = `PB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const device = await prisma.device.create({
    data: {
      device_id: deviceId,
      device_name: name,
      location_id: locationId,
      status: "BLOCKED",
      enrollment_token_hash: hashTabletToken(token),
      enrollment_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    include: { location: true },
  });
  return NextResponse.json({
    id: device.id,
    deviceId: device.device_id,
    name: device.device_name,
    location: device.location.name,
    status: device.status,
    lastUsed: device.last_used_at?.toISOString() ?? null,
    registeredIp: device.registered_ip,
    activatedAt: device.activated_at?.toISOString() ?? null,
    activationUrl: buildPublicAppUrl(`/tablet-clock/activate?token=${token}`),
  });
}
