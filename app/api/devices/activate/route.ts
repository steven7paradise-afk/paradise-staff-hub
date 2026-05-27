import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashTabletToken, newTabletToken, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const token = String(data.token ?? "");
  const ip = requestIp(request.headers);
  if (!token || !ip) {
    return NextResponse.json({ error: "Link non valido o informazioni dispositivo non disponibili." }, { status: 400 });
  }

  const device = await prisma.device.findFirst({
    where: {
      enrollment_token_hash: hashTabletToken(token),
      enrollment_expires_at: { gt: new Date() },
      archived_at: null,
    },
  });
  if (!device) {
    return NextResponse.json({ error: "Il link non e valido, e scaduto o e gia stato usato." }, { status: 410 });
  }

  const accessToken = newTabletToken();
  const activated = await prisma.device.update({
    where: { id: device.id },
    data: {
      status: "ACTIVE",
      registered_ip: ip,
      access_token_hash: hashTabletToken(accessToken),
      activated_at: new Date(),
      enrollment_token_hash: null,
      enrollment_expires_at: null,
    },
  });
  const response = NextResponse.json({ deviceId: activated.device_id });
  response.cookies.set(tabletCookieName, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set(tabletDeviceCookieName, activated.device_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
