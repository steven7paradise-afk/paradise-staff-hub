import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import {
  createPasskeyLoginFlowId,
  passkeyLoginChallengeDeviceId,
  passkeyLoginCookieName,
  replaceChallenge,
  webAuthnRequestConfig,
} from "@/lib/passkey";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const isAppLogin = request.headers.get("x-passkey-context") === "app-login";
  const deviceId = request.headers.get("x-device-id") ?? "";
  const device = isAppLogin ? null : await authorizedTablet(
      deviceId,
      request.cookies.get(tabletCookieName)?.value,
      requestIp(request.headers),
    );
  if (!isAppLogin && !device) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 403 });
  }

  const { rpID, origin } = webAuthnRequestConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required",
  });
  const loginFlowId = isAppLogin ? createPasskeyLoginFlowId() : "";
  await replaceChallenge({
    challenge: options.challenge,
    purpose: "AUTHENTICATE",
    deviceId: isAppLogin ? passkeyLoginChallengeDeviceId(loginFlowId) : device!.id,
    rpID,
    origin,
  });

  const response = NextResponse.json(options);
  if (isAppLogin) {
    response.cookies.set(passkeyLoginCookieName, loginFlowId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 5 * 60,
    });
  }
  return response;
}
