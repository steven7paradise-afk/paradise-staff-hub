import { pinLookup } from "@/lib/pin";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS, hasFormerEmployeeDocumentAccess } from "@/lib/former-employee";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ expired: false });

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const pin = String(body.pin ?? "").trim();
  if (body.passkeyToken || (pin ? !/^\d{4,6}$/.test(pin) : !email || !password)) return NextResponse.json({ expired: false });
  const user = await prisma.user.findUnique({ where: pin ? { pin_lookup: pinLookup(pin) } : { email } });
  const credentialsValid = user && (pin ? Boolean(user.pin_hash) && await bcrypt.compare(pin, user.pin_hash!) : await bcrypt.compare(password, user.password_hash));
  if (!credentialsValid || user.employee_status !== FORMER_EMPLOYEE_STATUS) {
    return NextResponse.json({ expired: false });
  }

  return NextResponse.json({
    expired: !hasFormerEmployeeDocumentAccess(user.workforce_data, user.last_edited_at),
  });
}
