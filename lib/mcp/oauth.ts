import { prisma } from "@/lib/prisma";
import type { Prisma, McpClient } from "@prisma/client";
import { digest, equalHash, opaque, mayAuthorize, MCP_SCOPE, resource, validVerifier, scopeForResource } from "./security";
const ACCESS_MS = 15 * 60_000;
const REFRESH_MS = 30 * 24 * 60 * 60_000;
export async function currentAdmin(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, active: true, role: true } });
  return mayAuthorize(user) ? user : null;
}
export async function authenticateClient(request: Request, form: URLSearchParams): Promise<McpClient | null> {
  let id = form.get("client_id") || ""; let secret = form.get("client_secret") || "";
  let method = secret ? "client_secret_post" : "none";
  const header = request.headers.get("authorization");
  if (header) {
    if (!header.startsWith("Basic ") || secret) return null;
    try { const decoded = Buffer.from(header.slice(6), "base64").toString(); const split = decoded.indexOf(":"); if (split < 0) return null;
      const basicId = decodeURIComponent(decoded.slice(0, split)); if (id && id !== basicId) return null;
      id = basicId; secret = decodeURIComponent(decoded.slice(split + 1)); method = "client_secret_basic";
    } catch { return null; }
  }
  const client = await prisma.mcpClient.findUnique({ where: { id } });
  if (!client || client.auth_method !== method) return null;
  if (method !== "none" && (!client.secret_hash || !equalHash(secret, client.secret_hash))) return null;
  return client;
}
async function mint(tx: Prisma.TransactionClient, grantId: string, expiresAt: Date, now: Date, scope: string) {
  const access = opaque(), refresh = opaque();
  await tx.mcpToken.create({ data: { id: opaque(), grant_id: grantId, access_hash: digest(access), refresh_hash: digest(refresh), access_expires_at: new Date(now.getTime() + ACCESS_MS), refresh_expires_at: expiresAt } });
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_MS / 1000, scope };
}
export async function exchangeCode(client: McpClient, form: URLSearchParams) {
  const target = form.get("resource") || ""; const scope = scopeForResource(target);
  const code = form.get("code") || ""; if (!code || !scope) return null;
  const authorization = await prisma.mcpAuthorization.findUnique({ where: { code_hash: digest(code) } });
  if (!authorization || authorization.client_id !== client.id || authorization.resource !== target || authorization.redirect_uri !== form.get("redirect_uri") || !validVerifier(form.get("code_verifier") || "", authorization.challenge) || !await currentAdmin(authorization.user_id)) return null;
  const now = new Date();
  return prisma.$transaction(async tx => {
    const used = await tx.mcpAuthorization.updateMany({ where: { id: authorization.id, consumed_at: null, expires_at: { gt: now } }, data: { consumed_at: now } });
    if (used.count !== 1) return null;
    const grant = await tx.mcpGrant.create({ data: { id: opaque(), client_id: client.id, user_id: authorization.user_id, resource: target, scope, expires_at: new Date(now.getTime() + REFRESH_MS) } });
    return mint(tx, grant.id, grant.expires_at, now, scope);
  });
}
export async function refreshTokens(client: McpClient, form: URLSearchParams) {
  const target = form.get("resource") || ""; const scope = scopeForResource(target);
  if (!scope || (form.has("scope") && form.get("scope") !== scope)) return null;
  const token = await prisma.mcpToken.findUnique({ where: { refresh_hash: digest(form.get("refresh_token") || "") }, include: { grant: true } });
  if (!token || token.grant.client_id !== client.id || token.grant.resource !== target || !await currentAdmin(token.grant.user_id)) return null;
  const now = new Date();
  return prisma.$transaction(async tx => {
    if (token.grant.revoked_at || token.grant.expires_at <= now || token.refresh_expires_at <= now) return null;
    const used = await tx.mcpToken.updateMany({ where: { id: token.id, rotated_at: null }, data: { rotated_at: now } });
    if (used.count !== 1) {
      // Refresh-token replay revokes the entire family, including its latest token.
      await tx.mcpGrant.update({ where: { id: token.grant_id }, data: { revoked_at: now } });
      return null;
    }
    return mint(tx, token.grant_id, token.grant.expires_at, now, scope);
  });
}
export async function bearerIdentity(request: Request, target = resource()) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  const token = await prisma.mcpToken.findUnique({ where: { access_hash: digest(match[1]) }, include: { grant: true } });
  const now = new Date();
  if (!token || token.access_expires_at <= now || token.grant.expires_at <= now || token.grant.revoked_at || token.grant.scope !== scopeForResource(target) || token.grant.resource !== target || !await currentAdmin(token.grant.user_id)) return null;
  return { user_id: token.grant.user_id, client_id: token.grant.client_id, tokenHash: token.access_hash };
}
