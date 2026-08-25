import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_SETTINGS_KEY, DEFAULT_DASHBOARD_SETTINGS } from "@/lib/dashboard-settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: DASHBOARD_SETTINGS_KEY }
    });

    if (!setting) {
      return NextResponse.json(DEFAULT_DASHBOARD_SETTINGS);
    }

    const val = setting.value as any;
    return NextResponse.json({
      salonGoal: Number(val?.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal,
      workerGoal: Number(val?.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal,
      workerBonusMap: val?.workerBonusMap && typeof val.workerBonusMap === "object" ? val.workerBonusMap : {},
      promos: Array.isArray(val?.promos) ? val.promos : DEFAULT_DASHBOARD_SETTINGS.promos,
      sideCard1: val?.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1,
      sideCard2: val?.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2,
      productOfMonth: val?.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth,
      communications: Array.isArray(val?.communications) ? val.communications : DEFAULT_DASHBOARD_SETTINGS.communications,
    });
  } catch (error: any) {
    console.error("Failed to load dashboard settings:", error);
    return NextResponse.json(DEFAULT_DASHBOARD_SETTINGS);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true }
  });

  const role = dbUser?.role || session.user.role;
  if (role !== "ZERO" && role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
  }

  try {
    const body = await req.json();
    
    const cleanSettings = {
      salonGoal: Math.max(1, Number(body.salonGoal) || DEFAULT_DASHBOARD_SETTINGS.salonGoal),
      workerGoal: Math.max(1, Number(body.workerGoal) || DEFAULT_DASHBOARD_SETTINGS.workerGoal),
      workerBonusMap: body.workerBonusMap && typeof body.workerBonusMap === "object" ? body.workerBonusMap : {},
      promos: Array.isArray(body.promos) ? body.promos : DEFAULT_DASHBOARD_SETTINGS.promos,
      sideCard1: body.sideCard1 || DEFAULT_DASHBOARD_SETTINGS.sideCard1,
      sideCard2: body.sideCard2 || DEFAULT_DASHBOARD_SETTINGS.sideCard2,
      productOfMonth: body.productOfMonth || DEFAULT_DASHBOARD_SETTINGS.productOfMonth,
      communications: Array.isArray(body.communications) ? body.communications : DEFAULT_DASHBOARD_SETTINGS.communications,
    };

    const setting = await prisma.setting.upsert({
      where: { key: DASHBOARD_SETTINGS_KEY },
      create: {
        key: DASHBOARD_SETTINGS_KEY,
        value: cleanSettings,
      },
      update: {
        value: cleanSettings,
      }
    });

    // Revalidate paths so changes show instantly
    try {
      revalidatePath("/dashboard");
      revalidatePath("/settings/dashboard");
      revalidatePath("/", "layout");
    } catch (revalError) {
      console.warn("Revalidation warning:", revalError);
    }

    return NextResponse.json({ success: true, settings: setting.value });
  } catch (error: any) {
    console.error("Failed to save dashboard settings:", error);
    return NextResponse.json({ error: error.message || "Errore durante il salvataggio" }, { status: 500 });
  }
}
