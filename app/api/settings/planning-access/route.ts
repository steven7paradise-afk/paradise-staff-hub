import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";
import { prisma } from "@/lib/prisma";

function canManage(role?: string) {
  return role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: PLANNING_ACCESS_KEY } });
  return NextResponse.json(normalizePlanningAccess(setting?.value));
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const value = normalizePlanningAccess(payload);
  await prisma.setting.upsert({
    where: { key: PLANNING_ACCESS_KEY },
    create: { key: PLANNING_ACCESS_KEY, value },
    update: { value },
  });

  return NextResponse.json(value);
}
