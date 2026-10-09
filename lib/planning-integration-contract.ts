import { createHmac, timingSafeEqual } from "node:crypto";

export function planningAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function planningSignature(body: string, timestamp: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function planningWebhookConfig(env: Record<string, string | undefined> = process.env) {
  const target = env.PLANNING_WEBHOOK_URL;
  const secret = env.PLANNING_WEBHOOK_SECRET;
  if (!target || !secret || secret.length < 32) return null;
  try {
    const url = new URL(target);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return { url: url.toString(), secret };
  } catch { return null; }
}


/** Returns true only after the receiver accepts the snapshot. */
export async function sendPlanningSnapshot(body: string, revision: number, config: {url: string; secret: string}, send: typeof fetch = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    try {
      const response = await send(config.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(5000), headers: {
        "Content-Type": "application/json", "X-Planning-Event-Id": `planning-${revision}`,
        "X-Planning-Timestamp": timestamp, "X-Planning-Signature": planningSignature(body, timestamp, config.secret),
      }, body });
      await response.body?.cancel();
      if (response.ok) return true;
      if (response.status < 500 && response.status !== 429) return false;
    } catch { /* Retry network errors; the caller retains pending state. */ }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
  return false;
}
