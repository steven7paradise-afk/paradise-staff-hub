import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, hashTabletToken, newTabletToken, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";

function reply(body: { deviceId: string } | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const deviceId = request.cookies.get(tabletDeviceCookieName)?.value;
  const accessToken = request.cookies.get(tabletCookieName)?.value;
  if (!deviceId || !accessToken) {
    return reply({ error: "Il browser non ha conservato l’autorizzazione. Consenti i cookie e usa lo stesso browser del tablet per l’attivazione e la timbratura." }, 401);
  }

  try {
    const device = await authorizedTablet(deviceId, accessToken, requestIp(request.headers));
    if (!device) {
      return reply({ error: "Autorizzazione del tablet non confermata. Verifica di essere sulla stessa rete usata per l’attivazione e riprova." }, 403);
    }
    return reply({ deviceId: device.device_id });
  } catch {
    return reply({ error: "Verifica del tablet temporaneamente non disponibile. Riprova." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => null);
  const token = typeof data?.token === "string" ? data.token : "";
  const ip = requestIp(request.headers);
  if (!/^[a-f0-9]{64}$/.test(token) || !ip) {
    return reply({ error: "Link non valido o informazioni dispositivo non disponibili." }, 400);
  }

  const enrollment = {
    enrollment_token_hash: hashTabletToken(token),
    enrollment_expires_at: { gt: new Date() },
    archived_at: null,
  };
  const unavailableLink = { error: "Il link è scaduto o è già stato usato. Richiedi un nuovo link." };
  try {
    const device = await prisma.device.findFirst({
      where: enrollment,
      select: { id: true, device_id: true },
    });
    if (!device) return reply(unavailableLink, 410);

    const accessToken = newTabletToken();
    const activatedAt = new Date();
    const updated = await prisma.device.updateMany({
      // Consume the link only if it is still valid, including after a concurrent renewal.
      where: { ...enrollment, id: device.id, enrollment_expires_at: { gt: activatedAt } },
      data: {
        status: "ACTIVE",
        registered_ip: ip,
        access_token_hash: hashTabletToken(accessToken),
        activated_at: activatedAt,
        enrollment_token_hash: null,
        enrollment_expires_at: null,
      },
    });
    if (updated.count !== 1) return reply(unavailableLink, 410);

    const response = reply({ deviceId: device.device_id });
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    };
    response.cookies.set(tabletCookieName, accessToken, cookieOptions);
    response.cookies.set(tabletDeviceCookieName, device.device_id, cookieOptions);
    return response;
  } catch {
    return reply({ error: "Attivazione temporaneamente non disponibile. Riapri il link per riprovare." }, 503);
  }
}
