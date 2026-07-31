import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();
  const name = String(data.name ?? "").trim();
  const address = String(data.address ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const openingTime = String(data.openingTime ?? "").trim();
  const closingTime = String(data.closingTime ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Il nome del salone e obbligatorio." }, { status: 400 });
  }

  const existing = await prisma.location.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esiste gia un salone con questo nome." }, { status: 409 });
  }

  const location = await prisma.location.create({
    data: {
      name,
      address: address || null,
      phone: phone || null,
      opening_time: openingTime || null,
      closing_time: closingTime || null,
      active: true,
    },
  });

  return NextResponse.json(location, { status: 201 });
}
