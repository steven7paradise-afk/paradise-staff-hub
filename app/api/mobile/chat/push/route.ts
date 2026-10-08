import { NextRequest, NextResponse } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { mobileUser } from "@/lib/mobile-auth";
import { boundedJSON } from "@/lib/chat-files";
import { ChatError } from "@/lib/chat-policy";
import { chatDB as db } from "@/lib/chat-db";
import { chatPushReady, pushKey } from "@/lib/chat-push";
export async function POST(request: NextRequest) {
  try {
    const user = await chatActor(request);
    if (!chatPushReady()) throw new ChatError("Le notifiche della chat non sono ancora attivate sul server.", 503);
    const context = await mobileUser(request);
    if (!context) throw new ChatError("Sessione scaduta.", 401);
    const input = await boundedJSON(request, 2000);
    if (typeof input.token !== "string" || !/^[a-f0-9]{64,200}$/.test(input.token) || !["sandbox", "production"].includes(String(input.environment))) throw new ChatError("Dispositivo non valido.");
    const value = { token: input.token, environment: String(input.environment), userId: user.id, sessionId: context.session.id };
    await db.setting.upsert({ where: { key: pushKey(input.token) }, create: { key: pushKey(input.token), value }, update: { value } });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof ChatError ? e.message : "Registrazione notifiche non riuscita." }, { status: e instanceof ChatError ? e.status : 500 }); }
}
