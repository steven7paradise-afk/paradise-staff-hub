import { NextRequest, NextResponse } from "next/server";
import { activatePC, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Codice di attivazione mancante." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const result = await activatePC(code, ip);

    const response = NextResponse.json({
      success: true,
      name: result.name,
      locationId: result.locationId,
    });

    // Set secure long-lived cookie
    response.cookies.set(appointmentsPcCookieName, result.accessToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Activation API error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Errore durante l'attivazione." 
    }, { status: 500 });
  }
}
