import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const id = payload.id ? String(payload.id) : "";
  await prisma.notification.updateMany({
    where: { user_id: auth.user.id, read: false, ...(id ? { id } : {}) },
    data: { read: true },
  });
  return NextResponse.json({ success: true });
}
