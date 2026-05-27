import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }

  const payload = await request.json();
  const current = await prisma.brandingSetting.findFirst();
  const data = {
    primary_color: String(payload.primary_color ?? "#FFA8DD"),
    secondary_color: String(payload.secondary_color ?? "#FFD6EA"),
    background_color: String(payload.background_color ?? "#F7E9EF"),
    sidebar_color: String(payload.sidebar_color ?? "#FFFFFF"),
    button_color: String(payload.button_color ?? "#FFA8DD"),
    card_color: String(payload.card_color ?? "#FFFFFF"),
    text_color: String(payload.text_color ?? "#1F1F1F"),
    gradient_color: String(payload.gradient_color ?? "#E8C98B"),
    logo_url: payload.logo_url ? String(payload.logo_url) : null,
  };

  const branding = current
    ? await prisma.brandingSetting.update({ where: { id: current.id }, data })
    : await prisma.brandingSetting.create({ data });

  revalidateTag("branding", "max");
  return NextResponse.json(branding);
}
