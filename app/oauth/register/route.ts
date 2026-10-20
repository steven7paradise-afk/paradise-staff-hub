import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enabled, opaque, digest, validRedirect, oauthError, boundedBody, audit, MCP_SCOPE, ADMIN_SCOPE, allowedOrigin } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
const registration = z.object({
  client_name: z.string().trim().min(1).max(100).default("MCP client"),
  redirect_uris: z.array(z.string().max(2048).refine(validRedirect)).min(1).max(5),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
  scope: z.enum([MCP_SCOPE, ADMIN_SCOPE, `${MCP_SCOPE} ${ADMIN_SCOPE}`]).optional(),
});
export async function POST(request: Request) {
  if (!enabled()) return oauthError("temporarily_unavailable", 503);
  if (!allowedOrigin(request)) return oauthError("access_denied", 403);
  if (!await consumeRate("registration-global", 30)) return rateLimited();
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return oauthError("invalid_client_metadata");
    const input = registration.parse(JSON.parse(await boundedBody(request)));
    if (!input.grant_types.includes("authorization_code")) return oauthError("invalid_client_metadata");
    const secret = input.token_endpoint_auth_method === "none" ? null : opaque();
    const client = await prisma.mcpClient.create({ data: { id: opaque(), name: input.client_name, redirect_uris: input.redirect_uris, auth_method: input.token_endpoint_auth_method, secret_hash: secret ? digest(secret) : null } });
    audit("client.registered", { client_id: client.id, status: 201 });
    return Response.json({ client_id: client.id, client_id_issued_at: Math.floor(Date.now() / 1000), ...input, scope: input.scope || `${MCP_SCOPE} ${ADMIN_SCOPE}`, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return oauthError("invalid_client_metadata"); }
}
