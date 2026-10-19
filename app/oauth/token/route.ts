import { authenticateClient, exchangeCode, refreshTokens } from "@/lib/mcp/oauth";
import { enabled, oauthError, boundedBody, audit, allowedOrigin } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!enabled()) return oauthError("temporarily_unavailable", 503);
  if (!allowedOrigin(request)) return oauthError("access_denied", 403);
  if (!await consumeRate("token-global", 600)) return rateLimited();
  try {
    if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) return oauthError("invalid_request");
    const form = new URLSearchParams(await boundedBody(request));
    if ([...new Set(form.keys())].some(key => form.getAll(key).length !== 1)) return oauthError("invalid_request");
    const client = await authenticateClient(request, form);
    if (!client) return oauthError("invalid_client", 401);
    if (!await consumeRate(`token-client:${client.id}`, 60)) return rateLimited();
    const grant = form.get("grant_type");
    if (grant !== "authorization_code" && grant !== "refresh_token") return oauthError("unsupported_grant_type");
    const result = grant === "authorization_code" ? await exchangeCode(client, form) : await refreshTokens(client, form);
    audit("token.exchange", { client_id: client.id, status: result ? 200 : 400 });
    return result ? Response.json(result, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }) : oauthError("invalid_grant");
  } catch { audit("token.error", { status: 400 }); return oauthError("invalid_request"); }
}
