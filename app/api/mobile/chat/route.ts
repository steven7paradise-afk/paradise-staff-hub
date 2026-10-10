import { chatReactions, summarizeReactions } from "@/lib/chat-reactions";
import { blockedPeers, requireRoomContact, requireContactAllowed, screenChatText } from "@/lib/chat-safety";
import { scheduleChatPush } from "@/lib/chat-push";
import { NextRequest, NextResponse } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { chatDB as db } from "@/lib/chat-db";
import { boundedJSON } from "@/lib/chat-files";
import { ChatError, text, roomInput, requireMember, requireOwnMessage } from "@/lib/chat-policy";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

export const dynamic = "force-dynamic";
const person = { id: true, name: true, photo_url: true } as const;
const messageUser = { replyTo: { select: { id: true, body: true, deletedAt: true, user: { select: person } } }, user: { select: person }, attachment: { select: { id: true, filename: true, mediaType: true, size: true } } } as const;
function response(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
async function membership(roomId: string, userId: string) {
  return requireMember(await db.chatMember.findUnique({ where: { roomId_userId: { roomId, userId } }, include: { room: true } }));
}
function failure(error: unknown) {
  if (error instanceof ChatError) return response({ error: error.message }, error.status);
  console.error("Chat operation failed", error instanceof Error ? error.name : "unknown");
  return response({ error: "Chat temporaneamente non disponibile. Riprova." }, 500);
}
export async function GET(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const blocked = await blockedPeers(user.id);
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (request.nextUrl.searchParams.get("directory") === "1") {
      const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
      const users = await db.user.findMany({ where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, id: { not: user.id }, name: { contains: q, mode: "insensitive" } }, select: { ...person, location: { select: { name: true } } }, orderBy: { name: "asc" }, take: 100 });
      return response({ users });
    }
    if (roomId) {
      const member = await membership(roomId, user.id);
      const before = request.nextUrl.searchParams.get("before");
      const cursor = before ? await db.chatMessage.findFirst({ where: { id: before, roomId } }) : null;
      if (before && !cursor) throw new ChatError("Messaggio non disponibile.", 404);
      const messages = await db.chatMessage.findMany({ where: { roomId, userId: { notIn: blocked }, ...(request.nextUrl.searchParams.get("media") === "1" ? { deletedAt: null, attachment: { isNot: null } } : {}), ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, include: messageUser, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
      const hasMore = messages.length > 50;
      const items = messages.slice(0, 50).reverse();
      const reactions = items.length ? await db.setting.findMany({ where: { OR: items.filter(m => !m.deletedAt).map(m => ({ key: { startsWith: `chat-reaction:${m.id}:` } })) }, select: { value: true } }) : [];
      const readers = await db.chatMember.findMany({ where: { roomId, userId: { not: user.id } }, select: { lastReadAt: true } });
      return response({ blockedUserIds: blocked, messages: items.map(message => ({ ...message, reactions: message.deletedAt ? [] : summarizeReactions(reactions, message.id, user.id, blocked), replyTo: message.replyTo && blocked.includes(message.replyTo.user.id) ? null : message.replyTo, readByAll: message.userId === user.id && readers.length > 0 && readers.every(reader => reader.lastReadAt >= message.createdAt) })), hasMore, archived: member.room.archived, manager: member.manager });
    }
    const memberships = await db.chatMember.findMany({ where: { userId: user.id }, include: { room: { include: { members: { include: { user: { select: person } } }, messages: { where: { userId: { notIn: blocked } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 } } } }, orderBy: { room: { updatedAt: "desc" } }, take: 200 });
    const rooms = await Promise.all(memberships.map(async ({ room, lastReadAt, muted, manager }) => ({
      id: room.id, title: room.kind === "direct" ? room.members.find(m => m.userId !== user.id)?.user.name ?? "Chat privata" : room.title,
      kind: room.kind, archived: room.archived, muted, manager, updatedAt: room.updatedAt,
      members: room.members.map(m => m.user), lastMessage: room.messages[0]?.body ?? null,
      unread: await db.chatMessage.count({ where: { roomId: room.id, userId: { not: user.id, notIn: blocked }, deletedAt: null, createdAt: { gt: lastReadAt } } }),
    })));
    return response({ rooms });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const input = await boundedJSON(request, 20000);
    if (input.action === "create") {
      const data = roomInput(input, user);
      screenChatText(data.title);
      for (const peer of data.members) if (peer !== user.id) await requireContactAllowed(user.id, peer);
      const count = await db.user.count({ where: { id: { in: data.members }, active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } } });
      if (count !== data.members.length) throw new ChatError("Uno dei partecipanti non è disponibile.");
      const create = { title: data.title, kind: data.kind, directKey: data.directKey, members: { create: data.members.map(id => ({ userId: id, manager: id === user.id })) } };
      const room = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`;
        const recent = await tx.chatRoom.count({ where: { createdAt: { gt: new Date(Date.now() - 60000) }, members: { some: { userId: user.id, manager: true } } } });
        if (recent >= 10) throw new ChatError("Troppe conversazioni create. Attendi un minuto.", 429);
        return data.directKey ? tx.chatRoom.upsert({ where: { directKey: data.directKey }, create, update: {} }) : tx.chatRoom.create({ data: create });
      });
      return response({ id: room.id });
    }
    const roomId = text(input.roomId, 128, "Conversazione");
    const member = await membership(roomId, user.id);
    if (input.action === "read") {
      const messageId = text(input.messageId, 128, "Messaggio");
      const seen = await db.chatMessage.findFirst({ where: { id: messageId, roomId } });
      if (!seen) throw new ChatError("Messaggio non disponibile.", 404);
      await db.chatMember.updateMany({ where: { roomId, userId: user.id, lastReadAt: { lt: seen.createdAt } }, data: { lastReadAt: seen.createdAt } });
      return response({ success: true });
    }
    if (input.action === "mute") {
      if (typeof input.muted !== "boolean") throw new ChatError("Preferenza non valida.");
      await db.chatMember.update({ where: { roomId_userId: { roomId, userId: user.id } }, data: { muted: input.muted } });
      return response({ success: true });
    }
    if (input.action === "archive" || input.action === "rename") {
      if (!member.manager || member.room.kind === "direct") throw new ChatError("Operazione non consentita.", 403);
      if (input.action === "rename") screenChatText(text(input.title, 80, "Nome"));
      await db.chatRoom.update({ where: { id: roomId }, data: input.action === "archive" ? { archived: true } : { title: text(input.title, 80, "Nome") } });
      return response({ success: true });
    }
    if (input.action === "react") {
      if (member.room.archived) throw new ChatError("La conversazione è archiviata.", 409);
      await requireRoomContact(roomId, user.id);
      const messageId = text(input.messageId, 128, "Messaggio");
      const emoji = input.emoji;
      if (emoji !== null && !chatReactions.includes(emoji as typeof chatReactions[number])) throw new ChatError("Reazione non valida.");
      const blocked = await blockedPeers(user.id);
      const target = await db.chatMessage.findFirst({ where: { id: messageId, roomId, deletedAt: null, userId: { notIn: blocked } } });
      if (!target) throw new ChatError("Messaggio non disponibile.", 404);
      const key = `chat-reaction:${messageId}:${user.id}`;
      if (emoji === null) await db.setting.deleteMany({ where: { key } });
      else { const value = { messageId, userId: user.id, emoji: String(emoji) }; await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }); }
      const rows = await db.setting.findMany({ where: { key: { startsWith: `chat-reaction:${messageId}:` } }, select: { value: true } });
      return response({ reactions: summarizeReactions(rows, messageId, user.id, blocked) });
    }
    if (input.action === "forward") {
      if (member.room.archived) throw new ChatError("La conversazione di destinazione è archiviata.", 409);
      await requireRoomContact(roomId, user.id);
      const messageId = text(input.messageId, 128, "Messaggio");
      const sourceRoomId = text(input.sourceRoomId, 128, "Conversazione originale");
      const clientId = text(input.clientId, 128, "Identificativo");
      await membership(sourceRoomId, user.id);
      await requireRoomContact(sourceRoomId, user.id);
      const blocked = await blockedPeers(user.id);
      let createdNow = false;
      const message = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`;
        const destination = requireMember(await tx.chatMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } }, include: { room: true } }));
        if (destination.room.archived) throw new ChatError("La conversazione è archiviata.", 409);
        requireMember(await tx.chatMember.findUnique({ where: { roomId_userId: { roomId: sourceRoomId, userId: user.id } } }));
        const existing = await tx.chatMessage.findUnique({ where: { userId_clientId: { userId: user.id, clientId } }, include: messageUser });
        if (existing) { if (existing.roomId !== roomId) throw new ChatError("Identificativo già utilizzato.", 409); return existing; }
        const source = await tx.chatMessage.findFirst({ where: { id: messageId, roomId: sourceRoomId, deletedAt: null, userId: { notIn: blocked } }, include: { attachment: true } });
        if (!source) throw new ChatError("Messaggio originale non disponibile.", 404);
        const recent = await tx.chatMessage.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
        if (recent >= 30) throw new ChatError("Troppi messaggi. Attendi un minuto.", 429);
        screenChatText(source.body);
        const file = source.attachment;
        if (file) {
          const quota = await tx.chatAttachment.aggregate({ where: { message: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86400000) } } }, _sum: { size: true } });
          if ((quota._sum.size ?? 0) + file.size > 100 * 1024 * 1024) throw new ChatError("Limite allegati giornaliero raggiunto (100 MB).", 429);
        }
        const created = await tx.chatMessage.create({ data: { roomId, userId: user.id, clientId, body: source.body, ...(file ? { attachment: { create: { filename: file.filename, mediaType: file.mediaType, size: file.size, data: file.data } } } : {}) }, include: messageUser });
        await tx.chatRoom.update({ where: { id: roomId }, data: { updatedAt: created.createdAt } });
        createdNow = true; return created;
      });
      if (createdNow) scheduleChatPush(message.id);
      return response({ message });
    }
    if (input.action === "send" || input.action === "edit") await requireRoomContact(roomId, user.id);
    if (member.room.archived) throw new ChatError("La conversazione è archiviata.", 409);
    if (input.action === "send") {
      const body = text(input.body, 4000, "Messaggio");
      screenChatText(body);
      const clientId = text(input.clientId, 128, "Identificativo");
      const replyToId = input.replyToId == null ? null : text(input.replyToId, 128, "Messaggio citato");
      let createdNow = false;
    const message = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`;
        const duplicate = await tx.chatMessage.findUnique({ where: { userId_clientId: { userId: user.id, clientId } }, include: messageUser });
        if (duplicate) {
          if (duplicate.roomId !== roomId) throw new ChatError("Identificativo già utilizzato.", 409);
          return duplicate;
        }
        const count = await tx.chatMessage.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
        if (count >= 30) throw new ChatError("Troppi messaggi. Attendi un minuto.", 429);
        // Check membership again inside the write transaction.
        requireMember(await tx.chatMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } }));
        if (replyToId && !await tx.chatMessage.findFirst({ where: { id: replyToId, roomId, deletedAt: null } })) {
          throw new ChatError("Il messaggio citato non è più disponibile.", 404);
        }
        const created = await tx.chatMessage.create({ data: { roomId, userId: user.id, body, clientId, replyToId }, include: messageUser });
        await tx.chatRoom.update({ where: { id: roomId }, data: { updatedAt: created.createdAt } });
        createdNow = true;
      return created;
      });
    if (createdNow) scheduleChatPush(message.id);
      return response({ message });
    }
    if (input.action === "edit" || input.action === "delete") {
      const id = text(input.messageId, 128, "Messaggio");
      const existing = await db.chatMessage.findFirst({ where: { id, roomId } });
      if (!existing) throw new ChatError("Messaggio non disponibile.", 404);
      requireOwnMessage(existing.userId, user.id);
      if (input.action === "edit") screenChatText(text(input.body, 4000, "Messaggio"));
      if (existing.deletedAt) throw new ChatError("Messaggio già eliminato.", 409);
      await db.$transaction(async tx => {
        if (input.action === "delete") await tx.chatAttachment.deleteMany({ where: { messageId: id } });
        await tx.chatMessage.update({ where: { id }, data: input.action === "delete" ? { body: "Messaggio eliminato", deletedAt: new Date() } : { body: text(input.body, 4000, "Messaggio"), editedAt: new Date() } });
      });
      return response({ success: true });
    }
    throw new ChatError("Operazione non valida.");
  } catch (error) { return failure(error); }
}
