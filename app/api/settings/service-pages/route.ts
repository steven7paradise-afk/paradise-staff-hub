import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const locationId = String(payload.locationId ?? "");
  const page = Math.min(3, Math.max(1, Number(payload.page ?? 1) || 1));
  const customName = String(payload.customName ?? "");
  const customIcon = String(payload.customIcon ?? "");
  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });
  if (!location) return NextResponse.json({ error: "Salone non valido." }, { status: 400 });

  const setting = await prisma.setting.upsert({
    where: { key: `service_page:${locationId}` },
    update: { value: { page, customName, customIcon } },
    create: { key: `service_page:${locationId}`, value: { page, customName, customIcon } },
  });

  let savedPage = page;
  let savedName = customName;
  let savedIcon = customIcon;

  if (setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)) {
    const valObj = setting.value as any;
    savedPage = Number(valObj.page) || page;
    savedName = String(valObj.customName || "");
    savedIcon = String(valObj.customIcon || "");
  }

  return NextResponse.json({ locationId, page: savedPage, customName: savedName, customIcon: savedIcon });
}
