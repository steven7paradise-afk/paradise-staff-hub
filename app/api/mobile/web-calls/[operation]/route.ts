import { NextRequest, NextResponse } from "next/server";
import { POST as login } from "@/app/api/mobile/auth/login/route";
import { GET as getCalls, POST as postCalls } from "@/app/api/mobile/chat/calls/route";
import { GET as directory, POST as createRoom } from "@/app/api/mobile/chat/route";
import { revokeMobileSession } from "@/lib/mobile-auth";
import { chatActor } from "@/lib/chat-access";
import { webCallCookie, webCallOriginAllowed, webCallActionAllowed } from "@/lib/web-call-policy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ operation: string }> };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
function bridge(request: NextRequest, body?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  const token = request.cookies.get(webCallCookie)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const ip = request.headers.get("x-forwarded-for");
  if (ip) headers.set("x-forwarded-for", ip);
  return new NextRequest(request.url, { method: body === undefined ? "GET" : "POST", headers, body });
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const { operation } = await context.params;
    const req = bridge(request);
    if (operation === "session") {
      const user = await chatActor(req);
      return reply({ user: { id: user.id, name: user.name, photo_url: user.photo_url } });
    }
    if (operation === "calls") return getCalls(req);
    if (operation === "directory") {
      req.nextUrl.search = "?directory=1";
      return directory(req);
    }
    return reply({ error: "Operazione non disponibile." }, 404);
  } catch { return reply({ error: "Accedi con il tuo account MyParadise." }, 401); }
}
export async function POST(request: NextRequest, context: Context) {
  if (!webCallOriginAllowed(request.headers.get("origin"), request.nextUrl.origin)) return reply({ error: "Origine non consentita." }, 403);
  const { operation } = await context.params;
  const raw = await request.text();
  if (raw.length > 4000) return reply({ error: "Richiesta troppo grande." }, 413);
  let input;
  try { input = JSON.parse(raw || "{}"); } catch { return reply({ error: "Richiesta non valida." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ error: "Richiesta non valida." }, 400);
  if (operation === "login") {
    const res = await login(bridge(request, JSON.stringify({ email: input.email, password: input.password, deviceName: "MyParadise Web" })));
    const data = await res.json();
    if (!res.ok) return reply({ error: data.error }, res.status);
    const authenticated = new NextRequest(request.url, { headers: { authorization: `Bearer ${data.token}` } });
    try { await chatActor(authenticated); } catch {
      await revokeMobileSession(authenticated);
      return reply({ error: data.requiresPasswordChange ? "Aggiorna la password nell’app MyParadise prima di accedere." : "Accesso alle chiamate non consentito." }, 403);
    }
    await revokeMobileSession(bridge(request));
    const response = reply({ user: { id: data.user.id, name: data.user.name, photo_url: data.user.photoURL } });
    response.cookies.set(webCallCookie, data.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  }
  if (operation === "logout") {
    await revokeMobileSession(bridge(request));
    const response = reply({ success: true });
    response.cookies.set(webCallCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  }
  if (!webCallActionAllowed(operation, input.action)) return reply({ error: "Operazione non consentita." }, 400);
  if (operation === "directory") {
    if (input.kind !== "direct") return reply({ error: "Scegli un collega." }, 400);
    return createRoom(bridge(request, raw));
  }
  return postCalls(bridge(request, raw));
}
