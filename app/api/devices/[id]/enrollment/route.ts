import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { hashTabletToken, newTabletToken } from "@/lib/tablet-auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ZERO") {
    return NextResponse.json({ error: "Solo Super Admin" }, { status: 403 });
  }
  const { id } = await context.params;
  const device = await prisma.device.findFirst({
    where: { id, archived_at: null, NOT: { device_id: { startsWith: "ADMIN-MANUAL-" } } },
  });
  if (!device) {
    return NextResponse.json({ error: "Tablet non trovato." }, { status: 404 });
  }

  const token = newTabletToken();
  await prisma.device.update({
    where: { id },
    data: {
      enrollment_token_hash: hashTabletToken(token),
      enrollment_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return NextResponse.json({
    activationUrl: buildPublicAppUrl(`/tablet-clock/activate?token=${token}`),
  });
}
