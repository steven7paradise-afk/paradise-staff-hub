import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { replaceChallenge, webAuthnRequestConfig } from "@/lib/passkey";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id") ?? "";
  const device = await authorizedTablet(
    deviceId,
    request.cookies.get(tabletCookieName)?.value,
    requestIp(request.headers),
  );
  if (!device) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 403 });
  }

  const { rpID, origin } = webAuthnRequestConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required",
  });
  await replaceChallenge({
    challenge: options.challenge,
    purpose: "AUTHENTICATE",
    deviceId: device.id,
    rpID,
    origin,
  });

  return NextResponse.json(options);
}
