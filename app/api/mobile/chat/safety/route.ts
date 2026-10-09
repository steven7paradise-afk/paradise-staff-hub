import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { chatActor } from "@/lib/chat-access";
import { chatDB as db } from "@/lib/chat-db";
import { boundedJSON } from "@/lib/chat-files";
import { ChatError, requireMember, text } from "@/lib/chat-policy";
import { blockKey, safetyModerators } from "@/lib/chat-safety";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
type Report = { id: string; reporterId: string; targetId: string; messageId: string; reason: string; status: string; createdAt: string; resolvedBy?: string; resolution?: string };
const fail = (e: unknown) => reply({ error: e instanceof ChatError ? e.message : "Operazione non disponibile." }, e instanceof ChatError ? e.status : 500);
export async function GET(request: NextRequest) {
  try {
    const user = await chatActor(request);
    if (request.nextUrl.searchParams.get("reports") === "1") {
      if (!safetyModerators.has(user.role)) throw new ChatError("Operazione non consentita.", 403);
      const rows = await db.setting.findMany({ where: { key: { startsWith: "chat-report:" }, value: { path: ["status"], equals: "open" } }, orderBy: { key: "asc" }, take: 200 });
      const reports = await Promise.all(rows.map(async row => {
        const value = row.value as Report;
        // Moderators see only explicitly reported messages, never the entire private room.
        const message = await db.chatMessage.findUnique({ where: { id: value.messageId }, select: { body: true, deletedAt: true, user: { select: { name: true } }, attachment: { select: { id: true, filename: true, mediaType: true, size: true } } } });
        return { ...value, author: message?.user.name ?? "Utente non disponibile", body: message?.deletedAt ? "Messaggio rimosso" : message?.body ?? "Messaggio non disponibile", filename: message?.attachment?.filename, attachment: message?.deletedAt ? null : message?.attachment };
      }));
      const suspendedRows = await db.setting.findMany({ where: { key: { startsWith: "chat-suspended:" } }, take: 200 });
      const suspended = await db.user.findMany({ where: { id: { in: suspendedRows.map(r => r.key.slice("chat-suspended:".length)) } }, select: { id: true, name: true } });
      return reply({ reports, suspended });
    }
    const target = text(request.nextUrl.searchParams.get("targetId"), 128, "Utente");
    return reply({ blocked: !!await db.setting.findUnique({ where: { key: blockKey(user.id, target) } }) });
  } catch (e) { return fail(e); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await chatActor(request);
    const input = await boundedJSON(request, 2500);
    if (input.action === "block" || input.action === "unblock") {
      const target = text(input.targetId, 128, "Utente");
      if (target === user.id) throw new ChatError("Utente non valido.");
      requireMember(await db.chatMember.findFirst({ where: { userId: target, room: { members: { some: { userId: user.id } } } } }));
      const key = blockKey(user.id, target);
      if (input.action === "block") await db.setting.upsert({ where: { key }, create: { key, value: { owner: user.id, target } }, update: {} });
      else await db.setting.deleteMany({ where: { key } });
      return reply({ success: true });
    }
    if (input.action === "report") {
      const messageId = text(input.messageId, 128, "Messaggio");
      const reason = text(input.reason, 1000, "Motivo");
      const message = await db.chatMessage.findFirst({ where: { id: messageId, userId: { not: user.id }, room: { members: { some: { userId: user.id } } } } });
      if (!message) throw new ChatError("Messaggio non disponibile.", 404);
      const id = createHash("sha256").update(JSON.stringify([user.id, messageId])).digest("hex");
      const key = `chat-report:${id}`;
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`;
        if (await tx.setting.findUnique({ where: { key } })) return;
        const recent = await tx.setting.count({ where: { key: { startsWith: "chat-report:" }, AND: [{ value: { path: ["reporterId"], equals: user.id } }, { value: { path: ["createdAt"], gte: new Date(Date.now() - 3600000).toISOString() } }] } });
        if (recent >= 20) throw new ChatError("Troppe segnalazioni. Riprova più tardi.", 429);
        const value: Report = { id, reporterId: user.id, targetId: message.userId, messageId, reason, status: "open", createdAt: new Date().toISOString() };
        await tx.setting.create({ data: { key, value } });
        const admins = await tx.user.findMany({ where: { active: true, role: { in: [...safetyModerators] } }, select: { id: true } });
        await tx.notification.createMany({ data: admins.map(a => ({ user_id: a.id, title: "Nuova segnalazione chat", message: "Una segnalazione richiede verifica. Apri Profilo → Segnalazioni chat in MyParadise.", type: "CHAT_REPORT" })) });
      });
      return reply({ success: true });
    }
    if (input.action === "restore") {
      if (!safetyModerators.has(user.role)) throw new ChatError("Operazione non consentita.", 403);
      const target = text(input.targetId, 128, "Utente");
      await db.setting.deleteMany({ where: { key: `chat-suspended:${target}` } });
      return reply({ success: true });
    }
    if (input.action === "resolve") {
      if (!safetyModerators.has(user.role)) throw new ChatError("Operazione non consentita.", 403);
      const key = `chat-report:${text(input.reportId, 64, "Segnalazione")}`;
      const resolution = text(input.resolution, 20, "Esito");
      if (!["dismiss", "remove", "suspend"].includes(resolution)) throw new ChatError("Esito non valido.");
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
        const row = await tx.setting.findUnique({ where: { key } });
        if (!row) throw new ChatError("Segnalazione non disponibile.", 404);
        const value = row.value as Report;
        if (value.status !== "open") return;
        if (resolution !== "dismiss") {
          await tx.chatAttachment.deleteMany({ where: { messageId: value.messageId } });
          await tx.chatMessage.updateMany({ where: { id: value.messageId }, data: { body: "Contenuto rimosso dalla moderazione", deletedAt: new Date() } });
        }
        if (resolution === "suspend") {
          if (value.targetId === user.id) throw new ChatError("La segnalazione deve essere gestita da un altro amministratore.", 403);
          const suspendedKey = `chat-suspended:${value.targetId}`;
          await tx.setting.upsert({ where: { key: suspendedKey }, create: { key: suspendedKey, value: { reportId: value.id, by: user.id } }, update: { value: { reportId: value.id, by: user.id } } });
        }
        await tx.setting.update({ where: { key }, data: { value: { ...value, status: "closed", resolution, resolvedBy: user.id, resolvedAt: new Date().toISOString() } } });
        await tx.notification.create({ data: { user_id: value.reporterId, title: "Segnalazione esaminata", message: resolution === "dismiss" ? "La segnalazione è stata esaminata senza rimuovere il contenuto. Puoi contattare l’assistenza per chiarimenti." : "La moderazione ha rimosso il contenuto segnalato.", type: "CHAT_REPORT" } });
      });
      return reply({ success: true });
    }
    throw new ChatError("Operazione non valida.");
  } catch (e) { return fail(e); }
}
