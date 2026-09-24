import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS, hasFormerEmployeeDocumentAccess } from "@/lib/former-employee";

const SESSION_DAYS = 180;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export async function createMobileSession(userId: string, deviceName?: string, lifetimeMs = SESSION_DAYS * 24 * 60 * 60 * 1000) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await prisma.mobileSession.create({
    data: {
      user_id: userId,
      token_hash: tokenHash(token),
      device_name: deviceName?.trim().slice(0, 120) || null,
      expires_at: expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function mobileUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const session = await prisma.mobileSession.findUnique({
    where: { token_hash: tokenHash(token) },
    include: { user: { include: { location: true } } },
  });
  if (!session || session.revoked_at || session.expires_at <= new Date() || !session.user.active) return null;
  if (
    session.user.employee_status === FORMER_EMPLOYEE_STATUS &&
    !hasFormerEmployeeDocumentAccess(session.user.workforce_data, session.user.last_edited_at)
  ) return null;

  if (Date.now() - session.last_used_at.getTime() > 15 * 60 * 1000) {
    void prisma.mobileSession.update({
      where: { id: session.id },
      data: { last_used_at: new Date() },
    }).catch(() => null);
  }
  return { session, user: session.user };
}

export async function revokeMobileSession(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) return;
  await prisma.mobileSession.updateMany({
    where: { token_hash: tokenHash(token), revoked_at: null },
    data: { revoked_at: new Date() },
  });
}
