import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Compatibility endpoint for older clients: communications are marked as read,
 * but the discontinued points system no longer grants a balance.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  const updated = await prisma.notification.updateMany({
    where: { id, user_id: session.user.id, type: "COMUNICAZIONE" },
    data: { read: true },
  });

  if (updated.count !== 1) {
    return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });
  }

  return NextResponse.json({ success: true, pointsAwarded: 0 });
}
