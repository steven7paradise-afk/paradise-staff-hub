import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { webLinkHash as hash, webLinkAllowed, type WebLink as Link } from "@/lib/web-link-policy";
import { prisma } from "@/lib/prisma";
import { chatActor } from "@/lib/chat-access";
import { mobileUser } from "@/lib/mobile-auth";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { webCallCookie, webCallOriginAllowed } from "@/lib/web-call-policy";
import { boundedJSON } from "@/lib/chat-files";

export const dynamic = "force-dynamic";
const secure = process.env.NODE_ENV === "production";
const cookie = secure ? "__Host-myparadise-link" : "myparadise-link";
const valid = (s: string) => /^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(s);
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  try {
    const input = await boundedJSON(request, 2000) as { action?: string; code?: string; id?: string };
    const action = input.action;
    if (action !== "approve" && !webCallOriginAllowed(request.headers.get("origin"), request.nextUrl.origin, request.headers.get("host"))) return response({ error: "Origine non consentita." }, 403);
    if (action === "create") {
      const now = Date.now();
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const limit = attempts.get(ip) ?? { count: 0, until: now + 900000 };
      if (++limit.count > 30) return response({ error: "Troppi codici richiesti. Riprova tra qualche minuto." }, 429);
      attempts.set(ip, limit);
      const id = randomUUID(), proof = randomBytes(32).toString("base64url"), browser = randomBytes(32).toString("base64url");
      const expires = now + 180000;
      await prisma.setting.deleteMany({ where: { key: { startsWith: "web-link:" }, value: { path: ["expires"], lt: now } } });
      await prisma.setting.create({ data: { key: `web-link:${id}`, value: { proof: hash(proof), browser: hash(browser), expires } } });
      const res = response({ id, qr: `https://my.staff-paradise.tech/my-staff/link#${id}.${proof}`, verification: id.slice(0, 6).toUpperCase(), expires });
      res.cookies.set(cookie, `${id}.${browser}`, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 180 });
      return res;
    }
    if (action !== "approve" && action !== "poll") return response({ error: "Operazione non disponibile." }, 400);
    const code = action === "approve" ? String(input.code ?? "") : request.cookies.get(cookie)?.value ?? "";
    if (!valid(code)) return response({ error: "Codice scaduto. Genera un nuovo QR." }, 410);
    const [id, secret] = code.split(".");
    if (action === "poll" && input.id !== id) return response({ error: "Il QR è stato sostituito in un’altra scheda. Generane uno nuovo." }, 410);
    const actor = action === "approve" ? await chatActor(request) : null;
    const context = actor ? await mobileUser(request) : null;
    const result = await prisma.$transaction(async tx => {
      const key = `web-link:${id}`;
      await tx.$queryRaw`SELECT id FROM settings WHERE key = ${key} FOR UPDATE`;
      const row = await tx.setting.findUnique({ where: { key } });
      const link = row?.value as Link | undefined;
      if (!link || !webLinkAllowed(link, secret, action === "approve" ? "proof" : "browser")) return response({ error: "Codice scaduto o non valido." }, 410);
      if (actor && context) {
        if (link.userId) return response({ error: "Questo QR è già stato confermato." }, 409);
        await tx.setting.update({ where: { key }, data: { value: { ...link, userId: actor.id, sessionId: context.session.id } } });
        return response({ success: true });
      }
      if (!link.userId) return response({ pending: true });
      const user = await tx.user.findUnique({ where: { id: link.userId } });
      const phoneSession = link.sessionId ? await tx.mobileSession.findUnique({ where: { id: link.sessionId } }) : null;
      const suspended = await tx.setting.findUnique({ where: { key: `chat-suspended:${link.userId}` } });
      if (!user?.active || user.must_change_password || user.employee_status === FORMER_EMPLOYEE_STATUS || suspended || !phoneSession || phoneSession.revoked_at || phoneSession.expires_at <= new Date() || process.env.INTERNAL_CHAT_ENABLED === "false") {
        await tx.setting.delete({ where: { key } });
        return response({ error: "Accesso non consentito. Controlla il tuo profilo nell’app." }, 403);
      }
      const token = randomBytes(32).toString("base64url");
      await tx.mobileSession.create({ data: { user_id: user.id, token_hash: hash(token), device_name: "MyParadise Web · QR", expires_at: new Date(Date.now() + 28800000) } });
      const previous = request.cookies.get(webCallCookie)?.value;
      if (previous) await tx.mobileSession.updateMany({ where: { token_hash: hash(previous), revoked_at: null }, data: { revoked_at: new Date() } });
      await tx.setting.delete({ where: { key } });
      const res = response({ user: { id: user.id, name: user.name, photo_url: user.photo_url } });
      res.cookies.set(webCallCookie, token, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 28800 });
      res.cookies.set(cookie, "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0 });
      return res;
    });
    return result;
  } catch (error) { console.error("Web link failed", error instanceof Error ? error.name : "Unknown", typeof error === "object" && error && "code" in error ? error.code : ""); return response({ error: "Collegamento non disponibile. Riprova dall’app MyParadise." }, 400); }
}
