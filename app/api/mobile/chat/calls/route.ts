import { requireContactAllowed } from "@/lib/chat-safety";
import { NextRequest, NextResponse, after } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { chatDB as db } from "@/lib/chat-db";
import { boundedJSON } from "@/lib/chat-files";
import { ChatError, requireMember, text } from "@/lib/chat-policy";
import { callsReady, callToken, roomOperation } from "@/lib/call-livekit";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

import { mobileUser } from "@/lib/mobile-auth";
import { sendIncomingCall } from "@/lib/call-push";
import { chatPushReady } from "@/lib/chat-push";

export const dynamic = "force-dynamic";
type Call = { id: string; roomId: string; callerId: string; calleeId: string; callerName: string; calleeName: string; status: string; createdAt: number; expiresAt: number; callerSessionId?: string; acceptedSessionId?: string; callerPhoto?: string | null; calleePhoto?: string | null };
const key = (id: string) => `audio-call:${id}`;
const pointer = (id: string) => `audio-current:${id}`;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const ownsDevice = (c: Call, userId: string, sessionId: string) => userId === c.callerId ? !c.callerSessionId || c.callerSessionId === sessionId : !c.acceptedSessionId || c.acceptedSessionId === sessionId;
const isLive = (c: Call) => ["ringing", "active"].includes(c.status) && c.expiresAt > Date.now();
function failure(e: unknown) { return reply({ error: e instanceof ChatError ? e.message : "Chiamata non disponibile. Riprova." }, e instanceof ChatError ? e.status : 500); }
async function authorized(id: string, userId: string) {
  const row = await db.setting.findUnique({ where: { key: key(id) } });
  const call = row?.value as Call | undefined;
  if (!call || ![call.callerId, call.calleeId].includes(userId)) throw new ChatError("Chiamata non disponibile.", 404);
  requireMember(await db.chatMember.findUnique({ where: { roomId_userId: { roomId: call.roomId, userId } } }));
  return call;
}
export async function GET(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const context = await mobileUser(request);
    if (!context) throw new ChatError("Sessione scaduta.", 401);
    if (!callsReady()) return reply({ enabled: false, call: null });
    const current = await db.setting.findUnique({ where: { key: pointer(user.id) } });
    const id = request.nextUrl.searchParams.get("id")?.toLowerCase() ?? (current?.value as { id?: string } | undefined)?.id;
    const call = id ? await authorized(id, user.id) : null;
    return reply({ enabled: true, call: call && isLive(call) && ownsDevice(call, user.id, context.session.id) ? call : null });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const context = await mobileUser(request);
    if (!context) throw new ChatError("Sessione scaduta.", 401);
    if (!callsReady()) throw new ChatError("Le chiamate sono in preparazione.", 503);
    const input = await boundedJSON(request, 2000);
    const action = input.action;
    if (action === "start") {
      const roomId = text(input.roomId, 128, "Conversazione");
      const id = text(input.id, 36, "Chiamata").toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ChatError("Chiamata non valida.");
      const member = requireMember(await db.chatMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } }, include: { room: { include: { members: { include: { user: true } } } } } }));
      const other = member.room.members.find(m => m.userId !== user.id)?.user;
      if (member.room.kind !== "direct" || member.room.archived || member.room.members.length !== 2 || !other?.active || other.must_change_password || other.employee_status === FORMER_EMPLOYEE_STATUS) throw new ChatError("Le chiamate sono disponibili nelle chat private con colleghi attivi.");
      await requireContactAllowed(user.id, other.id);
      if (await db.setting.findUnique({ where: { key: `chat-suspended:${other.id}` } })) throw new ChatError("Collega non disponibile.", 403);
      let created = false;
      const call = await db.$transaction(async tx => {
        // Serialize starts so simultaneous calls cannot reserve the same colleague.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(71830952)::text`;
        const existing = await tx.setting.findUnique({ where: { key: key(id) } });
        if (existing) {
          const previous = existing.value as Call;
          if (previous.callerId !== user.id || previous.roomId !== roomId) throw new ChatError("Chiamata non disponibile.", 404);
          return previous;
        }
        for (const personId of [user.id, other.id]) {
          const current = await tx.setting.findUnique({ where: { key: pointer(personId) } });
          const previousId = (current?.value as { id?: string } | undefined)?.id;
          const previous = previousId ? await tx.setting.findUnique({ where: { key: key(previousId) } }) : null;
          if (previous && isLive(previous.value as Call)) throw new ChatError("Tu o il collega siete già in chiamata.", 409);
          if (personId === user.id && previous && Date.now() - (previous.value as Call).createdAt < 10000) throw new ChatError("Attendi qualche secondo prima di richiamare.", 429);
        }
        const value: Call = { id, roomId, callerId: user.id, calleeId: other.id, callerName: user.name, calleeName: other.name, callerSessionId: context.session.id, callerPhoto: user.photo_url, calleePhoto: other.photo_url, status: "ringing", createdAt: Date.now(), expiresAt: Date.now() + 45000 };
        await tx.setting.create({ data: { key: key(id), value } });
        created = true;
        for (const personId of [user.id, other.id]) await tx.setting.upsert({ where: { key: pointer(personId) }, create: { key: pointer(personId), value: { id } }, update: { value: { id } } });
        return value;
      });
      if (created && chatPushReady()) after(async () => { try { await sendIncomingCall(call); } catch { console.warn("VoIP push failed", call.id); } });
      return reply({ call });
    }
    const id = text(input.id, 36, "Chiamata").toLowerCase();
    const call = await authorized(id, user.id);
    if (!ownsDevice(call, user.id, context.session.id)) throw new ChatError("Chiamata gestita su un altro dispositivo.", 409);
    if (action === "end" || action === "decline") {
      if (action === "decline" && call.calleeId !== user.id) throw new ChatError("Operazione non consentita.", 403);
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(71830952)::text`;
        const latest = (await tx.setting.findUniqueOrThrow({ where: { key: key(id) } })).value as Call;
        if (!ownsDevice(latest, user.id, context.session.id)) throw new ChatError("Chiamata gestita su un altro dispositivo.", 409);
        await tx.setting.update({ where: { key: key(id) }, data: { value: { ...latest, status: "ended", expiresAt: Date.now() } } });
      });
      try { await roomOperation("DeleteRoom", id); } catch { console.warn("Call room cleanup pending", id); }
      return reply({ call: null });
    }
    if (!isLive(call)) throw new ChatError("La chiamata è terminata.", 410);
    if (action === "accept") {
      if (call.calleeId !== user.id) throw new ChatError("Operazione non consentita.", 403);
      await roomOperation("CreateRoom", id);
      const accepted = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(71830952)::text`;
        const latest = (await tx.setting.findUniqueOrThrow({ where: { key: key(id) } })).value as Call;
        if (!ownsDevice(latest, user.id, context.session.id)) throw new ChatError("Chiamata già risposta su un altro dispositivo.", 409);
        if (!isLive(latest)) throw new ChatError("La chiamata è terminata.", 410);
        const value = latest.status === "active" ? latest : { ...latest, status: "active", acceptedSessionId: context.session.id, expiresAt: Date.now() + 2 * 60 * 60 * 1000 };
        await tx.setting.update({ where: { key: key(id) }, data: { value } });
        return value;
      });
      return reply({ call: accepted });
    }
    if (action === "join" && call.status === "active") {
      return reply({ call, url: process.env.LIVEKIT_URL, token: callToken(user.id, { room: id, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: false, canPublishSources: ["microphone"] }) });
    }
    throw new ChatError("Operazione chiamata non valida.");
  } catch (e) { return failure(e); }
}
