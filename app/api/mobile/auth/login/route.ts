import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMobileSession } from "@/lib/mobile-auth";
import { clearMobileLoginAttempts, mobileLoginAllowed } from "@/lib/mobile-login-limit";
import { FORMER_EMPLOYEE_STATUS, hasFormerEmployeeDocumentAccess } from "@/lib/former-employee";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const deviceName = String(payload.deviceName ?? "");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${forwarded || "unknown"}:${email}`;

  if (!email || !password) {
    return NextResponse.json({ error: "Inserisci email e password." }, { status: 400 });
  }
  if (!mobileLoginAllowed(key)) {
    return NextResponse.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { location: true } });
  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;
  const canAccess = Boolean(
    user?.active &&
    validPassword &&
    (user.employee_status !== FORMER_EMPLOYEE_STATUS || hasFormerEmployeeDocumentAccess(user.workforce_data, user.last_edited_at)),
  );
  if (!user || !canAccess) {
    return NextResponse.json({ error: "Email o password non corretti." }, { status: 401 });
  }

  clearMobileLoginAttempts(key);
  await prisma.mobileSession.deleteMany({
    where: { user_id: user.id, expires_at: { lt: new Date() } },
  }).catch(() => null);
  const session = await createMobileSession(user.id, deviceName);

  return NextResponse.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    requiresPasswordChange: user.must_change_password,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.mansione,
      locationName: user.location?.name ?? null,
      photoURL: user.photo_url,
    },
  });
}
