import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato. Solo i Super Admin possono modificare i ruoli." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, role, mansione, accessList } = body;

    if (!userId) {
      return NextResponse.json({ error: "ID utente mancante." }, { status: 400 });
    }

    const updateData: any = {};
    if (role) {
      if (!Object.values(UserRole).includes(role)) {
        return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
      }
      updateData.role = role;
    }
    if (mansione !== undefined) {
      updateData.mansione = mansione;
    }
    if (accessList !== undefined) {
      updateData.access_list = accessList;
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
