import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeAccessRoutes } from "@/lib/roles";

type MansionePermissionSet = {
  view: string[];
  edit: string[];
};

type MansioniPermissionsMap = Record<string, MansionePermissionSet>;

function normalizePermissionSet(value: unknown): MansionePermissionSet {
  if (Array.isArray(value)) {
    return {
      view: normalizeAccessRoutes(value),
      edit: [],
    };
  }

  if (value && typeof value === "object") {
    const raw = value as { view?: unknown; edit?: unknown };
    return {
      view: normalizeAccessRoutes(raw.view),
      edit: normalizeAccessRoutes(raw.edit),
    };
  }

  return { view: [], edit: [] };
}

function normalizePermissionsMap(value: unknown): MansioniPermissionsMap {
  const rawMap = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return Object.fromEntries(
    Object.entries(rawMap).map(([mansione, permissions]) => [
      mansione,
      normalizePermissionSet(permissions),
    ])
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ZERO" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { active: true, NOT: { mansione: null } },
      select: { mansione: true }
    });

    const dbMansioni = Array.from(new Set(users.map(u => String(u.mansione || "").trim().toLowerCase()).filter(Boolean)));

    const setting = await prisma.setting.findUnique({
      where: { key: "mansioni_permissions" }
    });

    let currentMap = normalizePermissionsMap(setting?.value);

    let changed = false;
    dbMansioni.forEach(m => {
      if (!currentMap[m]) {
        currentMap[m] = { view: [], edit: [] };
        changed = true;
      }
    });

    if (changed) {
      await prisma.setting.upsert({
        where: { key: "mansioni_permissions" },
        update: { value: currentMap },
        create: {
          key: "mansioni_permissions",
          value: currentMap
        }
      });
    }

    return NextResponse.json({
      success: true,
      mansioni: currentMap
    });
  } catch (err: any) {
    console.error("Error reading mansioni permissions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ZERO" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorizzato. Solo gli Admin e Super Admin possono configurare i permessi delle mansioni." }, { status: 403 });
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

    let currentMap = normalizePermissionsMap(currentSetting?.value);

    const cleanName = String(mansioneName || "").trim().toLowerCase();

    if (action === "save") {
      if (!cleanName) {
        return NextResponse.json({ error: "Nome mansione mancante." }, { status: 400 });
      }
      currentMap[cleanName] = normalizePermissionSet(accessList);
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
