import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditForUser } from "@/lib/roles";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const isAuthorized = user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || await canEditForUser(prisma, "/schedules", user));
  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();
  const name = String(data.name ?? "").trim();
  const code = String(data.code ?? "").trim().toUpperCase();
  const locationId = data.locationId ? String(data.locationId) : null;
  if (!name || !code || code.length > 4) {
    return NextResponse.json({ error: "Inserisci nome e codice fino a 4 caratteri." }, { status: 400 });
  }
  if (!locationId) {
    return NextResponse.json({ error: "Seleziona il salone per questa categoria." }, { status: 400 });
  }

  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });
  if (!location) {
    return NextResponse.json({ error: "Salone non valido." }, { status: 400 });
  }

  const existing = await prisma.scheduleCategory.findFirst({ where: { code, location_id: locationId } });
  const payload = {
      name,
      color: String(data.color ?? "#FFA8DD"),
      text_color: String(data.textColor ?? "#1F1F1F"),
      start_time: data.startTime ? String(data.startTime) : null,
      end_time: data.endTime ? String(data.endTime) : null,
      editable_time: Boolean(data.editableTime),
      active: true,
      location_id: locationId,
  };

  const category = existing
    ? await prisma.scheduleCategory.update({ where: { id: existing.id }, data: payload })
    : await prisma.scheduleCategory.create({ data: { ...payload, code } });

  return NextResponse.json({
    id: category.id,
    name: category.name,
    code: category.code,
    color: category.color,
    textColor: category.text_color,
    startTime: category.start_time ?? undefined,
    endTime: category.end_time ?? undefined,
    editableTime: category.editable_time,
    locationId: category.location_id,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const isAuthorized = user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || await canEditForUser(prisma, "/schedules", user));
  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();
  const id = String(data.id ?? "");
  const name = String(data.name ?? "").trim();
  const code = String(data.code ?? "").trim().toUpperCase();
  const locationId = data.locationId ? String(data.locationId) : null;
  if (!id || !name || !code || code.length > 4) {
    return NextResponse.json({ error: "Inserisci nome, codice e categoria valida." }, { status: 400 });
  }
  if (!locationId) {
    return NextResponse.json({ error: "Seleziona il salone per questa categoria." }, { status: 400 });
  }

  const category = await prisma.scheduleCategory.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const duplicate = await prisma.scheduleCategory.findFirst({
    where: { code, location_id: locationId, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Esiste gia una categoria con questo codice nel salone." }, { status: 400 });
  }

  const updated = await prisma.scheduleCategory.update({
    where: { id },
    data: {
      name,
      code,
      color: String(data.color ?? "#FFA8DD"),
      text_color: String(data.textColor ?? "#1F1F1F"),
      start_time: data.startTime ? String(data.startTime) : null,
      end_time: data.endTime ? String(data.endTime) : null,
      editable_time: Boolean(data.editableTime),
      location_id: locationId,
      active: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    code: updated.code,
    color: updated.color,
    textColor: updated.text_color,
    startTime: updated.start_time ?? undefined,
    endTime: updated.end_time ?? undefined,
    editableTime: updated.editable_time,
    locationId: updated.location_id,
  });
}
