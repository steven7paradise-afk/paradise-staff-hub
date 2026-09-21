import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const currentPassword = String(payload.currentPassword ?? "");
  const newPassword = String(payload.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "La nuova password deve avere almeno 8 caratteri." }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Scegli una password diversa da quella temporanea." }, { status: 400 });
  }
  if (!(await bcrypt.compare(currentPassword, auth.user.password_hash))) {
    return NextResponse.json({ error: "Password temporanea non corretta." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      password_hash: await bcrypt.hash(newPassword, 12),
      must_change_password: false,
    },
  });
  return NextResponse.json({ success: true });
}
