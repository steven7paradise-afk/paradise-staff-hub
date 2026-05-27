import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  await prisma.notification.updateMany({ where: { user_id: session.user.id, read: false }, data: { read: true } });
  return NextResponse.json({ success: true });
}
