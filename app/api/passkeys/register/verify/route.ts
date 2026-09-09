import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { credentialIdToString, takeChallenge } from "@/lib/passkey";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Accedi prima di registrare questo telefono." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) {
    return NextResponse.json({ error: "Profilo non disponibile." }, { status: 403 });
  }

  const challenge = await takeChallenge({ purpose: "REGISTER", userId: user.id });
  if (!challenge) {
    return NextResponse.json({ error: "Richiesta scaduta. Avvia nuovamente la registrazione." }, { status: 400 });
  }

  const payload = (await request.json()) as { response?: RegistrationResponseJSON; label?: string };
  if (!payload.response) {
    return NextResponse.json({ error: "Risposta Face ID mancante." }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: payload.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rp_id,
      requireUserVerification: true,
    });
    const info = verification.registrationInfo;
    if (!verification.verified || !info?.userVerified) {
      return NextResponse.json({ error: "Face ID non verificato." }, { status: 400 });
    }

    const credentialId = credentialIdToString(info.credentialID);
    await prisma.webAuthnCredential.upsert({
      where: { credential_id: credentialId },
      create: {
        user_id: user.id,
        credential_id: credentialId,
        public_key: Buffer.from(info.credentialPublicKey),
        counter: BigInt(info.counter),
        transports: payload.response.response.transports ?? [],
        device_type: info.credentialDeviceType,
        backed_up: info.credentialBackedUp,
        label: String(payload.label || "Dispositivo personale").slice(0, 80),
      },
      update: {
        public_key: Buffer.from(info.credentialPublicKey),
        counter: BigInt(info.counter),
        transports: payload.response.response.transports ?? [],
        device_type: info.credentialDeviceType,
        backed_up: info.credentialBackedUp,
        last_used_at: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: "Accesso biometrico registrato su questo dispositivo." });
  } catch {
    return NextResponse.json({ error: "Non è stato possibile verificare Face ID." }, { status: 400 });
  }
}
