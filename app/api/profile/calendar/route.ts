import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowed = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowed.has(session.user.role)) {
    return NextResponse.json({ error: "Solo Admin e Super Admin" }, { status: 403 });
  }

  const payload = await request.json();
  const enabled = Boolean(payload.enabled);
  const calendarId = String(payload.calendarId ?? "").trim();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      google_calendar_sync: enabled,
      google_calendar_id: calendarId || null,
    },
  });

  return NextResponse.json({ success: true });
}
