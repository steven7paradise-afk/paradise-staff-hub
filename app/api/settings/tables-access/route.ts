import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ASSISTANCE_TABLES_ACCESS_KEY,
  normalizeAssistanceTablesAccess,
} from "@/lib/assistance-tables";

function canManage(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_ACCESS_KEY } });
  return NextResponse.json(normalizeAssistanceTablesAccess(setting?.value));
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const value = normalizeAssistanceTablesAccess(payload);
  await prisma.setting.upsert({
    where: { key: ASSISTANCE_TABLES_ACCESS_KEY },
    create: { key: ASSISTANCE_TABLES_ACCESS_KEY, value },
    update: { value },
  });

  return NextResponse.json(value);
}
