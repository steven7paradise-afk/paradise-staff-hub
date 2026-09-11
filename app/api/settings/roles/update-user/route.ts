import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { normalizeAccessRoutes } from "@/lib/roles";

function normalizeAccessList(value: unknown) {
  if (value === null) return null;
  if (Array.isArray(value)) return normalizeAccessRoutes(value);
  if (value && typeof value === "object") {
    const raw = value as { view?: unknown; edit?: unknown };
    return {
      view: normalizeAccessRoutes(raw.view),
      edit: normalizeAccessRoutes(raw.edit),
    };
  }
  return value;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ZERO" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato. Solo gli Admin possono modificare mansioni e dati ruolo." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, role, mansione, accessList } = body;

    if (!userId) {
      return NextResponse.json({ error: "ID utente mancante." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!existingUser) {
      return NextResponse.json({ error: "Persona non trovata." }, { status: 404 });
    }

    const updateData: any = {};
    if (role) {
      if (session.user.role !== "ZERO") {
        return NextResponse.json({ error: "Solo Zero puo assegnare o modificare i ruoli di sistema." }, { status: 403 });
      }
      if (!Object.values(UserRole).includes(role)) {
        return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
      }
      if (role === "ZERO") {
        return NextResponse.json({ error: "Il ruolo Zero non si assegna dal pannello." }, { status: 403 });
      }
      if (existingUser.role === "ZERO") {
        return NextResponse.json({ error: "Il ruolo Zero è protetto e non può essere spostato." }, { status: 403 });
      }
      updateData.role = role;
    }
    if (mansione !== undefined) {
      updateData.mansione = mansione;
    }
    if (accessList !== undefined) {
      updateData.access_list = normalizeAccessList(accessList);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        role: true,
        mansione: true,
        access_list: true,
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error("Error updating user role/mansione:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
