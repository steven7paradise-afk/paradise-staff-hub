import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const payload = await request.json();
  const currentPassword = String(payload.currentPassword ?? "");
  const newPassword = String(payload.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "La nuova password deve avere almeno 8 caratteri." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password_hash: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    return NextResponse.json({ error: "Password attuale non corretta." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { password_hash: await bcrypt.hash(newPassword, 12) } });
  return NextResponse.json({ success: true });
}
