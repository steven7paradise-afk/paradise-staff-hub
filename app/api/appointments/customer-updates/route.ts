import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BOT_UPDATE_SETTING_KEY = "appointment_bot_updates";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const setting = await prisma.setting.findUnique({
    where: { key: BOT_UPDATE_SETTING_KEY },
    select: { value: true },
  });

  const updates =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? setting.value
      : {};

  return NextResponse.json(
    { updates, generatedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
