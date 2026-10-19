import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/mcp/oauth";
import { digest, opaque, equalHash, enabled, issuer, resource, MCP_SCOPE, oauthError, boundedBody, audit } from "@/lib/mcp/security";
import { consumeRate, rateLimited } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "mcp_consent";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export async function GET(request: NextRequest) {
  if (!enabled()) return oauthError("temporarily_unavailable", 503);
  const q = request.nextUrl.searchParams;
  if ([...new Set(q.keys())].some(k => q.getAll(k).length !== 1)) return oauthError("invalid_request");
  const client = await prisma.mcpClient.findUnique({ where: { id: q.get("client_id") || "" } });
  const redirect = q.get("redirect_uri") || "";
  if (!client || !client.redirect_uris.includes(redirect)) return oauthError("invalid_request");
  if (q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(q.get("code_challenge") || "") || q.get("scope") !== MCP_SCOPE || q.get("resource") !== resource() || (q.get("state") || "").length > 2048) return oauthError("invalid_request");
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${issuer()}/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${q}`)}`);
  const user = await currentAdmin(session.user.id);
  if (!user) { audit("consent.forbidden", { user_id: session.user.id, status: 403 }); return oauthError("access_denied", 403); }
  if (!await consumeRate(`consent:${user.id}`, 20)) return rateLimited();
  const csrf = opaque();
  const ticket = await prisma.mcpAuthorization.create({ data: { id: opaque(), user_id: user.id, client_id: client.id, redirect_uri: redirect, challenge: q.get("code_challenge")!, resource: resource(), state: q.get("state") || "", csrf_hash: digest(csrf), expires_at: new Date(Date.now() + 10 * 60_000) } });
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Autorizza connettore | Paradise Staff Hub</title><style>body{font:16px system-ui;background:#faf5f8;color:#251c23;margin:0;padding:32px}main{max-width:540px;margin:5vh auto;background:white;border:1px solid #eadce4;padding:32px;border-radius:20px}h1{font-size:26px}p{line-height:1.6;overflow-wrap:anywhere}button{padding:14px 20px;border:1px solid #83415d;border-radius:10px;background:#83415d;color:white;cursor:pointer;margin:8px 8px 0 0}button[value=deny]{color:#42313b;background:white}</style></head><body><main><p>PARADISE STAFF HUB</p><h1>Collega ${escape(client.name)}</h1><p>Questo connettore potrà leggere il personale configurato, le presenze operative e le attività. Non potrà modificare dati.</p><p>Non vengono condivisi retribuzioni, informazioni sanitarie, motivi di assenza, documenti o contatti personali. I testi delle attività sono condivisi solo se approvati nelle impostazioni MCP.</p><p>Destinazione autorizzata: <strong>${escape(redirect)}</strong></p><p>Permesso: <strong>staff:read</strong>. Puoi revocare l’accesso dalle impostazioni MCP.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="ticket" value="${ticket.id}"><input type="hidden" name="csrf" value="${csrf}"><button name="decision" value="approve">Autorizza sola lettura</button><button name="decision" value="deny">Annulla</button></form></main></body></html>`;
  const response = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
  response.cookies.set(cookieName, csrf, { httpOnly: true, secure: issuer().startsWith("https:"), sameSite: "lax", path: "/oauth/authorize", maxAge: 600 });
  return response;
}
export async function POST(request: NextRequest) {
  if (!enabled()) return oauthError("temporarily_unavailable", 503);
  if (request.headers.get("origin") !== issuer()) return oauthError("access_denied", 403);
  const session = await auth();
  if (!session?.user?.id || !await currentAdmin(session.user.id)) return oauthError("access_denied", 403);
  let form: URLSearchParams;
  try { form = new URLSearchParams(await boundedBody(request)); } catch { return oauthError("invalid_request"); }
  const ticket = await prisma.mcpAuthorization.findUnique({ where: { id: form.get("ticket") || "" } });
  const csrf = form.get("csrf") || "";
  if (!ticket || ticket.user_id !== session.user.id || ticket.expires_at <= new Date() || ticket.code_hash || ticket.consumed_at || !equalHash(csrf, ticket.csrf_hash) || csrf !== request.cookies.get(cookieName)?.value) return oauthError("access_denied", 403);
  const approve = form.get("decision") === "approve";
  const code = opaque();
  const used = await prisma.mcpAuthorization.updateMany({ where: { id: ticket.id, code_hash: null, consumed_at: null, expires_at: { gt: new Date() } }, data: approve ? { code_hash: digest(code), expires_at: new Date(Date.now() + 60_000) } : { consumed_at: new Date() } });
  if (used.count !== 1) return oauthError("access_denied", 403);
  const target = new URL(ticket.redirect_uri);
  target.searchParams.set(approve ? "code" : "error", approve ? code : "access_denied");
  if (ticket.state) target.searchParams.set("state", ticket.state);
  audit(approve ? "consent.approved" : "consent.denied", { user_id: ticket.user_id, client_id: ticket.client_id, status: 303 });
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(cookieName, "", { path: "/oauth/authorize", maxAge: 0 });
  return response;
}
