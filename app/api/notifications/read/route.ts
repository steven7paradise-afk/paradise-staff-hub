import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const id = payload.id ? String(payload.id) : "";
  await prisma.notification.updateMany({
    where: { user_id: session.user.id, read: false, ...(id ? { id } : {}) },
    data: { read: true },
  });
  return NextResponse.json({ success: true });
}
