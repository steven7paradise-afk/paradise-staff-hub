import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const locationId = String(payload.locationId ?? "");
  const page = Math.min(3, Math.max(1, Number(payload.page ?? 1) || 1));
  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });
  if (!location) return NextResponse.json({ error: "Salone non valido." }, { status: 400 });

  const setting = await prisma.setting.upsert({
    where: { key: `service_page:${locationId}` },
    update: { value: page },
    create: { key: `service_page:${locationId}`, value: page },
  });

  return NextResponse.json({ locationId, page: Number(setting.value) || page });
}
