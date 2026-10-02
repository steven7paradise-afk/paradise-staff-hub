import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Credentials belong in Coolify runtime secrets; never in the application bundle.
export async function sendWidgetUpdate(userId: string) {
  const keyId = process.env.APNS_KEY_ID;
  const team = process.env.APNS_TEAM_ID;
  const pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !team || !pem) return;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: team, iat: Math.floor(Date.now() / 1000) })}`;
  const jwt = `${input}.${sign("sha256", Buffer.from(input), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const devices = await prisma.setting.findMany({ where: { key: { startsWith: `mobile-widget-device:${userId}:` } } });
  await Promise.allSettled(devices.map(async device => {
    const value = device.value as { token: string; environment: string; sessionId: string };
    const session = await prisma.mobileSession.findUnique({ where: { id: value.sessionId }, include: { user: true } });
    if (!session || session.user_id !== userId || session.revoked_at || session.expires_at <= new Date() || !session.user.active || session.user.must_change_password) {
      await prisma.setting.deleteMany({ where: { key: device.key } }); return;
    }
    const status = await new Promise<number>((resolve) => {
      const client = connect(value.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
      const finish = (code: number) => { client.destroy(); resolve(code); };
      client.setTimeout(8000, () => finish(0));
      client.on("error", () => finish(0));
      const stream = client.request({ ":method": "POST", ":path": `/3/device/${value.token}`, authorization: `bearer ${jwt}`,
        "apns-topic": "it.paradisebeauty.myparadise.push-type.widgets", "apns-push-type": "widgets", "apns-priority": "5", "apns-collapse-id": "attendance", "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600) });
      let code = 0;
      stream.on("response", h => { code = Number(h[":status"]); });
      stream.on("data", () => {});
      stream.on("end", () => finish(code));
      stream.on("error", () => finish(0));
      stream.end(JSON.stringify({ aps: { "content-changed": true } }));
    });
    if (status === 410) await prisma.setting.deleteMany({ where: { key: device.key } });
    else if (status !== 200) console.warn("Widget push delivery failed", status);
  }));
}
