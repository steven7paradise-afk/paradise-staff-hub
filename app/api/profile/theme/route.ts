import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    
    let header_color: string | null = null;
    let sidebar_color: string | null = null;

    if (payload.headerColor !== undefined) {
      if (payload.headerColor === null) {
        header_color = null;
      } else {
        const trimmed = String(payload.headerColor).trim();
        if (trimmed === "") {
          header_color = null;
        } else {
          if (!hexRegex.test(trimmed)) {
            return NextResponse.json({ error: "Colore header non valido. Deve essere in formato Hex (es. #C66170)." }, { status: 400 });
          }
          header_color = trimmed;
        }
      }
    } else {
      // If not provided in payload, keep existing value
      const existing = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { header_color: true }
      });
      header_color = existing?.header_color ?? null;
    }

    if (payload.sidebarColor !== undefined) {
      if (payload.sidebarColor === null) {
        sidebar_color = null;
      } else {
        const trimmed = String(payload.sidebarColor).trim();
        if (trimmed === "") {
          sidebar_color = null;
        } else {
          if (!hexRegex.test(trimmed)) {
            return NextResponse.json({ error: "Colore sidebar non valido. Deve essere in formato Hex (es. #1F1F1F)." }, { status: 400 });
          }
          sidebar_color = trimmed;
        }
      }
    } else {
      // If not provided in payload, keep existing value
      const existing = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { sidebar_color: true }
      });
      sidebar_color = existing?.sidebar_color ?? null;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        header_color,
        sidebar_color,
      },
    });

    return NextResponse.json({ success: true, headerColor: header_color, sidebarColor: sidebar_color });
  } catch (error) {
    return NextResponse.json({ error: "Impossibile aggiornare i colori del tema." }, { status: 500 });
  }
}
