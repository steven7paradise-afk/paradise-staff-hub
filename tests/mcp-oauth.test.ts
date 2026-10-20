import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { exchangeCode, refreshTokens, bearerIdentity, authenticateClient } from "../lib/mcp/oauth";
import { digest, opaque, resource } from "../lib/mcp/security";
import { consumeRate } from "../lib/mcp/rate-limit";
function patch(t: any, target: any, key: string, fn: (...args: any[]) => any) { const old = target[key]; target[key] = t.mock.fn(fn); t.after(() => { target[key] = old; }); return target[key]; }
const client: any = { id: "client", auth_method: "none", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
test("authorization code is single-use and bound to PKCE, redirect, resource and client", async t => {
  const verifier = opaque(), code = opaque(); let consumed = false, minted = 0;
  const authorization = { id: "auth", user_id: "admin", client_id: client.id, scope: "staff:read", resource: resource(), redirect_uri: client.redirect_uris[0], challenge: createHash("sha256").update(verifier).digest("base64url") };
  patch(t, prisma.setting, "findUnique", async () => null);
  patch(t, prisma.user, "findUnique", async () => ({ id: "admin", role: "ADMIN", active: true }));
  patch(t, prisma.mcpAuthorization, "findUnique", async ({ where }) => where.code_hash === digest(code) ? authorization : null);
  patch(t, prisma, "$transaction", async (run: any) => run({ mcpAuthorization: { updateMany: async ({ where }: any) => { assert.ok(where.expires_at.gt instanceof Date); if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; } }, mcpGrant: { create: async ({ data }: any) => data }, mcpToken: { create: async ({ data }: any) => { minted++; assert.notEqual(data.access_hash, code); } } }));
  const form = new URLSearchParams({ code, code_verifier: verifier, redirect_uri: client.redirect_uris[0], resource: resource() });
  for (const [key, value] of [["code_verifier", opaque()], ["resource", "https://evil.test/mcp"], ["redirect_uri", "https://evil.test/callback"]]) { const bad = new URLSearchParams(form); bad.set(key, value); assert.equal(await exchangeCode(client, bad), null); }
  assert.equal(await exchangeCode({ ...client, id: "other" }, form), null);
  assert.equal(minted, 0);
  const token = await exchangeCode(client, form); assert.ok(token?.refresh_token); assert.equal(token?.scope, "staff:read"); assert.equal(token?.expires_in, 900);
  assert.equal(await exchangeCode(client, form), null); assert.equal(minted, 1);
});
test("refresh tokens rotate and replay revokes the entire grant", async t => {
  let rotated = false, revoked = false;
  const token: any = { id: "old", grant_id: "grant", refresh_expires_at: new Date(Date.now()+60_000), grant: { id: "grant", user_id: "admin", client_id: client.id, scope: "staff:read", resource: resource(), expires_at: new Date(Date.now()+60_000), revoked_at: null } };
  patch(t, prisma.setting, "findUnique", async () => null);
  patch(t, prisma.user, "findUnique", async () => ({ role: "ADMIN", active: true }));
  patch(t, prisma.mcpToken, "findUnique", async () => token);
  patch(t, prisma, "$transaction", async (run: any) => run({ mcpToken: { updateMany: async () => { if (rotated) return { count: 0 }; rotated = true; return { count: 1 }; }, create: async () => ({}) }, mcpGrant: { update: async () => { revoked = true; } } }));
  const form = new URLSearchParams({ refresh_token: opaque(), resource: resource() });
  assert.ok((await refreshTokens(client, form))?.access_token);
  assert.equal(await refreshTokens(client, form), null); assert.equal(revoked, true);
});
test("bearer validation rejects expiration, scope/audience mismatch, revocation and removed admin role", async t => {
  const secret = opaque(); const token: any = { access_hash: digest(secret), access_expires_at: new Date(Date.now()+60_000), grant: { user_id: "admin", client_id: "client", expires_at: new Date(Date.now()+60_000), resource: resource(), scope: "staff:read", revoked_at: null } };
  let role = "ADMIN";
  patch(t, prisma.mcpToken, "findUnique", async () => token);
  patch(t, prisma.setting, "findUnique", async () => null);
  patch(t, prisma.user, "findUnique", async () => ({ role, active: true }));
  const request = new Request(resource(), { headers: { Authorization: `Bearer ${secret}` } });
  assert.ok(await bearerIdentity(request));
  role = "DIPENDENTE"; assert.equal(await bearerIdentity(request), null); role = "ADMIN";
  for (const [key, value] of [["resource", "https://evil.test/mcp"], ["scope", "staff:write"], ["revoked_at", new Date()], ["expires_at", new Date(0)]] as const) { const old = token.grant[key]; token.grant[key] = value; assert.equal(await bearerIdentity(request), null); token.grant[key] = old; }
  token.access_expires_at = new Date(0); assert.equal(await bearerIdentity(request), null);
  assert.equal(await bearerIdentity(new Request(`${resource()}?access_token=${secret}`)), null);
});
test("public and confidential clients cannot switch authentication methods", async t => {
  const secret = opaque(); let stored: any = { ...client, auth_method: "client_secret_basic", secret_hash: digest(secret) };
  patch(t, prisma.mcpClient, "findUnique", async () => stored);
  const form = new URLSearchParams({ client_id: "client", client_secret: secret });
  assert.equal(await authenticateClient(new Request(resource()), form), null);
  const request = new Request(resource(), { headers: { Authorization: `Basic ${Buffer.from(`client:${secret}`).toString("base64")}` } });
  assert.ok(await authenticateClient(request, new URLSearchParams()));
  assert.equal(await authenticateClient(request, new URLSearchParams({ client_id: "wrong" })), null);
  stored = client; assert.ok(await authenticateClient(new Request(resource()), new URLSearchParams({ client_id: "client" })));
});
test("distributed rate limiter rejects request 61 and resets in the next minute", async t => {
  const buckets = new Map<string, number>();
  patch(t, prisma, "$queryRaw", async (_strings, key) => { const count = (buckets.get(key) || 0) + 1; buckets.set(key, count); return [{ count }]; });
  for (let i=0;i<60;i++) assert.equal(await consumeRate("token:test", 60, 60_000), true);
  assert.equal(await consumeRate("token:test", 60, 60_000), false);
  assert.equal(await consumeRate("token:test", 60, 120_000), true);
});
test('old read-only admin grants and pending consents cannot acquire write scope',async t=>{
 const {adminResource}=await import('../lib/mcp/security');
 const code=opaque(),verifier=opaque();
 patch(t,prisma.mcpAuthorization,'findUnique',async()=>({id:'old',scope:'staff:admin:read',client_id:client.id,user_id:'admin',resource:adminResource(),redirect_uri:client.redirect_uris[0],challenge:createHash('sha256').update(verifier).digest('base64url')}));
 assert.equal(await exchangeCode(client,new URLSearchParams({code,code_verifier:verifier,redirect_uri:client.redirect_uris[0],resource:adminResource()})),null);
 patch(t,prisma.mcpToken,'findUnique',async()=>({grant:{client_id:client.id,resource:adminResource(),scope:'staff:admin:read'}}));
 assert.equal(await refreshTokens(client,new URLSearchParams({refresh_token:opaque(),resource:adminResource()})),null);
});
