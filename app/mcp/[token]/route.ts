import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOfficeServer } from "@/lib/mcp/server";
import { enabled, digest, equalHash, audit } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function finish(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID");
  response.headers.set("Access-Control-Expose-Headers", "Retry-After, MCP-Protocol-Version");
  return response;
}
async function handle(request: Request, context: { params: Promise<{ token: string }> }) {
  const secret = process.env.MCP_URL_TOKEN;
  const { token } = await context.params;
  if (!enabled() || !secret || secret.length < 40 || !equalHash(token, digest(secret))) {
    audit("url.denied", { status: 404 });
    return finish(new Response(null, { status: 404 }));
  }
  if (request.method === "OPTIONS") return finish(new Response(null, { status: 204 }));
  try {
    if (!await consumeRate(`mcp-url:${digest(secret)}`, 60)) return finish(rateLimited());
    if (request.method !== "POST") return finish(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }));
    const server = createOfficeServer({ user_id: "url-connector", client_id: "url-connector" });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 32_768 });
    try {
      await server.connect(transport);
      // Never forward the secret URL to the SDK or its diagnostic messages.
      const sanitized = new Request("https://mcp.internal/mcp", { method: "POST", headers: request.headers, body: request.body, duplex: "half" } as RequestInit);
      const response = await transport.handleRequest(sanitized);
      audit("url.request", { status: response.status });
      return finish(response);
    } finally { await server.close(); }
  } catch { audit("url.failed", { status: 503 }); return finish(Response.json({ error: "temporarily_unavailable" }, { status: 503 })); }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
export const PUT = handle;
export const PATCH = handle;
