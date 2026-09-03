import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeShiftResponsibleQuestions, SHIFT_RESPONSIBLE_QUESTIONS_KEY } from "@/lib/shift-responsible-questions";

const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const questions = normalizeShiftResponsibleQuestions(await request.json().catch(() => null));
  await prisma.setting.upsert({
    where: { key: SHIFT_RESPONSIBLE_QUESTIONS_KEY },
    create: { key: SHIFT_RESPONSIBLE_QUESTIONS_KEY, value: questions },
    update: { value: questions },
  });
  return NextResponse.json(questions);
}
