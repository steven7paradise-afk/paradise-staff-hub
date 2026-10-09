import { blockedPeers } from "./chat-safety";
import { connect } from "node:http2";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { chatDB as db } from "./chat-db";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
import { chatPushReady } from "./chat-push";
export const voipKey = (token: string) => `voip-device:${createHash("sha256").update(token).digest("hex")}`;
export type IncomingCall = { id: string; callerId: string; calleeId: string; callerName: string; status: string; expiresAt: number };
export function voipPayload(call: IncomingCall) {
  // VoIP pushes represent new calls only. No cancellation or chat pushes on this channel.
  return { aps: { "content-available": 1 }, callId: call.id, callerName: call.callerName, calleeId: call.calleeId };
}
export async function sendIncomingCall(call: IncomingCall) {
  if (!chatPushReady() || call.status !== "ringing" || call.expiresAt <= Date.now()) return;
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const data = `${encode({ alg: "ES256", kid: process.env.APNS_KEY_ID })}.${encode({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const jwt = `${data}.${sign("sha256", Buffer.from(data), { key: createPrivateKey(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const devices = await db.setting.findMany({ where: { key: { startsWith: "voip-device:" } } });
  await Promise.all(devices.map(async device => {
    const value = device.value as { token: string; environment: string; sessionId: string; userId: string };
    if (value.userId !== call.calleeId) return;
    const session = await db.mobileSession.findUnique({ where: { id: value.sessionId }, include: { user: true } });
    if (!session || session.user_id !== value.userId || session.revoked_at || session.expires_at <= new Date() || !session.user.active || session.user.must_change_password || session.user.employee_status === FORMER_EMPLOYEE_STATUS) {
      await db.setting.deleteMany({ where: { key: device.key, value: { equals: device.value! } } }); return;
    }
    if ((await blockedPeers(value.userId)).includes(call.callerId) || await db.setting.findUnique({ where: { key: `chat-suspended:${value.userId}` } })) return;
    const member = await db.chatMember.findFirst({ where: { userId: value.userId, room: { members: { some: { userId: call.callerId } }, kind: "direct", archived: false } } });
    if (!member) return;
    const latest = await db.setting.findUnique({ where: { key: `audio-call:${call.id}` } });
    if ((latest?.value as IncomingCall | undefined)?.status !== "ringing") return;
    const status = await new Promise<number>(resolve => {
      const client = connect(value.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
      let done = false;
      const finish = (code: number) => { if (!done) { done = true; client.destroy(); resolve(code); } };
      client.setTimeout(5000, () => finish(0)); client.on("error", () => finish(0));
      const stream = client.request({ ":method": "POST", ":path": `/3/device/${value.token}`, authorization: `bearer ${jwt}`, "apns-topic": "it.paradisebeauty.myparadise.voip", "apns-push-type": "voip", "apns-priority": "10", "apns-expiration": "0" });
      let code = 0;
      stream.on("response", h => { code = Number(h[":status"]); }); stream.on("data", () => {});
      stream.on("end", () => finish(code)); stream.on("error", () => finish(0));
      stream.end(JSON.stringify(voipPayload(call)));
    });
    if (status === 410) await db.setting.deleteMany({ where: { key: device.key, value: { equals: device.value! } } });
    console.info("VoIP delivery", call.id, status);
  }));
}
