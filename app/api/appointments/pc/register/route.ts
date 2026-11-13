import { NextRequest, NextResponse } from "next/server";
import {
  activatePC,
  appointmentSalonForPC,
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  checkPCAuthorization,
  PCActivationError,
} from "@/lib/appointments-pc-auth";
import { appointmentSalonUrl } from "@/lib/appointment-salon-url";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: NextRequest) {
  const isForm = request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded");
  const body = isForm
    ? await request.formData().then((data) => ({ code: data.get("code") })).catch(() => null)
    : await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  try {
    if (!code) throw new PCActivationError("Codice di attivazione mancante.", 400);

    const existingPcAuth = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
    const existingDevice = existingPcAuth?.code === code ? existingPcAuth : null;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const device = existingDevice ?? await activatePC(code, ip);
    const salon = "salon" in device ? device.salon : await appointmentSalonForPC(device.locationId);
    if (!salon) throw new PCActivationError("La sede associata a questo link non è disponibile.", 409);

    const appointmentUrl = `${appointmentSalonUrl(salon)}?choose=1`;
    const response = isForm
      ? new NextResponse(null, { status: 303, headers: { ...headers, Location: appointmentUrl } })
      : NextResponse.json({
          success: true,
          ...(existingDevice ? { alreadyActivated: true } : {}),
          name: device.name,
          locationId: device.locationId,
          appointmentUrl,
        }, { headers });

    if ("accessToken" in device) {
      response.cookies.set(appointmentsPcCookieName, device.accessToken, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
    response.cookies.set(appointmentsPcWorkerCookieName, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return response;
  } catch (error) {
    const knownError = error instanceof PCActivationError;
    if (!knownError) console.error("Errore imprevisto durante l'attivazione del PC Cassa.");
    if (isForm) {
      return new NextResponse(null, {
        status: 303,
        headers: { ...headers, Location: "/appointments/register?activation=retry" },
      });
    }
    return NextResponse.json({
      error: knownError ? error.message : "Errore durante l'attivazione. Riprova.",
    }, { status: knownError ? error.status : 500, headers });
  }
}
