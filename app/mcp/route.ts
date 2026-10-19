import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOfficeServer } from "@/lib/mcp/server";
import { bearerIdentity } from "@/lib/mcp/oauth";
import { enabled, issuer, allowedOrigin, audit, MCP_SCOPE } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function cors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigin(request)) { response.headers.set("Access-Control-Allow-Origin", origin); response.headers.set("Vary", "Origin"); }
  response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Retry-After, MCP-Protocol-Version");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
async function handle(request: Request) {
  if (!enabled()) return Response.json({ error: "MCP non abilitato" }, { status: 503 });
  if (!allowedOrigin(request)) return Response.json({ error: "Origin non consentita" }, { status: 403 });
  try {
    const identity = await bearerIdentity(request);
    if (!identity) { audit("request.unauthorized", { status: 401 }); return cors(request, Response.json({ error: "invalid_token" }, { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource/mcp", scope="${MCP_SCOPE}"` } })); }
    if (!await consumeRate(`mcp:${identity.tokenHash}`, 60)) { audit("request.limited", { user_id: identity.user_id, client_id: identity.client_id, status: 429 }); return cors(request, rateLimited()); }
    if (request.method !== "POST") return cors(request, new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }));
    const server = createOfficeServer({ user_id: identity.user_id, client_id: identity.client_id });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 32_768 });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      audit("request", { user_id: identity.user_id, client_id: identity.client_id, status: response.status });
      return cors(request, response);
    } finally { await server.close(); }
  } catch { audit("request.failed", { status: 503 }); return cors(request, Response.json({ error: "temporarily_unavailable" }, { status: 503 })); }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export async function OPTIONS(request: Request) {
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  const response = new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID" } });
  return cors(request, response);
}
