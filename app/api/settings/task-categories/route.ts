import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const defaultCategories = ["Operativa", "Sala", "Reception", "Bar", "Cucina", "Pulizia", "Magazzino", "Clienti"];

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: "task_categories" } });
  return NextResponse.json({ categories: Array.isArray(setting?.value) ? setting.value : defaultCategories });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const payload = await request.json();
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map((item: unknown) => String(item).trim()).filter(Boolean)
    : defaultCategories;
  const unique = Array.from(new Set(categories));
  const value = unique as Prisma.InputJsonValue;
  await prisma.setting.upsert({
    where: { key: "task_categories" },
    create: { key: "task_categories", value },
    update: { value },
  });
  return NextResponse.json({ categories: unique });
}
