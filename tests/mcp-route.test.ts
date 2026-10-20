import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, GET, OPTIONS } from "../app/mcp/route";
import { protectedMetadata, authorizationMetadata } from "../lib/mcp/discovery";
import { prisma } from "../lib/prisma";
import { opaque, digest, resource } from "../lib/mcp/security";
function patch(t: any, target: any, key: string, fn: (...args: any[]) => any) { const old = target[key]; target[key] = t.mock.fn(fn); t.after(() => { target[key] = old; }); }
function enable(t: any) { const old = process.env.MCP_ENABLED; process.env.MCP_ENABLED = "true"; t.after(() => { if (old === undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED = old; }); }
test("disabled connector exposes no tools; no bearer gives MCP discovery challenge instead of login redirect", async t => {
  const old = process.env.MCP_ENABLED; process.env.MCP_ENABLED = "false";
  assert.equal((await POST(new Request(resource(), { method: "POST" }))).status, 503);
  process.env.MCP_ENABLED = "true";
  const r = await POST(new Request(resource(), { method: "POST" })); assert.equal(r.status, 401); assert.match(r.headers.get("WWW-Authenticate")!, /oauth-protected-resource\/mcp/); assert.equal(r.headers.get("Location"), null);
  if (old === undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED = old;
});
test("resource and authorization metadata agree on audience, scope, endpoints and PKCE", async () => {
  const p = await protectedMetadata().json(), a = await authorizationMetadata().json();
  assert.equal(p.resource, resource()); assert.deepEqual(p.authorization_servers, [a.issuer]); assert.deepEqual(a.code_challenge_methods_supported, ["S256"]); assert.deepEqual(a.scopes_supported, ["staff:read", "staff:admin"]); assert.ok(a.registration_endpoint);
});
test("route returns 429 and Retry-After, and authenticated GET has no persistent SSE", async t => {
  enable(t); patch(t, prisma.setting, "findUnique", async () => null); const secret = opaque(); let count = 61;
  patch(t, prisma.mcpToken, "findUnique", async () => ({ access_hash: digest(secret), access_expires_at: new Date(Date.now()+60_000), grant: { user_id: "admin", client_id: "client", scope: "staff:read", resource: resource(), expires_at: new Date(Date.now()+60_000), revoked_at: null } }));
  patch(t, prisma.user, "findUnique", async () => ({ role: "ADMIN", active: true }));
  patch(t, prisma, "$queryRaw", async () => [{ count }]);
  const headers = { Authorization: `Bearer ${secret}` };
  const limited = await POST(new Request(resource(), { method: "POST", headers })); assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "60");
  count = 1; assert.equal((await GET(new Request(resource(), { headers }))).status, 405);
});
test("unknown web origins are refused before token/database lookup", async t => {
  enable(t); patch(t, prisma.mcpToken, "findUnique", async () => { throw Error("Should not query"); });
  const r = new Request(resource(), { method: "POST", headers: { Origin: "https://evil.test" } });
  assert.equal((await POST(r)).status, 403); assert.equal((await OPTIONS(r)).status, 403);
});
