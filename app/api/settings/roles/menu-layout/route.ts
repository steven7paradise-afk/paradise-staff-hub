import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ZERO" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "sidebar_configuration" }
    });

    return NextResponse.json({
      success: true,
      layout: setting ? setting.value : null
    });
  } catch (err: any) {
    console.error("Error reading sidebar configuration:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ZERO" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato. Solo gli Admin e Super Admin possono modificare il layout della sidebar." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { layout } = body;

    const isScopedLayout =
      layout &&
      typeof layout === "object" &&
      !Array.isArray(layout) &&
      (Array.isArray(layout.default) || (layout.targets && typeof layout.targets === "object"));

    if (!Array.isArray(layout) && !isScopedLayout) {
      return NextResponse.json({ error: "Il layout inviato non è valido." }, { status: 400 });
    }

    // Save configuration to DB
    const updatedSetting = await prisma.setting.upsert({
      where: { key: "sidebar_configuration" },
      update: { value: layout },
      create: {
        key: "sidebar_configuration",
        value: layout
      }
    });

    return NextResponse.json({
      success: true,
      layout: updatedSetting.value
    });
  } catch (err: any) {
    console.error("Error updating sidebar configuration:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
