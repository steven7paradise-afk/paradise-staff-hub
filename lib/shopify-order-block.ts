import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDER_BLOCK_STATES = {
  NEW: "Da ordinare", PREPARING: "In preparazione", ORDERED: "Ordinato · in arrivo",
  READY: "Pronto · azione richiesta", COMPLETED: "Consegnato",
} as const;
export type OrderBlockState = keyof typeof ORDER_BLOCK_STATES;
export function isOrderBlockState(value: unknown): value is OrderBlockState {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORDER_BLOCK_STATES, value);
}
export function verifyOrderBlockToken(token: string, config: { secret: string; clientId: string; shop: string; users: string[] }, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3 || !config.secret || !config.clientId || !config.shop || token.length > 16000) throw new Error("Unauthorized");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  if (header.alg !== "HS256") throw new Error("Unauthorized");
  const signature = Buffer.from(parts[2], "base64url");
  const expected = createHmac("sha256", config.secret).update(`${parts[0]}.${parts[1]}`).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error("Unauthorized");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const seconds = now / 1000;
  if (claims.aud !== config.clientId || claims.dest !== `https://${config.shop}` || claims.iss !== `https://${config.shop}/admin` ||
      typeof claims.exp !== "number" || claims.exp <= seconds || typeof claims.nbf !== "number" || claims.nbf > seconds + 5 ||
      typeof claims.sub !== "string" || !config.users.includes(claims.sub)) throw new Error("Unauthorized");
  return claims.sub as string;
}
export function orderReference(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).trim().match(/^#?(\d+)$/);
  return match ? match[1] : null;
}
