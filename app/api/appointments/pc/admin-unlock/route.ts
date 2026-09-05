import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  appointmentsPcCookieName,
  checkPCAuthorization,
} from "@/lib/appointments-pc-auth";
import { appointmentSalonUrl, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ZERO", "SUPER_ADMIN", "ADMIN"] as const;

export async function POST(request: NextRequest) {
  const pcAuth = await checkPCAuthorization(
    request.cookies.get(appointmentsPcCookieName)?.value,
  );

  if (!pcAuth) {
    return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.replace(/\D/g, "").slice(0, 6) : "";
  const salone = normalizeAppointmentSalonSlug(body?.salone);

  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "Inserisci il PIN amministratore completo." },
      { status: 400 },
    );
  }

  const lookup = pinLookup(pin);
  let administrator = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: [...ADMIN_ROLES] },
      pin_lookup: lookup,
    },
    select: { id: true, name: true, role: true },
  });

  if (!administrator) {
    const candidates = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: [...ADMIN_ROLES] },
        pin_hash: { not: null },
      },
      select: { id: true, name: true, role: true, pin_hash: true },
    });

    for (const candidate of candidates) {
      if (!candidate.pin_hash || !(await bcrypt.compare(pin, candidate.pin_hash))) continue;
      administrator = {
        id: candidate.id,
        name: candidate.name,
        role: candidate.role,
      };
      await prisma.user
        .update({ where: { id: candidate.id }, data: { pin_lookup: lookup } })
        .catch(() => null);
      break;
    }
  }

  if (!administrator) {
    return NextResponse.json(
      { error: "PIN amministratore non riconosciuto." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    success: true,
    administratorName: administrator.name,
    appointmentUrl: `${appointmentSalonUrl(salone)}?worker=${encodeURIComponent(administrator.name)}`,
  });
}
