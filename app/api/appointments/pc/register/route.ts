import { NextRequest, NextResponse } from "next/server";
import { activatePC, appointmentsPcCookieName, appointmentsPcWorkerCookieName } from "@/lib/appointments-pc-auth";
import { appointmentSalonSlugFromName, appointmentSalonUrl } from "@/lib/appointment-salon-url";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Codice di attivazione mancante." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const result = await activatePC(code, ip);
    const location = await prisma.location.findUnique({
      where: { id: result.locationId },
      select: { name: true },
    });
    const salonSlug = appointmentSalonSlugFromName(location?.name);

    const response = NextResponse.json({
      success: true,
      name: result.name,
      locationId: result.locationId,
      appointmentUrl: `${appointmentSalonUrl(salonSlug)}?choose=1`,
    });

    // Set secure long-lived cookie
    response.cookies.set(appointmentsPcCookieName, result.accessToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    response.cookies.delete(appointmentsPcWorkerCookieName);

    return response;
  } catch (error) {
    console.error("Activation API error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Errore durante l'attivazione." 
    }, { status: 500 });
  }
}
