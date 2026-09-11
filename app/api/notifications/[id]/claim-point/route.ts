import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/lib/dashboard-settings";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const newPoints = await prisma.$transaction(async (tx) => {
      const claimed = await tx.notification.updateMany({
        where: {
          id,
          user_id: session.user.id,
          read: false,
          type: "COMUNICAZIONE",
        },
        data: { read: true },
      });
      if (claimed.count !== 1) return null;

      await tx.setting.upsert({
        where: { key: DASHBOARD_SETTINGS_KEY },
        create: { key: DASHBOARD_SETTINGS_KEY, value: DEFAULT_DASHBOARD_SETTINGS },
        update: {},
      });
      const lockedRows = await tx.$queryRaw<Array<{ value: unknown }>>`
        SELECT value FROM settings WHERE key = ${DASHBOARD_SETTINGS_KEY} FOR UPDATE
      `;
      const currentVal = lockedRows[0]?.value && typeof lockedRows[0].value === "object"
        ? lockedRows[0].value as Record<string, any>
        : { ...DEFAULT_DASHBOARD_SETTINGS };
      const workerBonusMap = currentVal.workerBonusMap && typeof currentVal.workerBonusMap === "object"
        ? { ...currentVal.workerBonusMap }
        : {};
      const userBonusRecord = workerBonusMap[session.user.id] || { manualBonusPoints: 0, redeemedPoints: 0 };
      userBonusRecord.manualBonusPoints = (Number(userBonusRecord.manualBonusPoints) || 0) + 1;
      workerBonusMap[session.user.id] = userBonusRecord;

      await tx.setting.update({
        where: { key: DASHBOARD_SETTINGS_KEY },
        data: {
          value: {
            ...DEFAULT_DASHBOARD_SETTINGS,
            ...currentVal,
            salonGoal: Number(currentVal.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal,
            workerGoal: Number(currentVal.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal,
            workerBonusMap,
          },
        },
      });
      return userBonusRecord.manualBonusPoints;
    });

    if (newPoints === null) {
      return NextResponse.json(
        { error: "Notifica non trovata, già letta o non valida" },
        { status: 404 }
      );
    }

    // Revalidate dashboard path
    try {
      revalidatePath("/dashboard");
      revalidatePath("/profile");
      revalidatePath("/settings/dashboard");
      revalidatePath("/", "layout");
    } catch (e) {
      console.warn("Revalidation warning in claim-point:", e);
    }

    return NextResponse.json({ success: true, newPoints });
  } catch (error: any) {
    console.error("Failed to claim notification point:", error);
    return NextResponse.json(
      { error: error.message || "Errore durante l'accredito dei punti" },
      { status: 500 }
    );
  }
}
