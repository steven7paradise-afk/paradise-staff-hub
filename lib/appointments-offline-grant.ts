import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const OFFLINE_ACCESS_SECONDS = 24 * 60 * 60;
type Grant = { version: 1; workerId: string; device: string; credential: string; role: string; issuedAt: number; expiresAt: number };
export const offlineFingerprint = (value: string) => createHash("sha256").update(value).digest("hex");

function signature(payload: string, secret: string) {
  if (!secret) throw new Error("Configurazione accesso offline non disponibile.");
  return createHmac("sha256", secret).update(`paradise-offline-v1:${payload}`).digest();
}

export function issueOfflineGrant(workerId: string, deviceToken: string, pinHash: string, role: string, secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const grant: Grant = { version: 1, workerId, device: offlineFingerprint(deviceToken), credential: offlineFingerprint(pinHash), role, issuedAt, expiresAt: issuedAt + OFFLINE_ACCESS_SECONDS };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return { token: `${payload}.${signature(payload, secret).toString("base64url")}`, expiresAt: new Date(grant.expiresAt * 1000).toISOString() };
}

export function verifyOfflineGrant(token: string, deviceToken: string, secret: string, now = Date.now()): Grant | null {
  if (token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const expected = signature(parts[0], secret);
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const grant = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Grant;
    const seconds = Math.floor(now / 1000);
    if (grant.version !== 1 || typeof grant.workerId !== "string" || !grant.workerId || typeof grant.role !== "string"
      || !Number.isSafeInteger(grant.issuedAt) || !Number.isSafeInteger(grant.expiresAt)
      || grant.issuedAt > seconds || grant.expiresAt <= seconds
      || grant.expiresAt - grant.issuedAt !== OFFLINE_ACCESS_SECONDS
      || grant.device !== offlineFingerprint(deviceToken) || typeof grant.credential !== "string") return null;
    return grant;
  } catch { return null; }
}
