import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "tablet_branding" },
    });
    return NextResponse.json(setting?.value || null);
  } catch (error) {
    return NextResponse.json({ error: "Errore nel caricamento delle impostazioni" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const value = {
      logo_url: typeof payload.logo_url === "string" ? payload.logo_url.trim() : "",
      background_color: typeof payload.background_color === "string" ? payload.background_color.trim() : "#fbf7f2",
      card_color: typeof payload.card_color === "string" ? payload.card_color.trim() : "#ffffff",
      text_color: typeof payload.text_color === "string" ? payload.text_color.trim() : "#171717",
      accent_color: typeof payload.accent_color === "string" ? payload.accent_color.trim() : "#a77a49",
      soft_color: typeof payload.soft_color === "string" ? payload.soft_color.trim() : "#f8ddd7",
      button_color: typeof payload.button_color === "string" ? payload.button_color.trim() : "#1c1c1c",
    };

    const setting = await prisma.setting.upsert({
      where: { key: "tablet_branding" },
      create: { key: "tablet_branding", value },
      update: { value },
    });

    return NextResponse.json(setting.value);
  } catch (error) {
    return NextResponse.json({ error: "Errore nel salvataggio delle impostazioni" }, { status: 500 });
  }
}
