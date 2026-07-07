import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "mansioni_permissions" }
    });

    return NextResponse.json({
      success: true,
      mansioni: setting ? (setting.value as Record<string, string[]>) : {}
    });
  } catch (err: any) {
    console.error("Error reading mansioni permissions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato. Solo i Super Admin possono configurare i permessi delle mansioni." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, mansioneName, accessList } = body;

    if (!action) {
      return NextResponse.json({ error: "Azione mancante." }, { status: 400 });
    }

    // Get current setting or initialize empty
    let currentSetting = await prisma.setting.findUnique({
      where: { key: "mansioni_permissions" }
    });

    let currentMap: Record<string, string[]> = currentSetting 
      ? (currentSetting.value as Record<string, string[]>) 
      : {};

    const cleanName = String(mansioneName || "").trim().toLowerCase();

    if (action === "save") {
      if (!cleanName) {
        return NextResponse.json({ error: "Nome mansione mancante." }, { status: 400 });
      }
      currentMap[cleanName] = Array.isArray(accessList) ? accessList : [];
    } else if (action === "delete") {
      if (!cleanName) {
        return NextResponse.json({ error: "Nome mansione mancante." }, { status: 400 });
      }
      delete currentMap[cleanName];
    } else {
      return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
    }

    // Save back to DB
    const updatedSetting = await prisma.setting.upsert({
      where: { key: "mansioni_permissions" },
      update: { value: currentMap },
      create: {
        key: "mansioni_permissions",
        value: currentMap
      }
    });

    return NextResponse.json({
      success: true,
      mansioni: updatedSetting.value
    });
  } catch (err: any) {
    console.error("Error updating mansioni permissions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
