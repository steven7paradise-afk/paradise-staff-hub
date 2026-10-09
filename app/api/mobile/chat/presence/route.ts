import { NextRequest, NextResponse } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { mobileUser } from "@/lib/mobile-auth";
import { chatDB as db } from "@/lib/chat-db";
import { ChatError, requireMember } from "@/lib/chat-policy";
import { boundedJSON } from "@/lib/chat-files";
const reply = (value: object, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
const failure = (e: unknown) => reply({ error: e instanceof ChatError ? e.message : "Presenza non disponibile." }, e instanceof ChatError ? e.status : 500);
// Session-specific leases expire even if iOS suspends or terminates the app without an offline request.
export async function POST(request: NextRequest) {
  try {
    await chatActor(request);
    const context = await mobileUser(request);
    if (!context) throw new ChatError("Sessione scaduta.", 401);
    const input = await boundedJSON(request, 256);
    if (typeof input.active !== "boolean") throw new ChatError("Stato non valido.");
    if (input.roomId !== undefined) {
      if (typeof input.roomId !== "string" || input.roomId.length > 128) throw new ChatError("Conversazione non valida.");
      requireMember(await db.chatMember.findFirst({ where: { userId: context.user.id, roomId: input.roomId, room: { archived: false } } }));
      const key = `chat-typing:${input.roomId}:${context.session.id}`;
      const value = { expiresAt: input.active ? Date.now() + 6000 : 0 };
      await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      return reply({ success: true });
    }
    const key = `chat-presence:${context.session.id}`;
    const value = { expiresAt: input.active ? Date.now() + 25000 : 0 };
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return reply({ success: true });
  } catch (e) { return failure(e); }
}
export async function GET(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (roomId && roomId.length > 128) throw new ChatError("Conversazione non valida.");
    if (roomId) requireMember(await db.chatMember.findFirst({ where: { userId: user.id, roomId, room: { archived: false } } }));
    const members = await db.chatMember.findMany({ where: roomId ? { roomId } : { room: { archived: false, members: { some: { userId: user.id } } } }, select: { userId: true } });
    const sessions = await db.mobileSession.findMany({ where: { user_id: { in: members.map(m => m.userId) }, revoked_at: null, expires_at: { gt: new Date() }, user: { active: true, must_change_password: false } }, select: { id: true, user_id: true } });
    const records = await db.setting.findMany({ where: { key: { in: sessions.map(s => `chat-presence:${s.id}`) } } });
    const live = new Set(records.filter(r => Number((r.value as { expiresAt?: number })?.expiresAt) > Date.now()).map(r => r.key));
    const typing = await db.setting.findMany({ where: { key: { in: sessions.map(s => `chat-typing:${roomId}:${s.id}`) } } });
    const typingKeys = new Set(typing.filter(r => Number((r.value as { expiresAt?: number })?.expiresAt) > Date.now()).map(r => r.key));
    const typingUserIds = [...new Set(sessions.filter(s => live.has(`chat-presence:${s.id}`) && typingKeys.has(`chat-typing:${roomId}:${s.id}`)).map(s => s.user_id))];
    return reply({ typingUserIds, onlineUserIds: [...new Set(sessions.filter(s => live.has(`chat-presence:${s.id}`)).map(s => s.user_id))] });
  } catch (e) { return failure(e); }
}
