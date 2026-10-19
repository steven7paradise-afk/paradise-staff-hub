import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const MCP_SCOPE = "staff:read";
export const ADMIN_ROLES = ["ZERO", "SUPER_ADMIN", "ADMIN"];
export function mayAuthorize(user: { active: boolean; role: string } | null | undefined) {
  return Boolean(user?.active && ADMIN_ROLES.includes(user.role));
}
export function opaque() { return randomBytes(32).toString("base64url"); }
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function equalHash(value: string, hash: string) {
  const actual = Buffer.from(digest(value)); const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function validVerifier(verifier: string, challenge: string) {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) &&
    createHash("sha256").update(verifier).digest("base64url") === challenge;
}
export function issuer() {
  const value = process.env.MCP_PUBLIC_ORIGIN || "https://www.staff-paradise.tech";
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Invalid MCP_PUBLIC_ORIGIN");
  return url.origin;
}
export function resource() { return `${issuer()}/mcp`; }
export function enabled() { return process.env.MCP_ENABLED === "true"; }
export function validRedirect(value: string) {
  try { const url = new URL(value); return (url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))) && !url.username && !url.password && !url.hash; } catch { return false; }
}
export function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || [issuer(), "https://claude.ai", "https://claude.com"].includes(origin);
}
export function audit(event: string, data: { user_id?: string; client_id?: string; tool?: string; status?: number; duration_ms?: number; reason?: string; role?: string } = {}) {
  // No tokens, query strings, tool arguments, names or returned records in logs.
  console.info(JSON.stringify({ service: "staff-mcp", event, at: new Date().toISOString(), ...data }));
}
export function oauthError(error: string, status = 400) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
export async function boundedBody(request: Request, max = 16_384) {
  if (Number(request.headers.get("content-length")) > max) throw new Error("body_too_large");
  const reader = request.body?.getReader(); if (!reader) return "";
  const parts: Uint8Array[] = []; let length = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new Error("body_too_large"); } parts.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(parts).toString("utf8");
}
