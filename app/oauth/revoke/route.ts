import { prisma } from "@/lib/prisma";
import { authenticateClient } from "@/lib/mcp/oauth";
import { enabled, oauthError, boundedBody, digest, allowedOrigin, audit } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export async function POST(request: Request) {
  if (!enabled()) return oauthError("temporarily_unavailable", 503);
  if (!allowedOrigin(request)) return oauthError("access_denied", 403);
  if (!await consumeRate("revoke-global", 120)) return rateLimited();
  try {
    const form = new URLSearchParams(await boundedBody(request));
    const client = await authenticateClient(request, form);
    if (!client) return oauthError("invalid_client", 401);
    const hash = digest(form.get("token") || "");
    const token = await prisma.mcpToken.findFirst({ where: { OR: [{ access_hash: hash }, { refresh_hash: hash }], grant: { client_id: client.id } } });
    if (token) await prisma.mcpGrant.update({ where: { id: token.grant_id }, data: { revoked_at: new Date() } });
    audit("token.revoked", { client_id: client.id, status: 200 });
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch { return oauthError("invalid_request"); }
}
