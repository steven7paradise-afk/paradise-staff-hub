import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/mcp/oauth";
import { digest, opaque, equalHash, enabled, issuer, resource, MCP_SCOPE, boundedBody, audit } from "@/lib/mcp/security";
import { consumeRate } from "@/lib/mcp/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "mcp_consent";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function browserError(reason: string, description: string, status = 400, target?: { redirect: string; state: string }, login?: string) {
  audit("consent.rejected", { reason, status });
  const back = target ? new URL(target.redirect) : null;
  if (back) {
    back.searchParams.set("error", status === 403 ? "access_denied" : "invalid_request");
    back.searchParams.set("error_description", description);
    if (target!.state) back.searchParams.set("state", target!.state);
  }
  // Invalid client/redirect must NEVER receive an OAuth redirect.
  if (back && status !== 403) return NextResponse.redirect(back, 303);
  return new NextResponse(`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizzazione Staff Hub</title><body><main><h1>Impossibile autorizzare il connettore</h1><p>${escape(description)}</p>${login ? `<p><a href="${escape(login)}">Accedi con un account amministratore</a></p>` : ""}${back ? `<p><a href="${escape(back.toString())}">Torna al connettore</a></p>` : ""}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
}
export async function GET(request: NextRequest) {
  if (!enabled()) return browserError("connector_disabled", "Il connettore è temporaneamente disabilitato.", 503);
  // Consent cookie and form POST must use the same configured origin.
  if (new URL(request.url).origin !== issuer()) return NextResponse.redirect(`${issuer()}/oauth/authorize${request.nextUrl.search}`);
  const q = request.nextUrl.searchParams;
  if ([...new Set(q.keys())].some(k => q.getAll(k).length !== 1)) return browserError("invalid_request", "La richiesta di autorizzazione non è valida.");
  const client = await prisma.mcpClient.findUnique({ where: { id: q.get("client_id") || "" } });
  const redirect = q.get("redirect_uri") || "";
  if (!client) return browserError("unknown_client", "Connettore non registrato. Rimuovilo e aggiungilo nuovamente in Claude.");
  if (!client.redirect_uris.includes(redirect)) return browserError("invalid_redirect_uri", "L’indirizzo di ritorno non corrisponde a quelli registrati per il connettore.");
  const target = { redirect, state: q.get("state") || "" };
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(q.get("code_challenge") || "")) return browserError("invalid_pkce", "È richiesto PKCE S256 con un code_challenge valido.", 400, target);
  if (q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(q.get("code_challenge") || "") || q.get("scope") !== MCP_SCOPE || q.get("resource") !== resource() || (q.get("state") || "").length > 2048) return browserError("invalid_oauth_parameters", "Controlla response_type, scope e resource della richiesta.", 400, target);
  const session = await auth();
  const login = `${issuer()}/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${q}`)}`;
  if (!session?.user?.id) { audit("consent.login_required", { reason: "missing_session", status: 307 }); return NextResponse.redirect(login); }
  const user = await currentAdmin(session.user.id);
  if (!user) {
    const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, active: true } });
    const reason = !account ? "session_user_not_found" : !account.active ? "inactive_user" : "insufficient_role";
    audit("consent.forbidden", { user_id: session.user.id, reason, role: account?.role, status: 403 });
    if (!account) return NextResponse.redirect(login);
    return browserError(reason, !account.active ? "L’account è disattivato. Contatta la direzione." : "L’account attualmente collegato non è amministratore. Accedi con il tuo account di direzione per autorizzare Claude.", 403, target, login);
  }
  if (!await consumeRate(`consent:${user.id}`, 20)) return browserError("rate_limited", "Troppe richieste. Riprova tra un minuto.", 429);
  const csrf = opaque();
  const ticket = await prisma.mcpAuthorization.create({ data: { id: opaque(), user_id: user.id, client_id: client.id, redirect_uri: redirect, challenge: q.get("code_challenge")!, resource: resource(), state: q.get("state") || "", csrf_hash: digest(csrf), expires_at: new Date(Date.now() + 10 * 60_000) } });
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Autorizza connettore | Paradise Staff Hub</title><style>body{font:16px system-ui;background:#faf5f8;color:#251c23;margin:0;padding:32px}main{max-width:540px;margin:5vh auto;background:white;border:1px solid #eadce4;padding:32px;border-radius:20px}h1{font-size:26px}p{line-height:1.6;overflow-wrap:anywhere}button{padding:14px 20px;border:1px solid #83415d;border-radius:10px;background:#83415d;color:white;cursor:pointer;margin:8px 8px 0 0}button[value=deny]{color:#42313b;background:white}</style></head><body><main><p>PARADISE STAFF HUB</p><h1>${["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"].includes(redirect) ? "Claude" : escape(client.name)} vuole leggere i dati dello Staff Hub in sola lettura</h1><p>Questo connettore potrà leggere il personale configurato, le presenze operative e le attività. Non potrà modificare dati.</p><p>Non vengono condivisi retribuzioni, informazioni sanitarie, motivi di assenza, documenti o contatti personali. I testi delle attività sono condivisi solo se approvati nelle impostazioni MCP.</p><p>Destinazione autorizzata: <strong>${escape(redirect)}</strong></p><p>Permesso: <strong>staff:read</strong>. Puoi revocare l’accesso dalle impostazioni MCP.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="ticket" value="${ticket.id}"><input type="hidden" name="csrf" value="${csrf}"><button name="decision" value="approve">Autorizza sola lettura</button><button name="decision" value="deny">Annulla</button></form></main></body></html>`;
  const response = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
  response.cookies.set(cookieName, csrf, { httpOnly: true, secure: issuer().startsWith("https:"), sameSite: "lax", path: "/oauth/authorize", maxAge: 600 });
  return response;
}
export async function POST(request: NextRequest) {
  if (!enabled()) return browserError("connector_disabled", "Il connettore è temporaneamente disabilitato.", 503);
  if (request.headers.get("origin") !== issuer()) return browserError("invalid_origin", "La richiesta proviene da una pagina non autorizzata. Riavvia il collegamento.", 403);
  const session = await auth();
  if (!session?.user?.id) return browserError("missing_session_on_consent", "La sessione è scaduta. Riavvia il collegamento da Claude e accedi nuovamente.", 403);
  if (!await currentAdmin(session.user.id)) { audit("consent.forbidden", { user_id: session.user.id, reason: "role_changed_on_consent", status: 403 }); return browserError("role_changed_on_consent", "L’account non ha più i permessi amministratore richiesti.", 403); }
  let form: URLSearchParams;
  try { form = new URLSearchParams(await boundedBody(request)); } catch { return browserError("invalid_body", "La richiesta non è valida."); }
  const ticket = await prisma.mcpAuthorization.findUnique({ where: { id: form.get("ticket") || "" } });
  const csrf = form.get("csrf") || "";
  if (!ticket || ticket.user_id !== session.user.id || ticket.expires_at <= new Date() || ticket.code_hash || ticket.consumed_at || !equalHash(csrf, ticket.csrf_hash) || csrf !== request.cookies.get(cookieName)?.value) return browserError("invalid_consent_ticket_or_csrf", "La conferma è scaduta o non è valida. Riavvia il collegamento da Claude.", 403);
  const approve = form.get("decision") === "approve";
  const code = opaque();
  const used = await prisma.mcpAuthorization.updateMany({ where: { id: ticket.id, code_hash: null, consumed_at: null, expires_at: { gt: new Date() } }, data: approve ? { code_hash: digest(code), expires_at: new Date(Date.now() + 60_000) } : { consumed_at: new Date() } });
  if (used.count !== 1) return browserError("invalid_consent_ticket_or_csrf", "La conferma è scaduta o non è valida. Riavvia il collegamento da Claude.", 403);
  const target = new URL(ticket.redirect_uri);
  target.searchParams.set(approve ? "code" : "error", approve ? code : "access_denied");
  if (!approve) target.searchParams.set("error_description", "Autorizzazione rifiutata dall’utente.");
  if (ticket.state) target.searchParams.set("state", ticket.state);
  audit(approve ? "consent.approved" : "consent.denied", { reason: approve ? "approved" : "user_denied", user_id: ticket.user_id, client_id: ticket.client_id, status: 303 });
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(cookieName, "", { path: "/oauth/authorize", maxAge: 0 });
  return response;
}
