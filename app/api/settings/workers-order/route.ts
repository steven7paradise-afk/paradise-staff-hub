import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManage(role?: string) {
  return role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: "schedules_workers_order" } });
  return NextResponse.json(Array.isArray(setting?.value) ? setting.value : []);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const value = Array.isArray(payload) ? payload : [];
  
  await prisma.setting.upsert({
    where: { key: "schedules_workers_order" },
    create: { key: "schedules_workers_order", value },
    update: { value },
  });

  return NextResponse.json(value);
}
