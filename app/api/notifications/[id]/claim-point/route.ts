import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/app/api/settings/dashboard/route";

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
    // 1. Find the notification and make sure it is a communication and is unread
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        user_id: session.user.id,
        read: false,
        type: "COMUNICAZIONE",
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notifica non trovata, già letta o non valida" },
        { status: 404 }
      );
    }

    // 2. Mark the notification as read
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    // 3. Load current dashboard settings to award 1 point to the user
    const settingRecord = await prisma.setting.findUnique({
      where: { key: DASHBOARD_SETTINGS_KEY },
    });

    let currentVal = settingRecord ? (settingRecord.value as any) : { ...DEFAULT_DASHBOARD_SETTINGS };

    // Initialize or read fields
    const salonGoal = Number(currentVal?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal;
    const workerGoal = Number(currentVal?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal;
    const workerBonusMap = currentVal?.workerBonusMap && typeof currentVal.workerBonusMap === "object"
      ? { ...currentVal.workerBonusMap }
      : {};

    const userBonusRecord = workerBonusMap[session.user.id] || { manualBonusPoints: 0, redeemedPoints: 0 };
    userBonusRecord.manualBonusPoints = (Number(userBonusRecord.manualBonusPoints) || 0) + 1;

    workerBonusMap[session.user.id] = userBonusRecord;

    const updatedSettings = {
      ...DEFAULT_DASHBOARD_SETTINGS,
      ...currentVal,
      salonGoal,
      workerGoal,
      workerBonusMap,
    };

    await prisma.setting.upsert({
      where: { key: DASHBOARD_SETTINGS_KEY },
      create: {
        key: DASHBOARD_SETTINGS_KEY,
        value: updatedSettings,
      },
      update: {
        value: updatedSettings,
      },
    });

    // Revalidate dashboard path
    try {
      revalidatePath("/dashboard");
      revalidatePath("/profile");
      revalidatePath("/settings/dashboard");
      revalidatePath("/", "layout");
    } catch (e) {
      console.warn("Revalidation warning in claim-point:", e);
    }

    return NextResponse.json({ success: true, newPoints: userBonusRecord.manualBonusPoints });
  } catch (error: any) {
    console.error("Failed to claim notification point:", error);
    return NextResponse.json(
      { error: error.message || "Errore durante l'accredito dei punti" },
      { status: 500 }
    );
  }
}
