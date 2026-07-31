import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeServiceFormsVisibility,
  SERVICE_FORMS_VISIBILITY_KEY,
} from "@/lib/service-form-visibility";

function canManage(role?: string) {
  return role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: SERVICE_FORMS_VISIBILITY_KEY } });
  return NextResponse.json(normalizeServiceFormsVisibility(setting?.value));
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const value = normalizeServiceFormsVisibility(await request.json());
  await prisma.setting.upsert({
    where: { key: SERVICE_FORMS_VISIBILITY_KEY },
    create: { key: SERVICE_FORMS_VISIBILITY_KEY, value },
    update: { value },
  });

  return NextResponse.json(value);
}
