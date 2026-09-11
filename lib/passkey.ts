import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES = ["ZERO", "SUPER_ADMIN", "ADMIN"] as const;
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const PASSKEY_GRANT_TTL_MS = 60 * 1000;
export const passkeyLoginCookieName = `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}paradise-passkey-login`;
export const passkeyRegistrationCookieName = `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}paradise-passkey-registration`;

export function isAdminRole(role?: string | null) {
  return ADMIN_ROLES.includes((role ?? "") as (typeof ADMIN_ROLES)[number]);
}

export function canUsePasskeyGrant(role: string | null | undefined, purpose: "ATTENDANCE" | "LOGIN") {
  return purpose === "LOGIN" || isAdminRole(role);
}

export function createPasskeyLoginFlowId() {
  return randomBytes(24).toString("base64url");
}

export function passkeyLoginChallengeDeviceId(flowId: string) {
  return `app-login:${createHash("sha256").update(flowId).digest("hex")}`;
}

export function passkeyRegistrationChallengeDeviceId(flowId: string) {
  return `registration:${createHash("sha256").update(flowId).digest("hex")}`;
}

export function webAuthnRequestConfig(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  const requestOrigin = `${protocol}://${host}`;
  const hostname = host.split(":")[0].toLowerCase();
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN?.replace(/\/$/, "");
  const configuredRpId = process.env.WEBAUTHN_RP_ID?.trim().toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    origin: configuredOrigin || requestOrigin,
    rpID: configuredRpId || (isLocal ? hostname : hostname.replace(/^www\./, "")),
  };
}

export function credentialIdToString(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export function credentialIdFromString(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export async function replaceChallenge(input: {
  challenge: string;
  purpose: "REGISTER" | "AUTHENTICATE";
  userId?: string;
  deviceId?: string;
  rpID: string;
  origin: string;
}) {
  const now = new Date();
  await prisma.$transaction([
    prisma.webAuthnChallenge.deleteMany({
      where: {
        OR: [
          { expires_at: { lte: now } },
          {
            purpose: input.purpose,
            user_id: input.userId ?? null,
            device_id: input.deviceId ?? null,
          },
        ],
      },
    }),
    prisma.webAuthnChallenge.create({
      data: {
        challenge: input.challenge,
        purpose: input.purpose,
        user_id: input.userId,
        device_id: input.deviceId,
        rp_id: input.rpID,
        origin: input.origin,
        expires_at: new Date(now.getTime() + PASSKEY_CHALLENGE_TTL_MS),
      },
    }),
  ]);
}

export async function takeChallenge(input: {
  purpose: "REGISTER" | "AUTHENTICATE";
  userId?: string;
  deviceId?: string;
}) {
  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: {
      purpose: input.purpose,
      user_id: input.userId ?? null,
      device_id: input.deviceId ?? null,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
  });
  if (!challenge) return null;
  await prisma.webAuthnChallenge.delete({ where: { id: challenge.id } });
  return challenge;
}

export async function takeChallengeForDevice(input: {
  purpose: "REGISTER" | "AUTHENTICATE";
  deviceId: string;
}) {
  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: {
      purpose: input.purpose,
      device_id: input.deviceId,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
  });
  if (!challenge) return null;
  await prisma.webAuthnChallenge.delete({ where: { id: challenge.id } });
  return challenge;
}

function hashGrant(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasskeyGrant(userId: string, purpose: "ATTENDANCE" | "LOGIN") {
  const token = randomBytes(32).toString("base64url");
  await prisma.passkeyGrant.create({
    data: {
      token_hash: hashGrant(token),
      user_id: userId,
      purpose,
      expires_at: new Date(Date.now() + PASSKEY_GRANT_TTL_MS),
    },
  });
  return token;
}

export async function consumePasskeyGrant(token: string, purpose: "ATTENDANCE" | "LOGIN", expectedUserId?: string) {
  if (!token || token.length < 32) return null;
  const tokenHash = hashGrant(token);
  const now = new Date();
  const grant = await prisma.passkeyGrant.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  });
  if (
    !grant ||
    grant.purpose !== purpose ||
    grant.used_at ||
    grant.expires_at <= now ||
    (expectedUserId && grant.user_id !== expectedUserId) ||
    !grant.user.active ||
    !canUsePasskeyGrant(grant.user.role, purpose)
  ) {
    return null;
  }

  const consumed = await prisma.passkeyGrant.updateMany({
    where: { id: grant.id, used_at: null, expires_at: { gt: now } },
    data: { used_at: now },
  });
  return consumed.count === 1 ? grant.user : null;
}
