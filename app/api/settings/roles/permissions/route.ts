import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MANSIONI_PERMISSIONS_SETTING_KEY,
  ROLE_PERMISSIONS_SETTING_KEY,
  normalizeMansionePermissions,
  normalizeRolePermissions,
} from "@/lib/roles";

function canManage(role?: string | null) {
  return role === "ZERO";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato. Solo Zero puo configurare la matrice permessi." }, { status: 403 });
  }

  const [roleSetting, mansioneSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: MANSIONI_PERMISSIONS_SETTING_KEY } }).catch(() => null),
  ]);

  return NextResponse.json({
    success: true,
    rolePermissions: normalizeRolePermissions(roleSetting?.value),
    mansionePermissions: normalizeMansionePermissions(mansioneSetting?.value),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !canManage(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato. Solo Zero puo configurare la matrice permessi." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const rolePermissions = normalizeRolePermissions(body?.rolePermissions);
    const mansionePermissions = normalizeMansionePermissions(body?.mansionePermissions);

    await Promise.all([
      prisma.setting.upsert({
        where: { key: ROLE_PERMISSIONS_SETTING_KEY },
        update: { value: rolePermissions },
        create: { key: ROLE_PERMISSIONS_SETTING_KEY, value: rolePermissions },
      }),
      prisma.setting.upsert({
        where: { key: MANSIONI_PERMISSIONS_SETTING_KEY },
        update: { value: mansionePermissions },
        create: { key: MANSIONI_PERMISSIONS_SETTING_KEY, value: mansionePermissions },
      }),
    ]);

    return NextResponse.json({
      success: true,
      rolePermissions,
      mansionePermissions,
    });
  } catch (err: any) {
    console.error("Error saving role permissions:", err);
    return NextResponse.json({ error: err.message || "Errore durante il salvataggio." }, { status: 500 });
  }
}
