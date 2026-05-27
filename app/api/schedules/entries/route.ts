import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planningRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !planningRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();
  const userId = String(data.userId ?? "");
  const categoryId = data.categoryId ? String(data.categoryId) : null;
  const date = new Date(String(data.date ?? ""));
  if (!userId || Number.isNaN(date.valueOf())) {
    return NextResponse.json({ error: "Cella planning non valida." }, { status: 400 });
  }

  const worker = await prisma.user.findUnique({ where: { id: userId } });
  if (!worker || (session.user.role === "RESPONSABILE" && worker.sede_id !== session.user.sedeId)) {
    return NextResponse.json({ error: "Personale non disponibile per questa sede." }, { status: 403 });
  }

  if (!categoryId) {
    await prisma.scheduleEntry.deleteMany({ where: { user_id: userId, date } });
    return NextResponse.json({ removed: true });
  }

  const category = await prisma.scheduleCategory.findUnique({ where: { id: categoryId } });
  if (!category?.active) {
    return NextResponse.json({ error: "Categoria non valida." }, { status: 400 });
  }
  if (category.location_id && category.location_id !== worker.sede_id) {
    return NextResponse.json({ error: "Questa categoria appartiene a un altro salone." }, { status: 400 });
  }

  const entry = await prisma.scheduleEntry.upsert({
    where: { user_id_date: { user_id: userId, date } },
    update: { category_id: categoryId, location_id: worker.sede_id },
    create: { user_id: userId, category_id: categoryId, location_id: worker.sede_id, date },
  });
  return NextResponse.json(entry);
}
