import { connect } from "node:http2";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { after } from "next/server";
import { chatDB as db } from "./chat-db";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
export const pushKey = (token: string) => `chat-device:${createHash("sha256").update(token).digest("hex")}`;
export function chatPushReady() {
  return process.env.CHAT_PUSH_ENABLED === "true" && !!process.env.APNS_KEY_ID && !!process.env.APNS_TEAM_ID && !!process.env.APNS_PRIVATE_KEY;
}
export function scheduleChatPush(messageId: string) {
  if (!chatPushReady()) return;
  after(async () => { try { await sendChatPush(messageId); } catch { console.warn("Chat push failed; message remains saved"); } });
}
export function chatPushPayload(message: { id: string; roomId: string; body: string; user: { id: string; name: string; photo_url: string | null }; room: { kind: string; title: string }; attachment: { mediaType: string; filename: string } | null }, badge: number) {
  const preview = message.attachment
    ? (message.attachment.mediaType.startsWith("image/") ? "📷 Foto" : `📎 ${message.attachment.filename}`)
    : message.body.trim();
  const body = Array.from(preview).slice(0, 180).join("") + (Array.from(preview).length > 180 ? "…" : "");
  return {
    aps: { alert: { title: Array.from(message.user.name).slice(0, 80).join(""), ...(message.room.kind !== "direct" ? { subtitle: Array.from(message.room.title).slice(0, 80).join("") } : {}), body: body || "Nuovo messaggio" }, sound: "default", badge, "thread-id": message.roomId, "mutable-content": 1 },
    senderId: message.user.id, senderPhoto: message.user.photo_url && message.user.photo_url.length < 1024 ? message.user.photo_url : null, isGroup: message.room.kind !== "direct",
    destination: "chat", roomId: message.roomId, messageId: message.id,
  };
}
export async function sendChatPush(messageId: string) {
  const message = await db.chatMessage.findUnique({ where: { id: messageId }, include: { user: { select: { id: true, name: true, photo_url: true } }, room: { select: { title: true, kind: true, archived: true } }, attachment: { select: { mediaType: true, filename: true } } } });
  if (!message || message.deletedAt || message.room.archived || !chatPushReady()) return;
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const input = `${encode({ alg: "ES256", kid: process.env.APNS_KEY_ID })}.${encode({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const jwt = `${input}.${sign("sha256", Buffer.from(input), { key: createPrivateKey(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const devices = await db.setting.findMany({ where: { key: { startsWith: "chat-device:" } } });
  for (const device of devices) {
    const value = device.value as { token: string; environment: string; sessionId: string; userId: string };
    const session = await db.mobileSession.findUnique({ where: { id: value.sessionId }, include: { user: true } });
    if (!session || session.user_id !== value.userId || session.revoked_at || session.expires_at <= new Date() || !session.user.active || session.user.must_change_password || session.user.employee_status === FORMER_EMPLOYEE_STATUS) {
      await db.setting.deleteMany({ where: { key: device.key, value: { equals: device.value! } } }); continue;
    }
    if (value.userId === message.userId) continue;
    const member = await db.chatMember.findUnique({ where: { roomId_userId: { roomId: message.roomId, userId: value.userId } } });
    if (!member || member.muted || member.lastReadAt >= message.createdAt) continue;
    const memberships = await db.chatMember.findMany({ where: { userId: value.userId, muted: false, room: { archived: false } }, select: { roomId: true, lastReadAt: true } });
    const badge = await db.chatMessage.count({ where: { userId: { not: value.userId }, deletedAt: null, OR: memberships.map(m => ({ roomId: m.roomId, createdAt: { gt: m.lastReadAt } })) } });
    const status = await new Promise<number>(resolve => {
      const client = connect(value.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
      let finished = false;
      const finish = (code: number) => { if (!finished) { finished = true; client.destroy(); resolve(code); } };
      client.setTimeout(8000, () => finish(0)); client.on("error", () => finish(0));
      const stream = client.request({ ":method": "POST", ":path": `/3/device/${value.token}`, authorization: `bearer ${jwt}`, "apns-topic": "it.paradisebeauty.myparadise", "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600) });
      let code = 0;
      stream.on("response", h => { code = Number(h[":status"]); }); stream.on("data", () => {});
      stream.on("end", () => finish(code)); stream.on("error", () => finish(0));
      stream.end(JSON.stringify(chatPushPayload(message, badge)));
    });
    if (status === 410) await db.setting.deleteMany({ where: { key: device.key, value: { equals: device.value! } } });
    console.info("Chat push delivery", message.id, status);
  }
}
