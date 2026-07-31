import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  const name = String(payload.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Il nome del salone e obbligatorio." }, { status: 400 });
  }

  const existing = await prisma.location.findFirst({
    where: { id: { not: id }, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esiste gia un altro salone con questo nome." }, { status: 409 });
  }

  const location = await prisma.location.update({
    where: { id },
    data: {
      name,
      address: String(payload.address ?? "").trim() || null,
      phone: String(payload.phone ?? "").trim() || null,
      opening_time: String(payload.openingTime ?? "").trim() || null,
      closing_time: String(payload.closingTime ?? "").trim() || null,
      active: Boolean(payload.active ?? true),
    },
  });

  return NextResponse.json(location);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const location = await prisma.location.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json(location);
}
