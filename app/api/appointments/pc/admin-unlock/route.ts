import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  appointmentSalonForPC,
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  checkPCAuthorization,
} from "@/lib/appointments-pc-auth";
import { appointmentSalonUrl } from "@/lib/appointment-salon-url";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
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

  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "Inserisci il PIN amministratore completo." },
      { status: 400 },
    );
  }

  const lookup = pinLookup(pin);
  const administratorFilter = { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, role: { in: [...ADMIN_ROLES] } };
  const select = { id: true, name: true, pin_hash: true } as const;
  const indexedAdministrator = await prisma.user.findFirst({
    where: { ...administratorFilter, pin_lookup: lookup },
    select,
  });
  let administrator = indexedAdministrator?.pin_hash && await bcrypt.compare(pin, indexedAdministrator.pin_hash)
    ? indexedAdministrator : null;

  if (!indexedAdministrator) {
    const candidates = await prisma.user.findMany({
      where: { ...administratorFilter, pin_hash: { not: null } },
      select,
    });

    for (const candidate of candidates) {
      if (!candidate.pin_hash || !(await bcrypt.compare(pin, candidate.pin_hash))) continue;
      await prisma.user.update({ where: { id: candidate.id }, data: { pin_lookup: lookup } });
      administrator = candidate;
      break;
    }
  }

  if (!administrator) {
    return NextResponse.json(
      { error: "PIN amministratore non riconosciuto." },
      { status: 403 },
    );
  }

  const salon = await appointmentSalonForPC(pcAuth.locationId);
  if (!salon) {
    return NextResponse.json({ error: "La sede di questo PC non è disponibile." }, { status: 409 });
  }
  const response = NextResponse.json({
    success: true,
    administratorName: administrator.name,
    appointmentUrl: appointmentSalonUrl(salon),
  }, { headers: { "Cache-Control": "private, no-store" } });
  // The authenticated administrator uses Auth.js, never the previous five-minute operator session.
  response.cookies.set(appointmentsPcWorkerCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
