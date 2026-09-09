import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { credentialIdFromString, isAdminRole, replaceChallenge, webAuthnRequestConfig } from "@/lib/passkey";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Registrazione Face ID riservata agli amministratori." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { webauthn_credentials: true },
  });
  if (!user?.active || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Profilo amministratore non disponibile." }, { status: 403 });
  }

  const { rpID, origin } = webAuthnRequestConfig(request);
  const options = await generateRegistrationOptions({
    rpName: "Paradise Staff Hub",
    rpID,
    userID: user.id,
    userName: user.email,
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

  await replaceChallenge({
    challenge: options.challenge,
    purpose: "REGISTER",
    userId: user.id,
    rpID,
    origin,
  });

  return NextResponse.json({ options, existingCount: user.webauthn_credentials.length });
}
