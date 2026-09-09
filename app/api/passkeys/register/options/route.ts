import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPasskeyLoginFlowId,
  credentialIdFromString,
  passkeyRegistrationChallengeDeviceId,
  passkeyRegistrationCookieName,
  replaceChallenge,
  webAuthnRequestConfig,
} from "@/lib/passkey";
import { pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Accedi prima di registrare questo telefono." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { pin?: string } | null;
  const pin = String(body?.pin || "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Inserisci il tuo PIN personale di 4-6 cifre." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { pin_lookup: pinLookup(pin) },
    include: { webauthn_credentials: true },
  });
  if (!user?.active) {
    return NextResponse.json({ error: "PIN personale non riconosciuto." }, { status: 403 });
  }

  const { rpID, origin } = webAuthnRequestConfig(request);
  const options = await generateRegistrationOptions({
    rpName: "Paradise Staff Hub",
    rpID,
    userID: user.id,
    userName: user.name,
    userDisplayName: user.name,
    attestationType: "none",
    timeout: 60_000,
    excludeCredentials: user.webauthn_credentials.map((credential) => ({
      id: credentialIdFromString(credential.credential_id),
      type: "public-key",
      transports: credential.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });

  const registrationFlowId = createPasskeyLoginFlowId();
  await replaceChallenge({
    challenge: options.challenge,
    purpose: "REGISTER",
    userId: user.id,
    deviceId: passkeyRegistrationChallengeDeviceId(registrationFlowId),
    rpID,
    origin,
  });

  const response = NextResponse.json({
    options,
    employeeName: user.name,
    existingCount: user.webauthn_credentials.length,
  });
  response.cookies.set(passkeyRegistrationCookieName, registrationFlowId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 5 * 60,
  });
  return response;
}
