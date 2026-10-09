import { safetyModerators, blockedPeers, requireRoomContact, screenChatText } from "@/lib/chat-safety";
import { scheduleChatPush } from "@/lib/chat-push";
import { NextRequest, NextResponse } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { chatDB as db } from "@/lib/chat-db";
import { ChatError, text, requireMember } from "@/lib/chat-policy";
import { boundedJSON, validateChatFile } from "@/lib/chat-files";
export const dynamic = "force-dynamic";
function fail(error: unknown) {
  return NextResponse.json({ error: error instanceof ChatError ? error.message : "Allegato non disponibile." }, { status: error instanceof ChatError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const input = await boundedJSON(request, 7_100_000);
    const roomId = text(input.roomId, 128, "Conversazione");
    const clientId = text(input.clientId, 128, "Identificativo");
    const member = requireMember(await db.chatMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } }, include: { room: true } }));
    if (member.room.archived) throw new ChatError("La conversazione è archiviata.", 409);
    await requireRoomContact(roomId, user.id);
    const file = validateChatFile(input.filename, input.data);
    screenChatText(file.filename);
    if (file.mediaType === "text/plain") screenChatText(file.data.toString("utf8"));
    let createdNow = false;
    const message = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`;
      const existing = await tx.chatMessage.findUnique({ where: { userId_clientId: { userId: user.id, clientId } } });
      if (existing) {
        if (existing.roomId !== roomId) throw new ChatError("Identificativo già utilizzato.", 409);
        return existing;
      }
      const recent = await tx.chatMessage.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
      if (recent >= 30) throw new ChatError("Troppi messaggi. Attendi un minuto.", 429);
      const quota = await tx.chatAttachment.aggregate({ where: { message: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86400000) } } }, _sum: { size: true } });
      if ((quota._sum.size ?? 0) + file.size > 100 * 1024 * 1024) throw new ChatError("Limite allegati giornaliero raggiunto (100 MB).", 429);
      const created = await tx.chatMessage.create({ data: { roomId, userId: user.id, clientId, body: file.filename, attachment: { create: file } } });
      await tx.chatRoom.update({ where: { id: roomId }, data: { updatedAt: created.createdAt } });
      createdNow = true;
      return created;
    });
    if (createdNow) scheduleChatPush(message.id);
    return NextResponse.json({ success: true, id: message.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}
export async function GET(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const blocked = await blockedPeers(user.id);
    const id = request.nextUrl.searchParams.get("id") ?? "";
    const reportId = request.nextUrl.searchParams.get("reportId");
    let reportedMessageId: string | undefined;
    if (reportId) {
      if (!safetyModerators.has(user.role)) throw new ChatError("Operazione non consentita.", 403);
      const report = await db.setting.findUnique({ where: { key: `chat-report:${reportId}` } });
      const value = report?.value as { status?: string; messageId?: string } | undefined;
      if (value?.status !== "open" || !value.messageId) throw new ChatError("Segnalazione non disponibile.", 404);
      reportedMessageId = value.messageId;
    }
    // Filter membership in the database before loading the bytes.
    const file = await db.chatAttachment.findFirst({ where: { id, message: reportedMessageId ? { id: reportedMessageId, deletedAt: null } : { userId: { notIn: blocked }, deletedAt: null, room: { members: { some: { userId: user.id } } } } } });
    if (!file) throw new ChatError("Allegato non disponibile.", 404);
    return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.mediaType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "Content-Length": String(file.size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return fail(error); }
}
