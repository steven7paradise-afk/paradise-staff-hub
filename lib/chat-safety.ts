import type { UserRole } from "@prisma/client";
import { createHash } from "node:crypto";
import { chatDB as db } from "./chat-db";
import { ChatError } from "./chat-policy";
export const safetyModerators = new Set<UserRole>(["ADMIN", "SUPER_ADMIN", "ZERO"]);
export const blockKey = (owner: string, target: string) => `chat-block:${createHash("sha256").update(JSON.stringify([owner, target])).digest("hex")}`;
export async function blockedPeers(userId: string) {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "chat-block:" }, OR: [{ value: { path: ["owner"], equals: userId } }, { value: { path: ["target"], equals: userId } }] } });
  return rows.map(row => { const v = row.value as { owner: string; target: string }; return v.owner === userId ? v.target : v.owner; });
}
export async function requireContactAllowed(a: string, b: string) {
  if (await db.setting.findFirst({ where: { key: { in: [blockKey(a, b), blockKey(b, a)] } } })) throw new ChatError("Questa conversazione è bloccata.", 403);
}
export async function requireRoomContact(roomId: string, userId: string) {
  const room = await db.chatRoom.findUnique({ where: { id: roomId }, include: { members: { select: { userId: true } } } });
  if (room?.kind === "direct") for (const member of room.members) if (member.userId !== userId) await requireContactAllowed(userId, member.userId);
}
// Basic text screening complements user reports and human moderation; it is not an image classifier.
export function screenChatText(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (/\b(ti ammazzo|ti uccido|kill yourself|i will kill you)\b/u.test(normalized)) throw new ChatError("Il contenuto contiene espressioni non consentite. Riformula il messaggio.");
}
