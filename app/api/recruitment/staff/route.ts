import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
      },
      include: {
        location: true,
        manager: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    return NextResponse.json({ error: "Errore durante il recupero dello staff" }, { status: 500 });
  }
}
